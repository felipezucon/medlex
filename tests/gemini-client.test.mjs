import assert from "node:assert/strict";
import {createGeminiInteraction, GEMINI_INTERACTIONS_ENDPOINT, GeminiError, testGeminiConnection} from "../js/gemini-client.mjs";

const credential = ["header", "only", "credential"].join("-");
const payload = {model: "model-for-test", store: false, input: "classification"};
let calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({url, options});
  return new Response(JSON.stringify({
    status: "completed",
    steps: [{type: "model_output", content: [{type: "text", text: "{\"ok\":true}"}]}]
  }), {status: 200, headers: {"Content-Type": "application/json"}});
};

assert.deepEqual(await createGeminiInteraction(credential, payload), {ok: true});
assert.equal(calls[0].url, GEMINI_INTERACTIONS_ENDPOINT);
assert.equal(calls[0].options.headers["x-goog-api-key"], credential);
assert.doesNotMatch(calls[0].url, new RegExp(credential));
assert.doesNotMatch(calls[0].options.body, new RegExp(credential));
assert.equal(JSON.parse(calls[0].options.body).store, false);

let transientCalls = 0;
globalThis.fetch = async () => {
  transientCalls++;
  if (transientCalls === 1) return new Response("", {status: 503});
  return new Response(JSON.stringify({status: "completed", steps: [{type: "model_output", content: [{type: "text", text: "{}"}]}]}), {status: 200});
};
await createGeminiInteraction(credential, payload);
assert.equal(transientCalls, 2);

let authCalls = 0;
globalThis.fetch = async () => { authCalls++; return new Response("", {status: 403}); };
await assert.rejects(createGeminiInteraction(credential, payload), error => error instanceof GeminiError && error.code === "invalid_key");
assert.equal(authCalls, 1);

globalThis.fetch = async () => new Response(JSON.stringify({status: "completed", steps: [{type: "model_output", content: [{type: "text", text: "not json"}]}]}), {status: 200});
await assert.rejects(createGeminiInteraction(credential, payload), error => error.code === "invalid_response");

let limitCalls = 0;
globalThis.fetch = async () => { limitCalls++; return new Response("", {status: 429}); };
await assert.rejects(createGeminiInteraction(credential, payload), error => error.code === "limited");
assert.equal(limitCalls, 2);

let missingModelCalls = 0;
globalThis.fetch = async () => { missingModelCalls++; return new Response("", {status: 404}); };
await assert.rejects(createGeminiInteraction(credential, payload), error => error.code === "model_unavailable");
assert.equal(missingModelCalls, 1);

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new TypeError("CORS"); };
await assert.rejects(createGeminiInteraction(credential, payload), error => error.code === "network");
assert.equal(networkCalls, 2);

globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
  options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
});
await assert.rejects(createGeminiInteraction(credential, payload, {timeoutMs: 5}), error => error.code === "timeout");

globalThis.fetch = async () => new Response("", {status: 400});
await assert.rejects(testGeminiConnection(credential, "model-for-test"), error => error.code === "invalid_key");

globalThis.fetch = async () => new Response(JSON.stringify({status: "incomplete", steps: []}), {status: 200});
await assert.rejects(createGeminiInteraction(credential, payload), error => error.code === "incomplete");

console.log("gemini client: ok");
