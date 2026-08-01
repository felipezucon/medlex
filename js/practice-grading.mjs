export function practiceItems(practice, unitIds = practice.units.map(unit => unit.id)) {
  const selected = new Set(unitIds);
  return practice.units.filter(unit => selected.has(unit.id)).flatMap(unit =>
    unit.blocks.flatMap(block => (block.type === "matching" ? block.questions : block.items)
      .map(item => ({...item, type: block.type, block})))
  );
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
      subjectiveTotal++;
      subjectiveItems++;
      if (assessment.translation) {
        subjectiveEarned++;
        satisfactory++;
      }
      needsReview ||= !correct || !assessment.translation;
    } else {
      const possible = item.rubric.reduce((sum, criterion) => sum + Number(criterion.points), 0);
      const earned = item.rubric.reduce((sum, criterion) => sum + (assessment[criterion.id] ? Number(criterion.points) : 0), 0);
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
