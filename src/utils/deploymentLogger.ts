/**
 * Deployment Logger - Streams logs to UI during deployments
 * Uses in-memory streams for active deployments
 */

export interface DeploymentStream {
    id: string;
    callbacks: Set<(message: string) => void>;
    createdAt: number;
    cancelled: boolean;
}

// Store active deployment streams
const deploymentStreams = new Map<string, DeploymentStream>();

// Cleanup old streams after 1 hour
const STREAM_TIMEOUT = 60 * 60 * 1000;

import { writeUnifiedEntry } from './structured-logger';

/**
 * Start a new deployment stream
 */
export function startDeploymentStream(deploymentId: string): void {
    deploymentStreams.set(deploymentId, {
        id: deploymentId,
        callbacks: new Set(),
        createdAt: Date.now(),
        cancelled: false,
    });
    console.log(`[DeploymentLogger] Started stream: ${deploymentId}`);
}

/**
 * Log a message to a deployment stream and console
 */
export function streamLog(deploymentId: string, message: string): void {
    const stream = deploymentStreams.get(deploymentId);
    if (stream) {
        // Send to all connected clients
        stream.callbacks.forEach(callback => {
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
export function subscribe(
    deploymentId: string,
    callback: (message: string) => void
): () => void {
    const stream = deploymentStreams.get(deploymentId);
    if (!stream) {
        console.warn(`[DeploymentLogger] Stream not found: ${deploymentId}`);
        return () => { };
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
        // Notify all subscribers that stream is ending
        stream.callbacks.forEach(callback => {
            try {
                callback('[DEPLOYMENT_STREAM_END]');
            } catch (error) {
                console.error(`[DeploymentLogger] End callback error:`, error);
            }
        });

        deploymentStreams.delete(deploymentId);
        console.log(`[DeploymentLogger] Ended stream: ${deploymentId}`);
    }
}

/**
 * Cleanup old streams periodically
 */
export function cleanupOldStreams(): void {
    const now = Date.now();
    for (const [id, stream] of deploymentStreams.entries()) {
        if (now - stream.createdAt > STREAM_TIMEOUT) {
            console.log(`[DeploymentLogger] Cleaning up old stream: ${id}`);
            endDeploymentStream(id);
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldStreams, 10 * 60 * 1000);

/**
 * Get active stream count (for debugging)
 */
export function getActiveStreamCount(): number {
    return deploymentStreams.size;
}

/**
 * Cancel a deployment
 */
export function cancelDeployment(deploymentId: string): boolean {
    const stream = deploymentStreams.get(deploymentId);
    if (stream) {
        stream.cancelled = true;
        streamLog(deploymentId, 'Deployment cancelled by user');
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
