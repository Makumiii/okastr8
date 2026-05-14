import { test, expect, spyOn, beforeEach, mock } from "bun:test";
import { Command } from "commander";
import { addSetupCommands } from "../../../src/commands/setup";
import * as commandUtils from "../../../src/utils/command";
import * as config from "../../../src/config";

// We need to mock Enquirer's prompt
// Since it's imported in the setup file, we can intercept the module or just rely on mocking the config saving
// For CLI interactive prompts, mocking process.argv or using a wrapper is best.
// But since we can't easily mock enquirer in this environment, we'll focus on testing the core setup validation logic if we extract it,
// Or we mock the runCommand to simulate curl returning success/failure.

// Let's create a minimal test that ensures the command is registered.
let program: Command;

beforeEach(() => {
    mock.restore();
    program = new Command();
    addSetupCommands(program);
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "error").mockImplementation(() => {});
});

test("setup commands > registers cloudflare command", () => {
    const cmd = program.commands.find(c => c.name() === "setup");
    expect(cmd).toBeDefined();
    const cfCmd = cmd?.commands.find(c => c.name() === "cloudflare");
    expect(cfCmd).toBeDefined();
    expect(cfCmd?.description()).toBe("Configure Cloudflare API credentials for automated tunnel routing");
});
