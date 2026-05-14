import { test, expect, mock, spyOn, beforeEach } from "bun:test";
import { deployDashboard } from "../../src/commands/dashboard";
import * as config from "../../src/config";
import * as github from "../../src/commands/github";
import { ConvexClient } from "convex/browser";

beforeEach(() => {
    mock.restore();
});

test("dashboard deploy > coordinates repo creation and deployment", async () => {
    // 1. Mock system config with admin ID
    spyOn(config, "getSystemConfig").mockResolvedValue({
        manager: {
            auth: { github_admin_id: "12345" }
        }
    });

    // 2. Mock Convex Broker calls
    const mockUser = { _id: "user-1", githubUserId: 12345 };
    const mockRepo = { fullName: "testuser/my-dashboard", cloneUrl: "https://..." };

    const querySpy = mock().mockResolvedValue(mockUser);
    const actionSpy = mock().mockResolvedValue(mockRepo);
    
    spyOn(ConvexClient.prototype, "query").mockImplementation(querySpy);
    spyOn(ConvexClient.prototype, "action").mockImplementation(actionSpy);

    // 3. Mock the import and deploy logic
    const importRepoSpy = spyOn(github, "importRepo").mockResolvedValue({
        success: true,
        message: "Successfully deployed"
    });

    // 4. Run the command
    const result = await deployDashboard({ domain: "dash.example.com" });

    // 5. Verify
    expect(result.success).toBe(true);
    expect(querySpy).toHaveBeenCalledWith("users:getByGitHubId", { githubUserId: 12345 });
    expect(actionSpy).toHaveBeenCalledWith("github:createDashboardRepo", {
        userId: "user-1",
        repoName: "my-okastr8-dashboard"
    });
    expect(importRepoSpy).toHaveBeenCalledWith(expect.objectContaining({
        repoFullName: "testuser/my-dashboard",
        domain: "dash.example.com",
        tunnel_routing: true
    }));
});
