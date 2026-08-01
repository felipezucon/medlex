import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateExam} from "../js/exam-data.mjs";

for (const letter of ["a", "b", "c", "d", "e", "f"]) {
  const exam = JSON.parse(await readFile(new URL(`../data/exams/prefinal-${letter}.json`, import.meta.url), "utf8"));
  assert.equal(validateExam(exam, `prefinal-${letter}`), exam);
}

const incomplete = JSON.parse(await readFile(new URL("../data/exams/prefinal-a.json", import.meta.url), "utf8"));
delete incomplete.sections.b.items[0].suggestedAnswer;
assert.throws(() => validateExam(incomplete, "prefinal-a"), /incompletos ou inconsistentes/);
assert.throws(() => validateExam({}, "missing"), /incompletos ou inconsistentes/);

console.log("exam data: ok");
