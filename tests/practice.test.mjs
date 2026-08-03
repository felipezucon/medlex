import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validatePractice} from "../js/practice-data.mjs";
import {applyPracticeAIResults, buildPracticeAIItems, gradePractice, practiceItems} from "../js/practice-grading.mjs";
import {practiceHistoryUnitTitles} from "../js/practice-storage.mjs";

const practice = JSON.parse(await readFile(new URL("../data/practice/ing-forms.json", import.meta.url), "utf8"));
assert.equal(validatePractice(practice, "ing-forms"), practice);
assert.equal(practice.units.length, 17);
assert.equal(practiceItems(practice).length, 76);
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
assert.equal(full.completed, 76);
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
assert.ok(reviewed.percent >= review.percent);
assert.ok(reviewed.pendingReview.includes("blood-a"));

const aiSession = structuredClone(session);
aiSession.assessment = {};
const aiItems = buildPracticeAIItems(practice, aiSession).filter(item => String(item.studentAnswer).trim());
assert.equal(aiItems.length, 76);
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
assert.ok(gradePractice(practice, aiSession).percent >= 99);
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

const examIndexUrl = new URL("../data/exams/index.json", import.meta.url);
const examIndex = JSON.parse(await readFile(examIndexUrl, "utf8"));
const exams = new Map(await Promise.all(examIndex.exams.map(async entry => [
  entry.id,
  JSON.parse(await readFile(new URL(entry.file, examIndexUrl), "utf8"))
])));
const sourcedUnits = practice.units.filter(unit => unit.examId);
assert.equal(sourcedUnits.length, 14);
assert.deepEqual(practiceHistoryUnitTitles({units: [sourcedUnits[0].sourceTitle]}, practice.units), [sourcedUnits[0].title]);
assert.deepEqual(practiceHistoryUnitTitles({unitIds: [sourcedUnits[0].id]}, practice.units), [sourcedUnits[0].title]);
for (const unit of sourcedUnits) {
  const exam = exams.get(unit.examId);
  assert.ok(exam, `Simulado ausente: ${unit.examId}`);
  assert.equal(unit.title, exam.theme);
  assert.equal(unit.sourceTitle, exam.title);
}

const standardizedRecentIds = new Set([
  "ing-simulado-06-semaglutide-masld",
  "ing-simulado-07-bioengineered-vessels"
]);
assert.doesNotMatch(JSON.stringify(practice), /answerMode|practiceSource/);
for (const unit of sourcedUnits) {
  const exam = exams.get(unit.examId);
  const translation = unit.blocks.find(block => block.type === "translation");
  const open = unit.blocks.find(block => block.type === "open");
  assert.equal(translation.items.length, standardizedRecentIds.has(unit.id) ? 4 : 3);
  assert.equal(open.items.length, 1);
  for (const item of translation.items) {
    const sourceParagraph = exam.article.paragraphs.find(paragraph => paragraph.number === item.sourceParagraph);
    const sourceAnswer = exam.sections.b.items.find(answer => answer.id === item.sourceAnswerId);
    const sourceRubric = sourceAnswer.rubric.find(criterion => criterion.id === item.sourceRubricId);
    const sourceSentence = item.segments.map(segment => segment.text).join("");
    const highlighted = item.segments.filter(segment => segment.target).map(segment => segment.text).join(" ");
    assert.ok(sourceParagraph.text.includes(sourceSentence), `Frase sem origem: ${item.id}`);
    assert.match(highlighted, /\b[A-Za-z][A-Za-z'-]*ing\b/i);
    assert.doesNotMatch(highlighted, /\b(?:during|according|offspring)\b/i);
    assert.ok(sourceAnswer.suggestedAnswer.includes(item.expectedAnswer), `Resposta sem origem: ${item.id}`);
    assert.deepEqual(item.rubric.map(({label, points}) => ({label, points})), [{label: sourceRubric.label, points: sourceRubric.points}]);
  }
  const item = open.items[0];
  const sourceParagraph = exam.article.paragraphs.find(paragraph => paragraph.number === item.sourceParagraph);
  const sourceAnswer = exam.sections.b.items.find(answer => answer.id === item.sourceAnswerId);
  assert.equal(item.text, sourceParagraph.text);
  assert.equal(item.question, sourceAnswer.question);
  assert.equal(item.expectedAnswer, sourceAnswer.suggestedAnswer);
  assert.deepEqual(item.rubric.map(({label, points}) => ({label, points})), sourceAnswer.rubric.map(({label, points}) => ({label, points})));
}

console.log("practice: ok");
