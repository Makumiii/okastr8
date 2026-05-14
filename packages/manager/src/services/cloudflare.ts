import { getSystemConfig } from "../config";
import { randomBytes } from "crypto";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

async function getCfAuth() {
    const config = await getSystemConfig();
    if (!config.cloudflare?.apiToken || !config.cloudflare?.accountId || !config.cloudflare?.zoneId) {
        throw new Error("Cloudflare credentials not configured");
    }
    return {
        token: config.cloudflare.apiToken,
        accountId: config.cloudflare.accountId,
        zoneId: config.cloudflare.zoneId,
        headers: {
            "Authorization": `Bearer ${config.cloudflare.apiToken}`,
            "Content-Type": "application/json"
        }
    };
}

async function cfFetch(url: string, options: RequestInit) {
    const response = await fetch(url, options);
    const data = await response.json() as any;
    if (!response.ok || !data.success) {
        throw new Error(`Cloudflare API Error: ${JSON.stringify(data.errors || data)}`);
    }
    return data;
}

export async function createTunnel(appName: string): Promise<{ id: string }> {
    const auth = await getCfAuth();
    // Tunnel secret must be exactly 32 bytes base64 encoded
    const tunnelSecret = randomBytes(32).toString("base64");
    
    const data = await cfFetch(`${CF_API_BASE}/accounts/${auth.accountId}/cfd_tunnel`, {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({
            name: `okastr8-${appName}`,
            tunnel_secret: tunnelSecret
        })
    });
    
    return { id: data.result.id };
}

export async function getTunnelToken(tunnelId: string): Promise<string> {
    const auth = await getCfAuth();
    const data = await cfFetch(`${CF_API_BASE}/accounts/${auth.accountId}/cfd_tunnel/${tunnelId}/token`, {
        method: "GET",
        headers: auth.headers
    });
    return data.result;
}

export async function deleteTunnel(tunnelId: string): Promise<void> {
    const auth = await getCfAuth();
    await cfFetch(`${CF_API_BASE}/accounts/${auth.accountId}/cfd_tunnel/${tunnelId}`, {
        method: "DELETE",
        headers: auth.headers
    });
}

export async function routeTunnel(tunnelId: string, hostname: string, targetService: string): Promise<void> {
    const auth = await getCfAuth();
    await cfFetch(`${CF_API_BASE}/accounts/${auth.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
        method: "PUT",
        headers: auth.headers,
        body: JSON.stringify({
            config: {
                ingress: [
                    {
                        hostname: hostname,
                        service: targetService,
                    },
                    {
                        service: "http_status:404"
                    }
                ]
            }
        })
    });
}

export async function createDnsRecord(hostname: string, tunnelId: string): Promise<{ id: string }> {
    const auth = await getCfAuth();
    const data = await cfFetch(`${CF_API_BASE}/zones/${auth.zoneId}/dns_records`, {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({
            type: "CNAME",
            name: hostname,
            content: `${tunnelId}.cfargotunnel.com`,
            proxied: true,
            comment: "Managed by Okastr8"
        })
    });
    
    return { id: data.result.id };
}

export async function deleteDnsRecord(recordId: string): Promise<void> {
    const auth = await getCfAuth();
    await cfFetch(`${CF_API_BASE}/zones/${auth.zoneId}/dns_records/${recordId}`, {
        method: "DELETE",
        headers: auth.headers
    });
}
