import {readIngProgress, writeIngProgress} from "./storage.mjs";

function readState() {
  const data = readIngProgress();
  return {version: 1, sessions: data.sessions, history: data.history};
}

function writeState(state) {
  const current = readIngProgress();
  writeIngProgress({...current, sessions: state.sessions, history: state.history});
}

export function createSession(practiceId, unitIds) {
  const startedAt = Date.now();
  return {
    id: `${practiceId}-${startedAt}`,
    practiceId,
    unitIds,
    status: "in-progress",
    startedAt,
    updatedAt: startedAt,
    answers: {},
    assessment: {}
  };
}

export function getSession(practiceId) {
  return readState().sessions[practiceId] || null;
}

export function saveSession(session) {
  const state = readState();
  session.updatedAt = Date.now();
  state.sessions[session.practiceId] = session;
  writeState(state);
}

export function clearSession(practiceId) {
  const state = readState();
  delete state.sessions[practiceId];
  writeState(state);
}

export function savePracticeHistory(record) {
  const state = readState();
  const index = state.history.findIndex(item => item.sessionId === record.sessionId);
  if (index >= 0) state.history[index] = record;
  else state.history.unshift(record);
  writeState(state);
}

export function getPracticeHistory(practiceId = null) {
  const history = readState().history;
  return practiceId ? history.filter(item => item.practiceId === practiceId) : history;
}

export function practiceHistoryUnitTitles(record, units) {
  const currentTitles = new Map(units.flatMap(unit => [
    [unit.id, unit.title],
    ...(unit.sourceTitle ? [[unit.sourceTitle, unit.title]] : [])
  ]));
  const references = Array.isArray(record.unitIds) ? record.unitIds : record.units;
  return references.map(reference => currentTitles.get(reference) || reference);
}

export function exportPracticeBackup() {
  return JSON.stringify({...readState(), exportedAt: new Date().toISOString()}, null, 2);
}

export function parsePracticeBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  const sessionsValid = data?.sessions && typeof data.sessions === "object" && !Array.isArray(data.sessions)
    && Object.values(data.sessions).every(session => session && typeof session.id === "string"
      && typeof session.practiceId === "string" && Array.isArray(session.unitIds)
      && ["in-progress", "finalizing", "review"].includes(session.status) && session.answers && session.assessment);
  const historyValid = Array.isArray(data?.history) && data.history.every(item => item
    && typeof item.sessionId === "string" && typeof item.practiceId === "string"
    && Number.isFinite(item.durationMs) && Number.isFinite(item.percent));
  if (data?.version !== 1 || !sessionsValid || !historyValid) {
    throw new Error("Este arquivo não é um backup de práticas válido.");
  }
  return {version: 1, sessions: data.sessions, history: data.history};
}

export function importPracticeBackup(text) {
  writeState(parsePracticeBackup(text));
}
