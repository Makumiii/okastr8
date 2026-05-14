import { test, expect, spyOn, mock, beforeEach } from "bun:test";
import { 
    createTunnel, 
    deleteTunnel, 
    getTunnelToken, 
    routeTunnel, 
    createDnsRecord, 
    deleteDnsRecord 
} from "../../src/services/cloudflare";
import * as config from "../../src/config";

// Store original fetch
const originalFetch = global.fetch;

beforeEach(() => {
    mock.restore();
    spyOn(config, "getSystemConfig").mockResolvedValue({
        cloudflare: {
            apiToken: "test-cf-token",
            accountId: "test-cf-account",
            zoneId: "test-cf-zone"
        }
    });
});

test("cloudflare api > handles missing credentials", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({});
    await expect(createTunnel("my-app")).rejects.toThrow("Cloudflare credentials not configured");
});

test("cloudflare api > creates a tunnel successfully", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({
            success: true,
            result: { id: "tunnel-123", name: "okastr8-my-app" }
        })
    });
    global.fetch = mockFetch as any;

    const result = await createTunnel("my-app");
    expect(result.id).toBe("tunnel-123");
    
    // Check request structure
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/accounts/test-cf-account/cfd_tunnel");
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Authorization"]).toBe("Bearer test-cf-token");
    expect(JSON.parse(callArgs[1].body)).toEqual({ name: "okastr8-my-app", tunnel_secret: expect.any(String) });

    // Restore fetch
    global.fetch = originalFetch;
});

test("cloudflare api > gets tunnel token", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({
            success: true,
            result: "secret-tunnel-token-abc"
        })
    });
    global.fetch = mockFetch as any;

    const token = await getTunnelToken("tunnel-123");
    expect(token).toBe("secret-tunnel-token-abc");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/accounts/test-cf-account/cfd_tunnel/tunnel-123/token");
    expect(callArgs[1].method).toBe("GET");

    global.fetch = originalFetch;
});

test("cloudflare api > deletes tunnel", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
    });
    global.fetch = mockFetch as any;

    await deleteTunnel("tunnel-123");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/accounts/test-cf-account/cfd_tunnel/tunnel-123");
    expect(callArgs[1].method).toBe("DELETE");

    global.fetch = originalFetch;
});

test("cloudflare api > configures tunnel routing", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
    });
    global.fetch = mockFetch as any;

    await routeTunnel("tunnel-123", "app.example.com", "http://localhost:3000");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/accounts/test-cf-account/cfd_tunnel/tunnel-123/configurations");
    expect(callArgs[1].method).toBe("PUT");
    
    const body = JSON.parse(callArgs[1].body);
    expect(body.config.ingress[0].hostname).toBe("app.example.com");
    expect(body.config.ingress[0].service).toBe("http://localhost:3000");
    expect(body.config.ingress[1].service).toBe("http_status:404"); // Catch-all rule required by CF

    global.fetch = originalFetch;
});

test("cloudflare api > creates DNS record", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({
            success: true,
            result: { id: "dns-123", name: "app.example.com" }
        })
    });
    global.fetch = mockFetch as any;

    const result = await createDnsRecord("app.example.com", "tunnel-123");
    expect(result.id).toBe("dns-123");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/zones/test-cf-zone/dns_records");
    expect(callArgs[1].method).toBe("POST");
    
    const body = JSON.parse(callArgs[1].body);
    expect(body.type).toBe("CNAME");
    expect(body.name).toBe("app.example.com");
    expect(body.content).toBe("tunnel-123.cfargotunnel.com");
    expect(body.proxied).toBe(true);

    global.fetch = originalFetch;
});

test("cloudflare api > deletes DNS record", async () => {
    const mockFetch = mock().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
    });
    global.fetch = mockFetch as any;

    await deleteDnsRecord("dns-123");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.cloudflare.com/client/v4/zones/test-cf-zone/dns_records/dns-123");
    expect(callArgs[1].method).toBe("DELETE");

    global.fetch = originalFetch;
});
