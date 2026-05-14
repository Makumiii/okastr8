#!/usr/bin/env bun
/**
 * Test script to debug branch listing
 * Usage: bun scripts/test-branches.ts owner/repo
 */

import { getGitHubConfig, listBranches } from "../src/commands/github";

const GITHUB_API = "https://api.github.com";

async function main() {
    const repoFullName = process.argv[2];

    if (!repoFullName) {
        console.error("Usage: bun scripts/test-branches.ts owner/repo");
        process.exit(1);
    }

    const config = await getGitHubConfig();

    if (!config.accessToken) {
        console.error("No GitHub access token found");
        process.exit(1);
    }

    console.log(`Testing branch listing for: ${repoFullName}`);
    console.log(`Token (first 10 chars): ${config.accessToken.substring(0, 10)}...`);
    console.log(`Username: ${config.username}`);

    try {
        console.log("\n--- Using listBranches function ---");
        const branches = await listBranches(config.accessToken, repoFullName);
        console.log(`Found ${branches.length} branches:`);
        branches.forEach((b) => console.log(`  - ${b}`));
    } catch (error) {
        console.error("Error from listBranches:", error);
    }

    console.log("\n--- Direct API call for comparison ---");
    const url = `${GITHUB_API}/repos/${repoFullName}/branches?per_page=100`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const error = await response.text();
        console.error("Error:", error);
    } else {
        const data = (await response.json()) as any[];
        console.log(`Found ${data.length} branches via direct API:`);
        data.forEach((b: any) => console.log(`  - ${b.name}`));
    }
}

main().catch(console.error);
