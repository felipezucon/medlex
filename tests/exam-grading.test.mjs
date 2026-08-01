import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {gradeExam} from "../js/exam-grading.mjs";

for (const letter of ["a", "b", "c", "d", "e", "f"]) {
  const exam = JSON.parse(await readFile(new URL(`../data/exams/prefinal-${letter}.json`, import.meta.url), "utf8"));
  const attempt = {
    answers: {
      a: Object.fromEntries(exam.sections.a.items.map(item => [item.id, {
        developed: item.developed,
        paragraph: item.paragraph || ""
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

console.log("exam grading: ok");
