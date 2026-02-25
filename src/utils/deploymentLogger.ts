/**
 * Deployment Logger - Streams logs to UI during deployments
 * Uses in-memory streams for active deployments
 */

export interface DeploymentStream {
    id: string;
    callbacks: Set<(message: string) => void>;
    createdAt: number;
    cancelled: boolean;
    ended: boolean;
    endedAt?: number;
    history: string[];
    cancelHandlers: Set<() => void>;
}

// Store active deployment streams
const deploymentStreams = new Map<string, DeploymentStream>();

// Cleanup old streams after 1 hour
const STREAM_TIMEOUT = 60 * 60 * 1000;

import { writeUnifiedEntry } from "./structured-logger";

/**
 * Start a new deployment stream
 */
export function startDeploymentStream(deploymentId: string): void {
    deploymentStreams.set(deploymentId, {
        id: deploymentId,
        callbacks: new Set(),
        createdAt: Date.now(),
        cancelled: false,
        ended: false,
        history: [],
        cancelHandlers: new Set(),
    });
    console.log(`[DeploymentLogger] Started stream: ${deploymentId}`);
}

export function hasDeploymentStream(deploymentId: string): boolean {
    return deploymentStreams.has(deploymentId);
}

/**
 * Log a message to a deployment stream and console
 */
export function streamLog(deploymentId: string, message: string): void {
    const stream = deploymentStreams.get(deploymentId);
    if (stream) {
        stream.history.push(message);
        if (stream.history.length > 500) {
            stream.history = stream.history.slice(-500);
        }
        // Send to all connected clients
        stream.callbacks.forEach((callback) => {
            try {
                callback(message);
            } catch (error) {
                console.error(`[DeploymentLogger] Callback error:`, error);
            }
        });
    }

    // Always log to console as well
    console.log(message);

    void writeUnifiedEntry({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "deploy",
        service: "deployment",
        message,
        traceId: deploymentId,
        action: "deploy-log",
        data: { deploymentId },
    });
}

/**
 * Subscribe to a deployment stream
 */
export function subscribe(deploymentId: string, callback: (message: string) => void): () => void {
    const stream = deploymentStreams.get(deploymentId);
    if (!stream) {
        console.warn(`[DeploymentLogger] Stream not found: ${deploymentId}`);
        try {
            callback("⚠️ Deployment stream not found. It may have expired.");
            callback("[DEPLOYMENT_STREAM_END]");
        } catch {}
        return () => {};
    }

    // Replay buffered logs for late subscribers.
    for (const line of stream.history) {
        try {
            callback(line);
        } catch {
            // Ignore callback errors during replay.
        }
    }

    if (stream.ended) {
        try {
            callback("[DEPLOYMENT_STREAM_END]");
        } catch {}
        return () => {};
    }

    stream.callbacks.add(callback);
    console.log(`[DeploymentLogger] Client subscribed to: ${deploymentId}`);

    // Return unsubscribe function
    return () => {
        stream.callbacks.delete(callback);
        console.log(`[DeploymentLogger] Client unsubscribed from: ${deploymentId}`);
    };
}

/**
 * End a deployment stream and cleanup
 */
export function endDeploymentStream(deploymentId: string): void {
    const stream = deploymentStreams.get(deploymentId);
    if (stream) {
        if (stream.ended) return;
        stream.ended = true;
        stream.endedAt = Date.now();
        // Notify all subscribers that stream is ending
        stream.callbacks.forEach((callback) => {
            try {
                callback("[DEPLOYMENT_STREAM_END]");
            } catch (error) {
                console.error(`[DeploymentLogger] End callback error:`, error);
            }
        });
        stream.callbacks.clear();
        stream.cancelHandlers.clear();
        console.log(`[DeploymentLogger] Ended stream: ${deploymentId}`);
    }
}

/**
 * Cleanup old streams periodically
 */
export function cleanupOldStreams(): void {
    const now = Date.now();
    for (const [id, stream] of deploymentStreams.entries()) {
        const anchor = stream.endedAt ?? stream.createdAt;
        if (now - anchor > STREAM_TIMEOUT) {
            console.log(`[DeploymentLogger] Cleaning up old stream: ${id}`);
            deploymentStreams.delete(id);
        }
    }
}

// Run cleanup every 10 minutes without keeping short-lived CLI commands alive.
const cleanupInterval = setInterval(cleanupOldStreams, 10 * 60 * 1000);
cleanupInterval.unref();

/**
 * Get active stream count (for debugging)
 */
export function getActiveStreamCount(): number {
    let count = 0;
    for (const stream of deploymentStreams.values()) {
        if (!stream.ended) count += 1;
    }
    return count;
}

/**
 * Cancel a deployment
 */
export function cancelDeployment(deploymentId: string): boolean {
    const stream = deploymentStreams.get(deploymentId);
    if (stream) {
        stream.cancelled = true;
        for (const stop of Array.from(stream.cancelHandlers)) {
            try {
                stop();
            } catch {
                // Best-effort cancellation.
            }
        }
        streamLog(deploymentId, "Deployment cancelled by user");
        console.log(`[DeploymentLogger] Deployment cancelled: ${deploymentId}`);
        return true;
    }
    return false;
}

/**
 * Check if a deployment has been cancelled
 */
export function isDeploymentCancelled(deploymentId: string): boolean {
    const stream = deploymentStreams.get(deploymentId);
    return stream?.cancelled ?? false;
}

/**
 * Register a process cancellation hook for a deployment stream.
 * Returns an unregister function.
 */
export function registerDeploymentCancelHandler(
    deploymentId: string,
    stop: () => void
): () => void {
    const stream = deploymentStreams.get(deploymentId);
    if (!stream) return () => {};
    stream.cancelHandlers.add(stop);
    return () => {
        stream.cancelHandlers.delete(stop);
    };
}
