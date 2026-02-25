import { describe, expect, test } from "bun:test";
import { runCommand } from "../../src/utils/command";

describe("runCommand streaming hooks", () => {
    test("forwards stdout/stderr chunks while collecting full output", async () => {
        const seenOut: string[] = [];
        const seenErr: string[] = [];

        const result = await runCommand(
            "bash",
            ["-lc", "echo hello; echo warn 1>&2"],
            undefined,
            undefined,
            {
                onStdout: (chunk) => seenOut.push(chunk),
                onStderr: (chunk) => seenErr.push(chunk),
            }
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("hello");
        expect(result.stderr).toContain("warn");
        expect(seenOut.join("")).toContain("hello");
        expect(seenErr.join("")).toContain("warn");
    });
});
