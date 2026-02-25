export type ServiceConfig = {
    systemd: {
        serviceName: string; // Name of the systemd unit
        description: string; // Description shown in `systemctl status`
        execStart: string; // Command to run
        workingDirectory: string; // Project root or executable directory
        user: string; // System user to run the service as
        wantedBy: string; // e.g., "multi-user.target"
        autoStart?: boolean; // Whether to enable on boot
    };
    git: {
        remoteName: string;
        watchRemoteBranch: string; // Remote to watch (e.g., main/develop)
    };
    buildSteps: string[]; // Shell commands to run before starting service
    networking: {
        port: number;
        domain: string;
        ngrokExpose?: boolean;
    };
};

export type Okastr8Config = {
    services: ServiceConfig[];
    networking: {
        ngrok: {
            authToken?: string; // Ngrok auth token
        };
    };
};
export type GitWebhookPayload = {
    ref: string;
    before: string;

    repository: {
        name: string;
        ssh_url: string;
        clone_url: string;
        html_url: string;
    };
};

export type OrchestrateEnvironment = {
    createUser: {
        userName: string;
        passWord: string;
        distro?: string;
    };
    changeSSHPort: {
        port: number;
    };
};

export interface DeployConfig {
    runtime?: string; // Optional - will be auto-detected if not provided
    buildSteps: string[];
    startCommand: string;
    port: number; // Required for health checks
    domain?: string;
    database?: string; // e.g., "postgres:15" | "mysql:8" | "mongodb:7"
    cache?: string; // e.g., "redis:7"
    env?: Record<string, string>;
    tunnel_routing?: boolean;
    deployStrategy?: "git" | "image";
    imageRef?: string;
}

export interface DeployFromPathOptions {
    appName: string;
    releasePath: string; // Path to version folder containing okastr8.yaml
    versionId: number;
    gitRepo?: string; // Optional: for app.json metadata
    gitBranch?: string;
    env?: Record<string, string>;
    onProgress?: (msg: string) => void;
    deploymentId?: string;
}

export interface DeployResult {
    success: boolean;
    message: string;
    config?: DeployConfig;
}
