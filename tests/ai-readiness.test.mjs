import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateExam} from "../js/exam-data.mjs";
import {validatePractice} from "../js/practice-data.mjs";
import {validateGradableItem} from "../js/ai-grading.mjs";

const examIndexUrl = new URL("../data/exams/index.json", import.meta.url);
const examIndex = JSON.parse(await readFile(examIndexUrl, "utf8"));
let objective = 0;
let open = 0;
let ready = 0;
for (const entry of examIndex.exams) {
  const exam = validateExam(JSON.parse(await readFile(new URL(entry.file, examIndexUrl), "utf8")), entry.id);
  objective += exam.sections.a.items.length;
  open += exam.sections.b.items.length + 1;
  ready += exam.sections.b.items.filter(item => validateGradableItem(item).gradable).length;
  assert.equal(exam.sections.c.gradingMode, "manual");
  assert.equal(Array.isArray(exam.sections.c.rubric), false);
}

const practiceUrl = new URL("../data/practice/ing-forms.json", import.meta.url);
const practice = validatePractice(JSON.parse(await readFile(practiceUrl, "utf8")), "ing-forms");
for (const unit of practice.units) for (const block of unit.blocks) {
  if (block.type === "matching") objective += block.questions.length;
  else {
    open += block.items.length;
    ready += block.items.filter(item => validateGradableItem(item).gradable).length;
  }
}

assert.deepEqual({objective, open, ready}, {objective: 77, open: 97, ready: 85});
console.log("ai readiness: ok");
