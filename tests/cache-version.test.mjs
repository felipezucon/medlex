import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CONTENT_VERSION} from "../js/storage.mjs";

const [serviceWorker, html, app, examData, practiceData] = await Promise.all([
  readFile(new URL("../sw.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/exam-data.mjs", import.meta.url), "utf8"),
  readFile(new URL("../js/practice-data.mjs", import.meta.url), "utf8")
]);

assert.match(serviceWorker, new RegExp(`CONTENT_VERSION=["']${CONTENT_VERSION.replaceAll(".", "\\.")}["']`));
assert.match(serviceWorker, /key\.startsWith\(["']medlex-["']\)/);
assert.doesNotMatch(serviceWorker, /localStorage/);
assert.match(html, new RegExp(`app\\.js\\?v=${CONTENT_VERSION.replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`styles\\.css\\?v=${CONTENT_VERSION.replaceAll(".", "\\.")}`));
assert.match(html, /href="https:\/\/aistudio\.google\.com\/api-keys"/);
assert.match(app, /cards\.csv\?v=\$\{CONTENT_VERSION\}/);
assert.match(examData, /searchParams\.set\(["']v["'], CONTENT_VERSION\)/);
assert.match(practiceData, /searchParams\.set\(["']v["'], CONTENT_VERSION\)/);

const productionSources = [serviceWorker, html, app, examData, practiceData,
  await readFile(new URL("../js/storage.mjs", import.meta.url), "utf8")];
assert.ok(productionSources.every(source => !source.includes("localStorage.clear(")));

console.log("cache version: ok");
