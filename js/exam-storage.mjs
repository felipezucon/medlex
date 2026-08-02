import {
  readExamAttempts,
  readExamHistory,
  writeExamAttempts,
  writeExamHistory
} from "./storage.mjs";

function readState() {
  return {
    version: 1,
    attempts: readExamAttempts().attempts,
    history: readExamHistory().records
  };
}

function writeState(state) {
  writeExamAttempts({version: 1, attempts: state.attempts});
  const current = readExamHistory();
  writeExamHistory({...current, records: state.history});
}

export function createAttempt(examId, timerEnabled, examVersion = 1) {
  const startedAt = Date.now();
  return {
    id: `${examId}-${startedAt}`,
    examId,
    examVersion,
    status: "in-progress",
    timerEnabled,
    startedAt,
    updatedAt: startedAt,
    answers: {a: {}, b: {}, c: ""},
    assessment: {b: {}, c: 0}
  };
}

export function getAttempt(examId) {
  return readState().attempts[examId] || null;
}

export function saveAttempt(attempt) {
  const state = readState();
  attempt.updatedAt = Date.now();
  state.attempts[attempt.examId] = attempt;
  writeState(state);
}

export function clearAttempt(examId) {
  const state = readState();
  delete state.attempts[examId];
  writeState(state);
}

export function saveHistory(record) {
  const state = readState();
  const index = state.history.findIndex(item => item.attemptId === record.attemptId);
  if (index >= 0) state.history[index] = record;
  else state.history.unshift(record);
  writeState(state);
}

export function getHistory(examId) {
  return readState().history.filter(item => item.examId === examId);
}

export function getAllHistory() {
  return readState().history;
}

export function exportExamBackup() {
  return JSON.stringify({...readState(), exportedAt: new Date().toISOString()}, null, 2);
}

export function parseExamBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  const attemptsValid = data?.attempts
    && typeof data.attempts === "object"
    && !Array.isArray(data.attempts)
    && Object.values(data.attempts).every(attempt =>
      attempt
      && typeof attempt.id === "string"
      && typeof attempt.examId === "string"
      && ["in-progress", "review"].includes(attempt.status)
      && attempt.answers?.a
      && attempt.answers?.b
      && attempt.assessment?.b
    );
  const historyValid = Array.isArray(data?.history) && data.history.every(item =>
    item
    && typeof item.attemptId === "string"
    && typeof item.examId === "string"
    && Number.isFinite(item.durationMs)
    && Number.isFinite(item.score)
    && typeof item.passed === "boolean"
  );
  if (
    data?.version !== 1
    || !attemptsValid
    || !historyValid
  ) throw new Error("Este arquivo não é um backup de simulados válido.");
  return {version: 1, attempts: data.attempts, history: data.history};
}

export function importExamBackup(text) {
  writeState(parseExamBackup(text));
}
