import {calculateCriterionPoints} from "./ai-grading.mjs";

const paragraphList = value => String(value ?? "")
  .split(/[^0-9]+/)
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

export function gradeSectionA(exam, answers = {}) {
  const results = {};
  let score = 0;
  for (const item of exam.sections.a.items) {
    const answer = answers[item.id] || {};
    const developed = Boolean(answer.developed);
    const paragraphs = paragraphList(answer.paragraph);
    const expected = (Array.isArray(item.paragraphs) ? item.paragraphs : [item.paragraph])
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
    const correct = developed === item.developed
      && (item.developed
        ? paragraphs.length === expected.length && paragraphs.every((number, index) => number === expected[index])
        : paragraphs.length === 0);
    results[item.id] = correct;
    if (correct) score += exam.sections.a.pointsPerItem;
  }
  return {score, results};
}

export function gradeExam(exam, attempt) {
  const sectionA = gradeSectionA(exam, attempt.answers.a);
  let sectionB = 0;
  for (const item of exam.sections.b.items) {
    const selected = attempt.assessment.b[item.id] || {};
    const reviewedAI = attempt.aiGrading?.[item.id];
    const itemScore = reviewedAI?.accepted
      ? Number(reviewedAI.finalPoints) || 0
      : item.rubric.reduce(
        (sum, criterion) => sum + calculateCriterionPoints(selected[criterion.id], criterion.points),
        0
      );
    sectionB += Math.min(exam.sections.b.pointsPerItem, itemScore);
  }
  const reviewedC = attempt.aiGrading?.[exam.sections.c.id];
  const sectionC = Math.min(exam.sections.c.maxPoints, Math.max(0,
    reviewedC?.accepted ? Number(reviewedC.finalPoints) || 0 : Number(attempt.assessment.c) || 0
  ));
  sectionB = Math.round(sectionB * 100) / 100;
  const total = Math.round((sectionA.score + sectionB + sectionC) * 100) / 100;
  return {
    sections: {a: sectionA.score, b: sectionB, c: sectionC},
    sectionAResults: sectionA.results,
    total,
    passed: total >= exam.passingScore
  };
}

export function buildExamAIItems(exam, attempt) {
  const sourceText = [exam.article.title, ...exam.article.paragraphs.map(
    paragraph => `(${paragraph.number}) ${paragraph.text}`
  )].join("\n");
  return [
    ...exam.sections.b.items.map(item => ({...item, sourceText, studentAnswer: attempt.answers.b[item.id] || ""})),
    {
      ...exam.sections.c,
      question: exam.sections.c.instructions,
      sourceText,
      studentAnswer: attempt.answers.c || "",
      rubric: []
    }
  ];
}

export function applyExamAIResults(exam, attempt, results) {
  const answered = buildExamAIItems(exam, attempt).filter(item => String(item.studentAnswer).trim());
  if (results.length !== answered.length || results.some(result => result.status !== "graded")) {
    throw new Error("A IA não devolveu uma correção completa.");
  }
  const expectedIds = new Set(answered.map(item => item.id));
  if (new Set(results.map(result => result.itemId)).size !== results.length
    || results.some(result => !expectedIds.has(result.itemId))) {
    throw new Error("A IA não devolveu uma correção completa.");
  }
  attempt.aiGrading = Object.fromEntries(results.map(result => [result.itemId, {
    ...result,
    aiSuggestedPoints: result.points,
    finalStatuses: Object.fromEntries(result.criteria.map(criterion => [criterion.criterionId, criterion.status])),
    finalPoints: result.points,
    gradingMethod: "ai",
    manuallyAdjusted: false,
    accepted: true
  }]));
  return attempt.aiGrading;
}

export function examMaximums(exam) {
  return {
    a: exam.sections.a.items.length * exam.sections.a.pointsPerItem,
    b: exam.sections.b.items.length * exam.sections.b.pointsPerItem,
    c: exam.sections.c.maxPoints
  };
}

export function examItemCount(exam) {
  return exam.sections.a.items.length + exam.sections.b.items.length + 1;
}
