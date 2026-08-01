const STORAGE_KEY = "medlexCards.v1";
const REVIEW_LOG_KEY = "medlexReviewLog.v1";
const EXAM_PROGRESS_KEY = "medlexExams.v1";
const PRACTICE_PROGRESS_KEY = "medlexPractice.v1";
const DAY = 24 * 60 * 60 * 1000;
let state = { cards: [], settings: { newPerDay: 20 } };
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
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function load() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (saved?.cards?.length) state = saved;
	} catch (e) {}
	state.cards = state.cards.map(normalizeCard);
}
async function loadInitial() {
	load();
	if (state.cards.length) return;
	const res = await fetch("./cards.csv");
	const text = await res.text();
	const rows = parseCSV(text);
	state.cards = rows.filter((r) => r.english).map(normalizeCard);
	save();
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
	const log = JSON.parse(localStorage.getItem(REVIEW_LOG_KEY) || "[]");
	log.push({ at: now(), rating });
	localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(log.slice(-5000)));
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
	const log = JSON.parse(localStorage.getItem(REVIEW_LOG_KEY) || "[]");
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
async function importCSV(file) {
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
	const storedJSON = (key) => {
		try {
			return JSON.parse(localStorage.getItem(key));
		} catch {
			return null;
		}
	};
	download(
		"medlex-backup.json",
		JSON.stringify(
			{
				version: 2,
				state,
				reviewLog: storedJSON(REVIEW_LOG_KEY) || [],
				examProgress: storedJSON(EXAM_PROGRESS_KEY),
				practiceProgress: storedJSON(PRACTICE_PROGRESS_KEY),
				theme: localStorage.getItem("medlexTheme") || "light",
				exportedAt: new Date().toISOString(),
			},
			null,
			2,
		),
		"application/json",
	);
}
async function restoreBackup(file) {
	const data = JSON.parse(await file.text());
	if (!Array.isArray(data?.state?.cards)) throw new Error("Backup inválido");
	if (data.reviewLog !== undefined && !Array.isArray(data.reviewLog)) throw new Error("Histórico de revisões inválido");
	const examModule = data.examProgress
		? await import("./js/exam-storage.mjs")
		: null;
	const practiceModule = data.practiceProgress
		? await import("./js/practice-storage.mjs")
		: null;
	if (examModule) examModule.parseExamBackup(JSON.stringify(data.examProgress));
	if (practiceModule) practiceModule.parsePracticeBackup(JSON.stringify(data.practiceProgress));
	if (!confirm("Restaurar este backup e substituir os dados locais incluídos nele?")) {
		$("#importStatus").textContent = "Restauração cancelada.";
		return;
	}
	state = data.state;
	state.settings ||= { newPerDay: 20 };
	state.cards = state.cards.map(normalizeCard);
	localStorage.setItem(REVIEW_LOG_KEY, JSON.stringify(data.reviewLog || []));
	if (examModule) examModule.importExamBackup(JSON.stringify(data.examProgress));
	if (practiceModule) practiceModule.importPracticeBackup(JSON.stringify(data.practiceProgress));
	if (["light", "dark"].includes(data.theme)) {
		localStorage.setItem("medlexTheme", data.theme);
		document.documentElement.dataset.theme = data.theme === "dark" ? "dark" : "";
	}
	save();
	buildQueue();
	populateTags();
	renderStats();
	window.dispatchEvent(new Event("medlex-backup-restored"));
	$("#importStatus").textContent = "Backup restaurado com sucesso.";
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
		if (!confirm("Isso apagará seu progresso. Continuar?")) return;
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(REVIEW_LOG_KEY);
		state = { cards: [], settings: { newPerDay: 20 } };
		await loadInitial();
		buildQueue();
		populateTags();
		renderStats();
		$("#importStatus").textContent = "Baralho restaurado.";
	};
	$("#themeBtn").onclick = () => {
		const dark = document.documentElement.dataset.theme === "dark";
		document.documentElement.dataset.theme = dark ? "" : "dark";
		localStorage.setItem("medlexTheme", dark ? "light" : "dark");
	};
}
(async function () {
	document.documentElement.dataset.theme =
		localStorage.getItem("medlexTheme") === "dark" ? "dark" : "";
	await loadInitial();
	initEvents();
	buildQueue();
	populateTags();
	renderStats();
	if ("serviceWorker" in navigator)
		navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
