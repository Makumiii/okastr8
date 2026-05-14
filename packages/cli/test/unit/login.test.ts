import { test, expect, mock, spyOn } from "bun:test";
import { runLoginFlow } from "../../src/commands/login";
import * as config from "../../src/config";

test("login command > generates code and polls until authorized", async () => {
    // Mock the config
    spyOn(config, "saveSystemConfig").mockResolvedValue();

    // Mock convex client
    const mockMutation = mock().mockResolvedValue({
        userCode: "ABCD-1234",
        code: "internal_code",
    });

    let pollCount = 0;
    const mockQuery = mock().mockImplementation(async () => {
        pollCount++;
        if (pollCount === 1) return { status: "pending" };
        return { status: "authorized", serverId: "test-server-id", userId: "test-user-id" };
    });

    const mockConvexClient = {
        mutation: mockMutation,
        query: mockQuery,
    };

    const result = await runLoginFlow(mockConvexClient as any, "test-server-id", 5); // 5ms poll interval for test

    expect(mockMutation).toHaveBeenCalledWith("deviceCodes:generate", { serverId: "test-server-id" });
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("authorized");
    expect(result.serverId).toBe("test-server-id");
    
    expect(config.saveSystemConfig).toHaveBeenCalledWith(expect.objectContaining({
        broker: {
            server_id: "test-server-id",
            server_token: expect.any(String),
        }
    }));
});

test("login command > handles expired code", async () => {
    const mockMutation = mock().mockResolvedValue({
        userCode: "EXPR-9999",
        code: "internal_code",
    });

    const mockQuery = mock().mockResolvedValue({ status: "expired" });

    const mockConvexClient = {
        mutation: mockMutation,
        query: mockQuery,
    };

    await expect(runLoginFlow(mockConvexClient as any, "test-server-id", 5)).rejects.toThrow("Device code expired.");
});
