import { cpus, freemem, totalmem, uptime as osUptime, loadavg, networkInterfaces } from 'os';
import { runCommand } from './command';
import { readFile } from 'fs/promises';

export interface SystemMetrics {
    cpu: {
        usage: number;     // Percentage (0-100)
        cores: number;
        model: string;
        speed: number;
    };
    memory: {
        used: number;      // MB
        total: number;     // MB
        percent: number;   // Percentage used
        free: number;      // MB
        available: number; // MB (estimated via free + buffers/cache - not strictly available in Node os module without parsing /proc/meminfo)
    };
    swap: {
        used: number;      // MB
        total: number;     // MB
        percent: number;
        swapping: boolean; // Heuristic based on recent calls? No, simplistic snapshot for now.
    };
    disk: {
        mounts: {
            mount: string;
            used: number;  // Bytes
            total: number; // Bytes
            percent: number;
            free: number;  // Bytes
        }[];
        io: {
            readPerSec: number;  // Bytes/sec (snapshot diff needed by caller or state?)
            writePerSec: number; // Bytes/sec
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
        totalRxPerSec: number; // Calculated by caller state or internally
        totalTxPerSec: number;
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

/**
 * Collect raw system metrics
 */
export async function getDetailedSystemMetrics(): Promise<SystemMetrics> {
    const uptimeSec = osUptime();
    const load = loadavg();
    const cpuList = cpus();
    const cores = cpuList.length;

    // 1. CPU Usage (Instantaneous Snapshot)
    // To get accurate %, we need two samples. For stateless call, we rely on load avg approximation or simple non-blocking trick if possible.
    // However, existing metrics.ts used load/cores. We can do better by reading /proc/stat if Linux.
    const cpuUsage = Math.min(100, ((load[0] || 0) / cores) * 100);

    // 2. Memory (parsing /proc/meminfo for accuracy on Linux)
    let memTotal = totalmem();
    let memFree = freemem();
    let memAvailable = memFree;
    let swapTotal = 0;
    let swapFree = 0;

    try {
        const memInfo = await readFile('/proc/meminfo', 'utf-8');
        const lines = memInfo.split('\n');
        const parseLine = (key: string) => {
            const line = lines.find(l => l.startsWith(key));
            if (!line) return 0;
            const match = line.match(/(\d+)/);
            return match ? parseInt(match[1], 10) * 1024 : 0; // kB to Bytes
        };

        const procMemTotal = parseLine('MemTotal:');
        if (procMemTotal > 0) memTotal = procMemTotal;

        memAvailable = parseLine('MemAvailable:');
        swapTotal = parseLine('SwapTotal:');
        swapFree = parseLine('SwapFree:');
    } catch {
        // Fallback to os module (already set defaults)
    }

    const memUsed = memTotal - memAvailable;
    const swapUsed = swapTotal - swapFree;

    // 3. Disk Usage (Multi-mount)
    const diskMounts = [];
    try {
        // df -B1 -P (Posix portability, bytes)
        const { stdout } = await runCommand('df', ['-B1', '-P']);
        const lines = stdout.trim().split('\n').slice(1);
        for (const line of lines) {
            const parts = line.split(/\s+/);
            // Filesystem 1024-blocks Used Available Capacity Mounted on
            // Need to handle spaces in mount points? df -P helps. 
            // parts[0] = fs, parts[1]=total, parts[2]=used, parts[3]=avail, parts[4]=cap, parts[5]=mount
            if (parts.length >= 6) {
                const mount = parts[5];
                // Critical mounts only for now to avoid spam (/, /home, /var)
                if (mount === '/' || (mount && (mount.startsWith('/home') || mount.startsWith('/var')))) {
                    const total = parseInt(parts[1] || '0', 10);
                    const used = parseInt(parts[2] || '0', 10);
                    const free = parseInt(parts[3] || '0', 10);
                    const percent = parseInt((parts[4] || '0').replace('%', ''), 10);

                    diskMounts.push({
                        mount,
                        total,
                        used,
                        free,
                        percent
                    });
                }
            }
        }
    } catch { }

    if (diskMounts.length === 0) {
        // Fallback root
        diskMounts.push({ mount: '/', total: 0, used: 0, free: 0, percent: 0 });
    }

    // 4. Network (/proc/net/dev)
    const netInterfaces = [];
    try {
        const netDev = await readFile('/proc/net/dev', 'utf-8');
        const lines = netDev.split('\n').slice(2); // Skip 2 header lines
        for (const line of lines) {
            if (!line.trim()) continue;
            const [namePart, dataPart] = line.split(':');
            if (!namePart || !dataPart) continue;

            const name = namePart.trim();
            if (name === 'lo') continue; // Skip loopback

            const stats = dataPart.trim().split(/\s+/).map(Number);
            // RX: bytes(0), packets(1), errs(2), drop(3)...
            // TX: bytes(8), packets(9), errs(10), drop(11)...
            if (stats.length >= 16) {
                netInterfaces.push({
                    name,
                    rxBytes: stats[0] || 0,
                    rxErrors: stats[2] || 0,
                    rxDropped: stats[3] || 0,
                    txBytes: stats[8] || 0,
                    txErrors: stats[10] || 0,
                    txDropped: stats[11] || 0
                });
            }
        }
    } catch { }

    return {
        cpu: {
            usage: parseFloat(cpuUsage.toFixed(1)),
            cores,
            model: (cpuList[0] && cpuList[0].model) ? cpuList[0].model : 'Unknown',
            speed: (cpuList[0] && cpuList[0].speed) ? cpuList[0].speed : 0
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
            swapping: false // Logic requires state tracking (diff)
        },
        disk: {
            mounts: diskMounts,
            io: { readPerSec: 0, writePerSec: 0 } // Requires state tracking
        },
        network: {
            interfaces: netInterfaces,
            totalRxPerSec: 0, // Requires state tracking
            totalTxPerSec: 0
        },
        load: {
            avg1: load[0] || 0,
            avg5: load[1] || 0,
            avg15: load[2] || 0
        },
        uptime: {
            seconds: uptimeSec,
            readable: formatUptime(uptimeSec)
        }
    };
}
