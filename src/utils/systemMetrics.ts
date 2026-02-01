import { cpus, freemem, totalmem, uptime as osUptime, loadavg, networkInterfaces } from 'os';
import { runCommand } from './command';
import { readFile } from 'fs/promises';

export interface SystemMetrics {
    cpu: {
        usage: number;     // Percentage (0-100)
        cores: number;
        model: string;
        speed: number;
        steal: number;     // Percentage
    };
    memory: {
        used: number;      // MB
        total: number;     // MB
        percent: number;   // Percentage used
        free: number;      // MB
        available: number; // MB
    };
    swap: {
        used: number;      // MB
        total: number;     // MB
        percent: number;
        inRate: number;    // MB/min
        outRate: number;   // MB/min
    };
    disk: {
        mounts: {
            mount: string;
            used: number;  // Bytes
            total: number; // Bytes
            percent: number;
            free: number;  // Bytes
            inodesPercent: number;
        }[];
        io: {
            readPerSec: number;
            writePerSec: number;
            busyPercent: number;
            latencyMs: number;
        };
    };
    network: {
        interfaces: {
            name: string;
            rxBytes: number;
            txBytes: number;
            rxErrors: number;
            txErrors: number;
            rxDropped: number;
            txDropped: number;
        }[];
        totalRxPerSec: number;
        totalTxPerSec: number;
        retransmits: number;
        activeConnections: number;
    };
    limits: {
        fileDescriptors: {
            used: number;
            total: number;
            percent: number;
        };
    };
    load: {
        avg1: number;
        avg5: number;
        avg15: number;
    };
    uptime: {
        seconds: number;
        readable: string;
    };
    health: {
        oomKills: number;
        unexpectedReboot: boolean;
        bootTime?: number; // Unix timestamp
    };
}

/**
 * Format uptime seconds to readable string
 */
export function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// State for calculating throughput (rates)
let lastState: {
    timestamp: number;
    cpu: { total: number; steal: number };
    network: Record<string, { rx: number; tx: number }>;
    swap: { in: number; out: number };
    disk: Record<string, { read: number; write: number; active: number }>;
} | null = null;

let bootTime: number | null = null;

/**
 * Collect raw system metrics
 */
export async function getDetailedSystemMetrics(): Promise<SystemMetrics> {
    const now = Date.now();
    const uptimeSec = osUptime();
    const load = loadavg();
    const cpuList = cpus();
    const cores = cpuList.length;

    // 1. CPU Usage & Steal
    let cpuUsage = Math.min(100, ((load[0] || 0) / cores) * 100);
    let cpuStealPercent = 0;
    try {
        const stat = await readFile('/proc/stat', 'utf-8');
        const statLines = stat.split('\n');

        // Boot time (Unix timestamp)
        const btimeLine = statLines.find(l => l.startsWith('btime '));
        bootTime = btimeLine ? parseInt(btimeLine.split(/\s+/)[1] || '0', 10) : 0;

        const cpuLine = statLines.find(l => l.startsWith('cpu '));
        if (cpuLine) {
            const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
            // user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
            const total = parts.reduce((a, b) => a + b, 0);
            const steal = parts[7] || 0;

            if (lastState && lastState.cpu) {
                const totalDelta = total - lastState.cpu.total;
                const stealDelta = steal - lastState.cpu.steal;
                if (totalDelta > 0) {
                    cpuStealPercent = (stealDelta / totalDelta) * 100;
                }
            }

            // Update boot time (btime)
            const btimeLine = stat.split('\n').find(l => l.startsWith('btime '));
            if (btimeLine) {
                const btime = parseInt(btimeLine.split(' ')[1] || '0', 10);
                if (bootTime && btime !== bootTime) {
                    // Unexpected reboot detected logic would go here or in monitor
                }
                bootTime = btime;
            }

            if (!lastState) lastState = { timestamp: now, cpu: { total, steal }, network: {}, swap: { in: 0, out: 0 }, disk: {} };
            else {
                lastState.cpu = { total, steal };
            }
        }
    } catch { }

    // 2. Memory & VMStat (OOM, Swap Rates)
    let memTotal = totalmem();
    let memFree = freemem();
    let memAvailable = memFree;
    let swapTotal = 0;
    let swapFree = 0;
    let oomKills = 0;
    let swapInRate = 0;
    let swapOutRate = 0;

    try {
        const memInfo = await readFile('/proc/meminfo', 'utf-8');
        const lines = memInfo.split('\n');
        const parseMem = (key: string) => {
            const line = lines.find(l => l.startsWith(key));
            return line ? parseInt(line.match(/(\d+)/)?.[1] || '0', 10) * 1024 : 0;
        };
        memAvailable = parseMem('MemAvailable:');
        swapTotal = parseMem('SwapTotal:');
        swapFree = parseMem('SwapFree:');

        const vmstat = await readFile('/proc/vmstat', 'utf-8');
        const vmLines = vmstat.split('\n');
        const parseVm = (key: string) => parseInt(vmLines.find(l => l.startsWith(key))?.split(/\s+/)[1] || '0', 10);

        oomKills = parseVm('oom_kill');
        const pswpin = parseVm('pswpin');
        const pswpout = parseVm('pswpout');

        if (lastState && lastState.swap) {
            const timeDeltaMin = (now - lastState.timestamp) / 60000;
            if (timeDeltaMin > 0) {
                swapInRate = Math.max(0, (pswpin - lastState.swap.in) * 4096 / 1024 / 1024 / timeDeltaMin); // pages to MB/min
                swapOutRate = Math.max(0, (pswpout - lastState.swap.out) * 4096 / 1024 / 1024 / timeDeltaMin);
            }
        }
        if (lastState) lastState.swap = { in: pswpin, out: pswpout };
    } catch { }

    const memUsed = memTotal - memAvailable;
    const swapUsed = swapTotal - swapFree;

    // 3. Disk Usage & Inodes & I/O
    const diskMounts = [];
    const EXCLUDED_FS_TYPES = ['squashfs', 'tmpfs', 'devtmpfs', 'overlay', 'proc', 'sysfs', 'cgroup', 'rpc_pipefs', 'securityfs', 'efivarfs', 'vfat'];
    const EXCLUDED_PATH_PREFIXES = ['/var/lib/snapd', '/snap', '/proc', '/sys', '/run', '/dev'];

    try {
        // Space usage
        const { stdout: spaceOut } = await runCommand('df', ['-B1', '-P', '-T']);
        const spaceLines = spaceOut.trim().split('\n').slice(1);

        // Inode usage
        const { stdout: inodeOut } = await runCommand('df', ['-i', '-P']);
        const inodeLines = inodeOut.trim().split('\n').slice(1);
        const inodeMap: Record<string, number> = {};
        for (const line of inodeLines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 6) inodeMap[parts[5]!] = parseInt((parts[4] || '0').replace('%', ''), 10);
        }

        for (const line of spaceLines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 7) {
                const fsType = parts[1];
                const mount = parts[6];
                if (!fsType || !mount || EXCLUDED_FS_TYPES.includes(fsType) || EXCLUDED_PATH_PREFIXES.some(p => mount.startsWith(p))) continue;

                diskMounts.push({
                    mount,
                    total: parseInt(parts[2] || '0', 10),
                    used: parseInt(parts[3] || '0', 10),
                    free: parseInt(parts[4] || '0', 10),
                    percent: parseInt((parts[5] || '0').replace('%', ''), 10),
                    inodesPercent: inodeMap[mount] || 0
                });
            }
        }
    } catch { }

    // Disk I/O (simplistic busy % and rates from /proc/diskstats)
    let diskReadRate = 0;
    let diskWriteRate = 0;
    let diskBusyPercent = 0;
    try {
        const stats = await readFile('/proc/diskstats', 'utf-8');
        const lines = stats.split('\n');
        let totalRead = 0, totalWrite = 0, totalActiveTime = 0;

        for (const line of lines) {
            const p = line.trim().split(/\s+/);
            if (p.length < 14) continue;
            // Filter for physical disks (sda, sdb, nvme, etc.)
            const dev = p[2] || '';
            if (!/^(sd[a-z]|nvme[0-9]n[0-9]|vd[a-z])[0-9]*$/.test(dev)) continue;

            totalRead += parseInt(p[5] || '0', 10) * 512; // sectors to bytes
            totalWrite += parseInt(p[9] || '0', 10) * 512;
            totalActiveTime += parseInt(p[12] || '0', 10); // ms spent doing I/O
        }

        if (lastState && lastState.disk) {
            const timeDeltaMs = now - lastState.timestamp;
            if (timeDeltaMs > 0) {
                diskReadRate = Math.max(0, (totalRead - (lastState.disk['_total']?.read || 0)) / (timeDeltaMs / 1000));
                diskWriteRate = Math.max(0, (totalWrite - (lastState.disk['_total']?.write || 0)) / (timeDeltaMs / 1000));
                diskBusyPercent = Math.min(100, ((totalActiveTime - (lastState.disk['_total']?.active || 0)) / timeDeltaMs) * 100);
            }
        }
        if (lastState) lastState.disk['_total'] = { read: totalRead, write: totalWrite, active: totalActiveTime };
    } catch { }

    // 4. Network Advanced (Retransmits, Connections)
    let retransmits = 0;
    let activeConnections = 0;
    let totalRxPerSec = 0;
    let totalTxPerSec = 0;
    const netInterfaces = [];
    const currentNet: Record<string, { rx: number; tx: number }> = {};

    try {
        const snmp = await readFile('/proc/net/snmp', 'utf-8');
        const tcpLine = snmp.split('\n').find(l => l.startsWith('Tcp: '))?.split(/\s+/);
        if (tcpLine) retransmits = parseInt(tcpLine[12] || '0', 10); // RetransSegs

        const netTcp = await readFile('/proc/net/tcp', 'utf-8');
        activeConnections = netTcp.split('\n').length - 2; // Subtract header and empty line

        const netDev = await readFile('/proc/net/dev', 'utf-8');
        const devLines = netDev.split('\n').slice(2);
        for (const line of devLines) {
            if (!line.trim()) continue;
            const [namePart, dataPart] = line.split(':');
            const name = namePart?.trim();
            if (!name || name === 'lo') continue;
            const stats = dataPart?.trim().split(/\s+/).map(Number);
            if (stats && stats.length >= 16) {
                const rx = stats[0] || 0, tx = stats[8] || 0;
                currentNet[name] = { rx, tx };
                netInterfaces.push({
                    name, rxBytes: rx, txBytes: tx,
                    rxErrors: stats[2] || 0, rxDropped: stats[3] || 0,
                    txErrors: stats[10] || 0, txDropped: stats[11] || 0
                });
            }
        }

        if (lastState && lastState.network) {
            const timeDeltaSec = (now - lastState.timestamp) / 1000;
            if (timeDeltaSec > 0) {
                for (const iface of netInterfaces) {
                    const prev = lastState.network[iface.name];
                    if (prev) {
                        totalRxPerSec += (iface.rxBytes - prev.rx) / timeDeltaSec;
                        totalTxPerSec += (iface.txBytes - prev.tx) / timeDeltaSec;
                    }
                }
            }
        }
        if (lastState) lastState.network = currentNet;
    } catch { }

    // 5. Limits (File Descriptors)
    let fdUsed = 0, fdTotal = 0, fdPercent = 0;
    try {
        const nr = await readFile('/proc/sys/fs/file-nr', 'utf-8');
        const p = nr.trim().split(/\s+/).map(Number);
        fdUsed = p[0] || 0;
        fdTotal = p[2] || 1;
        fdPercent = (fdUsed / fdTotal) * 100;
    } catch { }

    if (lastState) lastState.timestamp = now;

    return {
        cpu: {
            usage: parseFloat(cpuUsage.toFixed(1)),
            cores,
            model: cpuList[0]?.model || 'Unknown',
            speed: cpuList[0]?.speed || 0,
            steal: parseFloat(cpuStealPercent.toFixed(1))
        },
        memory: {
            used: Math.round(memUsed / 1024 / 1024),
            total: Math.round(memTotal / 1024 / 1024),
            percent: Math.round((memUsed / memTotal) * 100),
            free: Math.round(memFree / 1024 / 1024),
            available: Math.round(memAvailable / 1024 / 1024)
        },
        swap: {
            used: Math.round(swapUsed / 1024 / 1024),
            total: Math.round(swapTotal / 1024 / 1024),
            percent: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
            inRate: parseFloat(swapInRate.toFixed(1)),
            outRate: parseFloat(swapOutRate.toFixed(1))
        },
        disk: {
            mounts: diskMounts,
            io: {
                readPerSec: Math.round(diskReadRate),
                writePerSec: Math.round(diskWriteRate),
                busyPercent: parseFloat(diskBusyPercent.toFixed(1)),
                latencyMs: 0 // Placeholder
            }
        },
        network: {
            interfaces: netInterfaces,
            totalRxPerSec: Math.round(totalRxPerSec),
            totalTxPerSec: Math.round(totalTxPerSec),
            retransmits,
            activeConnections
        },
        limits: {
            fileDescriptors: { used: fdUsed, total: fdTotal, percent: parseFloat(fdPercent.toFixed(1)) }
        },
        load: { avg1: load[0] || 0, avg5: load[1] || 0, avg15: load[2] || 0 },
        uptime: { seconds: uptimeSec, readable: formatUptime(uptimeSec) },
        health: { oomKills, unexpectedReboot: false, bootTime: bootTime || undefined } // Logic in monitor
    };
}
