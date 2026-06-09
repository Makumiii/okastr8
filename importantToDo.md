# Important TODO

## Patch GitHub webhook auto-deploy registration

Context from production investigation on 2026-06-09:

- `caroline-kagia` had `webhookAutoDeploy: true` and `webhookBranch: main`.
- The okastr8 manager was running and `https://okastr8.makumitech.co.ke/api/github/webhook` was reachable.
- GitHub had no repository webhooks configured for `Makumiii/caroline-kagia`.
- `~/.okastr8/system.yaml` had a GitHub access token, but no `manager.github.webhook_secret`.
- The webhook receiver rejects all signed GitHub webhooks when `manager.github.webhook_secret` is missing.
- Result: pushes did not trigger deployment; manual `okastr8 deploy trigger caroline-kagia` was required.

Required patch:

1. Add webhook provisioning to the GitHub import/redeploy flow and/or `okastr8 app webhook <app> on`.
2. Generate a strong `manager.github.webhook_secret` when missing and persist it in `system.yaml`.
3. Create or update the GitHub repository webhook via the GitHub API:
   - URL: `${manager.public_url || tunnel.url}/api/github/webhook`
   - Content type: `json`
   - Secret: `manager.github.webhook_secret`
   - Events: `push`
   - Active: `true`
4. Make provisioning idempotent:
   - Reuse an existing hook pointing at the same callback URL.
   - Update URL, secret, events, and active flag when stale.
   - Avoid creating duplicate hooks.
5. Surface webhook health in CLI/dashboard:
   - Show whether the repo hook exists.
   - Show whether the app has auto-deploy enabled and which branch is tracked.
   - Show the last GitHub hook delivery status when available.
6. Add tests for:
   - Missing webhook secret generation.
   - Existing hook update.
   - Duplicate hook avoidance.
   - `app webhook on` provisioning behavior.
   - Failure messaging when the GitHub token lacks hook permissions.

Relevant code paths:

- Receiver requires secret: `src/api.ts` `/github/webhook`
- Current app toggle only updates metadata: `src/commands/app.ts` `app webhook`
- GitHub import writes app metadata but does not register hooks: `src/commands/github.ts`

Operational note:

- Until this is patched, GitHub pushes will not auto-deploy apps unless the repo webhook and matching okastr8 webhook secret are created manually.
