---
generated_at: "2026-03-14"
source_hash: "994219301021"
sources:
  - src/index.ts
  - src/cli.ts
  - src/types.ts
  - src/hydrate.ts
  - src/resolve.ts
  - src/init.ts
  - src/ci-refs.ts
  - skills/op-env-setup/SKILL.md
  - .claude-plugin/plugin.json
---

# @adddog/1password-env

CLI + programmatic API replacing `.env` files with 1Password vault-backed secret hydration. Published to npm as `@adddog/1password-env`.

## Mental Model

```
SecretsConfig (pkg.json "op-env" or secrets.ts)
  → init: op CLI (desktop auth) scaffolds vault + items
  → hydrate/resolve: @1password/sdk (service account token) reads secrets → .env files or stdout
  → ci-refs: generates 1password/load-secrets-action@v2 YAML (no auth needed)
```

Two auth modes:
- `init` — uses `op` CLI (desktop app personal auth, `execSync`)
- `hydrate`/`resolve` — uses `@1password/sdk` via `OP_SERVICE_ACCOUNT_TOKEN`

## File Map

| File | Role |
|------|------|
| `src/types.ts` | `SecretsConfig`, `EnvironmentConfig`, `SecretField`, `OutputFormat` |
| `src/cli.ts` | Commander CLI: `init`, `hydrate`, `resolve`, `ci-refs` commands |
| `src/init.ts` | Scaffold vault + items via `op` CLI. Supports `--from-env` seeding, `--dry-run` |
| `src/hydrate.ts` | Resolve secrets → write `.env` file (dotenv or shell format) |
| `src/resolve.ts` | Core resolver: `sdk.createClient()` → `client.secrets.resolve(op://ref)`. Also exports `defineSecrets()` identity helper |
| `src/ci-refs.ts` | Generate GitHub Actions YAML step from config (pure transform, no auth) |
| `src/index.ts` | Barrel: re-exports `generateCiRefs`, `hydrateEnv`, `initFromConfig`, `defineSecrets`, `resolveSecrets` + types |

## Config Schema

Two config sources (CLI walks up from cwd looking for `package.json["op-env"]`, or `--config <path>` for standalone file with `export default`):

```ts
interface SecretsConfig {
  vault: string;                           // default vault name
  environments: Record<string, {
    vault?: string;                        // per-env vault override
    item: string;                          // 1Password item name
    fields: (string | { env: string; field?: string })[];
    outputFile: string;                    // relative to config dir
    format?: "dotenv" | "shell";           // default: dotenv
    literals?: Record<string, string>;     // non-secret key-values
  }>;
}
```

Field shorthand: `"MY_KEY"` → env var = 1P field name. Object form `{ env, field }` when they differ.

## CLI Commands

| Command | Auth | Description |
|---------|------|-------------|
| `op-env init [-c config] [-f .env] [-n]` | op CLI (desktop) | Create vault + items, optional seed from .env |
| `op-env hydrate [-c config] [-e env]` | SDK (SA token) | Write .env files for one or all environments |
| `op-env resolve -e env [-c config]` | SDK (SA token) | Print resolved secrets to stdout |
| `op-env ci-refs -e env... [-c config]` | None | Output GitHub Actions YAML step |

## Programmatic API

```ts
import { hydrateEnv, resolveSecrets, defineSecrets, generateCiRefs, initFromConfig } from "@adddog/1password-env"

// Type-safe config definition
const config = defineSecrets({ vault: "...", environments: { ... } })

// Resolve to Record<string, string>
const secrets = await resolveSecrets(config, "prod")

// Write .env file, returns output path
const path = await hydrateEnv(config, "remote", baseDir)

// Generate CI YAML (sync, no auth)
const yaml = generateCiRefs(config, ["staging", "prod"])
```

## Secret Reference Format

`op://{vault}/{item}/{field}` — constructed in `resolve.ts:35`. Vault falls back: `envConfig.vault ?? config.vault`.

## Claude Code Plugin

Published as a Claude Code plugin via `.claude-plugin/`:
- `plugin.json` — plugin manifest (name, version, description)
- `marketplace.json` — npm distribution metadata
- `skills/op-env-setup/SKILL.md` — interactive setup guide skill

Installed via `@adddog/1password-env` npm package. The skill walks users through config creation, vault scaffolding, service account setup, and hydration verification.

## Build

`tsup` — dual ESM/CJS, `--platform node`. Entries: `src/index.ts` (library), `src/cli.ts` (bin). Published bin: `op-env`.

## Dependencies

- `@1password/sdk` — secret resolution (service account auth)
- `commander` + `@commander-js/extra-typings` — CLI
- Dev: `@adddog/monorepo-consistency` (workspace)

## Key Gotchas

- `init` uses `op` CLI (desktop auth) but `hydrate`/`resolve` use SDK (service account) — different auth paths
- `OP_SERVICE_ACCOUNT_TOKEN` required for hydrate/resolve, NOT for init or ci-refs
- New vaults require manual service account access grant in 1Password web UI
- `literals` in config are non-secret values included verbatim in output (no vault lookup)
- No tests yet (`"test": "echo 'no tests yet'"`)
