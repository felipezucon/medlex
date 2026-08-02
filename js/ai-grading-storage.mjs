import {STORAGE_KEYS, readJsonStorage, writeJsonStorage, removeStorageKey} from "./storage.mjs";

export const AI_GRADING_CONSENT_VERSION = 1;
const MAX_CACHE_ITEMS = 500;
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

const validSettings = value => value?.version === 1
  && ["unconfigured", "locked", "ready", "invalid", "limited", "unavailable"].includes(value.state)
  && (value.lastSuccessfulTestAt === null || typeof value.lastSuccessfulTestAt === "string");
const validConsent = value => value?.aiGradingConsentVersion === AI_GRADING_CONSENT_VERSION
  && typeof value.accepted === "boolean"
  && (value.acceptedAt === null || typeof value.acceptedAt === "string");
const validCache = value => value?.version === 1 && isObject(value.items);

export function readAISettings() {
  return readJsonStorage(STORAGE_KEYS.aiSettings, {
    version: 1,
    state: "unconfigured",
    lastSuccessfulTestAt: null
  }, validSettings);
}

export function writeAISettings(changes) {
  return writeJsonStorage(STORAGE_KEYS.aiSettings, {...readAISettings(), ...changes, version: 1});
}

export function readAIConsent() {
  return readJsonStorage(STORAGE_KEYS.aiConsent, {
    aiGradingConsentVersion: AI_GRADING_CONSENT_VERSION,
    accepted: false,
    acceptedAt: null
  }, validConsent);
}

export function setAIConsent(accepted) {
  return writeJsonStorage(STORAGE_KEYS.aiConsent, {
    aiGradingConsentVersion: AI_GRADING_CONSENT_VERSION,
    accepted: Boolean(accepted),
    acceptedAt: accepted ? new Date().toISOString() : null
  });
}

export const hasAIConsent = () => readAIConsent().accepted;

export function readCachedGrading(hash) {
  return readJsonStorage(STORAGE_KEYS.aiGradingCache, {version: 1, items: {}}, validCache).items[hash] || null;
}

export function writeCachedGrading(hash, result) {
  const cache = readJsonStorage(STORAGE_KEYS.aiGradingCache, {version: 1, items: {}}, validCache);
  cache.items[hash] = result;
  const entries = Object.entries(cache.items)
    .sort(([, a], [, b]) => String(b.correctedAt).localeCompare(String(a.correctedAt)))
    .slice(0, MAX_CACHE_ITEMS);
  writeJsonStorage(STORAGE_KEYS.aiGradingCache, {version: 1, items: Object.fromEntries(entries)});
}

export function clearAIGradingCache() {
  removeStorageKey(STORAGE_KEYS.aiGradingCache);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

export async function gradingHash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
