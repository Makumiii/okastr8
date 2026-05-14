export function resolveRegistryServer(imageRef: string): string {
    // Docker Hub short form (e.g., nginx:alpine) has no slash and should map to docker.io.
    if (!imageRef.includes("/")) {
        return "docker.io";
    }

    const first = imageRef.split("/")[0] || "";
    const looksLikeRegistry = first.includes(".") || first.includes(":") || first === "localhost";
    return looksLikeRegistry ? first : "docker.io";
}

export function normalizeImageRef(imageRef: string): string {
    const trimmed = imageRef.trim();
    if (!trimmed) {
        return trimmed;
    }

    let base = trimmed;
    let digest = "";
    const digestIndex = trimmed.indexOf("@");
    if (digestIndex !== -1) {
        base = trimmed.slice(0, digestIndex);
        digest = trimmed.slice(digestIndex);
    }

    let repository = base;
    let tag = "";
    const lastSlash = base.lastIndexOf("/");
    const lastColon = base.lastIndexOf(":");
    if (lastColon > lastSlash) {
        repository = base.slice(0, lastColon);
        tag = base.slice(lastColon);
    }

    return `${repository.toLowerCase()}${tag}${digest}`;
}
