/**
 * Runtime Detector
 * Auto-detects application runtime based on project files
 */

import { existsSync } from "fs";
import { join } from "path";

/**
 * Detect runtime based on files in the project
 */
export async function detectRuntime(releasePath: string): Promise<string> {
    // Check for Node.js
    if (
        existsSync(join(releasePath, "package.json")) ||
        existsSync(join(releasePath, "package-lock.json"))
    ) {
        return "node";
    }

    // Check for Python
    if (
        existsSync(join(releasePath, "requirements.txt")) ||
        existsSync(join(releasePath, "Pipfile")) ||
        existsSync(join(releasePath, "setup.py")) ||
        existsSync(join(releasePath, "pyproject.toml"))
    ) {
        return "python";
    }

    // Check for Go
    if (existsSync(join(releasePath, "go.mod"))) {
        return "go";
    }

    // Check for Rust
    if (existsSync(join(releasePath, "Cargo.toml"))) {
        return "rust";
    }

    // Check for Ruby
    if (existsSync(join(releasePath, "Gemfile"))) {
        return "ruby";
    }

    // Check for Bun
    if (existsSync(join(releasePath, "bun.lockb"))) {
        return "bun";
    }

    // Check for Deno
    if (existsSync(join(releasePath, "deno.json")) || existsSync(join(releasePath, "deno.jsonc"))) {
        return "deno";
    }

    throw new Error(
        "Could not auto-detect runtime. Please specify 'runtime' in okastr8.yaml.\\n" +
            "Supported runtimes: node, python, go, rust, ruby, bun, deno"
    );
}
