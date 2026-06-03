import type { SecretsConfig } from "./types.js";
import { defineSecrets } from "./resolve.js";

/**
 * 1Password secret reference for the OpenRouter gateway API key.
 *
 * Env-injected only — NO secret value is committed here. At runtime the key is
 * resolved from `op://infra/<item>/OPENROUTER_API_KEY` (CI uses
 * `1password/load-secrets-action`; local uses `op-env hydrate`).
 *
 * PREREQUISITE GATE: the 1Password item name is TBD. `OPENROUTER_ITEM_TBD` is a
 * placeholder — a human must provision the OpenRouter account, store the key in
 * 1Password, then replace `OPENROUTER_ITEM_TBD` with the real item name before
 * `op-env init`/`hydrate`/CI secret sync will resolve. See the team plan's
 * human-gated checklist (team-session/20260603-openrouter-adapter).
 */
export const OPENROUTER_ITEM_TBD = "OPENROUTER_ITEM_TBD";

/**
 * Standalone secrets config declaring the `OPENROUTER_API_KEY` ref in the
 * `infra` vault. Mergeable into a consumer's `defineSecrets({...})` or usable
 * directly with `op-env --config`. Produces the op:// ref
 * `op://infra/OPENROUTER_ITEM_TBD/OPENROUTER_API_KEY`.
 */
export const openRouterSecrets: SecretsConfig = defineSecrets({
    vault: "infra",
    environments: {
        // Single env-injected secret; no committed value, no outputFile writes a value.
        default: {
            // TBD prerequisite placeholder — replace with the real 1Password item name.
            item: OPENROUTER_ITEM_TBD,
            fields: ["OPENROUTER_API_KEY"],
            outputFile: ".config/.env.openrouter",
            format: "shell",
        },
    },
});
