import { test, expect, mock, spyOn, beforeEach } from "bun:test";
import { getInstallationTokenFromBroker, initBrokerSync } from "../../src/services/broker";
import * as config from "../../src/config";
import { ConvexClient } from "convex/browser";

beforeEach(() => {
    mock.restore();
});

test("broker service > retrieves installation token from broker", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({
        broker: { server_id: "srv-123", server_token: "tok-abc" }
    });

    const mockMutation = mock().mockResolvedValue("mock-https-token-123");
    
    // We mock the constructor behavior by patching the module or we can mock ConvexClient prototype
    spyOn(ConvexClient.prototype, "mutation").mockImplementation(mockMutation);

    const token = await getInstallationTokenFromBroker("owner/repo");

    expect(token).toBe("mock-https-token-123");
    expect(mockMutation).toHaveBeenCalledWith("github:getInstallationToken", {
        serverId: "srv-123",
        serverToken: "tok-abc",
        repoFullName: "owner/repo"
    });
});

test("broker service > returns null if no broker config", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({});

    const token = await getInstallationTokenFromBroker("owner/repo");
    expect(token).toBeNull();
});

test("broker service > listens for deployment events", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({
        broker: { server_id: "srv-123", server_token: "tok-abc" }
    });

    const mockOnUpdate = mock().mockImplementation((query, args, callback) => {
        // simulate receiving an event
        callback([{ id: "event-1", repo: "owner/repo" }]);
        return () => {}; // unsubscribe function
    });

    spyOn(ConvexClient.prototype, "onUpdate").mockImplementation(mockOnUpdate);

    // Capture console.log to verify it processed the event
    const logSpy = spyOn(console, "log");

    await initBrokerSync();

    expect(mockOnUpdate).toHaveBeenCalledWith(
        "deployments:getPending",
        { serverId: "srv-123", serverToken: "tok-abc" },
        expect.any(Function),
        expect.any(Function)
    );

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Received 1 deployment events"));
});
