import { runCommand } from "./command";

export default async function build(buildSteps: string[], serviceName: string) {
    try {
        for (const step of buildSteps) {
            console.log(`[${serviceName}] Running build step: ${step}`);
            await runCommand(step, []);
        }
        console.log(`[${serviceName}] All build steps completed successfully`);
    } catch (error) {
        console.error(`[${serviceName}] Error executing build steps:`, error);
        throw error; // Re-throw instead of process.exit(1) to not crash server
    }
}
