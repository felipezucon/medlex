import assert from "node:assert/strict";

const values = new Map([["medlex:card-progress", JSON.stringify({version: 1, cards: {kept: {reviews: 2}}})]]);
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const {STORAGE_KEYS} = await import("../js/storage.mjs");
const vault = await import("../js/api-key-vault.mjs");
const credential = ["browser", "credential", "test"].join("-");
const password = ["local", "password", "test"].join("-");

await vault.configureApiKey(credential, password, password);
const raw = localStorage.getItem(STORAGE_KEYS.aiKeyVault);
assert.ok(raw);
assert.doesNotMatch(raw, new RegExp(credential));
assert.doesNotMatch(raw, new RegExp(password));
const encrypted = JSON.parse(raw);
assert.equal(encrypted.algorithm, "AES-GCM");
assert.equal(encrypted.kdf, "PBKDF2-SHA-256");
assert.equal(encrypted.iterations, 250000);
assert.equal(vault.vaultState().unlocked, true);

vault.lockApiKey();
assert.deepEqual(vault.vaultState(), {configured: true, unlocked: false});
await assert.rejects(vault.unlockApiKey("incorrect-password"), /incorreta/);
await vault.unlockApiKey(password);
assert.equal(await vault.withUnlockedApiKey(value => value.length), credential.length);

const firstIv = encrypted.iv;
await vault.configureApiKey(credential, password, password);
assert.notEqual(JSON.parse(localStorage.getItem(STORAGE_KEYS.aiKeyVault)).iv, firstIv);

vault.forgetApiKey();
assert.equal(localStorage.getItem(STORAGE_KEYS.aiKeyVault), null);
assert.ok(localStorage.getItem(STORAGE_KEYS.cardProgress));
assert.equal(vault.vaultState().configured, false);

console.log("api key vault: ok");
