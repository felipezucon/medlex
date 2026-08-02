const INDEX_URL = new URL("../data/exams/index.json", import.meta.url);

const fail = message => { throw new Error(message); };
const isText = value => typeof value === "string" && value.trim().length > 0;
const uniqueIds = items => new Set(items.map(item => item.id)).size === items.length;

async function requestJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Não foi possível carregar os dados dos simulados.");
  }
  if (!response.ok) throw new Error(`Arquivo de simulado não encontrado (${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error("Um arquivo de simulado contém JSON inválido.");
  }
}

export async function loadExamIndex() {
  const data = await requestJSON(INDEX_URL);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.exams) || data.exams.length === 0
    || !data.exams.every(exam => isText(exam?.id) && isText(exam?.file) && exam.file.startsWith("./"))) {
    throw new Error("O índice de simulados é inválido.");
  }
  return data.exams;
}

export function validateExam(exam, expectedId = exam?.id) {
  const a = exam?.sections?.a;
  const b = exam?.sections?.b;
  const c = exam?.sections?.c;
  const paragraphs = exam?.article?.paragraphs;
  const paragraphNumbers = new Set(Array.isArray(paragraphs) ? paragraphs.map(item => item.number) : []);
  const scoreScale = c?.scoreScale;
  const itemParagraphs = item => Array.isArray(item?.paragraphs) ? item.paragraphs : [item?.paragraph];
  const points = (a?.items?.length || 0) * Number(a?.pointsPerItem)
    + (b?.items?.length || 0) * Number(b?.pointsPerItem)
    + Number(c?.maxPoints);

  if (
    exam?.schemaVersion !== 1
    || exam?.id !== expectedId
    || !isText(exam.title)
    || !isText(exam.theme)
    || !isText(exam?.article?.title)
    || !Array.isArray(paragraphs)
    || paragraphs.length === 0
    || !paragraphs.every(item => Number.isInteger(item?.number) && isText(item?.text))
    || paragraphNumbers.size !== paragraphs.length
    || !isText(a?.title)
    || !isText(a?.instructions)
    || !Number.isFinite(Number(a?.pointsPerItem))
    || Number(a.pointsPerItem) <= 0
    || !Array.isArray(a?.items)
    || a.items.length === 0
    || !uniqueIds(a.items)
    || !a.items.every(item => {
      const references = itemParagraphs(item);
      return isText(item?.id) && isText(item?.statement)
        && typeof item.developed === "boolean"
        && (item.developed
          ? references.length > 0 && new Set(references).size === references.length
            && references.every(number => paragraphNumbers.has(number))
          : references.every(number => number === null || number === undefined));
    })
    || !isText(b?.title)
    || !isText(b?.instructions)
    || !Number.isFinite(Number(b?.pointsPerItem))
    || Number(b.pointsPerItem) <= 0
    || !Array.isArray(b?.items)
    || b.items.length === 0
    || !uniqueIds(b.items)
    || !b.items.every(item => isText(item?.id) && isText(item?.question)
      && isText(item?.suggestedAnswer)
      && Array.isArray(item.rubric)
      && item.rubric.length > 0
      && uniqueIds(item.rubric)
      && item.rubric.every(criterion => isText(criterion?.id) && isText(criterion?.label)
        && Number.isFinite(Number(criterion?.points)) && Number(criterion.points) > 0)
      && item.rubric.reduce((sum, criterion) => sum + Number(criterion.points), 0) === Number(b.pointsPerItem))
    || !isText(c?.title)
    || !isText(c?.instructions)
    || !isText(c?.suggestedAnswer)
    || (c?.answerLabel !== undefined && !isText(c.answerLabel))
    || !Number.isInteger(Number(c?.maxPoints))
    || Number(c.maxPoints) <= 0
    || !Array.isArray(scoreScale)
    || scoreScale.length < 2
    || !scoreScale.every(value => Number.isInteger(value) && value >= 0 && value <= Number(c.maxPoints))
    || !scoreScale.includes(0)
    || !scoreScale.includes(Number(c.maxPoints))
    || !Number.isFinite(Number(exam.totalPoints))
    || points !== Number(exam.totalPoints)
    || !Number.isFinite(Number(exam.passingScore))
    || Number(exam.passingScore) < 0
    || Number(exam.passingScore) > points
  ) fail(`Os dados de ${expectedId || "simulado"} estão incompletos ou inconsistentes.`);

  return exam;
}

export async function loadExam(entry) {
  const exam = await requestJSON(new URL(entry.file, INDEX_URL));
  return validateExam(exam, entry.id);
}
