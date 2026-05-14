import { test, expect, mock, spyOn, beforeEach } from "bun:test";
import { pollDeviceCodeStatus } from "../../src/commands/github";
import * as config from "../../src/config";
import { ConvexClient } from "convex/browser";

beforeEach(() => {
    mock.restore();
});

test("zero-config auth > polls broker and updates admin identity", async () => {
    // 1. Mock the Convex polling to return authorized status with GitHub info
    const mockQuery = mock().mockResolvedValue({
        status: "authorized",
        githubUserId: 12345,
        githubUsername: "testuser",
        serverId: "srv-123"
    });
    spyOn(ConvexClient.prototype, "query").mockImplementation(mockQuery);

    // 2. Mock system config saving
    const saveSpy = spyOn(config, "saveSystemConfig").mockResolvedValue();

    // 3. Call the poll function
    const result = await pollDeviceCodeStatus("ABC-123");

    // 4. Verify results
    expect(result.connected).toBe(true);
    expect(result.username).toBe("testuser");

    // 5. Verify that saveSystemConfig was called with the correct admin identity
    expect(saveSpy).toHaveBeenCalledWith({
        manager: {
            auth: {
                github_admin_id: "12345",
                github_admin_login: "testuser"
            }
        }
    });
});
