import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("setup-sudoers docker build rules", () => {
    test("includes docker build and buildx non-interactive sudo rules", () => {
        const script = readFileSync(join(process.cwd(), "scripts/setup-sudoers.sh"), "utf-8");

        expect(script).toContain('$DOCKER_CMD build *');
        expect(script).toContain('$DOCKER_CMD buildx version');
        expect(script).toContain('$DOCKER_CMD buildx build *');
    });
});
