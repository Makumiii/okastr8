import {
    dockerLogin,
    dockerLogout,
    imageExists,
    inspectImageDigest,
    pushImage,
    tagImage,
} from "../commands/docker";
import { getRegistryLoginMaterial } from "../commands/registry";
import { normalizeImageRef } from "./registry-image";

export interface ImagePublishOptions {
    localImageRef: string;
    targetImageRef: string;
    registryCredentialId: string;
}

export async function publishLocalImageToRegistry(
    options: ImagePublishOptions
): Promise<{ success: boolean; message: string; digest?: string }> {
    const targetImageRef = normalizeImageRef(options.targetImageRef);
    const loginMaterial = await getRegistryLoginMaterial(options.registryCredentialId);
    if (
        !loginMaterial.success ||
        !loginMaterial.server ||
        !loginMaterial.username ||
        !loginMaterial.password
    ) {
        return {
            success: false,
            message: loginMaterial.message || "Unable to resolve registry credential",
        };
    }

    const localImageExists = await imageExists(options.localImageRef);
    if (!localImageExists) {
        return {
            success: false,
            message: `Built image '${options.localImageRef}' not found. Push is supported for Dockerfile-based deploys.`,
        };
    }

    const loginResult = await dockerLogin(
        loginMaterial.server,
        loginMaterial.username,
        loginMaterial.password
    );
    if (!loginResult.success) {
        return loginResult;
    }

    try {
        const tagResult = await tagImage(options.localImageRef, targetImageRef);
        if (!tagResult.success) {
            return tagResult;
        }

        const pushResult = await pushImage(targetImageRef);
        if (!pushResult.success) {
            return pushResult;
        }

        const digest = await inspectImageDigest(targetImageRef);
        return {
            success: true,
            message: digest
                ? `Published image ${targetImageRef} (${digest})`
                : `Published image ${targetImageRef}`,
            digest,
        };
    } finally {
        await dockerLogout(loginMaterial.server).catch(() => {});
    }
}
