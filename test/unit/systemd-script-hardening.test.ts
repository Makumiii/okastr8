import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

describe("systemd manager hardening script", () => {
    test("includes manager/webhook hardening directives", () => {
        const script = readFileSync(join(process.cwd(), "scripts/systemd/create.sh"), "utf-8");

        expect(script).toContain('"$SERVICE_NAME" == "okastr8-manager"');
        expect(script).toContain("UMask=0077");
        expect(script).toContain("PrivateTmp=true");
        expect(script).toContain("ProtectSystem=full");
        expect(script).toContain("ReadWritePaths=/home/$USER/.okastr8 /tmp /var/tmp");
        expect(script).toContain(
            "Wants=network-online.target docker.service caddy.service cloudflared.service"
        );
        expect(script).toContain(
            "After=network-online.target docker.service caddy.service cloudflared.service"
        );
    });
});
