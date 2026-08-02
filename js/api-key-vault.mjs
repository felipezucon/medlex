import {STORAGE_KEYS, readJsonStorage, writeJsonStorage, removeStorageKey} from "./storage.mjs";

const VAULT_VERSION = 1;
const ITERATIONS = 250000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let unlockedApiKey = null;

const toBase64 = bytes => {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = value => {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const validVault = value => value?.version === VAULT_VERSION
  && value.algorithm === "AES-GCM"
  && value.kdf === "PBKDF2-SHA-256"
  && Number.isInteger(value.iterations) && value.iterations >= ITERATIONS
  && [value.salt, value.iv, value.ciphertext, value.createdAt].every(item => typeof item === "string" && item.length > 0);

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name: "PBKDF2", hash: "SHA-256", salt, iterations},
    material,
    {name: "AES-GCM", length: 256},
    false,
    ["encrypt", "decrypt"]
  );
}

export function vaultState() {
  const configured = Boolean(readJsonStorage(STORAGE_KEYS.aiKeyVault, null, validVault));
  return {configured, unlocked: configured && unlockedApiKey !== null};
}

export async function configureApiKey(apiKey, password, confirmation) {
  const keyText = String(apiKey ?? "").trim();
  if (!keyText) throw new Error("Ingrese una clave de API.");
  if (String(password).length < 8) throw new Error("La contraseña local debe tener al menos 8 caracteres.");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, encoder.encode(keyText));
  writeJsonStorage(STORAGE_KEYS.aiKeyVault, {
    version: VAULT_VERSION,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
    createdAt: new Date().toISOString()
  });
  unlockedApiKey = keyText;
}

export async function unlockApiKey(password) {
  const vault = readJsonStorage(STORAGE_KEYS.aiKeyVault, null, validVault);
  if (!vault) throw new Error("No hay una clave configurada.");
  try {
    const key = await deriveKey(String(password), fromBase64(vault.salt), vault.iterations);
    const plaintext = await crypto.subtle.decrypt(
      {name: "AES-GCM", iv: fromBase64(vault.iv)},
      key,
      fromBase64(vault.ciphertext)
    );
    const value = decoder.decode(plaintext).trim();
    if (!value) throw new Error("empty");
    unlockedApiKey = value;
  } catch {
    unlockedApiKey = null;
    throw new Error("La contraseña local no es correcta.");
  }
}

export function lockApiKey() {
  unlockedApiKey = null;
}

export function forgetApiKey() {
  lockApiKey();
  removeStorageKey(STORAGE_KEYS.aiKeyVault);
}

export async function withUnlockedApiKey(operation) {
  if (!unlockedApiKey) throw new Error("La clave de API está bloqueada.");
  return operation(unlockedApiKey);
}
