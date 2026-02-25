import { afterEach, describe, expect, it } from "bun:test";
import { cleanupTempHomes, createTempHome, runIsolatedScript } from "./helpers";

afterEach(() => {
    cleanupTempHomes();
});

describe("security file permissions", () => {
    it("writes auth.json with 0600 permissions", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const auth = await import('./src/commands/auth.ts');
        const { statSync } = await import('fs');
        const { join } = await import('path');
        await auth.generateToken('perm-user', '1h');
        const mode = statSync(join(process.env.HOME, '.okastr8', 'auth.json')).mode & 0o777;
        console.log(JSON.stringify({ mode }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);
        expect(data.mode).toBe(0o600);
    });

    it("writes system.yaml with 0600 permissions", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const config = await import('./src/config.ts');
        const { statSync } = await import('fs');
        await config.saveSystemConfig({ manager: { port: 41788 } });
        const mode = statSync(config.CONFIG_FILE).mode & 0o777;
        console.log(JSON.stringify({ mode }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);
        expect(data.mode).toBe(0o600);
    });
});
