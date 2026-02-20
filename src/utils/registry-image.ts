export function resolveRegistryServer(imageRef: string): string {
    // Docker Hub short form (e.g., nginx:alpine) has no slash and should map to docker.io.
    if (!imageRef.includes("/")) {
        return "docker.io";
    }

    const first = imageRef.split("/")[0] || "";
    const looksLikeRegistry = first.includes(".") || first.includes(":") || first === "localhost";
    return looksLikeRegistry ? first : "docker.io";
}
