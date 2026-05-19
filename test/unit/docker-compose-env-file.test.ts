import { describe, expect, it } from "bun:test";
import * as docker from "../../src/commands/docker";

describe("composeUp env file interpolation", () => {
    it("passes the app env file to Docker Compose interpolation", () => {
        expect(
            (docker as any).buildComposeUpArgs(
                ["/tmp/base-compose.yml", "/tmp/okastr8-env-compose.yml"],
                "demo-app",
                "/tmp/demo-app.env"
            )
        ).toEqual([
            "--env-file",
            "/tmp/demo-app.env",
            "-f",
            "/tmp/base-compose.yml",
            "-f",
            "/tmp/okastr8-env-compose.yml",
            "-p",
            "demo-app",
            "up",
            "-d",
            "--build",
        ]);
    });
});
