import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("api route uniqueness", () => {
    test("does not register duplicate method+path handlers", () => {
        const source = readFileSync(join(process.cwd(), "src/api.ts"), "utf-8");
        const routeRegex = /api\.(get|post|put|delete|patch)\("([^"]+)"/g;

        const seen = new Set<string>();
        const duplicates: string[] = [];

        let match: RegExpExecArray | null;
        while ((match = routeRegex.exec(source)) !== null) {
            const key = `${match[1].toUpperCase()}:${match[2]}`;
            if (seen.has(key)) {
                duplicates.push(key);
            } else {
                seen.add(key);
            }
        }

        expect(duplicates).toEqual([]);
    });
});
