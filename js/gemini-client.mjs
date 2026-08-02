export const GEMINI_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const TRANSIENT_STATUSES = new Set([408, 429, 500, 503]);

export class GeminiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

function errorForStatus(status) {
  if ([401, 403].includes(status)) return new GeminiError("invalid_key", "La clave de API no es válida.", status);
  if (status === 404) return new GeminiError("model_unavailable", "El modelo configurado no está disponible.", status);
  if (status === 429) return new GeminiError("limited", "Se alcanzó temporalmente el límite de solicitudes.", status);
  if ([500, 503].includes(status)) return new GeminiError("unavailable", "Gemini no está disponible en este momento.", status);
  if (status === 400) return new GeminiError("bad_request", "Gemini rechazó la solicitud de corrección.", status);
  return new GeminiError("request_failed", "No se pudo completar la corrección con IA.", status);
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function request(url, apiKey, options = {}, retry = true, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {...options.headers, "x-goog-api-key": apiKey},
      signal: controller.signal
    });
    if (!response.ok) {
      if (retry && TRANSIENT_STATUSES.has(response.status)) {
        await delay(500);
        return request(url, apiKey, options, false, timeoutMs);
      }
      throw errorForStatus(response.status);
    }
    try {
      return await response.json();
    } catch {
      throw new GeminiError("invalid_response", "La respuesta de la IA no pudo validarse.", response.status);
    }
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error.name === "AbortError") throw new GeminiError("timeout", "La corrección con IA tardó demasiado.");
    if (retry) {
      await delay(500);
      return request(url, apiKey, options, false, timeoutMs);
    }
    throw new GeminiError("network", globalThis.navigator?.onLine === false ? "No hay conexión a internet." : "No se pudo conectar con Gemini.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function testGeminiConnection(apiKey, model) {
  try {
    await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, apiKey, {method: "GET"}, false, 15000);
  } catch (error) {
    if (error.status === 400) throw new GeminiError("invalid_key", "La clave de API no es válida.", 400);
    throw error;
  }
}

export async function createGeminiInteraction(apiKey, payload, {timeoutMs = 30000} = {}) {
  const response = await request(GEMINI_INTERACTIONS_ENDPOINT, apiKey, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  }, true, timeoutMs);
  if (response?.status !== "completed") throw new GeminiError("incomplete", "Gemini devolvió una respuesta incompleta.");
  const texts = response.steps?.filter(step => step?.type === "model_output")
    .flatMap(step => step.content || [])
    .filter(content => content?.type === "text" && typeof content.text === "string")
    .map(content => content.text) || [];
  if (!texts.length) throw new GeminiError("empty", "Gemini devolvió una respuesta vacía.");
  try {
    return JSON.parse(texts.join(""));
  } catch {
    throw new GeminiError("invalid_response", "La respuesta de la IA no pudo validarse.");
  }
}
