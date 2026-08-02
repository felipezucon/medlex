import {CONTENT_VERSION} from "./storage.mjs";

const versionedURL = (path, base = import.meta.url) => {
  const url = new URL(path, base);
  url.searchParams.set("v", CONTENT_VERSION);
  return url;
};
const INDEX_URL = versionedURL("../data/practice/index.json");
const isText = value => typeof value === "string" && value.trim().length > 0;
const uniqueIds = items => new Set(items.map(item => item.id)).size === items.length;
const rubricValid = rubric => Array.isArray(rubric) && rubric.length > 0 && uniqueIds(rubric)
  && rubric.every(item => isText(item?.id) && isText(item?.label) && Number(item?.points) > 0);

async function requestJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Não foi possível carregar os dados das práticas.");
  }
  if (!response.ok) throw new Error(`Arquivo de prática não encontrado (${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error("Um arquivo de prática contém JSON inválido.");
  }
}

export async function loadPracticeIndex() {
  const data = await requestJSON(INDEX_URL);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.practices) || data.practices.length === 0
    || !data.practices.every(item => isText(item?.id) && isText(item?.file) && item.file.startsWith("./"))) {
    throw new Error("O índice de práticas é inválido.");
  }
  return data.practices;
}

export function validatePractice(practice, expectedId = practice?.id) {
  if (
    practice?.schemaVersion !== 1
    || practice?.id !== expectedId
    || !isText(practice.title)
    || !isText(practice.description)
    || !Array.isArray(practice.units)
    || practice.units.length === 0
    || !uniqueIds(practice.units)
  ) throw new Error(`Os dados de ${expectedId || "prática"} estão incompletos ou inconsistentes.`);

  const itemIds = new Set();
  for (const unit of practice.units) {
    if (!isText(unit?.id) || !isText(unit?.title) || !Array.isArray(unit?.blocks) || !uniqueIds(unit.blocks)) {
      throw new Error(`A unidade ${unit?.id || "sem identificação"} é inválida.`);
    }
    for (const block of unit.blocks) {
      const items = block.type === "matching" ? block.questions : block.items;
      if (!isText(block?.id) || !isText(block?.instructions) || !Array.isArray(items) || !items.length || !uniqueIds(items)) {
        throw new Error(`O bloco ${block?.id || "sem identificação"} é inválido.`);
      }
      if (items.some(item => itemIds.has(item.id))) throw new Error(`O item ${items.find(item => itemIds.has(item.id)).id} está duplicado.`);
      items.forEach(item => itemIds.add(item.id));
      if (block.type === "translation" && !items.every(item => isText(item?.id)
        && Array.isArray(item.segments) && item.segments.some(segment => segment?.target)
        && item.segments.every(segment => isText(segment?.text))
        && isText(item.expectedAnswer) && rubricValid(item.rubric))) {
        throw new Error(`O bloco ${block.id} contém traduções inválidas.`);
      }
      if (block.type === "matching") {
        if (!Array.isArray(block.options) || !block.options.length || !uniqueIds(block.options)
          || !block.options.every(option => isText(option?.id) && isText(option?.text) && isText(option?.expectedTranslation))
          || !items.every(item => isText(item?.id) && isText(item?.question)
            && block.options.some(option => option.id === item.correctOption))) {
          throw new Error(`O bloco ${block.id} contém associações inválidas.`);
        }
      } else if (block.type === "open" && !items.every(item => isText(item?.id) && isText(item?.text)
        && isText(item?.question) && isText(item?.expectedAnswer) && rubricValid(item.rubric))) {
        throw new Error(`O bloco ${block.id} contém respostas abertas inválidas.`);
      } else if (!["translation", "open"].includes(block.type)) {
        throw new Error(`O tipo de exercício ${block.type || "ausente"} não é compatível.`);
      }
    }
  }
  return practice;
}

export async function loadPractice(entry) {
  return validatePractice(await requestJSON(versionedURL(entry.file, INDEX_URL)), entry.id);
}
