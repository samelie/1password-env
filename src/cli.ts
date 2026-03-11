#!/usr/bin/env node
import type { SecretsConfig } from "./types.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Command } from "@commander-js/extra-typings";
import { hydrateEnv } from "./hydrate.js";
import { initFromConfig } from "./init.js";
import { resolveSecrets } from "./resolve.js";

interface PkgJson {
    "op-env"?: SecretsConfig;
}

/**
 * Walk up from `startDir` looking for a package.json with an "op-env" key.
 * Returns { config, baseDir } or null.
 */
function findPackageJsonConfig(startDir: string): { config: SecretsConfig; baseDir: string } | null {
    let dir = resolve(startDir);
    const root = resolve("/");
    while (dir !== root) {
        const pkgPath = join(dir, "package.json");
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PkgJson;
            if (pkg["op-env"]) {
                return { config: pkg["op-env"], baseDir: dir };
            }
        }
        dir = dirname(dir);
    }
    return null;
}

async function loadConfigFromFile(configPath: string): Promise<{ config: SecretsConfig; baseDir: string }> {
    const abs = resolve(configPath);
    const mod = (await import(pathToFileURL(abs).href)) as { default: SecretsConfig };
    return { config: mod.default, baseDir: dirname(abs) };
}

async function resolveConfig(configPath: string | undefined): Promise<{ config: SecretsConfig; baseDir: string }> {
    if (configPath) {
        return loadConfigFromFile(configPath);
    }
    const found = findPackageJsonConfig(process.cwd());
    if (!found) {
        console.error("No config found. Either pass --config <path> or add \"op-env\" to package.json");
        process.exit(1);
    }
    return found;
}

const program = new Command()
    .name("op-env")
    .description("Manage secrets via 1Password")
    .version("0.0.1");

program
    .command("init")
    .description("Scaffold 1Password vault and items from a secrets config")
    .option("-c, --config <path>", "Path to secrets config file (default: package.json op-env key)")
    .option("-f, --from-env <path>", "Seed field values from an existing .env file")
    .option("-n, --dry-run", "Show what would be created without making changes")
    .action(async opts => {
        const { config, baseDir } = await resolveConfig(opts.config);

        const result = await initFromConfig(config, {
            fromEnv: opts.fromEnv ? resolve(baseDir, opts.fromEnv) : undefined,
            dryRun: opts.dryRun,
        });

        console.log("");
        if (result.items.some(i => i.created)) {
            console.log("Next steps:");
            console.log("  1. Create a service account at https://my.1password.com/developer-tools/directory");
            const allVaults = [...new Set([config.vault, ...Object.values(config.environments).map(e => e.vault).filter(Boolean)])];
            console.log(`  2. Grant it access to vault${allVaults.length > 1 ? "s" : ""}: ${allVaults.join(", ")}`);
            console.log("  3. export OP_SERVICE_ACCOUNT_TOKEN=<token> in ~/.zshrc");
            console.log("  4. gh secret set OP_SERVICE_ACCOUNT_TOKEN");
            const placeholders = result.items.filter(i => i.created && i.fieldsSeeded === 0);
            if (placeholders.length > 0) {
                console.log("");
                console.log("Items with placeholder values (update in 1Password):");
                for (const item of placeholders) {
                    const itemVault = config.environments[item.env]?.vault ?? config.vault;
                    console.log(`  op item edit --vault "${itemVault}" "${item.name}" '<FIELD>[password]=<value>'`);
                }
            }
        }
    });

program
    .command("hydrate")
    .description("Resolve secrets from 1Password and write .env files")
    .option("-c, --config <path>", "Path to secrets config file (default: package.json op-env key)")
    .option("-e, --env <name>", "Specific environment to hydrate (default: all)")
    .action(async opts => {
        requireServiceAccountToken();
        const { config, baseDir } = await resolveConfig(opts.config);
        const envs = opts.env ? [opts.env] : Object.keys(config.environments);
        for (const name of envs) {
            const out = await hydrateEnv(config, name, baseDir);
            console.log(`${name} → ${out}`);
        }
    });

program
    .command("resolve")
    .description("Resolve secrets and print to stdout")
    .option("-c, --config <path>", "Path to secrets config file (default: package.json op-env key)")
    .requiredOption("-e, --env <name>", "Environment to resolve")
    .action(async opts => {
        requireServiceAccountToken();
        const { config } = await resolveConfig(opts.config);
        const secrets = await resolveSecrets(config, opts.env);
        for (const [k, v] of Object.entries(secrets)) console.log(`${k}=${v}`);
    });

function requireServiceAccountToken(): void {
    if (!process.env.OP_SERVICE_ACCOUNT_TOKEN) {
        console.error("!! OP_SERVICE_ACCOUNT_TOKEN not set");
        console.error("!! Create service account: https://my.1password.com/developer-tools/directory");
        process.exit(1);
    }
}

program.parseAsync().catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
});
