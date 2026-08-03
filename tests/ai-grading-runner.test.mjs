import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: key => values.delete(key)
};

const vault = await import("../js/api-key-vault.mjs");
const storage = await import("../js/ai-grading-storage.mjs");
const grading = await import("../js/ai-grading.mjs");
const credential = ["runner", "credential", "test"].join("-");
const password = ["runner", "password", "test"].join("-");
await vault.configureApiKey(credential, password, password);

const item = {
  id: "open-1",
  gradingMode: "ai_or_manual",
  question: "Pregunta",
  expectedAnswer: "Respuesta",
  acceptedVariants: [],
  sourceExcerpt: null,
  answerLanguage: "es",
  maxPoints: 2,
  rubric: [{id: "open-1-r1", label: "Criterio", points: 2}],
  studentAnswer: "Paráfrasis"
};

let calls = 0;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.doesNotMatch(url, new RegExp(credential));
  assert.doesNotMatch(options.body, new RegExp(credential));
  assert.equal(JSON.parse(options.body).store, false);
  const payload = JSON.parse(options.body);
  const coaching = payload.response_format.schema.properties.items.items.required.includes("coachingFeedback");
  const output = {
    schemaVersion: 3,
    items: [{
      itemId: "open-1",
      status: "graded",
      confidence: "high",
      criteria: [{criterionId: "open-1-r1", status: "partial", feedback: "Parcial."}],
      score: 1,
      overallFeedback: coaching ? "Resposta parcial." : "Respuesta parcial.",
      ...(coaching ? {coachingFeedback: {
        explanation: "Faltou completar o critério.",
        improvementTip: "Compare a resposta com a rubrica.",
        memoryTip: "Lembre-se do critério central."
      }} : {})
    }]
  };
  return new Response(JSON.stringify({
    status: "completed",
    steps: [{type: "model_output", content: [{type: "text", text: JSON.stringify(output)}]}]
  }), {status: 200});
};

await assert.rejects(
  grading.gradeItemsWithAI({parentId: "practice", contentVersion: 1, items: [item]}),
  /consentimento/
);
assert.equal(calls, 0);
storage.setAIConsent(true);

const first = await grading.gradeItemsWithAI({parentId: "practice", contentVersion: 1, items: [item]});
assert.equal(first[0].points, 1);
assert.equal(first[0].cached, false);
assert.equal(calls, 1);
const cached = await grading.gradeItemsWithAI({parentId: "practice", contentVersion: 1, items: [item]});
assert.equal(cached[0].cached, true);
assert.equal(calls, 1);

const coached = await grading.gradeItemsWithAI({
  parentId: "practice",
  contentVersion: 1,
  items: [item],
  feedbackProfile: "learning-coach",
  feedbackLanguage: "pt-BR"
});
assert.equal(coached[0].coachingFeedback.memoryTip, "Lembre-se do critério central.");
assert.equal(calls, 2);

const empty = await grading.gradeItemsWithAI({parentId: "practice", contentVersion: 1, items: [{...item, studentAnswer: "  "}]});
assert.deepEqual(empty, []);
assert.equal(calls, 2);

let invalidCalls = 0;
globalThis.fetch = async () => {
  invalidCalls++;
  const text = invalidCalls === 1 ? "not-json" : JSON.stringify({
    schemaVersion: 3,
    items: [{itemId: "open-1", status: "graded", confidence: "medium", criteria: [{criterionId: "open-1-r1", status: "met", feedback: "Cumplido."}], score: 2, overallFeedback: "Correcto."}]
  });
  return new Response(JSON.stringify({status: "completed", steps: [{type: "model_output", content: [{type: "text", text}]}]}), {status: 200});
};
const retried = await grading.gradeItemsWithAI({parentId: "practice", contentVersion: 1, items: [item], force: true});
assert.equal(retried[0].points, 2);
assert.equal(invalidCalls, 2);

console.log("ai grading runner: ok");
