import { describe, expect, test } from "bun:test";
import { normalizeSourceDir, resolveSourcePath } from "../../src/utils/source-path";

describe("repository source directory handling", () => {
    test("normalizes a relative app directory", () => {
        expect(normalizeSourceDir("apps\\field-service-demo/")).toBe("apps/field-service-demo");
        expect(resolveSourcePath("/srv/releases/v1", "apps/field-service-demo")).toBe(
            "/srv/releases/v1/apps/field-service-demo"
        );
    });

    test("treats the repository root as the default", () => {
        expect(normalizeSourceDir(undefined)).toBeUndefined();
        expect(resolveSourcePath("/srv/releases/v1")).toBe("/srv/releases/v1");
    });

    test.each(["/etc", "../outside", "apps/../outside", "C:/outside"])(
        "rejects an escaping source directory: %s",
        (sourceDir) => {
            expect(() => normalizeSourceDir(sourceDir)).toThrow();
        }
    );
});
