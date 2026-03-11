# @adddog/1password-env

Single source of truth for secrets via 1Password. Replaces committed `.env` files, scattered GitHub secrets, and manual secret management.

## Install

```bash
pnpm add @adddog/1password-env
```

## How it works

```
secrets.ts (config)  -->  1Password vault  -->  .env file / CI env vars
        ^                       ^                       ^
   defineSecrets()         op-env init            op-env hydrate
                                              1password/load-secrets-action (CI)
```

1. **Define** secrets in a `secrets.ts` config
2. **Init** scaffolds the 1Password vault and items (`op-env init`)
3. **Hydrate** resolves secrets and writes `.env` files (`op-env hydrate`)
4. **CI** uses `1password/load-secrets-action` to inject secrets at runtime

## Config

Add an `"op-env"` key to your `package.json` — no extra config files needed:

```jsonc
// package.json
{
  "op-env": {
    "vault": "my-project",
    "environments": {
      "remote": {
        "item": "remote",
        "fields": [
          "COOKIE_SECRET",
          "PASETO_SECRET_KEY",
          { "env": "DB_PASS", "field": "database-password" }
        ],
        "outputFile": ".config/.env.dev.remote",
        "literals": {
          "CORS_ORIGINS": "https://example.com"
        }
      }
    }
  },
  "scripts": {
    "hydrate": "op-env hydrate",
    "hydrate:init": "op-env init --from-env .config/.env.dev.remote"
  }
}
```

`outputFile` paths are relative to the `package.json` directory.

Alternatively, use a standalone `secrets.ts` file with `--config`:

```typescript
import { defineSecrets } from "@adddog/1password-env"

export default defineSecrets({
  vault: "my-project",
  environments: { /* ... */ },
})
```

## CLI

### `op-env init` — scaffold vault and items

Reads config and creates the 1Password vault + items via the `op` CLI. Requires the 1Password desktop app integration (not service account).

```bash
# Auto-discovers config from package.json "op-env" key
op-env init

# Seed values from an existing .env file
op-env init --from-env .config/.env.dev.remote

# Preview without making changes
op-env init --dry-run

# Or with pnpm scripts:
pnpm hydrate:init
```

Idempotent — skips vaults and items that already exist.

### `op-env hydrate` — write .env files

Resolves secrets from 1Password and writes the output file. Requires `OP_SERVICE_ACCOUNT_TOKEN`.

```bash
# Hydrate all environments (reads package.json)
op-env hydrate

# Hydrate a specific environment
op-env hydrate -e remote

# Or with pnpm scripts:
pnpm hydrate
```

### `op-env resolve` — print secrets to stdout

```bash
op-env resolve -e remote
# COOKIE_SECRET=abc123...
# PASETO_SECRET_KEY=k4.local...
```

All commands auto-discover config from the nearest `package.json` with an `"op-env"` key. Pass `--config <path>` to use a standalone config file instead.

## Programmatic API

```typescript
import { defineSecrets, resolveSecrets, hydrateEnv, initFromConfig } from "@adddog/1password-env"

// Resolve to a map
const secrets = await resolveSecrets(config, "remote")

// Write .env file, returns output path
const path = await hydrateEnv(config, "remote", "/path/to/base")

// Scaffold vault + items (uses op CLI)
const result = await initFromConfig(config, { fromEnv: ".env.dev.remote" })
```

## Setup (one-time)

### 1. Define config

Add `"op-env"` to your project's `package.json`.

### 2. Scaffold 1Password

```bash
# With existing .env file (seeds values):
op-env init --from-env .config/.env.dev.remote

# Without (creates placeholders):
op-env init
```

### 3. Create service account (manual — 1P web UI)

1. Go to https://my.1password.com/developer-tools/directory
2. Create a service account
3. Grant it access to your vault(s)
4. Copy the token

### 4. Configure token

```bash
# Local dev
echo 'export OP_SERVICE_ACCOUNT_TOKEN="ops_..."' >> ~/.zshrc

# GitHub Actions
gh secret set OP_SERVICE_ACCOUNT_TOKEN
```

### 5. Hydrate

```bash
op-env hydrate -c .config/secrets.ts
```

### 6. CI (GitHub Actions)

For CI, use the official 1Password action instead of this package:

```yaml
- uses: 1password/load-secrets-action@v2
  with:
    export-env: true
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    MY_SECRET: op://vault/item/field
```

## Output formats

**dotenv** (default):
```
COOKIE_SECRET=abc123
CORS_ORIGINS=https://example.com
```

**shell**:
```bash
#!/bin/bash
export COOKIE_SECRET="abc123"
export CORS_ORIGINS="https://example.com"
```
