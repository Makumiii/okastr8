
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

async function main() {
    const p = join(homedir(), ".okastr8/apps/makumi-tech-final/versions.json");
    try {
        const c = await readFile(p, "utf-8");
        console.log("--- START CONTENT ---");
        console.log(c);
        console.log("--- END CONTENT ---");

        try {
            JSON.parse(c);
            console.log("JSON is VALID");
        } catch (e: any) {
            console.log("JSON PARSE ERROR:", e.message);
        }
    } catch (e: any) {
        console.error(`Error checking versions: ${e.message}`);
        // console.error(e);
    }
}

main();
