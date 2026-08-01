import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validatePractice} from "../js/practice-data.mjs";
import {gradePractice, practiceItems} from "../js/practice-grading.mjs";

const practice = JSON.parse(await readFile(new URL("../data/practice/ing-forms.json", import.meta.url), "utf8"));
assert.equal(validatePractice(practice, "ing-forms"), practice);
assert.equal(practiceItems(practice).length, 18);
assert.equal(practiceItems(practice, ["blood"]).length, 7);

const session = {unitIds: practice.units.map(unit => unit.id), answers: {}, assessment: {}};
for (const item of practiceItems(practice)) {
  if (item.type === "matching") {
    session.answers[item.id] = {choice: item.correctOption, translation: "Traducción propia"};
    session.assessment[item.id] = {translation: true};
  } else {
    session.answers[item.id] = "Respuesta propia";
    session.assessment[item.id] = Object.fromEntries(item.rubric.map(criterion => [criterion.id, true]));
  }
}
const full = gradePractice(practice, session);
assert.equal(full.completed, 18);
assert.equal(full.autoCorrect, 5);
assert.equal(full.percent, 100);
assert.deepEqual(full.pendingReview, []);

session.answers["tb-tests"].choice = "a";
session.assessment["blood-a"] = {};
const review = gradePractice(practice, session);
assert.ok(review.percent < 100);
assert.deepEqual(review.pendingReview.sort(), ["blood-a", "tb-tests"]);

const incomplete = structuredClone(practice);
delete incomplete.units[0].blocks[0].items[0].expectedAnswer;
assert.throws(() => validatePractice(incomplete, "ing-forms"), /traduções inválidas/);

console.log("practice: ok");
