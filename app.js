import {
	CONTENT_VERSION,
	LEGACY_KEYS,
	exportStorageBackup,
	getStorageIssues,
	hasMigrationBackup,
	migrateStorage,
	parseStorageBackup,
	readCardProgress,
	readCustomDecks,
	readReviewLog,
	readSettings,
	recoverMigrationBackup,
	resetMedlexStorage,
	restoreStorageBackup,
	storageVersions,
	writeCardProgress,
	writeCustomDecks,
	writeReviewLog,
	writeSettings,
} from "./js/storage.mjs";

const DAY = 24 * 60 * 60 * 1000;
const CONTENT_FIELDS = ["english", "spanish", "portuguese", "example_en", "example_es", "example_pt", "source", "tags"];
let state = { cards: [], settings: { newPerDay: 20, theme: "light" } };
let defaultCards = [];
let defaultCardIds = new Set();
let hiddenDefaultIds = new Set();
let storageReady = true;
let queue = [],
	currentIndex = 0;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const now = () => Date.now();
const uid = () =>
	crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2) + Date.now();

function normalizeCard(raw) {
	return {
		id: raw.id || uid(),
		english: (raw.english || "").trim(),
		spanish: (raw.spanish || "").trim(),
		portuguese: (raw.portuguese || "").trim(),
		example_en: (raw.example_en || "").trim(),
		example_es: (raw.example_es || "").trim(),
		example_pt: (raw.example_pt || "").trim(),
		source: (raw.source || "").trim(),
		tags: (raw.tags || "general").trim(),
		due: Number(raw.due) || 0,
		interval: Number(raw.interval) || 0,
		ease: Number(raw.ease) || 2.5,
		repetitions: Number(raw.repetitions) || 0,
		lapses: Number(raw.lapses) || 0,
		reviews: Number(raw.reviews) || 0,
		createdAt: Number(raw.createdAt) || now(),
		lastReviewed: Number(raw.lastReviewed) || 0,
	};
}
function save() {
	const progress = {};
	const customCards = [];
	const overrides = {};
	for (const card of state.cards) {
		const isDefault = defaultCardIds.has(card.id);
		if (!isDefault || card.reviews > 0 || card.repetitions > 0 || card.lapses > 0 || card.due > 0 || card.interval > 0 || card.lastReviewed > 0) {
			progress[card.id] = Object.fromEntries(["due", "interval", "ease", "repetitions", "lapses", "reviews", "createdAt", "lastReviewed"]
				.map(field => [field, Number(card[field]) || (field === "ease" ? 2.5 : 0)]));
		}
		if (isDefault) {
			const original = defaultCards.find(item => item.id === card.id);
			const changed = Object.fromEntries(CONTENT_FIELDS
				.filter(field => String(card[field] ?? "").trim() !== String(original?.[field] ?? "").trim())
				.map(field => [field, String(card[field] ?? "").trim()]));
			if (Object.keys(changed).length) overrides[card.id] = {id: card.id, ...changed};
		} else {
			customCards.push(Object.fromEntries([["id", card.id], ...CONTENT_FIELDS.map(field => [field, String(card[field] ?? "").trim()])]));
		}
	}
	writeCardProgress({version: 1, cards: progress});
	writeCustomDecks({version: 1, cards: customCards, overrides, hiddenDefaultIds: [...hiddenDefaultIds]});
	writeSettings({version: 1, newPerDay: state.settings.newPerDay, theme: state.settings.theme});
}
async function loadInitial() {
	const res = await fetch(`./cards.csv?v=${CONTENT_VERSION}`, {cache: "no-cache"});
	if (!res.ok) throw new Error(`Não foi possível carregar o baralho padrão (${res.status}).`);
	const text = await res.text();
	const rows = parseCSV(text);
	defaultCards = rows.filter((r) => r.english).map(normalizeCard);
	defaultCardIds = new Set(defaultCards.map(card => card.id));
	let migrationFailure = null;
	try {
		migrateStorage(defaultCards);
	} catch (error) {
		migrationFailure = error;
	}
	const progress = readCardProgress().cards;
	const userDecks = readCustomDecks();
	hiddenDefaultIds = new Set(userDecks.hiddenDefaultIds);
	state.settings = readSettings();
	state.cards = defaultCards
		.filter(card => !hiddenDefaultIds.has(card.id))
		.map(card => normalizeCard({...card, ...(userDecks.overrides[card.id] || {}), ...(progress[card.id] || {})}));
	state.cards.push(...userDecks.cards.map(card => normalizeCard({...card, ...(progress[card.id] || {})})));
	return migrationFailure;
}
function parseCSV(text) {
	text = text.replace(/^\uFEFF/, "");
	const rows = [];
	let row = [],
		field = "",
		q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i],
			n = text[i + 1];
		if (c == '"' && q && n == '"') {
			field += '"';
			i++;
		} else if (c == '"') {
			q = !q;
		} else if (c == "," && !q) {
			row.push(field);
			field = "";
		} else if ((c == "\n" || c == "\r") && !q) {
			if (c == "\r" && n == "\n") i++;
			row.push(field);
			field = "";
			if (row.some((x) => x !== "")) rows.push(row);
			row = [];
		} else field += c;
	}
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	if (!rows.length) return [];
	const headers = rows.shift().map((h) => h.trim());
	return rows.map((r) =>
		Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])),
	);
}
function escapeCSV(v) {
	const s = String(v ?? "");
	return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function download(name, content, type) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dueCards() {
	const t = now();
	const due = state.cards
		.filter((c) => c.repetitions > 0 && c.due <= t)
		.sort((a, b) => a.due - b.due);
	const fresh = state.cards
		.filter((c) => c.repetitions === 0)
		.slice(0, state.settings.newPerDay);
	return [...due, ...fresh];
}
function buildQueue() {
	queue = dueCards();
	currentIndex = 0;
	renderStudy();
	refreshCounts();
}
function refreshCounts() {
	const t = now();
	$("#dueCount").textContent = state.cards.filter(
		(c) => c.repetitions > 0 && c.due <= t,
	).length;
	$("#newCount").textContent = state.cards.filter(
		(c) => c.repetitions === 0,
	).length;
	$("#masteredCount").textContent = state.cards.filter(
		(c) => c.interval >= 21,
	).length;
}
function fmtInterval(ms) {
	if (ms < 60 * 60 * 1000) return Math.max(1, Math.round(ms / 60000)) + " min";
	if (ms < DAY) return Math.round(ms / 3600000) + " h";
	const d = Math.round(ms / DAY);
	return d === 1 ? "1 dia" : d + " dias";
}
function proposed(card, rating) {
	if (rating === "again") return 60 * 1000;
	if (card.repetitions === 0) {
		return rating === "hard"
			? 10 * 60 * 1000
			: rating === "good"
				? DAY
				: 4 * DAY;
	}
	const base = Math.max(DAY, card.interval);
	if (rating === "hard") return Math.max(10 * 60 * 1000, base * 1.2);
	if (rating === "good") return base * card.ease;
	return base * card.ease * 1.45;
}
function renderStudy() {
	const card = queue[currentIndex];
	if (!card) {
		$("#studyCard").classList.add("hidden");
		$("#emptyState").classList.remove("hidden");
		return;
	}
	$("#studyCard").classList.remove("hidden");
	$("#emptyState").classList.add("hidden");
	$("#backSide").classList.add("hidden");
	$("#frontSide").classList.remove("hidden");
	$("#frontWord").textContent = card.english;
	$("#spanishText").textContent = card.spanish;
	$("#portugueseText").textContent = card.portuguese;
	$("#exampleEn").textContent = card.example_en;
	$("#exampleEs").textContent = card.example_es;
	$("#examplePt").textContent = card.example_pt;
	$("#sourceText").textContent = card.source;
	$("#cardTag").textContent = card.tags || "general";
	$("#queuePosition").textContent = `${currentIndex + 1}/${queue.length}`;
	$("#hardInterval").textContent = fmtInterval(proposed(card, "hard"));
	$("#goodInterval").textContent = fmtInterval(proposed(card, "good"));
	$("#easyInterval").textContent = fmtInterval(proposed(card, "easy"));
}
function rateCard(rating) {
	if (!storageReady) {
		$("#importStatus").textContent = "O vocabulário está disponível para consulta, mas o progresso não pode ser salvo até reparar os dados locais.";
		return;
	}
	const card = queue[currentIndex];
	if (!card) return;
	const oldEase = card.ease;
	let next = proposed(card, rating);
	card.reviews++;
	card.lastReviewed = now();
	if (rating === "again") {
		card.lapses++;
		card.repetitions = 0;
		card.interval = next;
		card.ease = Math.max(1.3, oldEase - 0.2);
	} else {
		card.repetitions++;
		card.interval = next;
		if (rating === "hard") card.ease = Math.max(1.3, oldEase - 0.15);
		if (rating === "easy") card.ease = oldEase + 0.15;
	}
	card.due = now() + next;
	logReview(rating);
	save();
	currentIndex++;
	renderStudy();
	refreshCounts();
	renderStats();
}
function logReview(rating) {
	const log = readReviewLog();
	log.items.push({ at: now(), rating });
	log.items = log.items.slice(-5000);
	writeReviewLog(log);
}
function renderCards() {
	const q = $("#searchInput").value.toLowerCase();
	const tag = $("#tagFilter").value;
	const filtered = state.cards
		.filter((c) => {
			const hay = [c.english, c.spanish, c.portuguese, c.tags]
				.join(" ")
				.toLowerCase();
			return hay.includes(q) && (!tag || c.tags === tag);
		})
		.sort((a, b) => a.english.localeCompare(b.english));
	$("#cardCountLabel").textContent = `${filtered.length} cartão(ões)`;
	$("#cardList").innerHTML = filtered
		.map(
			(c) => `
    <div class="list-item">
      <div><h3>${safe(c.english)}</h3><p>ES: ${safe(c.spanish)}</p><p>PT: ${safe(c.portuguese)}</p></div>
      <button data-delete="${c.id}" aria-label="Excluir">Excluir</button>
    </div>`,
		)
		.join("");
}
function safe(s) {
	return String(s ?? "").replace(
		/[&<>"']/g,
		(m) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#039;",
			})[m],
	);
}
function populateTags() {
	const tags = [
		...new Set(state.cards.map((c) => c.tags).filter(Boolean)),
	].sort();
	$("#tagFilter").innerHTML =
		'<option value="">Todas as etiquetas</option>' +
		tags.map((t) => `<option>${safe(t)}</option>`).join("");
}
function renderStats() {
	const total = state.cards.length,
		seen = state.cards.filter((c) => c.reviews > 0).length;
	const mature = state.cards.filter((c) => c.interval >= 21 * DAY).length;
	const reviews = state.cards.reduce((a, c) => a + c.reviews, 0);
	$("#statsGrid").innerHTML = [
		["Cartões", total],
		["Já estudados", seen],
		["Maduros", mature],
		["Revisões", reviews],
	]
		.map(
			([k, v]) =>
				`<div class="stat"><strong>${v}</strong><span>${k}</span></div>`,
		)
		.join("");
	const log = readReviewLog().items;
	const days = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - i);
		const next = d.getTime() + DAY;
		days.push({
			label: d
				.toLocaleDateString("pt-BR", { weekday: "short" })
				.replace(".", ""),
			count: log.filter((x) => x.at >= d.getTime() && x.at < next).length,
		});
	}
	const max = Math.max(1, ...days.map((d) => d.count));
	$("#weekChart").innerHTML = days
		.map(
			(d) =>
				`<div class="daybar"><b>${d.count}</b><div class="bar" style="height:${Math.max(4, (d.count / max) * 120)}px"></div><small>${d.label}</small></div>`,
		)
		.join("");
}
function switchView(name) {
	$$(".tab").forEach((b) =>
		b.classList.toggle("active", b.dataset.view === name),
	);
	$$(".view").forEach((v) => v.classList.remove("active"));
	$("#" + name + "View").classList.add("active");
	if (name === "cards") {
		populateTags();
		renderCards();
	}
	if (name === "stats") renderStats();
}
window.addEventListener("medlex-switch-view", event => {
	if (event.detail?.view) switchView(event.detail.view);
});
window.addEventListener("medlex-open-ai-settings", event => {
	switchView("import");
	requestAnimationFrame(() => document.querySelector(event.detail?.focus || "#aiSettingsHeading")?.focus());
});
async function importCSV(file) {
	if (!storageReady) throw new Error("Repare os dados locais antes de importar cartões.");
	const rows = parseCSV(await file.text());
	let added = 0,
		updated = 0;
	for (const r of rows) {
		if (!r.english) continue;
		const existing = state.cards.find(
			(c) => c.english.toLowerCase() === r.english.trim().toLowerCase(),
		);
		if (existing) {
			Object.assign(
				existing,
				normalizeCard({
					...existing,
					...r,
					id: existing.id,
					due: existing.due,
					interval: existing.interval,
					ease: existing.ease,
					repetitions: existing.repetitions,
					lapses: existing.lapses,
					reviews: existing.reviews,
					createdAt: existing.createdAt,
					lastReviewed: existing.lastReviewed,
				}),
			);
			updated++;
		} else {
			state.cards.push(normalizeCard(r));
			added++;
		}
	}
	save();
	buildQueue();
	populateTags();
	$("#importStatus").textContent =
		`Importação concluída: ${added} novo(s), ${updated} atualizado(s).`;
}
function exportCards() {
	const cols = [
		"id",
		"english",
		"spanish",
		"portuguese",
		"example_en",
		"example_es",
		"example_pt",
		"source",
		"tags",
	];
	const text = [
		cols.join(","),
		...state.cards.map((c) => cols.map((k) => escapeCSV(c[k])).join(",")),
	].join("\n");
	download("medlex-cards.csv", "\uFEFF" + text, "text/csv;charset=utf-8");
}
function exportBackup() {
	download(
		"medlex-backup.json",
		exportStorageBackup(),
		"application/json",
	);
}
async function restoreBackup(file) {
	const text = await file.text();
	let data;
	try {
		data = parseStorageBackup(text);
	} catch (currentError) {
		let legacy;
		try {
			legacy = JSON.parse(text);
		} catch {
			throw currentError;
		}
		if (legacy?.version !== 2 || !Array.isArray(legacy?.state?.cards)
			|| (legacy.reviewLog !== undefined && !Array.isArray(legacy.reviewLog))) throw currentError;
		if (legacy.examProgress) (await import("./js/exam-storage.mjs")).parseExamBackup(JSON.stringify(legacy.examProgress));
		if (legacy.practiceProgress) (await import("./js/practice-storage.mjs")).parsePracticeBackup(JSON.stringify(legacy.practiceProgress));
		data = {
			format: "medlex-storage-backup",
			version: 1,
			entries: {
				[LEGACY_KEYS.cards]: JSON.stringify(legacy.state),
				[LEGACY_KEYS.reviewLog]: JSON.stringify(legacy.reviewLog || []),
				...(legacy.examProgress ? {[LEGACY_KEYS.exams]: JSON.stringify(legacy.examProgress)} : {}),
				...(legacy.practiceProgress ? {[LEGACY_KEYS.practice]: JSON.stringify(legacy.practiceProgress)} : {}),
				[LEGACY_KEYS.theme]: ["light", "dark"].includes(legacy.theme) ? legacy.theme : "light",
			}
		};
	}
	if (!confirm("Restaurar este backup e substituir os dados locais incluídos nele?")) {
		$("#importStatus").textContent = "Restauração cancelada.";
		return;
	}
	restoreStorageBackup(data);
	const failure = await loadInitial();
	if (failure) throw failure;
	storageReady = true;
	applyTheme();
	buildQueue();
	populateTags();
	renderStats();
	renderStorageStatus();
	window.dispatchEvent(new Event("medlex-backup-restored"));
	$("#importStatus").textContent = "Backup restaurado com sucesso.";
}

function applyTheme() {
	document.documentElement.dataset.theme = state.settings.theme === "dark" ? "dark" : "";
}

function renderStorageStatus() {
	const versions = storageVersions();
	$("#storageVersions").textContent = `Aplicativo ${versions.contentVersion} · schema de dados v${versions.schemaVersion}`;
	const issues = getStorageIssues();
	$("#storageHealth").textContent = issues.length
		? `${issues.length} aviso(s): ${issues.map(item => item.message).join("; ")}`
		: "Armazenamento local verificado.";
	$("#recoverStorageBtn").classList.toggle("hidden", !hasMigrationBackup());
}
function initEvents() {
	$$(".tab").forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
	$("#revealBtn").onclick = () => {
		$("#frontSide").classList.add("hidden");
		$("#backSide").classList.remove("hidden");
	};
	$$(".ratings button").forEach(
		(b) => (b.onclick = () => rateCard(b.dataset.rating)),
	);
	$("#studyNewBtn").onclick = () => {
		if (!storageReady) return;
		state.settings.newPerDay += 20;
		save();
		buildQueue();
	};
	$("#searchInput").oninput = renderCards;
	$("#tagFilter").onchange = renderCards;
	$("#cardList").onclick = (e) => {
		const id = e.target.dataset.delete;
		if (!id) return;
		if (confirm("Excluir este cartão?")) {
			if (!storageReady) {
				$("#importStatus").textContent = "Repare os dados locais antes de excluir cartões.";
				return;
			}
			if (defaultCardIds.has(id)) hiddenDefaultIds.add(id);
			state.cards = state.cards.filter((c) => c.id !== id);
			save();
			renderCards();
			buildQueue();
		}
	};
	$("#csvInput").onchange = (e) =>
		e.target.files[0] &&
		importCSV(e.target.files[0]).catch(
			(err) => ($("#importStatus").textContent = "Erro: " + err.message),
		);
	$("#exportCardsBtn").onclick = exportCards;
	$("#exportBackupBtn").onclick = exportBackup;
	$("#backupInput").onchange = (e) =>
		e.target.files[0] &&
		restoreBackup(e.target.files[0]).catch(
			(err) => ($("#importStatus").textContent = "Erro: " + err.message),
		);
	$("#resetBtn").onclick = async () => {
		if (!confirm("Isso apagará somente os dados locais do MedLex neste navegador: progresso, tentativas, histórico, cartões importados e preferências. Continuar?")) return;
		resetMedlexStorage();
		window.dispatchEvent(new Event("medlex-storage-reset"));
		const failure = await loadInitial();
		if (failure) throw failure;
		storageReady = true;
		applyTheme();
		buildQueue();
		populateTags();
		renderStats();
		renderStorageStatus();
		window.dispatchEvent(new Event("medlex-backup-restored"));
		$("#importStatus").textContent = "Dados locais do MedLex restabelecidos.";
	};
	$("#themeBtn").onclick = () => {
		if (!storageReady) return;
		const dark = document.documentElement.dataset.theme === "dark";
		state.settings.theme = dark ? "light" : "dark";
		applyTheme();
		save();
	};
	$("#repairStorageBtn").onclick = async () => {
		try {
			migrateStorage(defaultCards, {repair: true});
			const failure = await loadInitial();
			if (failure) throw failure;
			storageReady = true;
			buildQueue();
			populateTags();
			renderStats();
			renderStorageStatus();
			await Promise.all([import("./js/exam.mjs"), import("./js/practice.mjs")]);
			$("#importStatus").textContent = getStorageIssues().length
				? "Verificação concluída. Dados inválidos foram preservados e ignorados; exporte o backup para recuperação manual."
				: "Verificação e reparo concluídos sem apagar dados válidos.";
		} catch (error) {
			$("#importStatus").textContent = `Não foi possível reparar: ${error.message}`;
		}
	};
	$("#recoverStorageBtn").onclick = async () => {
		if (!confirm("Recuperar a cópia automática anterior à migração? Os dados atuais serão substituídos.")) return;
		try {
			recoverMigrationBackup();
			const failure = await loadInitial();
			if (failure) throw failure;
			storageReady = true;
			applyTheme();
			buildQueue();
			populateTags();
			renderStats();
			renderStorageStatus();
			window.dispatchEvent(new Event("medlex-backup-restored"));
			$("#importStatus").textContent = "Cópia anterior recuperada.";
		} catch (error) {
			$("#importStatus").textContent = `Não foi possível recuperar: ${error.message}`;
		}
	};
}
(async function () {
	try {
		const migrationFailure = await loadInitial();
		storageReady = !migrationFailure;
		applyTheme();
		initEvents();
		buildQueue();
		populateTags();
		renderStats();
		renderStorageStatus();
		if (storageReady) {
			await Promise.all([import("./js/exam.mjs"), import("./js/practice.mjs"), import("./js/ai-settings.mjs")]);
		} else {
			$("#examApp").innerHTML = '<div class="panel exam-error">Simulados pausados até a reparação dos dados locais.</div>';
			$("#practiceApp").innerHTML = '<div class="panel exam-error">Práticas pausadas até a reparação dos dados locais.</div>';
			$("#importStatus").textContent = `Migração interrompida sem apagar dados antigos: ${migrationFailure.message}`;
		}
		if ("serviceWorker" in navigator)
			navigator.serviceWorker.register(`./sw.js?v=${CONTENT_VERSION}`).catch(error => console.warn("Service Worker:", error));
	} catch (error) {
		console.error(error);
		$("#importStatus").textContent = `Não foi possível iniciar completamente: ${error.message}`;
	}
})();
