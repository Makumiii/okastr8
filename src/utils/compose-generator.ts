/**
 * Docker Compose Generator
 * Auto-generates docker-compose.yml when users specify database/cache services
 */

import type { DeployConfig } from "../types";
import { generateDockerfile } from "./dockerfile-generator";
import { writeFile } from "fs/promises";
import { join } from "path";

/**
 * Generate docker-compose.yml based on config
 */
export function generateCompose(
    config: DeployConfig,
    appName: string,
    envFilePath?: string
): string {
    const services: any = {
        app: {
            build: {
                context: ".",
                dockerfile: "Dockerfile.generated",
            },
            container_name: appName,
            ports: [`${config.port}:${config.port}`],
            restart: "unless-stopped",
            healthcheck: {
                test: ["CMD", "wget", "--spider", "-q", `http://127.0.0.1:${config.port}/`],
                interval: "10s",
                timeout: "5s",
                retries: 3,
                start_period: "10s",
            },
        },
    };

    // Add env_file if provided
    if (envFilePath) {
        services.app.env_file = [envFilePath];
    }

    // Add environment variables for service connections
    const environment: Record<string, string> = {};
    const dependsOn: any = {};

    // Add database service if specified
    if (config.database) {
        const dbService = parseDatabaseService(config.database);
        services[dbService.name] = dbService.config;
        dependsOn[dbService.name] = { condition: "service_healthy" };
        environment[dbService.envKey] = dbService.envValue;
    }

    // Add cache service if specified
    if (config.cache) {
        const cacheService = parseCacheService(config.cache);
        services[cacheService.name] = cacheService.config;
        dependsOn[cacheService.name] = { condition: "service_healthy" };
        environment[cacheService.envKey] = cacheService.envValue;
    }

    // Add environment and depends_on to app service
    if (Object.keys(environment).length > 0) {
        services.app.environment = environment;
    }
    if (Object.keys(dependsOn).length > 0) {
        services.app.depends_on = dependsOn;
    }

    // Build compose object
    const compose: any = {
        version: "3.8",
        services,
    };

    // Add volumes if database is present
    if (config.database) {
        compose.volumes = {
            [`${appName}_dbdata`]: {},
        };
    }

    return toYAML(compose);
}

/**
 * Parse database service string (e.g., "postgres:15") and return service config
 */
const DEFAULT_DB_VERSIONS: Record<string, string> = {
    postgres: "15",
    postgresql: "15",
    mysql: "8",
    mariadb: "10.11",
    mongodb: "7",
    mongo: "7",
};

const DEFAULT_CACHE_VERSIONS: Record<string, string> = {
    redis: "7",
};

function parseDatabaseService(database: string): {
    name: string;
    config: any;
    envKey: string;
    envValue: string;
} {
    const parts = database.split(":");
    const type = parts[0];
    const version = parts[1] || (type ? DEFAULT_DB_VERSIONS[type] : undefined) || "latest";

    if (!type) {
        throw new Error("Database type not specified");
    }

    const dbName = "database";

    switch (type.toLowerCase()) {
        case "postgres":
        case "postgresql":
            return {
                name: dbName,
                config: {
                    image: `postgres:${version}`,
                    container_name: `${dbName}-postgres`,
                    environment: {
                        POSTGRES_USER: "user",
                        POSTGRES_PASSWORD: "changeme",
                        POSTGRES_DB: "app",
                    },
                    volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/postgresql/data`],
                    restart: "unless-stopped",
                    healthcheck: {
                        test: ["CMD-SHELL", "pg_isready -U user"],
                        interval: "5s",
                        timeout: "5s",
                        retries: 5,
                    },
                },
                envKey: "DATABASE_URL",
                envValue: "postgres://user:changeme@database:5432/app",
            };

        case "mysql":
            return {
                name: dbName,
                config: {
                    image: `mysql:${version}`,
                    container_name: `${dbName}-mysql`,
                    environment: {
                        MYSQL_ROOT_PASSWORD: "changeme",
                        MYSQL_DATABASE: "app",
                        MYSQL_USER: "user",
                        MYSQL_PASSWORD: "changeme",
                    },
                    volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/mysql`],
                    restart: "unless-stopped",
                    healthcheck: {
                        test: ["CMD", "mysqladmin", "ping", "-h", "localhost"],
                        interval: "5s",
                        timeout: "5s",
                        retries: 5,
                    },
                },
                envKey: "DATABASE_URL",
                envValue: "mysql://user:changeme@database:3306/app",
            };

        case "mongodb":
        case "mongo":
            return {
                name: dbName,
                config: {
                    image: `mongo:${version}`,
                    container_name: `${dbName}-mongo`,
                    environment: {
                        MONGO_INITDB_ROOT_USERNAME: "user",
                        MONGO_INITDB_ROOT_PASSWORD: "changeme",
                    },
                    volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/data/db`],
                    restart: "unless-stopped",
                    healthcheck: {
                        test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"],
                        interval: "5s",
                        timeout: "5s",
                        retries: 5,
                    },
                },
                envKey: "MONGODB_URI",
                envValue: "mongodb://user:changeme@database:27017",
            };

        case "mariadb":
            return {
                name: dbName,
                config: {
                    image: `mariadb:${version}`,
                    container_name: `${dbName}-mariadb`,
                    environment: {
                        MARIADB_ROOT_PASSWORD: "changeme",
                        MARIADB_DATABASE: "app",
                        MARIADB_USER: "user",
                        MARIADB_PASSWORD: "changeme",
                    },
                    volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/mysql`],
                    restart: "unless-stopped",
                    healthcheck: {
                        test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"],
                        interval: "5s",
                        timeout: "5s",
                        retries: 5,
                    },
                },
                envKey: "DATABASE_URL",
                envValue: "mysql://user:changeme@database:3306/app",
            };

        default:
            throw new Error(`Unsupported database type: ${type}`);
    }
}

/**
 * Parse cache service string (e.g., "redis:7") and return service config
 */
function parseCacheService(cache: string): {
    name: string;
    config: any;
    envKey: string;
    envValue: string;
} {
    const parts = cache.split(":");
    const type = parts[0];
    const version = parts[1] || (type ? DEFAULT_CACHE_VERSIONS[type] : undefined) || "latest";

    if (!type) {
        throw new Error("Cache type not specified");
    }

    const cacheName = "cache";

    switch (type.toLowerCase()) {
        case "redis":
            return {
                name: cacheName,
                config: {
                    image: `redis:${version}-alpine`,
                    container_name: `${cacheName}-redis`,
                    restart: "unless-stopped",
                    healthcheck: {
                        test: ["CMD", "redis-cli", "ping"],
                        interval: "5s",
                        timeout: "5s",
                        retries: 5,
                    },
                },
                envKey: "REDIS_URL",
                envValue: "redis://cache:6379",
            };

        default:
            throw new Error(`Unsupported cache type: ${type}`);
    }
}

/**
 * Simple YAML stringifier
 * (For production, consider using a proper YAML library like 'yaml')
 */
function toYAML(obj: any, indent = 0): string {
    const spaces = "  ".repeat(indent);
    let yaml = "";

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            yaml += `${spaces}${key}:\n`;
            value.forEach((item) => {
                if (typeof item === "object") {
                    yaml += `${spaces}  - ${toYAML(item, indent + 2).trim()}\n`;
                } else {
                    yaml += `${spaces}  - ${item}\n`;
                }
            });
        } else if (typeof value === "object") {
            yaml += `${spaces}${key}:\n`;
            yaml += toYAML(value, indent + 1);
        } else if (typeof value === "string") {
            // Quote strings if they contain special characters or look like numbers
            const looksLikeNumber = /^[\d.]+$/.test(value);
            const needsQuotes =
                value.includes(":") ||
                value.includes("#") ||
                value.startsWith("$") ||
                looksLikeNumber;
            yaml += `${spaces}${key}: ${needsQuotes ? `"${value}"` : value}\n`;
        } else {
            yaml += `${spaces}${key}: ${value}\n`;
        }
    }

    return yaml;
}

/**
 * Save generated Dockerfile and docker-compose.yml to the release path
 */
export async function saveGeneratedFiles(
    releasePath: string,
    config: DeployConfig,
    appName: string,
    envFilePath?: string
): Promise<{ dockerfile: string; compose?: string }> {
    const files: { dockerfile: string; compose?: string } = {
        dockerfile: join(releasePath, "Dockerfile.generated"),
    };

    // Generate and save Dockerfile
    const dockerfile = generateDockerfile(config);
    await writeFile(files.dockerfile, dockerfile, "utf-8");

    // Generate and save docker-compose.yml if services are specified
    if (config.database || config.cache) {
        files.compose = join(releasePath, "docker-compose.generated.yml");
        const compose = generateCompose(config, appName, envFilePath);
        await writeFile(files.compose, compose, "utf-8");
    }

    return files;
}
