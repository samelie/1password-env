import assert from "node:assert/strict";
import process from "node:process";
import { afterEach, it, vi } from "vitest";
import { generateCiRefs } from "../src/ci-refs.ts";
import { resolveSecrets } from "../src/resolve.ts";

const mocks = vi.hoisted(() => ({ calls: [] as string[], clients: 0 }));
vi.mock("@1password/sdk", () => ({ createClient: async () => {
    mocks.clients++;
    return { secrets: { resolve: async (ref: string) => {
        mocks.calls.push(ref);
        return `mock:${ref}`;
    } } };
} }));

afterEach(() => {
    delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
    delete process.env.LEGACY;
    mocks.calls.length = 0;
    mocks.clients = 0;
});

const config = { vault: "infra", environments: { development: {
    item: "default-item", outputFile: "unused", fields: ["LEGACY", { env: "OBJECT" }, { env: "RENAMED", field: "stored-field" }, { env: "OPENAI_API_KEY", item: "openai" }, { env: "OPENROUTER_API_KEY", item: "openrouter" }, { env: "MIXED", field: "other-field", item: "other-item" }],
} } };

it("runtime resolution keeps string/object defaults and honors item plus field overrides", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "mock-only-token";
    const result = await resolveSecrets(config, "development");
    assert.deepEqual(mocks.calls, ["op://infra/default-item/LEGACY", "op://infra/default-item/OBJECT", "op://infra/default-item/stored-field", "op://infra/openai/OPENAI_API_KEY", "op://infra/openrouter/OPENROUTER_API_KEY", "op://infra/other-item/other-field"]);
    assert.equal(mocks.clients, 1);
    assert.equal(result.OPENAI_API_KEY, "mock:op://infra/openai/OPENAI_API_KEY");
    assert.equal(result.OPENROUTER_API_KEY, "mock:op://infra/openrouter/OPENROUTER_API_KEY");
    assert.equal(result.RENAMED, "mock:op://infra/default-item/stored-field");
});

it("cI reference generation follows the same mixed field bindings without SDK access", () => {
    const refs = generateCiRefs(config, ["development"]);
    for (const line of ["LEGACY: op://infra/default-item/LEGACY", "OBJECT: op://infra/default-item/OBJECT", "RENAMED: op://infra/default-item/stored-field", "OPENAI_API_KEY: op://infra/openai/OPENAI_API_KEY", "OPENROUTER_API_KEY: op://infra/openrouter/OPENROUTER_API_KEY", "MIXED: op://infra/other-item/other-field"]) assert.ok(refs.includes(line));
    assert.equal(mocks.clients, 0);
});

it("environment vault override applies to default and field-level items", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "mock-only-token";
    const selected = { ...config, environments: { development: { ...config.environments.development, vault: "override-vault" } } };
    await resolveSecrets(selected, "development");
    assert.ok(mocks.calls.every(ref => ref.startsWith("op://override-vault/")));
    assert.ok(generateCiRefs(selected, ["development"]).includes("OPENAI_API_KEY: op://override-vault/openai/OPENAI_API_KEY"));
    assert.ok(generateCiRefs(selected, ["development"]).includes("OPENROUTER_API_KEY: op://override-vault/openrouter/OPENROUTER_API_KEY"));
});

it("environment fallback reads the env key without SDK initialization", async () => {
    process.env.LEGACY = "mock-env-value";
    const selected = { ...config, environments: { development: { ...config.environments.development, fields: ["LEGACY"] } } };
    assert.deepEqual(await resolveSecrets(selected, "development"), { LEGACY: "mock-env-value" });
    assert.equal(mocks.clients, 0);
});
