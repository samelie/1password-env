import type { OutputFormat, SecretsConfig } from "./types.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { resolveSecrets } from "./resolve.js";

function formatLine(key: string, value: string, format: OutputFormat): string {
    if (format === "shell") return `export ${key}="${value}"`;
    return `${key}=${value}`;
}

export async function hydrateEnv(
    config: SecretsConfig,
    envName: string,
    baseDir?: string,
): Promise<string> {
    const envConfig = config.environments[envName];
    if (!envConfig) throw new Error(`Unknown environment: ${envName}`);

    const format = envConfig.format ?? "dotenv";
    const secrets = await resolveSecrets(config, envName);

    const lines = Object.entries(secrets).map(([k, v]) => formatLine(k, v, format));
    if (format === "shell") lines.unshift("#!/bin/bash");

    const outPath = resolve(baseDir ?? process.cwd(), envConfig.outputFile);
    writeFileSync(outPath, `${lines.join("\n")}\n`, "utf-8");
    return outPath;
}
