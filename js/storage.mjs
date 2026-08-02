export const STORAGE_SCHEMA_VERSION = 4;
export const CONTENT_VERSION = "2026.08.02.3";

export const STORAGE_KEYS = Object.freeze({
  meta: "medlex:meta",
  cardProgress: "medlex:card-progress",
  customDecks: "medlex:custom-decks",
  reviewLog: "medlex:review-log",
  examAttempts: "medlex:exam-attempts",
  examHistory: "medlex:exam-history",
  ingProgress: "medlex:ing-progress",
  settings: "medlex:settings",
  aiKeyVault: "medlex:ai-key-vault",
  aiSettings: "medlex:ai-settings",
  aiConsent: "medlex:ai-consent",
  aiGradingCache: "medlex:ai-grading-cache",
  migrationBackup: "medlex:migration-backup"
});

// These browser-specific AI values are intentionally never part of a backup.
const BACKUP_EXCLUDED_KEYS = new Set([
  STORAGE_KEYS.aiKeyVault,
  STORAGE_KEYS.aiSettings,
  STORAGE_KEYS.aiConsent,
  STORAGE_KEYS.aiGradingCache
]);

export const LEGACY_KEYS = Object.freeze({
  cards: "medlexCards.v1",
  reviewLog: "medlexReviewLog.v1",
  exams: "medlexExams.v1",
  practice: "medlexPractice.v1",
  theme: "medlexTheme"
});

const TRANSITION_KEYS = Object.freeze({
  cards: "medlex:cards",
  exams: "medlex:exams",
  practice: "medlex:practice"
});
const CONTENT_FIELDS = ["english", "spanish", "portuguese", "example_en", "example_es", "example_pt", "source", "tags"];
const PROGRESS_FIELDS = ["due", "interval", "ease", "repetitions", "lapses", "reviews", "createdAt", "lastReviewed"];
const issues = new Map();

const clone = value => globalThis.structuredClone
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const fallbackValue = fallback => clone(typeof fallback === "function" ? fallback() : fallback);
const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const isText = value => typeof value === "string" && value.length > 0;
const nowISO = () => new Date().toISOString();
const recordIssue = (key, message) => {
  const id = `${key}:${message}`;
  if (!issues.has(id)) console.warn(`[MedLex storage] ${key}: ${message}`);
  issues.set(id, {key, message});
};

export function clearStorageIssues() {
  issues.clear();
}

export function getStorageIssues() {
  return [...issues.values()];
}

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    recordIssue(key, `não foi possível ler: ${error.message}`);
    return null;
  }
}

export function readJsonStorage(key, fallback, validate = () => true) {
  const raw = readRaw(key);
  if (raw === null) return fallbackValue(fallback);
  try {
    const value = JSON.parse(raw);
    if (!validate(value)) throw new Error("formato inesperado");
    return value;
  } catch (error) {
    recordIssue(key, `dados preservados mas ignorados nesta sessão (${error.message})`);
    return fallbackValue(fallback);
  }
}

export function writeJsonStorage(key, value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    if (localStorage.getItem(key) !== serialized) throw new Error("a gravação não pôde ser verificada");
  } catch (error) {
    recordIssue(key, `não foi possível gravar: ${error.message}`);
    throw new Error(`Não foi possível salvar ${key}. Exporte um backup antes de continuar.`);
  }
  return value;
}

export function removeStorageKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    recordIssue(key, `não foi possível remover: ${error.message}`);
    throw error;
  }
}

const emptyCardProgress = () => ({version: 1, cards: {}});
const emptyCustomDecks = () => ({version: 1, cards: [], overrides: {}, hiddenDefaultIds: []});
const emptyReviewLog = () => ({version: 1, items: []});
const emptyExamAttempts = () => ({version: 1, attempts: {}});
const emptyExamHistory = () => ({version: 1, records: [], archived: []});
const emptyIngProgress = () => ({version: 1, sessions: {}, history: [], archived: []});
const emptySettings = () => ({version: 1, newPerDay: 20, theme: "light"});

const validCardProgress = value => value?.version === 1 && isObject(value.cards);
const validCustomDecks = value => value?.version === 1 && Array.isArray(value.cards)
  && isObject(value.overrides) && Array.isArray(value.hiddenDefaultIds);
const validReviewLog = value => value?.version === 1 && Array.isArray(value.items);
const validExamAttempts = value => value?.version === 1 && isObject(value.attempts);
const validExamHistory = value => value?.version === 1 && Array.isArray(value.records) && Array.isArray(value.archived);
const validIngProgress = value => value?.version === 1 && isObject(value.sessions)
  && Array.isArray(value.history) && Array.isArray(value.archived);
const validSettings = value => value?.version === 1 && Number.isFinite(Number(value.newPerDay))
  && ["light", "dark"].includes(value.theme);

export const readCardProgress = () => readJsonStorage(STORAGE_KEYS.cardProgress, emptyCardProgress, validCardProgress);
export const writeCardProgress = value => writeJsonStorage(STORAGE_KEYS.cardProgress, value);
export const readCustomDecks = () => readJsonStorage(STORAGE_KEYS.customDecks, emptyCustomDecks, validCustomDecks);
export const writeCustomDecks = value => writeJsonStorage(STORAGE_KEYS.customDecks, value);
export const readReviewLog = () => readJsonStorage(STORAGE_KEYS.reviewLog, emptyReviewLog, validReviewLog);
export const writeReviewLog = value => writeJsonStorage(STORAGE_KEYS.reviewLog, value);
export const readExamAttempts = () => readJsonStorage(STORAGE_KEYS.examAttempts, emptyExamAttempts, validExamAttempts);
export const writeExamAttempts = value => writeJsonStorage(STORAGE_KEYS.examAttempts, value);
export const readExamHistory = () => readJsonStorage(STORAGE_KEYS.examHistory, emptyExamHistory, validExamHistory);
export const writeExamHistory = value => writeJsonStorage(STORAGE_KEYS.examHistory, value);
export const readIngProgress = () => readJsonStorage(STORAGE_KEYS.ingProgress, emptyIngProgress, validIngProgress);
export const writeIngProgress = value => writeJsonStorage(STORAGE_KEYS.ingProgress, value);
export const readSettings = () => readJsonStorage(STORAGE_KEYS.settings, emptySettings, validSettings);
export const writeSettings = value => writeJsonStorage(STORAGE_KEYS.settings, value);

export function canonicalEnglish(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/u, "")
    .trim();
}

function customId(card) {
  let hash = 2166136261;
  for (const char of canonicalEnglish(card.english)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `custom-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function cardContent(card, id = card.id) {
  return Object.fromEntries([["id", id || customId(card)], ...CONTENT_FIELDS.map(field => [field, String(card[field] ?? "").trim()])]);
}

function cardOverride(card, reference) {
  return Object.fromEntries([["id", reference.id], ...CONTENT_FIELDS
    .filter(field => card[field] !== undefined
      && String(card[field]).trim() !== String(reference[field] ?? "").trim())
    .map(field => [field, String(card[field]).trim()])]);
}

function cardProgress(card) {
  const progress = Object.fromEntries(PROGRESS_FIELDS.map(field => [field, Number(card[field]) || (field === "ease" ? 2.5 : 0)]));
  const meaningful = progress.reviews > 0 || progress.repetitions > 0 || progress.lapses > 0
    || progress.due > 0 || progress.interval > 0 || progress.lastReviewed > 0;
  return meaningful ? progress : null;
}

function parseStored(key, validate) {
  const raw = readRaw(key);
  if (raw === null) return {present: false, valid: true, value: null};
  try {
    const value = JSON.parse(raw);
    if (!validate(value)) throw new Error("formato inesperado");
    return {present: true, valid: true, value};
  } catch (error) {
    recordIssue(key, `migração adiada; dados antigos preservados (${error.message})`);
    return {present: true, valid: false, value: null};
  }
}

function readMeta() {
  return readJsonStorage(STORAGE_KEYS.meta, null, value => isObject(value)
    && Number.isInteger(value.schemaVersion) && value.schemaVersion >= 0 && value.schemaVersion <= STORAGE_SCHEMA_VERSION);
}

function detectSchemaVersion() {
  const meta = readMeta();
  if (meta) return meta.schemaVersion;
  if (readRaw(TRANSITION_KEYS.exams) !== null) return 1;
  if (readRaw(TRANSITION_KEYS.cards) !== null) return readRaw(STORAGE_KEYS.examAttempts) !== null ? 2 : 1;
  if (Object.values(STORAGE_KEYS).some(key => ![STORAGE_KEYS.meta, STORAGE_KEYS.migrationBackup].includes(key) && readRaw(key) !== null)) {
    return STORAGE_SCHEMA_VERSION;
  }
  return 0;
}

function writeMeta(schemaVersion, previous = readMeta()) {
  const meta = {
    schemaVersion,
    contentVersion: CONTENT_VERSION,
    lastMigrationAt: schemaVersion === previous?.schemaVersion ? previous.lastMigrationAt || null : nowISO(),
    lastSuccessfulLoadAt: previous?.lastSuccessfulLoadAt || null
  };
  return writeJsonStorage(STORAGE_KEYS.meta, meta);
}

function backupEntries(entries, sourceSchemaVersion, reason = "migration") {
  if (readRaw(STORAGE_KEYS.migrationBackup) !== null && reason === "migration") return;
  writeJsonStorage(STORAGE_KEYS.migrationBackup, {
    version: 1,
    sourceSchemaVersion,
    reason,
    createdAt: nowISO(),
    entries
  });
}

function migrationZeroToOne(defaultCards) {
  console.info("[MedLex storage] Migrando schema 0 → 1");
  const defaultsById = new Map(defaultCards.map(card => [card.id, card]));
  const defaultsByEnglish = new Map(defaultCards.map(card => [canonicalEnglish(card.english), card]));
  const legacyCards = parseStored(LEGACY_KEYS.cards, value => isObject(value) && Array.isArray(value.cards));
  const legacyReview = parseStored(LEGACY_KEYS.reviewLog, Array.isArray);
  const legacyExams = parseStored(LEGACY_KEYS.exams, value => value?.version === 1 && isObject(value.attempts) && Array.isArray(value.history));
  const legacyPractice = parseStored(LEGACY_KEYS.practice, value => value?.version === 1 && isObject(value.sessions) && Array.isArray(value.history));
  const legacyTheme = readRaw(LEGACY_KEYS.theme);
  const hasLegacyData = [legacyCards, legacyReview, legacyExams, legacyPractice].some(item => item.present)
    || legacyTheme !== null;
  const legacyThemeValid = legacyTheme === null || ["light", "dark"].includes(legacyTheme);
  if (!legacyThemeValid) recordIssue(LEGACY_KEYS.theme, "valor antigo inválido preservado");
  const combined = {version: 1, progress: {}, customCards: [], overrides: {}, hiddenDefaultIds: []};
  const presentDefaultIds = new Set();
  let migratedDefaultCount = 0;

  if (legacyCards.valid && legacyCards.value) {
    for (const oldCard of legacyCards.value.cards) {
      if (!oldCard || !String(oldCard.english ?? "").trim()) continue;
      const reference = defaultsById.get(oldCard.id) || defaultsByEnglish.get(canonicalEnglish(oldCard.english));
      if (reference) {
        presentDefaultIds.add(reference.id);
        migratedDefaultCount++;
        const progress = cardProgress(oldCard);
        if (progress) combined.progress[reference.id] = progress;
        const override = cardOverride(oldCard, reference);
        if (Object.keys(override).length > 1) combined.overrides[reference.id] = override;
      } else {
        const custom = cardContent(oldCard);
        combined.customCards.push(custom);
        const progress = cardProgress(oldCard);
        combined.progress[custom.id] = progress || {
          due: 0, interval: 0, ease: 2.5, repetitions: 0, lapses: 0,
          reviews: 0, createdAt: Number(oldCard.createdAt) || Date.now(), lastReviewed: 0
        };
      }
    }
    const defaultCoverage = defaultCards.length ? presentDefaultIds.size / defaultCards.length : 0;
    // Legacy versions did not distinguish an intentional deletion from a stale/incomplete
    // bundled deck. Only infer deletions when the saved deck closely matches this release.
    if (Number(legacyCards.value.defaultDeckVersion) >= 2 && defaultCoverage >= 0.9) {
      combined.hiddenDefaultIds = defaultCards.filter(card => !presentDefaultIds.has(card.id)).map(card => card.id);
    }
  }

  const settings = {
    version: 1,
    newPerDay: Number(legacyCards.value?.settings?.newPerDay) || 20,
    theme: ["light", "dark"].includes(legacyTheme) ? legacyTheme : "light"
  };
  const reviewLog = {version: 1, items: legacyReview.valid && legacyReview.value ? legacyReview.value.slice(-5000) : []};
  const exams = legacyExams.valid && legacyExams.value ? legacyExams.value : {version: 1, attempts: {}, history: []};
  const practice = legacyPractice.valid && legacyPractice.value ? legacyPractice.value : {version: 1, sessions: {}, history: []};
  const entries = {
    [TRANSITION_KEYS.cards]: JSON.stringify(combined),
    [STORAGE_KEYS.reviewLog]: JSON.stringify(reviewLog),
    [STORAGE_KEYS.settings]: JSON.stringify(settings),
    [TRANSITION_KEYS.exams]: JSON.stringify(exams),
    [TRANSITION_KEYS.practice]: JSON.stringify(practice)
  };
  if (hasLegacyData) backupEntries(entries, 1);
  for (const [key, raw] of Object.entries(entries)) {
    const value = JSON.parse(raw);
    writeJsonStorage(key, value);
  }
  if (legacyCards.valid) removeStorageKey(LEGACY_KEYS.cards);
  if (legacyReview.valid) removeStorageKey(LEGACY_KEYS.reviewLog);
  if (legacyExams.valid) removeStorageKey(LEGACY_KEYS.exams);
  if (legacyPractice.valid) removeStorageKey(LEGACY_KEYS.practice);
  if (legacyThemeValid) removeStorageKey(LEGACY_KEYS.theme);
  console.info(`[MedLex storage] Flashcards: ${migratedDefaultCount} padrão associados, ${combined.customCards.length} personalizados preservados, ${combined.hiddenDefaultIds.length} exclusões preservadas.`);
  writeMeta(1);
}

const compatibleAttempt = attempt => attempt && isText(attempt.id) && isText(attempt.examId)
  && ["in-progress", "review"].includes(attempt.status) && isObject(attempt.answers?.a)
  && isObject(attempt.answers?.b) && isObject(attempt.assessment?.b);
const compatibleHistory = record => record && isText(record.attemptId) && isText(record.examId)
  && Number.isFinite(Number(record.durationMs)) && Number.isFinite(Number(record.score))
  && typeof record.passed === "boolean";
const compatibleSession = session => session && isText(session.id) && isText(session.practiceId)
  && Array.isArray(session.unitIds) && ["in-progress", "review"].includes(session.status)
  && isObject(session.answers) && isObject(session.assessment);
const compatiblePracticeHistory = record => record && isText(record.sessionId) && isText(record.practiceId)
  && Number.isFinite(Number(record.durationMs)) && Number.isFinite(Number(record.percent));

function migrationOneToTwo() {
  console.info("[MedLex storage] Migrando schema 1 → 2");
  const combinedExams = readJsonStorage(TRANSITION_KEYS.exams, {version: 1, attempts: {}, history: []},
    value => value?.version === 1 && isObject(value.attempts) && Array.isArray(value.history));
  const attempts = emptyExamAttempts();
  const history = emptyExamHistory();
  for (const [examId, attempt] of Object.entries(combinedExams.attempts)) {
    if (compatibleAttempt(attempt)) attempts.attempts[examId] = {...attempt, examVersion: Number(attempt.examVersion) || 1};
    else history.archived.push({type: "attempt", examId, examVersion: Number(attempt?.examVersion) || 1, archivedAt: nowISO(), reason: "estrutura antiga incompatível", data: attempt});
  }
  for (const record of combinedExams.history) {
    if (compatibleHistory(record)) history.records.push(record);
    else history.archived.push({type: "history", examVersion: Number(record?.examVersion) || 1, archivedAt: nowISO(), reason: "registro antigo incompatível", data: record});
  }

  const combinedPractice = readJsonStorage(TRANSITION_KEYS.practice, {version: 1, sessions: {}, history: []},
    value => value?.version === 1 && isObject(value.sessions) && Array.isArray(value.history));
  const practice = emptyIngProgress();
  for (const [practiceId, session] of Object.entries(combinedPractice.sessions)) {
    if (compatibleSession(session)) practice.sessions[practiceId] = session;
    else practice.archived.push({type: "session", practiceId, archivedAt: nowISO(), reason: "estrutura antiga incompatível", data: session});
  }
  for (const record of combinedPractice.history) {
    if (compatiblePracticeHistory(record)) practice.history.push(record);
    else practice.archived.push({type: "history", archivedAt: nowISO(), reason: "registro antigo incompatível", data: record});
  }
  writeExamAttempts(attempts);
  writeExamHistory(history);
  writeIngProgress(practice);
  removeStorageKey(TRANSITION_KEYS.exams);
  removeStorageKey(TRANSITION_KEYS.practice);
  writeMeta(2);
}

function migrationTwoToThree() {
  console.info("[MedLex storage] Migrando schema 2 → 3");
  const combined = readJsonStorage(TRANSITION_KEYS.cards,
    {version: 1, progress: {}, customCards: [], overrides: {}, hiddenDefaultIds: []},
    value => value?.version === 1 && isObject(value.progress) && Array.isArray(value.customCards)
      && isObject(value.overrides) && Array.isArray(value.hiddenDefaultIds));
  writeCardProgress({version: 1, cards: combined.progress});
  writeCustomDecks({version: 1, cards: combined.customCards, overrides: combined.overrides, hiddenDefaultIds: combined.hiddenDefaultIds});
  removeStorageKey(TRANSITION_KEYS.cards);
  writeMeta(3);
}

function migrationThreeToFour() {
  console.info("[MedLex storage] Migrando schema 3 → 4");
  // AI storage is optional and initialized lazily. Existing study data is untouched.
  writeMeta(4);
}

function ensureFinalKeys() {
  const defaults = [
    [STORAGE_KEYS.cardProgress, emptyCardProgress],
    [STORAGE_KEYS.customDecks, emptyCustomDecks],
    [STORAGE_KEYS.reviewLog, emptyReviewLog],
    [STORAGE_KEYS.examAttempts, emptyExamAttempts],
    [STORAGE_KEYS.examHistory, emptyExamHistory],
    [STORAGE_KEYS.ingProgress, emptyIngProgress],
    [STORAGE_KEYS.settings, emptySettings]
  ];
  for (const [key, factory] of defaults) if (readRaw(key) === null) writeJsonStorage(key, factory());
}

export function validateStoredData({resetIssues = true} = {}) {
  if (resetIssues) clearStorageIssues();
  readCardProgress();
  readCustomDecks();
  readReviewLog();
  readExamAttempts();
  readExamHistory();
  readIngProgress();
  readSettings();
  return getStorageIssues();
}

export function migrateStorage(defaultCards = [], {repair = false} = {}) {
  clearStorageIssues();
  const fromVersion = detectSchemaVersion();
  let version = fromVersion;
  try {
    if (version > 0 && version < STORAGE_SCHEMA_VERSION) {
      const sourceEntries = collectEntries({includeBackup: false});
      if (Object.keys(sourceEntries).length) backupEntries(sourceEntries, version);
    }
    while (version < STORAGE_SCHEMA_VERSION) {
      if (version === 0) migrationZeroToOne(defaultCards);
      if (version === 1) migrationOneToTwo();
      if (version === 2) migrationTwoToThree();
      if (version === 3) migrationThreeToFour();
      version++;
    }
    ensureFinalKeys();
    const validationIssues = validateStoredData({resetIssues: false});
    const meta = writeMeta(STORAGE_SCHEMA_VERSION);
    meta.contentVersion = CONTENT_VERSION;
    meta.lastSuccessfulLoadAt = nowISO();
    writeJsonStorage(STORAGE_KEYS.meta, meta);
    if (repair) console.info(`[MedLex storage] Reparação concluída com ${validationIssues.length} aviso(s).`);
    return {fromVersion, toVersion: STORAGE_SCHEMA_VERSION, migrated: fromVersion !== STORAGE_SCHEMA_VERSION, issues: validationIssues};
  } catch (error) {
    recordIssue("migration", error.message);
    console.error("[MedLex storage] Migração interrompida sem apagar os dados antigos.", error);
    throw error;
  }
}

const managedKeys = () => [...new Set([
  ...Object.values(STORAGE_KEYS),
  ...Object.values(LEGACY_KEYS),
  ...Object.values(TRANSITION_KEYS)
])];

function collectEntries({includeBackup = true, includeAI = false} = {}) {
  return Object.fromEntries(managedKeys()
    .filter(key => includeBackup || key !== STORAGE_KEYS.migrationBackup)
    .filter(key => includeAI || !BACKUP_EXCLUDED_KEYS.has(key))
    .map(key => [key, readRaw(key)])
    .filter(([, raw]) => raw !== null));
}

export function exportStorageBackup() {
  return JSON.stringify({
    format: "medlex-storage-backup",
    version: 1,
    schemaVersion: detectSchemaVersion(),
    contentVersion: CONTENT_VERSION,
    exportedAt: nowISO(),
    entries: collectEntries()
  }, null, 2);
}

export function parseStorageBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  if (data?.format !== "medlex-storage-backup" || data.version !== 1 || !isObject(data.entries)
    || !Object.entries(data.entries).every(([key, raw]) => managedKeys().includes(key) && typeof raw === "string")) {
    throw new Error("Este arquivo não é um backup completo válido do MedLex.");
  }
  return data;
}

export function restoreStorageBackup(data) {
  const parsed = typeof data === "string" ? parseStorageBackup(data) : data;
  const current = collectEntries({includeBackup: false});
  backupEntries(current, detectSchemaVersion(), "pre-restore");
  for (const key of managedKeys()) {
    if (key !== STORAGE_KEYS.migrationBackup && !BACKUP_EXCLUDED_KEYS.has(key)) removeStorageKey(key);
  }
  try {
    for (const [key, raw] of Object.entries(parsed.entries)) {
      if (key === STORAGE_KEYS.migrationBackup || BACKUP_EXCLUDED_KEYS.has(key)) continue;
      localStorage.setItem(key, raw);
      if (localStorage.getItem(key) !== raw) throw new Error(`falha ao verificar ${key}`);
    }
  } catch (error) {
    for (const key of managedKeys()) {
      if (key !== STORAGE_KEYS.migrationBackup && !BACKUP_EXCLUDED_KEYS.has(key)) removeStorageKey(key);
    }
    for (const [key, raw] of Object.entries(current)) localStorage.setItem(key, raw);
    throw new Error(`A restauração falhou e os dados anteriores foram recuperados: ${error.message}`);
  }
}

export function recoverMigrationBackup() {
  const backup = readJsonStorage(STORAGE_KEYS.migrationBackup, null,
    value => value?.version === 1 && isObject(value.entries));
  if (!backup) throw new Error("Não há cópia de recuperação disponível.");
  const current = collectEntries();
  try {
    for (const key of managedKeys()) if (!BACKUP_EXCLUDED_KEYS.has(key)) removeStorageKey(key);
    for (const [key, raw] of Object.entries(backup.entries)) {
      if (typeof raw !== "string" || !managedKeys().includes(key) || BACKUP_EXCLUDED_KEYS.has(key)) continue;
      localStorage.setItem(key, raw);
      if (localStorage.getItem(key) !== raw) throw new Error(`falha ao verificar ${key}`);
    }
  } catch (error) {
    for (const key of managedKeys()) if (!BACKUP_EXCLUDED_KEYS.has(key)) removeStorageKey(key);
    for (const [key, raw] of Object.entries(current)) localStorage.setItem(key, raw);
    throw new Error(`A recuperação falhou e os dados atuais foram restaurados: ${error.message}`);
  }
  return backup;
}

export function hasMigrationBackup() {
  return readRaw(STORAGE_KEYS.migrationBackup) !== null;
}

export function resetMedlexStorage() {
  for (const key of managedKeys()) removeStorageKey(key);
}

export function storageVersions() {
  return {
    schemaVersion: readMeta()?.schemaVersion ?? detectSchemaVersion(),
    contentVersion: CONTENT_VERSION
  };
}
