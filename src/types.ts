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
    watchRemoteBranch: string;         // Remote to watch (e.g., main/develop)
  };
  buildSteps: string[];          // Shell commands to run before starting service
};

export type GitWebhookPayload = {
    ref:string,
    before:string,
    
    repository:{
        name:string,
        ssh_url:string,
        clone_url:string,
        html_url:string,
    }
}

export type Okastr8Config = {
    services: ServiceConfig[]
}

export type DeploysMetadata = {
    gitHash: string;  // Commit hash of the deployment
    timeStamp: Date;
    ssh_url:string  // Timestamp of the deployment
}

export type Deployment = {
    serviceName:string,
    gitRemoteName:string,
    deploys:DeploysMetadata[]
    lastSuccessfulDeploy:DeploysMetadata | null 

}

export type DeploymentRecord = {
    deployments: Deployment[]
}

export type OrchestrateEnvironment = {
  createUser:{
    userName:string,
    passWord:string,
    distro?:string
  },
  changeSSHPort:{
    port:number
  },
  
    
}
