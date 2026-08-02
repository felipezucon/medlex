import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {gradeExam, gradeSectionA} from "../js/exam-grading.mjs";

const indexUrl = new URL("../data/exams/index.json", import.meta.url);
const index = JSON.parse(await readFile(indexUrl, "utf8"));

for (const entry of index.exams) {
  const exam = JSON.parse(await readFile(new URL(entry.file, indexUrl), "utf8"));
  const attempt = {
    answers: {
      a: Object.fromEntries(exam.sections.a.items.map(item => [item.id, {
        developed: item.developed,
        paragraph: (Array.isArray(item.paragraphs) ? item.paragraphs : [item.paragraph]).filter(Number.isInteger).join(", ")
      }]))
    },
    assessment: {
      b: Object.fromEntries(exam.sections.b.items.map(item => [item.id,
        Object.fromEntries(item.rubric.map(criterion => [criterion.id, true]))
      ])),
      c: 3
    }
  };

  const result = gradeExam(exam, attempt);
  assert.deepEqual(result.sections, {a: 9, b: 24, c: 3});
  assert.equal(result.total, 36);
  assert.equal(result.passed, true);

  attempt.assessment.b = {};
  attempt.assessment.c = 0;
  const failed = gradeExam(exam, attempt);
  assert.equal(failed.total, 9);
  assert.equal(failed.passed, false);
}

const multiParagraphExam = JSON.parse(await readFile(new URL("../data/exams/simulado-01-sleep-apnea.json", import.meta.url), "utf8"));
assert.equal(gradeSectionA(multiParagraphExam, {a2: {developed: true, paragraph: "5, 3"}}).results.a2, true);
assert.equal(gradeSectionA(multiParagraphExam, {a2: {developed: true, paragraph: "3"}}).results.a2, false);

const thresholdExam = JSON.parse(await readFile(new URL("../data/exams/prefinal-a.json", import.meta.url), "utf8"));
const thresholdAttempt = {
  answers: {a: Object.fromEntries(thresholdExam.sections.a.items.map(item => [item.id, {
    developed: !item.developed,
    paragraph: item.developed ? "" : "1"
  }]))},
  assessment: {b: {}, c: 0}
};
for (const item of thresholdExam.sections.b.items.slice(0, 5)) {
  thresholdAttempt.assessment.b[item.id] = Object.fromEntries(item.rubric.map(criterion => [criterion.id, true]));
}
thresholdAttempt.assessment.b.b6 = {"b6-1": true};
assert.equal(gradeExam(thresholdExam, thresholdAttempt).total, 21);
assert.equal(gradeExam(thresholdExam, thresholdAttempt).passed, true);

thresholdAttempt.aiGrading = {b1: {accepted: true, finalPoints: 2.5}};
thresholdAttempt.assessment.b.b1 = {};
assert.equal(gradeExam(thresholdExam, thresholdAttempt).sections.b, 19.5);

console.log("exam grading: ok");
