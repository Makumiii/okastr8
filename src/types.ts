export type ServiceConfig = {
  systemd: {
    serviceName: string;         // Name of the systemd unit
    description: string;         // Description shown in `systemctl status`
    execStart: string;           // Command to run
    workingDirectory: string;    // Project root or executable directory
    user: string;                // System user to run the service as
    wantedBy: string;            // e.g., "multi-user.target"
    autoStart?: boolean;         // Whether to enable on boot
  };
  git: {
    remoteName:string
    watchRemote: string;         // Remote to watch (e.g., main/develop)
  };
  buildSteps: string[];          // Shell commands to run before starting service
};

export type Okastr8 = {
    services: ServiceConfig[]
}
