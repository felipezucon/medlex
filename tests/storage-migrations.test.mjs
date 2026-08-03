import assert from "node:assert/strict";

class MemoryStorage {
  constructor(entries = {}, failKey = null) {
    this.data = new Map(Object.entries(entries));
    this.failKey = failKey;
    this.clearCalls = 0;
  }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (key === this.failKey) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.data.set(key, String(value));
  }
  removeItem(key) { this.data.delete(key); }
  clear() { this.clearCalls++; this.data.clear(); }
}

globalThis.localStorage = new MemoryStorage();
const storage = await import("../js/storage.mjs");
const {LEGACY_KEYS, STORAGE_KEYS} = storage;
const json = value => JSON.stringify(value);
const read = key => JSON.parse(localStorage.getItem(key));
const defaults = [
  {id: "card-a", english: "alpha", spanish: "alfa", portuguese: "alfa", tags: "core"},
  {id: "card-b", english: "beta", spanish: "beta", portuguese: "beta", tags: "core"},
  {id: "card-c", english: "gamma", spanish: "gama", portuguese: "gama", tags: "new"}
];
const baseCard = (card, extra = {}) => ({
  ...card, example_en: "", example_es: "", example_pt: "", source: "", tags: card.tags || "general",
  due: 0, interval: 0, ease: 2.5, repetitions: 0, lapses: 0, reviews: 0,
  createdAt: 10, lastReviewed: 0, ...extra
});

function use(entries = {}, failKey = null) {
  globalThis.localStorage = new MemoryStorage(entries, failKey);
  storage.clearStorageIssues();
}

// Schema 0: a small/old deck migrates by identity, gains new defaults and keeps custom data.
use({
  [LEGACY_KEYS.cards]: json({
    settings: {newPerDay: 40},
    defaultDeckVersion: 1,
    cards: [
      {...baseCard(defaults[1], {reviews: 3, repetitions: 2, due: 1234}), id: ""},
      baseCard(defaults[0]),
      baseCard({english: "personal term", spanish: "personal", portuguese: "pessoal", tags: "mine"})
    ]
  }),
  [LEGACY_KEYS.reviewLog]: json([{at: 100, rating: "good"}]),
  [LEGACY_KEYS.theme]: "dark"
});
let result = storage.migrateStorage([...defaults].reverse());
assert.equal(result.fromVersion, 0);
assert.equal(read(STORAGE_KEYS.meta).schemaVersion, 5);
assert.equal(read(STORAGE_KEYS.cardProgress).cards["card-b"].reviews, 3);
assert.equal(read(STORAGE_KEYS.customDecks).cards[0].english, "personal term");
assert.deepEqual(read(STORAGE_KEYS.customDecks).hiddenDefaultIds, []);
assert.equal(read(STORAGE_KEYS.settings).theme, "dark");
assert.equal(read(STORAGE_KEYS.settings).newPerDay, 40);
assert.equal(read(STORAGE_KEYS.reviewLog).items.length, 1);
assert.equal(localStorage.getItem(LEGACY_KEYS.cards), null);
assert.ok(localStorage.getItem(STORAGE_KEYS.migrationBackup));
localStorage.setItem(STORAGE_KEYS.aiKeyVault, json({ciphertext: "preserved-during-recovery"}));
storage.recoverMigrationBackup();
assert.equal(localStorage.getItem(STORAGE_KEYS.meta), null);
assert.equal(read(STORAGE_KEYS.aiKeyVault).ciphertext, "preserved-during-recovery");
storage.migrateStorage([...defaults].reverse());
assert.equal(read(STORAGE_KEYS.cardProgress).cards["card-b"].reviews, 3);

// A stale 72-card cache cannot hide the 928 cards shipped by a later 1,000-card release.
const thousandDefaults = Array.from({length: 1000}, (_, index) => ({
  id: `bulk-${index}`, english: `term ${index}`, spanish: `es ${index}`, portuguese: `pt ${index}`, tags: "bulk"
}));
use({
  [LEGACY_KEYS.cards]: json({defaultDeckVersion: 2, cards: thousandDefaults.slice(0, 72).map(baseCard)})
});
storage.migrateStorage(thousandDefaults);
assert.deepEqual(read(STORAGE_KEYS.customDecks).hiddenDefaultIds, []);

// A near-complete matching deck can still preserve an intentional deletion.
use({
  [LEGACY_KEYS.cards]: json({defaultDeckVersion: 2, cards: thousandDefaults.slice(0, 999).map(baseCard)})
});
storage.migrateStorage(thousandDefaults);
assert.deepEqual(read(STORAGE_KEYS.customDecks).hiddenDefaultIds, ["bulk-999"]);

// Schema 1 splits exam/practice data and archives incompatible records instead of dropping them.
use({
  [STORAGE_KEYS.meta]: json({schemaVersion: 1, contentVersion: "old"}),
  "medlex:cards": json({version: 1, progress: {}, customCards: [], overrides: {}, hiddenDefaultIds: []}),
  "medlex:exams": json({version: 1, attempts: {
    good: {id: "a1", examId: "good", status: "in-progress", answers: {a: {}, b: {}}, assessment: {b: {}}},
    bad: {id: 9}
  }, history: [{attemptId: "h1", examId: "good", durationMs: 1, score: 2, passed: false}, {bad: true}]}),
  "medlex:practice": json({version: 1, sessions: {}, history: []})
});
storage.migrateStorage(defaults);
assert.equal(read(STORAGE_KEYS.examAttempts).attempts.good.examVersion, 1);
assert.equal(read(STORAGE_KEYS.examHistory).records.length, 1);
assert.equal(read(STORAGE_KEYS.examHistory).archived.length, 2);

// Schema 2 completes only the card split and keeps current exam data intact.
use({
  [STORAGE_KEYS.meta]: json({schemaVersion: 2, contentVersion: "old"}),
  "medlex:cards": json({version: 1, progress: {"card-a": {reviews: 7}}, customCards: [], overrides: {}, hiddenDefaultIds: []}),
  [STORAGE_KEYS.examAttempts]: json({version: 1, attempts: {}}),
  [STORAGE_KEYS.examHistory]: json({version: 1, records: [], archived: []}),
  [STORAGE_KEYS.ingProgress]: json({version: 1, sessions: {}, history: [], archived: []})
});
storage.migrateStorage(defaults);
assert.equal(read(STORAGE_KEYS.cardProgress).cards["card-a"].reviews, 7);
assert.equal(localStorage.getItem("medlex:cards"), null);

// Schema 4 resets only rebuilt -ing units and gives finalized sessions a new identity.
const preservedHistory = [{
  sessionId: "finished-session", practiceId: "ing-forms", durationMs: 1000,
  percent: 75, units: ["Blood", "Simulado 6"]
}];
use({
  [STORAGE_KEYS.meta]: json({schemaVersion: 4, contentVersion: "old"}),
  [STORAGE_KEYS.ingProgress]: json({version: 1, sessions: {
    "ing-forms": {
      id: "finished-session",
      practiceId: "ing-forms",
      status: "review",
      unitIds: ["blood", "ing-simulado-06-semaglutide-masld", "ing-simulado-07-bioengineered-vessels"],
      answers: {
        "blood-a": "preservar",
        "ing-simulado-06-semaglutide-masld-t1": "apagar",
        "ing-simulado-07-bioengineered-vessels-o1": "apagar"
      },
      assessment: {
        "blood-a": {"blood-a-meaning": true},
        "ing-simulado-06-semaglutide-masld-t1": {criterion: true}
      },
      aiGrading: {
        "blood-a": {accepted: true, finalPoints: 1},
        "ing-simulado-07-bioengineered-vessels-o1": {accepted: true, finalPoints: 4}
      },
      finalizedAt: 20,
      durationMs: 1000,
      gradingMethod: "ai",
      gradingModel: "gemini",
      gradingMessage: "ok"
    },
    "other-practice": {
      id: "other-session", practiceId: "other-practice", status: "in-progress",
      unitIds: ["blood"], answers: {"blood-a": "intacto"}, assessment: {}, aiGrading: {}
    }
  }, history: preservedHistory, archived: []})
});
storage.migrateStorage(defaults);
const migratedPractice = read(STORAGE_KEYS.ingProgress);
const rebuiltSession = migratedPractice.sessions["ing-forms"];
assert.equal(read(STORAGE_KEYS.meta).schemaVersion, 5);
assert.equal(rebuiltSession.status, "in-progress");
assert.notEqual(rebuiltSession.id, "finished-session");
assert.equal(rebuiltSession.answers["blood-a"], "preservar");
assert.equal(rebuiltSession.answers["ing-simulado-06-semaglutide-masld-t1"], undefined);
assert.equal(rebuiltSession.answers["ing-simulado-07-bioengineered-vessels-o1"], undefined);
assert.deepEqual(rebuiltSession.assessment["blood-a"], {"blood-a-meaning": true});
assert.equal(rebuiltSession.assessment["ing-simulado-06-semaglutide-masld-t1"], undefined);
assert.deepEqual(rebuiltSession.aiGrading["blood-a"], {accepted: true, finalPoints: 1});
assert.equal(rebuiltSession.aiGrading["ing-simulado-07-bioengineered-vessels-o1"], undefined);
assert.equal(rebuiltSession.finalizedAt, undefined);
assert.equal(rebuiltSession.gradingMethod, undefined);
assert.deepEqual(migratedPractice.history, preservedHistory);
assert.equal(migratedPractice.sessions["other-practice"].answers["blood-a"], "intacto");

// An active session keeps its identity while only the affected unit is cleared.
use({
  [STORAGE_KEYS.meta]: json({schemaVersion: 4, contentVersion: "old"}),
  [STORAGE_KEYS.ingProgress]: json({version: 1, sessions: {
    "ing-forms": {
      id: "active-session", practiceId: "ing-forms", status: "in-progress",
      unitIds: ["blood", "ing-simulado-06-semaglutide-masld"],
      answers: {"blood-a": "preservar", "ing-simulado-06-semaglutide-masld-o1": "apagar"},
      assessment: {}, aiGrading: {}, startedAt: 10, updatedAt: 20
    }
  }, history: [], archived: []})
});
storage.migrateStorage(defaults);
const activeSession = read(STORAGE_KEYS.ingProgress).sessions["ing-forms"];
assert.equal(activeSession.id, "active-session");
assert.equal(activeSession.startedAt, 10);
assert.equal(activeSession.answers["blood-a"], "preservar");
assert.equal(activeSession.answers["ing-simulado-06-semaglutide-masld-o1"], undefined);

// Current malformed JSON is never overwritten silently and remains exportable.
use({
  [STORAGE_KEYS.meta]: json({schemaVersion: 3, contentVersion: storage.CONTENT_VERSION}),
  [STORAGE_KEYS.cardProgress]: "{broken",
  [STORAGE_KEYS.customDecks]: json({version: 1, cards: [], overrides: {}, hiddenDefaultIds: []})
});
result = storage.migrateStorage(defaults);
assert.ok(result.issues.some(issue => issue.key === STORAGE_KEYS.cardProgress));
assert.equal(localStorage.getItem(STORAGE_KEYS.cardProgress), "{broken");
assert.match(storage.exportStorageBackup(), /\{broken/);

// A quota failure stops before deleting the old source and never calls clear().
const legacyRaw = json({defaultDeckVersion: 1, cards: [baseCard(defaults[0], {reviews: 1})]});
use({[LEGACY_KEYS.cards]: legacyRaw}, "medlex:cards");
assert.throws(() => storage.migrateStorage(defaults), /Não foi possível salvar/);
assert.equal(localStorage.getItem(LEGACY_KEYS.cards), legacyRaw);
assert.equal(localStorage.clearCalls, 0);

// Complete backup/restore is versioned, and reset leaves unrelated origin data alone.
use({unrelated: "keep-me"});
storage.migrateStorage(defaults);
assert.equal(localStorage.getItem(STORAGE_KEYS.migrationBackup), null);
storage.writeCardProgress({version: 1, cards: {"card-a": {reviews: 11}}});
localStorage.setItem(STORAGE_KEYS.aiKeyVault, json({ciphertext: "encrypted-only"}));
localStorage.setItem(STORAGE_KEYS.aiConsent, json({accepted: true}));
const backup = storage.parseStorageBackup(storage.exportStorageBackup());
assert.equal(Object.hasOwn(backup.entries, STORAGE_KEYS.aiKeyVault), false);
assert.equal(Object.hasOwn(backup.entries, STORAGE_KEYS.aiConsent), false);
storage.resetMedlexStorage();
assert.equal(localStorage.getItem("unrelated"), "keep-me");
assert.equal(localStorage.getItem(STORAGE_KEYS.cardProgress), null);
storage.restoreStorageBackup(backup);
assert.equal(read(STORAGE_KEYS.cardProgress).cards["card-a"].reviews, 11);
localStorage.setItem(STORAGE_KEYS.aiKeyVault, json({ciphertext: "keep-me"}));
storage.restoreStorageBackup(backup);
assert.equal(read(STORAGE_KEYS.aiKeyVault).ciphertext, "keep-me");
assert.throws(() => storage.parseStorageBackup("{}"), /backup completo válido/);
assert.equal(localStorage.clearCalls, 0);

console.log("storage migrations: ok");
