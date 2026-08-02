import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = 1000;
const FINAL_HEADERS = ["id", "english", "spanish", "portuguese", "example_en", "example_es", "example_pt", "source", "tags"];
const SOURCE_HEADERS = FINAL_HEADERS.slice(1);
const ORIGINAL = "data/cards/sources/cards-original.csv";
const INPUTS = [
  {name: "cards.csv original", file: ORIGINAL},
  {name: "medlex-cards-expansion-to-320.csv", file: "medlex-cards-expansion-to-320.csv"},
  {name: "medlex-expansion-150-pubmed.csv", file: "medlex-expansion-150-pubmed.csv"}
];
const VOCABULARY_FILE = "data/cards/sources/exam-vocabulary.csv";
const OUTPUT = "cards.csv";
const REPORT = "reports/cards-build-report.md";
const REVIEW = "reports/cards-duplicates-review.csv";

const absolute = file => resolve(ROOT, file);
const readText = async file => (await readFile(absolute(file), "utf8")).replace(/^\uFEFF/, "");
const canonical = value => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("en")
  .trim()
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/\s+/g, " ")
  .replace(/[.!?;:,]+$/u, "")
  .trim();
const stableId = english => `card-${createHash("sha256").update(canonical(english)).digest("hex").slice(0, 16)}`;

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(field);
      field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return {headers: [], records: []};
  const headers = rows.shift().map(header => header.trim());
  return {
    headers,
    records: rows.map((values, index) => ({
      line: index + 2,
      values,
      data: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]))
    }))
  };
}

const escapeCSV = value => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const serializeCSV = (headers, records) => "\uFEFF" + [
  headers.join(","),
  ...records.map(record => headers.map(header => escapeCSV(record[header])).join(","))
].join("\n") + "\n";

async function ensureOriginalBackup(check) {
  if (existsSync(absolute(ORIGINAL))) return;
  if (check) throw new Error(`Cópia de segurança ausente: ${ORIGINAL}`);
  const current = parseCSV(await readText(OUTPUT));
  if (current.records.length !== 72 || current.headers.join() !== SOURCE_HEADERS.join()) {
    throw new Error("O cards.csv atual não corresponde ao baralho original de 72 cartões; cópia de segurança não criada.");
  }
  await mkdir(dirname(absolute(ORIGINAL)), {recursive: true});
  await copyFile(absolute(OUTPUT), absolute(ORIGINAL));
}

function validateRows(parsed, expectedHeaders, file) {
  if (parsed.headers.join() !== expectedHeaders.join()) throw new Error(`Cabeçalho inesperado em ${file}.`);
  const invalid = parsed.records.filter(record => record.values.length !== expectedHeaders.length
    || expectedHeaders.some(header => !record.data[header].trim()));
  return {invalid, valid: parsed.records.filter(record => !invalid.includes(record))};
}

async function loadExamCorpus() {
  const sources = [];
  const examIndex = JSON.parse(await readText("data/exams/index.json"));
  for (const entry of examIndex.exams) {
    const exam = JSON.parse(await readText(`data/exams/${entry.file.replace(/^\.\//, "")}`));
    sources.push({
      id: entry.id,
      text: [exam.article.title, ...exam.article.paragraphs.map(item => item.text)].join(". ")
    });
  }
  const practiceIndex = JSON.parse(await readText("data/practice/index.json"));
  for (const entry of practiceIndex.practices) {
    const practice = JSON.parse(await readText(`data/practice/${entry.file.replace(/^\.\//, "")}`));
    const strings = [];
    for (const unit of practice.units) {
      for (const block of unit.blocks) {
        if (block.type === "translation") strings.push(...block.items.map(item => item.segments.map(segment => segment.text).join(" ")));
        else if (block.type === "matching") strings.push(...block.options.map(option => option.text));
        else if (block.type === "open") strings.push(...block.items.map(item => item.text));
      }
    }
    sources.push({
      id: entry.id,
      text: strings.map(text => text.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim()).join(" ")
    });
  }
  return sources;
}

function sourceSentence(text, term) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return sentences.find(sentence => canonical(sentence).includes(canonical(term)))?.trim() || "";
}

async function build() {
  const audits = [];
  const combined = [];
  const seen = new Map();
  let exactDuplicates = 0, normalizedDuplicates = 0;
  const translationConflicts = [];

  for (const input of INPUTS) {
    const parsed = parseCSV(await readText(input.file));
    const rows = validateRows(parsed, SOURCE_HEADERS, input.file);
    let preserved = 0;
    for (const record of rows.valid) {
      const key = canonical(record.data.english);
      if (seen.has(key)) {
        const previous = seen.get(key);
        if (SOURCE_HEADERS.every(header => previous[header] === record.data[header])) exactDuplicates++;
        else normalizedDuplicates++;
        if (canonical(previous.spanish) !== canonical(record.data.spanish)) {
          translationConflicts.push({first: previous.english, second: record.data.english, reason: `traduções conflitantes: ${previous.spanish} / ${record.data.spanish}`});
        }
        continue;
      }
      const card = {...record.data, id: stableId(record.data.english)};
      seen.set(key, card);
      combined.push(card);
      preserved++;
    }
    audits.push({name: input.name, rows: parsed.records.length, valid: rows.valid.length, invalid: rows.invalid.length, preserved});
  }

  const corpus = await loadExamCorpus();
  const catalog = parseCSV(await readText(VOCABULARY_FILE));
  const vocabularyHeaders = ["english", "spanish", "portuguese", "tags"];
  const catalogRows = validateRows(catalog, vocabularyHeaders, VOCABULARY_FILE);
  const candidates = [];
  const rejected = catalogRows.invalid.map(record => ({english: record.data.english, reason: `linha inválida (${record.line})`}));
  for (const record of catalogRows.valid) {
    const key = canonical(record.data.english);
    if (seen.has(key) || candidates.some(item => item.key === key)) {
      rejected.push({...record.data, reason: "duplicata canônica"});
      continue;
    }
    const matches = corpus.filter(source => canonical(source.text).includes(key));
    if (!matches.length) {
      rejected.push({...record.data, reason: "termo não encontrado nas fontes"});
      continue;
    }
    candidates.push({...record.data, key, matches});
  }

  const selected = candidates.slice(0, Math.max(0, LIMIT - combined.length));
  const rejectionCounts = new Map();
  for (const item of rejected) rejectionCounts.set(item.reason, (rejectionCounts.get(item.reason) || 0) + 1);
  if (candidates.length > selected.length) rejectionCounts.set("limite de cartões", candidates.length - selected.length);
  for (const candidate of selected) {
    const primary = candidate.matches[0];
    combined.push({
      id: stableId(candidate.english),
      english: candidate.english.trim(),
      spanish: candidate.spanish.trim(),
      portuguese: candidate.portuguese.trim(),
      example_en: sourceSentence(primary.text, candidate.english),
      example_es: `El texto emplea «${candidate.spanish.trim()}» en un contexto médico.`,
      example_pt: `O texto emprega “${candidate.portuguese.trim()}” em um contexto médico.`,
      source: `Extracted from ${candidate.matches.map(match => match.id).join("; ")}`,
      tags: candidate.tags.trim()
    });
    seen.set(candidate.key, combined.at(-1));
  }

  const keys = combined.map(card => canonical(card.english));
  const ids = combined.map(card => card.id);
  const invalidFinal = combined.filter(card => FINAL_HEADERS.some(header => !String(card[header] ?? "").trim()));
  if (new Set(keys).size !== keys.length) throw new Error("O banco final contém frentes canônicas duplicadas.");
  if (new Set(ids).size !== ids.length) throw new Error("O banco final contém IDs duplicados.");
  if (invalidFinal.length) throw new Error("O banco final contém campos vazios.");
  if (combined.length > LIMIT && audits.reduce((sum, audit) => sum + audit.preserved, 0) <= LIMIT) {
    throw new Error(`O banco final ultrapassou o limite de ${LIMIT}.`);
  }

  const possibleDuplicates = [];
  const reviewPairs = new Set();
  const addReview = (first, second, reason) => {
    const pair = [first, second].sort().join("\u0000");
    if (first !== second && !reviewPairs.has(pair)) {
      reviewPairs.add(pair);
      possibleDuplicates.push({first, second, reason});
    }
  };
  const singular = value => value.replace(/(ies|es|s)$/u, ending => ending === "ies" ? "y" : "");
  const semanticKey = value => singular(canonical(value)
    .replaceAll("randomized", "randomised")
    .replaceAll("hospitalized", "hospitalised")
    .replaceAll("neutralizing", "neutralising"));
  const byLooseKey = new Map();
  for (const card of combined) {
    const key = semanticKey(card.english);
    const other = byLooseKey.get(key);
    if (other && canonical(other.english) !== canonical(card.english)) addReview(other.english, card.english, "possível variante morfológica ou ortográfica");
    else byLooseKey.set(key, card);
  }
  const bySpanish = new Map();
  for (const card of combined) {
    const key = canonical(card.spanish);
    const other = bySpanish.get(key);
    if (other && canonical(other.english) !== canonical(card.english)) addReview(other.english, card.english, "mesma tradução em espanhol; revisar equivalência semântica");
    else bySpanish.set(key, card);
  }
  translationConflicts.forEach(item => addReview(item.first, item.second, item.reason));

  const categories = new Map();
  for (const card of combined) categories.set(card.tags, (categories.get(card.tags) || 0) + 1);
  const sourceCounts = new Map();
  for (const candidate of selected) {
    const primary = candidate.matches[0].id;
    sourceCounts.set(primary, (sourceCounts.get(primary) || 0) + 1);
  }
  const missing = Math.max(0, LIMIT - combined.length);
  const report = `# Relatório de construção dos cartões\n\n` +
    `Gerado deterministicamente por \`node scripts/build-cards.mjs\`.\n\n` +
    `## Auditoria dos CSVs originais\n\n` +
    `| Origem | Linhas | Válidas | Inválidas | Únicas preservadas |\n|---|---:|---:|---:|---:|\n` +
    audits.map(item => `| ${item.name} | ${item.rows} | ${item.valid} | ${item.invalid} | ${item.preserved} |`).join("\n") +
    `\n\n- Duplicatas exatas removidas: ${exactDuplicates}.\n` +
    `- Duplicatas normalizadas removidas: ${normalizedDuplicates}.\n` +
    `- Conflitos de tradução: ${translationConflicts.length}.\n` +
    `- Total único preservado dos CSVs: ${audits.reduce((sum, item) => sum + item.preserved, 0)}.\n\n` +
    `## Vocabulário dos simulados\n\n` +
    `- Candidatos curados: ${catalog.records.length}.\n` +
    `- Candidatos aceitos: ${selected.length}.\n` +
    `- Candidatos rejeitados: ${rejected.length + Math.max(0, candidates.length - selected.length)}.\n` +
    `- Motivos de rejeição: ${[...rejectionCounts].map(([reason, count]) => `${reason} (${count})`).join("; ") || "nenhum"}.\n\n` +
    `| Fonte primária | Cartões extraídos |\n|---|---:|\n` +
    [...sourceCounts].sort(([a], [b]) => a.localeCompare(b)).map(([source, count]) => `| ${source} | ${count} |`).join("\n") +
    `\n\n## Resultado\n\n` +
    `- Cartões finais: **${combined.length}**.\n` +
    `- Faltam para ${LIMIT}: **${missing}**.\n` +
    `- IDs duplicados: 0.\n` +
    `- Frentes canônicas duplicadas: 0.\n` +
    `- Linhas ou campos obrigatórios inválidos: 0.\n` +
    `- Codificação de saída: UTF-8 com BOM.\n\n` +
    `## Categorias\n\n` +
    [...categories].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => `- ${tag}: ${count}`).join("\n") +
    `\n\n## Revisão manual\n\n` +
    `${possibleDuplicates.length} possível(is) equivalência(s) semântica(s) foram mantidas e listadas em \`reports/cards-duplicates-review.csv\`.\n` +
    (missing ? `\nPara chegar a ${LIMIT} sem inventar conteúdo, seriam necessárias novas fontes médicas bilíngues ou novos simulados com resoluções em espanhol.\n` : "");

  return {
    cards: serializeCSV(FINAL_HEADERS, combined),
    report,
    review: serializeCSV(["first", "second", "reason"], possibleDuplicates),
    summary: {final: combined.length, original: audits.reduce((sum, item) => sum + item.preserved, 0), extracted: selected.length, rejected: rejected.length, possibleDuplicates: possibleDuplicates.length}
  };
}

async function compare(file, expected) {
  let actual;
  try {
    actual = await readFile(absolute(file), "utf8");
  } catch {
    throw new Error(`${file} não existe; execute o construtor sem --check.`);
  }
  if (actual !== expected) throw new Error(`${file} está desatualizado; execute node scripts/build-cards.mjs.`);
}

async function main() {
  const check = process.argv.includes("--check");
  await ensureOriginalBackup(check);
  const result = await build();
  if (check) {
    await compare(OUTPUT, result.cards);
    await compare(REPORT, result.report);
    await compare(REVIEW, result.review);
    console.log(`cards check: ok (${result.summary.final} cartões)`);
    return;
  }
  await mkdir(dirname(absolute(REPORT)), {recursive: true});
  await writeFile(absolute(OUTPUT), result.cards, "utf8");
  await writeFile(absolute(REPORT), result.report, "utf8");
  await writeFile(absolute(REVIEW), result.review, "utf8");
  console.log(`cards build: ok (${result.summary.original} originais + ${result.summary.extracted} extraídos = ${result.summary.final})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
