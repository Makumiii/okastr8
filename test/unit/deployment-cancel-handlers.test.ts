import { describe, expect, test } from "bun:test";
import {
    cancelDeployment,
    endDeploymentStream,
    registerDeploymentCancelHandler,
    startDeploymentStream,
} from "../../src/utils/deploymentLogger";

describe("deployment cancellation handlers", () => {
    test("invokes registered handlers when deployment is cancelled", () => {
        const id = `test-cancel-${Date.now()}`;
        startDeploymentStream(id);

        let called = 0;
        registerDeploymentCancelHandler(id, () => {
            called += 1;
        });

        const cancelled = cancelDeployment(id);
        endDeploymentStream(id);

        expect(cancelled).toBe(true);
        expect(called).toBe(1);
    });

    test("unregistered handler is not invoked", () => {
        const id = `test-unregister-${Date.now()}`;
        startDeploymentStream(id);

        let called = 0;
        const unregister = registerDeploymentCancelHandler(id, () => {
            called += 1;
        });
        unregister();

        cancelDeployment(id);
        endDeploymentStream(id);
        expect(called).toBe(0);
    });
});
