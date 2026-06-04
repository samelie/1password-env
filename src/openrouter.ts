import type { SecretsConfig } from "./types.js";
import { defineSecrets } from "./resolve.js";

/**
 * 1Password item name holding the OpenRouter gateway API key.
 *
 * Env-injected only — NO secret value is committed here. At runtime the key is
 * resolved from `op://infra/openrouter/OPENROUTER_API_KEY` (CI uses
 * `1password/load-secrets-action`; local uses `op-env hydrate`).
 *
 * Provisioned: infra vault, SECURE_NOTE item `openrouter`, concealed field
 * `OPENROUTER_API_KEY` (mirrors the `openai`/`gemini` items). k8s prod pods still
 * require the ExternalSecret wiring + redeploy — see the human-gated checklist
 * (team-session/20260603-openrouter-adapter).
 */
export const OPENROUTER_ITEM = "openrouter";

/**
 * Standalone secrets config declaring the `OPENROUTER_API_KEY` ref in the
 * `infra` vault. Mergeable into a consumer's `defineSecrets({...})` or usable
 * directly with `op-env --config`. Produces the op:// ref
 * `op://infra/openrouter/OPENROUTER_API_KEY`.
 */
export const openRouterSecrets: SecretsConfig = defineSecrets({
    vault: "infra",
    environments: {
        // Single env-injected secret; no committed value, no outputFile writes a value.
        default: {
            item: OPENROUTER_ITEM,
            fields: ["OPENROUTER_API_KEY"],
            outputFile: ".config/.env.openrouter",
            format: "shell",
        },
    },
});
