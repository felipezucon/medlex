import {
  configureApiKey,
  forgetApiKey,
  lockApiKey,
  unlockApiKey,
  vaultState,
  withUnlockedApiKey
} from "./api-key-vault.mjs";
import {testGeminiConnection} from "./gemini-client.mjs";
import {GEMINI_MODEL} from "./ai-grading.mjs";
import {readAIConsent, readAISettings, setAIConsent, writeAISettings} from "./ai-grading-storage.mjs";

const $ = selector => document.querySelector(selector);
const stateLabels = {
  unconfigured: "No configurada",
  locked: "Configurada y bloqueada",
  ready: "Desbloqueada",
  invalid: "Clave inválida",
  limited: "Límite alcanzado",
  unavailable: "No disponible"
};
let replacing = false;

function effectiveState() {
  const vault = vaultState();
  if (!vault.configured) return "unconfigured";
  if (!vault.unlocked) return "locked";
  const saved = readAISettings().state;
  return ["invalid", "limited", "unavailable"].includes(saved) ? saved : "ready";
}

function announceState() {
  window.dispatchEvent(new Event("medlex-ai-state-changed"));
}

function render(message = "", error = false, announce = true) {
  const vault = vaultState();
  const settings = readAISettings();
  const current = effectiveState();
  $("#aiState").textContent = stateLabels[current];
  $("#aiState").className = `availability ${current === "ready" ? "available" : "unavailable"}`;
  $("#aiConfigureForm").classList.toggle("hidden", vault.configured && !replacing);
  $("#aiUnlockForm").classList.toggle("hidden", !vault.configured || vault.unlocked || replacing);
  $("#aiKeyActions").classList.toggle("hidden", !vault.configured || replacing);
  $("#aiLockBtn").disabled = !vault.unlocked;
  $("#aiTestBtn").disabled = !vault.unlocked;
  $("#aiCancelReplaceBtn").classList.toggle("hidden", !replacing);
  $("#aiConsent").checked = readAIConsent().accepted;
  $("#aiLastTest").textContent = settings.lastSuccessfulTestAt
    ? `Última conexión correcta: ${new Date(settings.lastSuccessfulTestAt).toLocaleString("es-AR")}`
    : "La conexión todavía no fue probada con éxito.";
  $("#aiStatus").textContent = message;
  $("#aiStatus").className = `status ${error ? "error" : ""}`.trim();
  if (announce) announceState();
}

function clearConfigureFields() {
  $("#aiApiKey").value = "";
  $("#aiPassword").value = "";
  $("#aiPasswordConfirm").value = "";
}

$("#aiConfigureForm").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await configureApiKey($("#aiApiKey").value, $("#aiPassword").value, $("#aiPasswordConfirm").value);
    writeAISettings({state: "ready"});
    replacing = false;
    clearConfigureFields();
    render("Clave guardada y desbloqueada durante esta sesión.");
  } catch (error) {
    render(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

$("#aiUnlockForm").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await unlockApiKey($("#aiUnlockPassword").value);
    $("#aiUnlockPassword").value = "";
    writeAISettings({state: "ready"});
    render("Clave desbloqueada durante esta sesión.");
  } catch (error) {
    render(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

$("#aiLockBtn").addEventListener("click", () => {
  lockApiKey();
  writeAISettings({state: "locked"});
  render("Clave bloqueada.");
});

$("#aiReplaceBtn").addEventListener("click", () => {
  replacing = true;
  render("Ingrese la nueva clave y una nueva contraseña local.");
  $("#aiApiKey").focus();
});

$("#aiCancelReplaceBtn").addEventListener("click", () => {
  replacing = false;
  clearConfigureFields();
  render();
});

$("#aiForgetBtn").addEventListener("click", () => {
  if (!confirm("¿Olvidar solamente la clave de Gemini? El progreso de estudio no se eliminará.")) return;
  forgetApiKey();
  writeAISettings({state: "unconfigured", lastSuccessfulTestAt: null});
  render("Clave eliminada. El progreso permanece intacto.");
});

$("#aiTestBtn").addEventListener("click", async event => {
  event.currentTarget.disabled = true;
  render("Probando la conexión…");
  try {
    await withUnlockedApiKey(apiKey => testGeminiConnection(apiKey, GEMINI_MODEL));
    writeAISettings({state: "ready", lastSuccessfulTestAt: new Date().toISOString()});
    render("Conexión correcta.");
  } catch (error) {
    const state = error.code === "invalid_key" ? "invalid"
      : error.code === "limited" ? "limited" : "unavailable";
    writeAISettings({state});
    render(`${error.message} Puede continuar con la corrección manual.`, true);
  }
});

$("#aiConsent").addEventListener("change", event => {
  setAIConsent(event.currentTarget.checked);
  render(event.currentTarget.checked ? "Consentimiento registrado." : "Consentimiento revocado. No se realizarán llamadas.");
});

window.addEventListener("medlex-backup-restored", () => render("La configuración de IA no fue modificada por el backup."));
window.addEventListener("medlex-ai-status-changed", () => render("", false, false));
window.addEventListener("medlex-storage-reset", () => {
  lockApiKey();
  replacing = false;
  clearConfigureFields();
  render("La configuración local de IA fue eliminada.");
});
render();
