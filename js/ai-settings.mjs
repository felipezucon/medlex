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
  unconfigured: "Não configurada",
  locked: "Configurada e bloqueada",
  ready: "Desbloqueada",
  invalid: "Chave inválida",
  limited: "Limite atingido",
  unavailable: "Indisponível"
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
    ? `Última conexão bem-sucedida: ${new Date(settings.lastSuccessfulTestAt).toLocaleString("pt-BR")}`
    : "A conexão ainda não foi testada com sucesso.";
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
    render("Chave salva e desbloqueada durante esta sessão.");
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
    render("Chave desbloqueada durante esta sessão.");
  } catch (error) {
    render(error.message, true);
  } finally {
    submit.disabled = false;
  }
});

$("#aiLockBtn").addEventListener("click", () => {
  lockApiKey();
  writeAISettings({state: "locked"});
  render("Chave bloqueada.");
});

$("#aiReplaceBtn").addEventListener("click", () => {
  replacing = true;
  render("Informe a nova chave e uma nova senha local.");
  $("#aiApiKey").focus();
});

$("#aiCancelReplaceBtn").addEventListener("click", () => {
  replacing = false;
  clearConfigureFields();
  render();
});

$("#aiForgetBtn").addEventListener("click", () => {
  if (!confirm("Esquecer somente a chave do Gemini? O progresso de estudo não será apagado.")) return;
  forgetApiKey();
  writeAISettings({state: "unconfigured", lastSuccessfulTestAt: null});
  render("Chave removida. O progresso permanece intacto.");
});

$("#aiTestBtn").addEventListener("click", async event => {
  event.currentTarget.disabled = true;
  render("Testando a conexão…");
  try {
    await withUnlockedApiKey(apiKey => testGeminiConnection(apiKey, GEMINI_MODEL));
    writeAISettings({state: "ready", lastSuccessfulTestAt: new Date().toISOString()});
    render("Conexão bem-sucedida.");
  } catch (error) {
    const state = error.code === "invalid_key" ? "invalid"
      : error.code === "limited" ? "limited" : "unavailable";
    writeAISettings({state});
    render(`${error.message} Você pode continuar com a correção manual.`, true);
  }
});

$("#aiConsent").addEventListener("change", event => {
  setAIConsent(event.currentTarget.checked);
  render(event.currentTarget.checked ? "Consentimento registrado." : "Consentimento revogado. Nenhuma chamada será realizada.");
});

window.addEventListener("medlex-open-ai-settings", event => render(event.detail?.message || ""));
window.addEventListener("medlex-backup-restored", () => render("A configuração da IA não foi alterada pelo backup."));
window.addEventListener("medlex-ai-status-changed", () => render("", false, false));
window.addEventListener("medlex-storage-reset", () => {
  lockApiKey();
  replacing = false;
  clearConfigureFields();
  render("A configuração local da IA foi removida.");
});
render();
