import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validatePractice} from "../js/practice-data.mjs";
import {applyPracticeAIResults, buildPracticeAIItems, gradePractice, practiceItems} from "../js/practice-grading.mjs";

const practice = JSON.parse(await readFile(new URL("../data/practice/ing-forms.json", import.meta.url), "utf8"));
assert.equal(validatePractice(practice, "ing-forms"), practice);
assert.equal(practiceItems(practice).length, 18);
assert.equal(practiceItems(practice, ["blood"]).length, 7);
const matchingItem = practiceItems(practice).find(item => item.id === "tb-tests");
assert.equal(matchingItem.maxPoints, 1);
assert.equal(matchingItem.expectedAnswer, matchingItem.block.options.find(option => option.id === "c").expectedTranslation);

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

session.aiGrading = {"blood-a": {accepted: true, finalPoints: 0.5}};
const reviewed = gradePractice(practice, session);
assert.ok(reviewed.percent > review.percent);

const aiSession = structuredClone(session);
aiSession.assessment = {};
const aiItems = buildPracticeAIItems(practice, aiSession).filter(item => String(item.studentAnswer).trim());
assert.equal(aiItems.length, 18);
assert.equal(aiItems.find(item => item.id === "tb-tests").sourceText, matchingItem.sourceText);
applyPracticeAIResults(practice, aiSession, aiItems.map(item => ({
  itemId: item.id,
  status: "graded",
  confidence: "high",
  criteria: item.rubric.map(criterion => ({criterionId: criterion.id, status: "met", feedback: "Atendido."})),
  score: item.maxPoints,
  points: item.maxPoints,
  overallFeedback: "Correto.",
  coachingFeedback: {explanation: "Correto.", improvementTip: "Continue.", memoryTip: "Revise."}
})));
assert.equal(gradePractice(practice, aiSession).percent, 96);
assert.equal(aiSession.aiGrading["tb-tests"].accepted, true);
assert.equal(aiSession.aiGrading["tb-tests"].manuallyAdjusted, false);

const partialSession = structuredClone(session);
delete partialSession.aiGrading;
assert.throws(() => applyPracticeAIResults(practice, partialSession, []), /correção completa/);
assert.equal(partialSession.aiGrading, undefined);

const incomplete = structuredClone(practice);
delete incomplete.units[0].blocks[0].items[0].expectedAnswer;
assert.throws(() => validatePractice(incomplete, "ing-forms"), /traduções inválidas/);

const invalidMatching = structuredClone(practice);
delete invalidMatching.units[1].blocks[0].translationGrading;
assert.throws(() => validatePractice(invalidMatching, "ing-forms"), /associações inválidas/);

console.log("practice: ok");
