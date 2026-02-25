import { describe, expect, test } from "bun:test";
import { assertValidCreateServiceInputs, assertValidServiceName } from "../../src/commands/systemd";

describe("systemd input validation", () => {
    test("accepts a valid service name", () => {
        expect(() => assertValidServiceName("okastr8-manager")).not.toThrow();
    });

    test("rejects an invalid service name", () => {
        expect(() => assertValidServiceName("bad;name")).toThrow();
    });

    test("accepts valid create service inputs", () => {
        expect(() =>
            assertValidCreateServiceInputs({
                service_name: "okastr8-manager",
                description: "Okastr8 manager",
                exec_start: "/usr/local/bin/bun run /home/maks/okastr8/src/managerServer.ts",
                working_directory: "/home/maks/okastr8",
                user: "maks",
                wanted_by: "multi-user.target",
            })
        ).not.toThrow();
    });

    test("rejects multiline exec_start inputs", () => {
        expect(() =>
            assertValidCreateServiceInputs({
                service_name: "okastr8-manager",
                description: "desc",
                exec_start: "bun run foo\nrm -rf /",
                working_directory: "/home/maks/okastr8",
                user: "maks",
                wanted_by: "multi-user.target",
            })
        ).toThrow();
    });

    test("rejects relative working directory", () => {
        expect(() =>
            assertValidCreateServiceInputs({
                service_name: "okastr8-manager",
                description: "desc",
                exec_start: "bun run foo",
                working_directory: "relative/path",
                user: "maks",
                wanted_by: "multi-user.target",
            })
        ).toThrow();
    });
});
