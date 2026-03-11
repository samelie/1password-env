export type OutputFormat = "dotenv" | "shell";

export interface SecretField {
    /** env var name, e.g. "COOKIE_SECRET" */
    env: string;
    /** 1Password field name (defaults to env if omitted) */
    field?: string;
}

export interface EnvironmentConfig {
    /** Override vault for this environment (defaults to top-level vault) */
    vault?: string;
    /** 1Password item name, e.g. "remote" */
    item: string;
    /** Fields to resolve from this item */
    fields: (string | SecretField)[];
    /** Output file path relative to config file dir */
    outputFile: string;
    /** Output format: "dotenv" (KEY=value) or "shell" (export KEY="value") */
    format?: OutputFormat;
    /** Extra literal (non-secret) key-values to include */
    literals?: Record<string, string>;
}

export interface SecretsConfig {
    /** 1Password vault name (one vault per project) */
    vault: string;
    /** Named environments */
    environments: Record<string, EnvironmentConfig>;
}
