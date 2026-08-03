import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [html, vault, grading, client, storage, examUI, practiceUI] = await Promise.all([
  read("../index.html"),
  read("../js/api-key-vault.mjs"),
  read("../js/ai-grading.mjs"),
  read("../js/gemini-client.mjs"),
  read("../js/storage.mjs"),
  read("../js/exam.mjs"),
  read("../js/practice.mjs")
]);

assert.match(html, /connect-src 'self' https:\/\/generativelanguage\.googleapis\.com/);
assert.doesNotMatch(html, /connect-src \*/);
assert.match(html, /script-src 'self'/);
assert.match(html, /object-src 'none'/);
assert.match(html, /frame-src 'none'/);
assert.doesNotMatch(html, /script-src[^;]*unsafe-inline/);
assert.match(vault, /PBKDF2/);
assert.match(vault, /SHA-256/);
assert.match(vault, /AES-GCM/);
assert.match(vault, /250000/);
assert.doesNotMatch(vault, /sessionStorage/);
assert.match(client, /"x-goog-api-key": apiKey/);
assert.doesNotMatch(client, /\?key=/);
assert.match(grading, /store: false/);
assert.doesNotMatch(grading, /previous_interaction_id\s*:/);
assert.doesNotMatch(grading, /tools\s*:/);
assert.doesNotMatch(grading, /google_search|grounding/);
assert.match(storage, /BACKUP_EXCLUDED_KEYS/);
assert.doesNotMatch([vault, grading, client, storage, examUI, practiceUI].join("\n"), /localStorage\.clear\s*\(/);
assert.doesNotMatch([examUI, practiceUI].join("\n"), /innerHTML/);
assert.match(examUI, /continueFinalization/);
assert.doesNotMatch(examUI, /Aceitar correção revisada|Descartar sugestão|Corrigir novamente/);
assert.match(practiceUI, /continueFinalization/);
assert.doesNotMatch(practiceUI, /Aceitar correção revisada|Descartar sugestão|Corrigir novamente|Pontuação final \(ajuste humano\)/);
assert.doesNotMatch([html, vault, grading, client, storage, examUI, practiceUI].join("\n"), /AIza[0-9A-Za-z_-]{20,}/);

console.log("ai security: ok");
