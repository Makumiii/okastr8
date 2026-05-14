<script lang="ts">
    import { Card } from "$lib/components/ui";
    import { ArrowRight, Github, Container } from "lucide-svelte";
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">Deploy</h1>
        <p class="mt-1 text-[var(--text-secondary)]">
            Choose your deployment strategy.
        </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
        <a href="/github" class="block">
            <Card class="h-full cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
                <div class="flex items-start gap-4">
                    <div class="rounded-[var(--radius-md)] bg-[var(--surface-dark)] p-3">
                        <Github size={20} />
                    </div>
                    <div class="space-y-2">
                        <h2 class="text-lg font-semibold text-[var(--text-primary)]">
                            GitHub Strategy
                        </h2>
                        <p class="text-sm text-[var(--text-secondary)]">
                            Import a repository, configure deploy settings, and optionally publish
                            built images to OCR after successful deploy.
                        </p>
                    </div>
                </div>
                <div class="mt-6 flex items-center justify-end gap-2 text-sm font-medium text-[var(--primary-strong)]">
                    Continue <ArrowRight size={16} />
                </div>
            </Card>
        </a>

        <a href="/container" class="block">
            <Card class="h-full cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
                <div class="flex items-start gap-4">
                    <div class="rounded-[var(--radius-md)] bg-[var(--surface-dark)] p-3">
                        <Container size={20} />
                    </div>
                    <div class="space-y-2">
                        <h2 class="text-lg font-semibold text-[var(--text-primary)]">
                            Container Strategy
                        </h2>
                        <p class="text-sm text-[var(--text-secondary)]">
                            Deploy directly from container registries. Browse GHCR packages or
                            enter manual image references for other OCR providers.
                        </p>
                    </div>
                </div>
                <div class="mt-6 flex items-center justify-end gap-2 text-sm font-medium text-[var(--primary-strong)]">
                    Continue <ArrowRight size={16} />
                </div>
            </Card>
        </a>
    </div>
</div>
