import { Command } from "commander";
import { deployDashboard } from "./dashboard";

export function addDashboardCommands(program: Command) {
    const dashboard = program.command("dashboard").description("Okastr8 Dashboard management");

    dashboard
        .command("deploy")
        .description("Deploy your personal Okastr8 Dashboard")
        .requiredOption("-d, --domain <domain>", "Domain name for the dashboard (e.g. dash.example.com)")
        .option("-r, --repo <name>", "Name for the new private GitHub repository", "my-okastr8-dashboard")
        .action(async (options) => {
            try {
                const result = await deployDashboard({
                    domain: options.domain,
                    repoName: options.repo
                });

                if (result.success) {
                    console.log(`\n✅ ${result.message}`);
                    console.log(`🔗 Access it at: ${result.url}`);
                } else {
                    console.error(`\n❌ ${result.message}`);
                    process.exit(1);
                }
            } catch (error: any) {
                console.error("\n❌ Unexpected error:", error.message);
                process.exit(1);
            }
        });
}
