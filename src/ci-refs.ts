import type { SecretsConfig } from "./types.js";

/**
 * Generate a `1password/load-secrets-action@v2` YAML step from config env names.
 * No 1Password auth needed — purely reads config and formats op:// refs.
 */
export function generateCiRefs(config: SecretsConfig, envNames: string[]): string {
    const refs: Record<string, string> = {};

    for (const name of envNames) {
        const env = config.environments[name];
        if (!env) {
            throw new Error(`Unknown environment: "${name}" (available: ${Object.keys(config.environments).join(", ")})`);
        }
        const vault = env.vault ?? config.vault;
        for (const f of env.fields) {
            const envKey = typeof f === "string" ? f : f.env;
            const field = typeof f === "string" ? f : (f.field ?? f.env);
            refs[envKey] = `op://${vault}/${env.item}/${field}`;
        }
    }

    const lines = [
        "- name: Load secrets from 1Password",
        "  uses: 1password/load-secrets-action@v2",
        "  with:",
        "    export-env: true",
        "  env:",
        // eslint-disable-next-line no-template-curly-in-string -- GitHub Actions expression syntax, not JS template literal
        "    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}",
    ];

    for (const [key, ref] of Object.entries(refs)) {
        lines.push(`    ${key}: ${ref}`);
    }

    return lines.join("\n");
}
