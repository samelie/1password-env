import type { SecretsConfig } from "./types.js";
import process from "node:process";

export function defineSecrets(config: SecretsConfig): SecretsConfig {
    return config;
}

export async function resolveSecrets(
    config: SecretsConfig,
    envName: string,
): Promise<Record<string, string>> {
    const envConfig = config.environments[envName];
    if (!envConfig) throw new Error(`Unknown environment: ${envName}`);

    const token = process.env.OP_SERVICE_ACCOUNT_TOKEN;

    if (!token) {
        const result: Record<string, string> = {};
        for (const field of envConfig.fields) {
            const envKey = typeof field === "string" ? field : field.env;
            const value = process.env[envKey];
            if (value) result[envKey] = value;
        }
        if (envConfig.literals) Object.assign(result, envConfig.literals);
        return result;
    }

    const sdk = await import("@1password/sdk");
    const client = await sdk.createClient({
        auth: token,
        integrationName: "adddog-1password-env",
        integrationVersion: "v1.0.0",
    });

    const result: Record<string, string> = {};

    for (const field of envConfig.fields) {
        const envKey = typeof field === "string" ? field : field.env;
        const fieldName = typeof field === "string" ? field : (field.field ?? field.env);
        const vault = envConfig.vault ?? config.vault;
        const ref = `op://${vault}/${envConfig.item}/${fieldName}`;
        result[envKey] = await client.secrets.resolve(ref);
    }

    if (envConfig.literals) Object.assign(result, envConfig.literals);
    return result;
}
