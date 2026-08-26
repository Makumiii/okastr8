import { describe, expect, test } from "bun:test";
import { PassThrough } from "stream";
import { attachDeploymentCancellationInput } from "../../src/commands/github-wizard";
import {
    endDeploymentStream,
    isDeploymentCancelled,
    startDeploymentStream,
} from "../../src/utils/deploymentLogger";

class FakeTTYInput extends PassThrough {
    isTTY = true;
    isRaw = false;
    rawModeChanges: boolean[] = [];

    constructor() {
        super();
        this.pause();
    }

    setRawMode(enabled: boolean) {
        this.isRaw = enabled;
        this.rawModeChanges.push(enabled);
        return this;
    }
}

describe("GitHub deployment cancellation input", () => {
    test("restores a previously paused TTY after cleanup", () => {
        const deploymentId = `test-input-${Date.now()}`;
        startDeploymentStream(deploymentId);
        const input = new FakeTTYInput();

        const cleanup = attachDeploymentCancellationInput(deploymentId, input);

        expect(cleanup).toBeFunction();
        input.emit("keypress", "c", { name: "c" });
        expect(isDeploymentCancelled(deploymentId)).toBe(true);

        cleanup?.();
        expect(input.rawModeChanges).toEqual([true, false]);
        expect(input.isPaused()).toBe(true);
        expect(input.listenerCount("keypress")).toBe(0);
        endDeploymentStream(deploymentId);
    });

    test("pauses an initially flowing TTY after cleanup", () => {
        const deploymentId = `test-flowing-input-${Date.now()}`;
        startDeploymentStream(deploymentId);
        const input = new FakeTTYInput();
        input.resume();
        expect(input.isPaused()).toBe(false);

        const cleanup = attachDeploymentCancellationInput(deploymentId, input);
        cleanup?.();

        expect(input.isPaused()).toBe(true);
        expect(input.listenerCount("keypress")).toBe(0);
        endDeploymentStream(deploymentId);
    });

    test("does not attach handlers to non-TTY input", () => {
        const input = new FakeTTYInput();
        input.isTTY = false;
        const cleanup = attachDeploymentCancellationInput("unused", input);

        expect(cleanup).toBeUndefined();
        expect(input.listenerCount("keypress")).toBe(0);
    });
});
