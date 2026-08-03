import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CONTENT_VERSION} from "../js/storage.mjs";

const [serviceWorker, html, stylesheet, app, examData, practiceData, examIndex] = await Promise.all([
  readFile(new URL("../sw.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/exam-data.mjs", import.meta.url), "utf8"),
  readFile(new URL("../js/practice-data.mjs", import.meta.url), "utf8"),
  readFile(new URL("../data/exams/index.json", import.meta.url), "utf8")
]);

assert.match(serviceWorker, new RegExp(`CONTENT_VERSION=["']${CONTENT_VERSION.replaceAll(".", "\\.")}["']`));
assert.match(serviceWorker, /key\.startsWith\(["']medlex-["']\)/);
assert.doesNotMatch(serviceWorker, /localStorage/);
assert.match(html, new RegExp(`app\\.js\\?v=${CONTENT_VERSION.replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`styles\\.css\\?v=${CONTENT_VERSION.replaceAll(".", "\\.")}`));
assert.match(html, /href="https:\/\/aistudio\.google\.com\/api-keys"/);
assert.match(html, /id="themeBtn"[^>]*aria-label="Ativar tema escuro"/);
assert.match(html, /class="theme-icon-light lucide lucide-sun-icon lucide-sun"[^>]*aria-hidden="true"/);
assert.match(html, /class="theme-icon-dark lucide lucide-moon-icon lucide-moon"[^>]*aria-hidden="true"/);
assert.match(html, /data-view="import" aria-label="Configuração" title="Configuração"/);
assert.match(stylesheet, /@media\(max-width:1024px\)\{[\s\S]*?\.topbar \.tabs\{grid-column:1\/-1;grid-row:2;width:100%\}/);
assert.match(app, /cards\.csv\?v=\$\{CONTENT_VERSION\}/);
assert.match(app, /dark \? "Ativar tema claro" : "Ativar tema escuro"/);
assert.match(examData, /searchParams\.set\(["']v["'], CONTENT_VERSION\)/);
assert.match(practiceData, /searchParams\.set\(["']v["'], CONTENT_VERSION\)/);
assert.ok(JSON.parse(examIndex).exams.every(entry => serviceWorker.includes(`./data/exams/${entry.file.slice(2)}`)));

const productionSources = [serviceWorker, html, app, examData, practiceData,
  await readFile(new URL("../js/storage.mjs", import.meta.url), "utf8")];
assert.ok(productionSources.every(source => !source.includes("localStorage.clear(")));

console.log("cache version: ok");
