import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { startAppTunnelContainer, stopAppTunnelContainer, containerStatus } from "./docker";
import { runCommand } from "../utils/command";

// These tests require Docker to be installed and running on the system to execute accurately.
// They run actual containers and then clean them up.
describe("Docker Tunnel Container Lifecycle", () => {
    const testAppName = "test-app-tunnel-e2e";
    const testToken = "fake-token-for-testing"; // cloudflared will fail to connect with this, but the container will start and run for a bit before exiting or crash-looping

    beforeAll(async () => {
        // Clean up any lingering containers before starting
        await stopAppTunnelContainer(testAppName);
    });

    afterAll(async () => {
        // Clean up after tests are done
        await stopAppTunnelContainer(testAppName);
    });

    test("starts a tunnel container successfully", async () => {
        const result = await startAppTunnelContainer(testAppName, testToken);

        expect(result.success).toBe(true);
        expect(result.message).toContain(`Tunnel container ${testAppName}-tunnel started successfully`);

        // Check if container is actually running
        const status = await containerStatus(`${testAppName}-tunnel`);

        // It might not be 'running' stable because the token is fake, so cloudflared might crash and restart (unless-stopped).
        // It should at least exist and not be 'not found' or 'error' immediately, usually it'll be 'running' or 'restarting'.
        expect(status.status).not.toBe("not found");
        expect(status.status).not.toBe("error");
    });

    test("stops and removes a tunnel container successfully", async () => {
        // Ensure it's running first
        await startAppTunnelContainer(testAppName, testToken);

        const result = await stopAppTunnelContainer(testAppName);

        expect(result.success).toBe(true);
        expect(result.message).toContain(`Tunnel container ${testAppName}-tunnel stopped and removed`);

        // Check it's gone
        const status = await containerStatus(`${testAppName}-tunnel`);
        expect(status.status).toBe("not found");
    });
});
