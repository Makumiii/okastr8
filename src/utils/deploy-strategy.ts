export type DeployStrategy = "git" | "image";

export interface StrategySource {
    deployStrategy?: string;
    gitRepo?: string;
    imageRef?: string;
}

export function resolveDeployStrategy(source: StrategySource): DeployStrategy {
    if (source.deployStrategy === "image") return "image";
    if (source.deployStrategy === "git") return "git";

    // Backward compatibility for existing app metadata.
    // Current apps are git-based unless explicitly marked otherwise.
    return "git";
}

