import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const exams = await import("../js/exam-storage.mjs");
const practice = await import("../js/practice-storage.mjs");

const examA = exams.createAttempt("prefinal-a", true);
const examB = exams.createAttempt("prefinal-b", false);
exams.saveAttempt(examA);
exams.saveAttempt(examB);
exams.clearAttempt("prefinal-a");
assert.equal(exams.getAttempt("prefinal-a"), null);
assert.equal(exams.getAttempt("prefinal-b").id, examB.id);
examB.status = "finalizing";
exams.saveAttempt(examB);
assert.equal(exams.parseExamBackup(exams.exportExamBackup()).attempts["prefinal-b"].status, "finalizing");
assert.throws(() => exams.importExamBackup("{}"), /backup de simulados válido/);

const session = practice.createSession("ing-forms", ["blood"]);
practice.saveSession(session);
assert.equal(practice.getSession("ing-forms").id, session.id);
practice.clearSession("ing-forms");
assert.equal(practice.getSession("ing-forms"), null);
assert.throws(() => practice.importPracticeBackup("not json"), /JSON válido/);

console.log("storage: ok");
