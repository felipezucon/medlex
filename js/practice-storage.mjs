const STORAGE_KEY = "medlexPractice.v1";
const emptyState = () => ({version: 1, sessions: {}, history: []});

function readState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.version === 1 && data.sessions && Array.isArray(data.history)) return data;
  } catch {}
  return emptyState();
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      && ["in-progress", "review"].includes(session.status) && session.answers && session.assessment);
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
