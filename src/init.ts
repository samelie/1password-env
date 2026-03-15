import type { SecretsConfig } from "./types.js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface InitResult {
    vaults: { name: string; created: boolean }[];
    items: { name: string; env: string; created: boolean; fieldsSeeded: number }[];
}

function op(args: string): string {
    return execSync(`op ${args}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function opJson<T>(args: string): T {
    return JSON.parse(op(`${args} --format=json`)) as T;
}

function vaultExists(name: string): boolean {
    try {
        op(`vault get "${name}" --format=json`);
        return true;
    } catch {
        return false;
    }
}

function itemExists(vault: string, title: string): boolean {
    try {
        op(`item get "${title}" --vault "${vault}" --format=json`);
        return true;
    } catch {
        return false;
    }
}

function parseDotenv(filePath: string): Record<string, string> {
    const abs = resolve(filePath);
    const content = readFileSync(abs, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx);
        let value = trimmed.slice(eqIdx + 1);
        // strip surrounding quotes
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

export async function initFromConfig(
    config: SecretsConfig,
    options: { fromEnv?: string; dryRun?: boolean } = {},
): Promise<InitResult> {
    const { fromEnv, dryRun } = options;

    // Verify op CLI is available
    try {
        op("--version");
    } catch {
        throw new Error("op CLI not found. Install: https://developer.1password.com/docs/cli/get-started/");
    }

    // Parse --from-env file if provided
    const envValues = fromEnv ? parseDotenv(fromEnv) : {};

    // Track which vaults have been created/checked
    const vaultsCreated = new Set<string>();
    const vaultsExisted = new Set<string>();

    function ensureVault(name: string): void {
        if (vaultsCreated.has(name) || vaultsExisted.has(name)) return;
        if (vaultExists(name)) {
            vaultsExisted.add(name);
            // eslint-disable-next-line no-console
            console.log(`vault exists: ${name}`);
        } else if (dryRun) {
            vaultsCreated.add(name);
            // eslint-disable-next-line no-console
            console.log(`[dry-run] would create vault: ${name}`);
        } else {
            opJson(`vault create "${name}"`);
            vaultsCreated.add(name);
            // eslint-disable-next-line no-console
            console.log(`created vault: ${name}`);
        }
    }

    // Create items for each environment
    const items: InitResult["items"] = [];
    // Track items created in this run to avoid duplicates when multiple environments share an item
    const itemsCreated = new Set<string>();

    for (const [envName, envConfig] of Object.entries(config.environments)) {
        const vault = envConfig.vault ?? config.vault;
        ensureVault(vault);
        const itemKey = `${vault}/${envConfig.item}`;
        const existed = itemsCreated.has(itemKey) || itemExists(vault, envConfig.item);

        if (existed) {
            // eslint-disable-next-line no-console
            console.log(`item exists: ${itemKey} (env: ${envName})`);
            items.push({ name: envConfig.item, env: envName, created: false, fieldsSeeded: 0 });
            continue;
        }

        // Build field args for op item create
        const fieldArgs: string[] = [];
        let seeded = 0;

        for (const field of envConfig.fields) {
            const envKey = typeof field === "string" ? field : field.env;
            const fieldName = typeof field === "string" ? field : (field.field ?? field.env);
            const value = envValues[envKey] ?? "";
            const fieldType = value ? "password" : "text";
            fieldArgs.push(`'${fieldName}[${fieldType}]=${value || "REPLACE_ME"}'`);
            if (value) seeded++;
        }

        // Add literals as text fields
        if (envConfig.literals) {
            for (const [k, v] of Object.entries(envConfig.literals)) {
                fieldArgs.push(`'${k}[text]=${v}'`);
                seeded++;
            }
        }

        if (dryRun) {
            // eslint-disable-next-line no-console
            console.log(`[dry-run] would create item: ${itemKey} (${fieldArgs.length} fields, ${seeded} seeded)`);
        } else {
            const cmd = `item create --vault "${vault}" --category "Secure Note" --title "${envConfig.item}" ${fieldArgs.join(" ")}`;
            op(cmd);
            // eslint-disable-next-line no-console
            console.log(`created item: ${itemKey} (${fieldArgs.length} fields, ${seeded} seeded)`);
        }

        itemsCreated.add(itemKey);

        items.push({ name: envConfig.item, env: envName, created: true, fieldsSeeded: seeded });
    }

    const vaults = [
        ...Array.from(vaultsCreated, name => ({ name, created: true })),
        ...Array.from(vaultsExisted, name => ({ name, created: false })),
    ];
    return { vaults, items };
}
