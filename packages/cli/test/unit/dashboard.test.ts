import { test, expect, spyOn, beforeEach, mock } from "bun:test";
import { Command } from "commander";
import { addDashboardCommands } from "../../src/commands/dashboard";
import * as config from "../../src/config";

let program: Command;

beforeEach(() => {
    mock.restore();
    program = new Command();
    addDashboardCommands(program);
    // Suppress console output during tests
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "error").mockImplementation(() => {});
});

test("dashboard deploy > requires login first", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({});
    
    // We mock process.exit to prevent the test from actually exiting
    const mockExit = spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
    }) as any);

    await expect(program.parseAsync(["node", "test", "dashboard", "deploy", "dash.test.com"])).rejects.toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
});

test("dashboard deploy > deploys dashboard when logged in", async () => {
    spyOn(config, "getSystemConfig").mockResolvedValue({
        broker: { server_id: "test-server-id", server_token: "tok-abc" }
    });
    
    const mockExit = spyOn(process, "exit").mockImplementation((() => {}) as any);

    await program.parseAsync(["node", "test", "dashboard", "deploy", "dash.test.com"]);
    expect(mockExit).not.toHaveBeenCalled();
});
