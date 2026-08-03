import {calculateCriterionPoints} from "./ai-grading.mjs";

export function practiceItems(practice, unitIds = practice.units.map(unit => unit.id)) {
  const selected = new Set(unitIds);
  return practice.units.filter(unit => selected.has(unit.id)).flatMap(unit =>
    unit.blocks.flatMap(block => (block.type === "matching" ? block.questions : block.items)
      .map(item => ({...item, type: block.type, block})))
  );
}

export function buildPracticeAIItems(practice, session) {
  return practiceItems(practice, session.unitIds).map(item => item.type === "matching"
    ? {
      ...item,
      question: item.gradingQuestion,
      studentAnswer: session.answers[item.id]?.translation || ""
    }
    : {...item, studentAnswer: session.answers[item.id] || ""});
}

export function applyPracticeAIResults(practice, session, results) {
  const answered = buildPracticeAIItems(practice, session).filter(item => String(item.studentAnswer).trim());
  const expectedIds = new Set(answered.map(item => item.id));
  if (results.length !== answered.length || results.some(result => result.status !== "graded")
    || new Set(results.map(result => result.itemId)).size !== results.length
    || results.some(result => !expectedIds.has(result.itemId))) {
    throw new Error("A IA não devolveu uma correção completa.");
  }
  session.aiGrading = Object.fromEntries(results.map(result => [result.itemId, {
    ...result,
    aiSuggestedPoints: result.points,
    finalStatuses: Object.fromEntries(result.criteria.map(criterion => [criterion.criterionId, criterion.status])),
    finalPoints: result.points,
    gradingMethod: "ai",
    manuallyAdjusted: false,
    accepted: true
  }]));
  return session.aiGrading;
}

export function gradePractice(practice, session) {
  const items = practiceItems(practice, session.unitIds);
  let completed = 0;
  let autoCorrect = 0;
  let autoTotal = 0;
  let subjectiveEarned = 0;
  let subjectiveTotal = 0;
  let satisfactory = 0;
  let subjectiveItems = 0;
  const pendingReview = [];

  for (const item of items) {
    const answer = session.answers[item.id];
    const assessment = session.assessment[item.id] || {};
    const answered = item.type === "matching"
      ? Boolean(answer?.choice && String(answer?.translation || "").trim())
      : Boolean(String(answer || "").trim());
    if (answered) completed++;

    let needsReview = !answered;
    if (item.type === "matching") {
      autoTotal++;
      const correct = answer?.choice === item.correctOption;
      if (correct) autoCorrect++;
      const possible = Number(item.maxPoints) || 1;
      const reviewedAI = session.aiGrading?.[item.id];
      const translationEarned = reviewedAI?.accepted
        ? Math.min(possible, Math.max(0, Number(reviewedAI.finalPoints) || 0))
        : assessment.translation ? possible : 0;
      subjectiveTotal += possible;
      subjectiveItems++;
      if (translationEarned) subjectiveEarned += translationEarned;
      if (translationEarned === possible) satisfactory++;
      needsReview ||= !correct || translationEarned < possible;
    } else {
      const possible = item.rubric.reduce((sum, criterion) => sum + Number(criterion.points), 0);
      const reviewedAI = session.aiGrading?.[item.id];
      const earned = reviewedAI?.accepted
        ? Math.min(possible, Math.max(0, Number(reviewedAI.finalPoints) || 0))
        : item.rubric.reduce((sum, criterion) => sum + calculateCriterionPoints(assessment[criterion.id], criterion.points), 0);
      subjectiveTotal += possible;
      subjectiveEarned += earned;
      subjectiveItems++;
      if (earned === possible) satisfactory++;
      needsReview ||= earned < possible;
    }
    if (needsReview) pendingReview.push(item.id);
  }

  const earned = autoCorrect + subjectiveEarned;
  const possible = autoTotal + subjectiveTotal;
  return {
    totalItems: items.length,
    completed,
    autoCorrect,
    autoTotal,
    satisfactory,
    subjectiveItems,
    percent: possible ? Math.round((earned / possible) * 100) : 0,
    pendingReview
  };
}
