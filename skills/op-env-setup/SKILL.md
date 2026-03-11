---
name: op-env-setup
description: Interactive guide for setting up @adddog/1password-env in a project. Use when a user wants to configure 1Password-based secret management, set up vaults, define environments (dev/staging/prod), scaffold 1Password items, or troubleshoot op-env hydration. Also use when the user mentions op-env, secret management with 1Password, or wants to add secrets to a new or existing app in the monorepo. Triggers on phrases like "set up secrets", "add 1password", "configure vault", "op-env", "hydrate secrets", "new environment", or any request to manage .env files via 1Password.
---

# op-env Setup Guide

You are guiding a human through setting up `@adddog/1password-env` for their project. This is an interactive, conversational process — ask questions, confirm choices, and explain what's happening at each step.

The package lives at `/Volumes/DriveHard/samelie-monorepo/packages/1password-env/`. Read the README there if you need API details beyond what's covered here.

## Overview

`op-env` replaces committed `.env` files with 1Password-backed secret management:

```
package.json "op-env" config  →  1Password vault/items  →  .env files (local) / CI env vars
       defineSecrets()              op-env init               op-env hydrate
```

## Step 1: Understand the project

Before writing any config, interview the user:

1. **Which package?** — Find the target `package.json`. If the user says "this project" or is vague, check the current working directory.
2. **What secrets does the app need?** — Look at existing `.env` files, `.env.example`, docker-compose files, or code that reads `process.env.*`. List what you find and confirm with the user.
3. **Which environments?** — Common patterns:
   - Single env: `remote` (for local dev pointing at remote services)
   - Standard: `dev`, `staging`, `prod`
   - With local: `local`, `remote`, `staging`, `prod`

   Ask: "What environments do you need? Just one for now, or separate dev/staging/prod?"

4. **Vault strategy** — By default, one vault per project (named after the project). Per-environment vault overrides are supported if the user wants isolation (e.g., prod secrets in a separate vault with tighter access controls). Ask only if the user mentions isolation concerns — don't overwhelm with options upfront.

5. **Existing secrets?** — Ask if they have an existing `.env` file to seed from. This saves manual entry in 1Password.

## Step 2: Build the config

Construct the `"op-env"` config for their `package.json`. The schema:

```jsonc
{
  "op-env": {
    "vault": "project-name",          // top-level vault (required)
    "environments": {
      "remote": {
        // "vault": "project-name-prod",  // optional per-env override
        "item": "remote",              // 1Password item name
        "fields": [
          "SECRET_KEY",               // string shorthand: env var = 1P field name
          { "env": "DB_PASS", "field": "database-password" }  // when names differ
        ],
        "outputFile": ".config/.env.dev.remote",  // relative to package.json dir
        "format": "dotenv",           // "dotenv" (default) or "shell"
        "literals": {                 // non-secret values included in output
          "API_URL": "https://api.example.com"
        }
      }
    }
  }
}
```

**Present the draft config to the user and confirm before writing it.** Walk through each field so they understand what it does.

Also add these scripts to package.json:
```json
{
  "scripts": {
    "hydrate": "op-env hydrate",
    "hydrate:init": "op-env init --from-env <path-to-existing-env>"
  }
}
```

If there's no existing `.env` to seed from, use `"hydrate:init": "op-env init"` instead.

## Step 3: Install the dependency

```bash
pnpm -F "<package-name>" add @adddog/1password-env
```

In the monorepo, use `workspace:*`:
```bash
pnpm -F "<package-name>" add @adddog/1password-env@"workspace:*"
```

## Step 4: Scaffold 1Password vault + items

Run `op-env init` to create the vault and items. Always dry-run first so the user can preview:

```bash
pnpm -F "<package-name>" hydrate:init -- --dry-run
```

Then for real:
```bash
pnpm -F "<package-name>" hydrate:init
```

**If init fails:**
- `op CLI not found` → The user needs the 1Password desktop app with CLI integration enabled. Link: https://developer.1password.com/docs/cli/get-started/
- Authentication errors → The user needs to sign into `op` via the desktop app (not the service account — `init` uses personal auth)

After init succeeds, relay the "Next steps" output and explain each one.

## Step 5: Manual steps (explain clearly)

These cannot be automated — walk the user through them:

### Service account (one-time per 1Password account)

Check if the user already has one:
```bash
echo $OP_SERVICE_ACCOUNT_TOKEN
```

If not set, guide them:
1. Go to https://my.1password.com/developer-tools/directory
2. Create a service account (web UI only — no API for this)
3. Grant it access to the vault(s) created in step 4
4. Copy the token

### Token configuration

```bash
# Local dev — add to shell profile
echo 'export OP_SERVICE_ACCOUNT_TOKEN="ops_..."' >> ~/.zshrc
source ~/.zshrc

# GitHub Actions (if applicable)
gh secret set OP_SERVICE_ACCOUNT_TOKEN
```

**Important caveat:** When `op-env init` creates a NEW vault, the user must manually grant the service account access to it via the 1Password web UI. This is the only recurring manual step — remind the user every time a new vault is created.

## Step 6: Verify with hydrate

```bash
pnpm -F "<package-name>" hydrate
```

Check the output file exists and has real values (not `REPLACE_ME` placeholders).

If secrets show `REPLACE_ME`, the user needs to edit them in 1Password:
```bash
op item edit --vault "<vault>" "<item>" 'FIELD_NAME[password]=actual-value'
```

Or they can edit via the 1Password desktop app / web UI.

## Step 7: Gitignore the output

Make sure the `.env` output files are in `.gitignore`. Check and add if missing.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `OP_SERVICE_ACCOUNT_TOKEN not set` | Token not in shell env | Add to `~/.zshrc` and `source` it |
| `Unknown environment: X` | Typo in `-e` flag or missing env in config | Check `package.json` `op-env.environments` keys |
| `vault not found` | Service account lacks vault access | Grant access at https://my.1password.com/developer-tools/directory |
| `REPLACE_ME` in output | Field not seeded during init | Edit in 1Password UI or `op item edit` |
| `op CLI not found` | 1Password CLI not installed | https://developer.1password.com/docs/cli/get-started/ |

## Per-environment vault override

For projects that need vault isolation (e.g., prod secrets locked down separately):

```jsonc
{
  "op-env": {
    "vault": "myapp",              // default vault
    "environments": {
      "dev": {
        "item": "dev",
        "vault": "myapp",          // uses default — can omit
        "fields": ["SECRET"],
        "outputFile": ".env.dev"
      },
      "prod": {
        "item": "prod",
        "vault": "myapp-prod",     // separate vault with restricted access
        "fields": ["SECRET"],
        "outputFile": ".env.prod"
      }
    }
  }
}
```

Only introduce this pattern when the user explicitly asks about environment isolation or has compliance requirements. For most projects, a single vault is simpler and sufficient.

## CI Integration (GitHub Actions)

For CI, recommend the official 1Password action instead of `op-env hydrate`:

```yaml
- uses: 1password/load-secrets-action@v2
  with:
    export-env: true
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    MY_SECRET: op://vault/item/field
```

The secret references use the same `op://vault/item/field` format.
