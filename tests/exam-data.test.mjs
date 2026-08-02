import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateExam} from "../js/exam-data.mjs";

const indexUrl = new URL("../data/exams/index.json", import.meta.url);
const index = JSON.parse(await readFile(indexUrl, "utf8"));
assert.equal(index.exams.length, 12);

for (const entry of index.exams) {
  const exam = JSON.parse(await readFile(new URL(entry.file, indexUrl), "utf8"));
  assert.equal(validateExam(exam, entry.id), exam);
}

const incomplete = JSON.parse(await readFile(new URL("../data/exams/prefinal-a.json", import.meta.url), "utf8"));
delete incomplete.sections.b.items[0].suggestedAnswer;
assert.throws(() => validateExam(incomplete, "prefinal-a"), /incompletos ou inconsistentes/);
assert.throws(() => validateExam({}, "missing"), /incompletos ou inconsistentes/);

console.log("exam data: ok");
