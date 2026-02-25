import { afterEach, describe, expect, it } from "bun:test";
import { cleanupTempHomes, createTempHome, runIsolatedScript } from "./helpers";

afterEach(() => {
    cleanupTempHomes();
});

describe("API/CLI integration", () => {
    it("accepts bearer token on protected API routes", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const auth = await import('./src/commands/auth.ts');
        const api = (await import('./src/api.ts')).default;
        const tokenRes = await auth.generateToken('integration-user', '1h');

        const response = await api.request('/logs/recent', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + tokenRes.token },
        });

        const body = await response.json();
        console.log(JSON.stringify({ status: response.status, body }));
      `
        );

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");

        const data = JSON.parse(result.stdout);
        expect(data.status).toBe(200);
        expect(data.body).toMatchObject({ success: true, message: "Recent logs" });
    });

    it("accepts session cookie token for auth/me route", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const auth = await import('./src/commands/auth.ts');
        const api = (await import('./src/api.ts')).default;
        const tokenRes = await auth.generateToken('cookie-user', '1h');

        const response = await api.request('/auth/me', {
          method: 'GET',
          headers: { Cookie: 'okastr8_session=' + tokenRes.token },
        });

        const body = await response.json();
        console.log(JSON.stringify({ status: response.status, body }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);

        expect(data.status).toBe(200);
        expect(data.body).toMatchObject({
            success: true,
            message: "Session valid",
            data: { userId: "cookie-user" },
        });
    });

    it("rejects tampered bearer tokens on protected routes", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const auth = await import('./src/commands/auth.ts');
        const api = (await import('./src/api.ts')).default;
        const tokenRes = await auth.generateToken('tamper-user', '1h');
        const token = tokenRes.token;
        const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

        const response = await api.request('/logs/recent', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + tampered },
        });

        const body = await response.json();
        console.log(JSON.stringify({ status: response.status, body }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);

        expect(data.status).toBe(401);
        expect(data.body.success).toBe(false);
        expect(String(data.body.message)).toContain("Invalid");
    });

    it("keeps CLI and API usable in same isolated environment", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        const auth = await import('./src/commands/auth.ts');
        const api = (await import('./src/api.ts')).default;
        const tokenRes = await auth.generateToken('bridge-user', '1h');

        const cli = Bun.spawnSync({
          cmd: [process.execPath, 'run', 'src/main.ts', '--version'],
          cwd: process.cwd(),
          env: process.env,
          stdout: 'pipe',
          stderr: 'pipe',
        });

        const response = await api.request('/auth/me', {
          method: 'GET',
          headers: { Cookie: 'okastr8_session=' + tokenRes.token },
        });

        const body = await response.json();
        console.log(JSON.stringify({
          cliExitCode: cli.exitCode,
          cliVersion: new TextDecoder().decode(cli.stdout).trim(),
          apiStatus: response.status,
          apiBody: body,
        }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);

        expect(data.cliExitCode).toBe(0);
        expect(data.cliVersion).toBe("0.0.1");
        expect(data.apiStatus).toBe(200);
        expect(data.apiBody).toMatchObject({ success: true, message: "Session valid" });
    });

    it("fails closed for oauth redirect base URL in production when public URL is missing", () => {
        const home = createTempHome();
        const result = runIsolatedScript(
            home,
            `
        process.env.NODE_ENV = 'production';
        const config = await import('./src/config.ts');
        await config.saveSystemConfig({
          manager: {
            github: {
              client_id: 'dummy-client',
              client_secret: 'dummy-secret',
            },
            auth: {
              github_admin_id: '12345',
            },
          },
        });
        const api = (await import('./src/api.ts')).default;
        const response = await api.request('/auth/github', { method: 'GET' });
        console.log(JSON.stringify({
          status: response.status,
          location: response.headers.get('location') || ''
        }));
      `
        );

        expect(result.exitCode).toBe(0);
        const data = JSON.parse(result.stdout);
        expect(data.status).toBe(302);
        expect(data.location).toContain("error=oauth_public_url_missing");
    });
});
