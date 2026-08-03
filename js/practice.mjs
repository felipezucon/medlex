import {loadPracticeIndex, loadPractice} from "./practice-data.mjs";
import {
  createSession,
  getSession,
  saveSession,
  clearSession,
  savePracticeHistory,
  getPracticeHistory,
  practiceHistoryUnitTitles,
  exportPracticeBackup,
  parsePracticeBackup,
  importPracticeBackup
} from "./practice-storage.mjs";
import {applyPracticeAIResults, buildPracticeAIItems, gradePractice} from "./practice-grading.mjs";
import {aiGradingAvailability, GEMINI_MODEL, gradeItemsWithAI} from "./ai-grading.mjs";

const root = document.querySelector("#practiceApp");
let catalog = [];
let pendingFinalization = null;

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.id) node.id = options.id;
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = options.value;
  if (options.checked !== undefined) node.checked = options.checked;
  if (options.disabled !== undefined) node.disabled = options.disabled;
  if (options.htmlFor) node.htmlFor = options.htmlFor;
  if (options.accept) node.accept = options.accept;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  if (options.on) for (const [event, handler] of Object.entries(options.on)) node.addEventListener(event, handler);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

const button = (text, onClick, className = "", disabled = false) =>
  el("button", {type: "button", className, text, disabled, on: {click: onClick}});

function replace(...nodes) {
  root.replaceChildren(...nodes);
  window.scrollTo({top: 0, behavior: "smooth"});
}

function statusMessage(text = "", kind = "", id = "") {
  return el("p", {id, className: `exam-status ${kind}`.trim(), text, attrs: {"aria-live": "polite"}});
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

function durationOf(session) {
  return session.durationMs ?? Math.max(0, Date.now() - session.startedAt);
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], {type: "application/json"}));
  const link = el("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBackupControls(message = "", kind = "") {
  const input = el("input", {id: "practiceBackupInput", type: "file", accept: ".json,application/json"});
  const status = statusMessage(message, kind);
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      parsePracticeBackup(text);
      if (!confirm("Importar este backup e substituir os dados locais das práticas?")) {
        input.value = "";
        return;
      }
      importPracticeBackup(text);
      renderSelection("Backup das práticas restaurado com sucesso.", "success");
    } catch (error) {
      status.textContent = `Erro: ${error.message}`;
      status.className = "exam-status error";
      input.value = "";
    }
  });
  return el("section", {className: "panel exam-tools", attrs: {"aria-labelledby": "practiceToolsTitle"}}, [
    el("div", {className: "section-heading"}, [
      el("div", {}, [
        el("h3", {id: "practiceToolsTitle", text: "Backup das práticas"}),
        el("p", {text: "Este progresso também é incluído no backup completo da área Configuração."})
      ]),
      el("div", {className: "exam-actions"}, [
        button("Exportar JSON", () => download("medlex-praticas.json", exportPracticeBackup())),
        el("label", {className: "file-label secondary", htmlFor: "practiceBackupInput", text: "Importar backup"}, input)
      ])
    ]),
    status
  ]);
}

function renderHistory(practice = null) {
  const history = getPracticeHistory(practice?.id || null);
  const section = el("section", {className: "panel exam-history", attrs: {"aria-labelledby": "practiceHistoryTitle"}}, [
    el("h3", {id: "practiceHistoryTitle", text: "Histórico local"})
  ]);
  if (!history.length) {
    section.append(el("p", {className: "muted", text: "Nenhuma prática finalizada ainda."}));
    return section;
  }
  const list = el("div", {className: "history-list"});
  for (const item of history) {
    const method = {ai: "IA", manual: "Manual", manual_fallback: "Fallback manual", local: "Local"}[item.gradingMethod] || "Manual";
    const currentPractice = catalog.find(entry => entry.practice?.id === item.practiceId)?.practice;
    const units = currentPractice ? practiceHistoryUnitTitles(item, currentPractice.units) : item.units;
    list.append(el("article", {className: "history-row"}, [
      el("div", {}, [el("strong", {text: item.practiceTitle}), el("span", {text: `${units.join(" · ")} · ${new Date(item.date).toLocaleString("pt-BR")}`})]),
      el("div", {className: "history-result"}, [el("strong", {text: `${item.percent}%`}), el("span", {text: `${item.pendingReview} para revisar · ${method} · ${formatDuration(item.durationMs)}`})])
    ]));
  }
  section.append(list);
  return section;
}

function renderSelection(message = "", kind = "") {
  const panel = el("section", {className: "panel practice-selection", attrs: {"aria-labelledby": "practiceSelectionTitle"}}, [
    el("h2", {id: "practiceSelectionTitle", text: "Práctica de formas en -ing"}),
    el("p", {className: "muted", text: "Pratique todas as atividades ou escolha apenas uma unidade."})
  ]);

  for (const item of catalog) {
    const practice = item.practice;
    if (!practice) {
      panel.append(el("article", {className: "exam-choice"}, [
        el("div", {}, [el("div", {className: "availability unavailable", text: "Indisponível"}), el("h3", {text: item.entry.id}), el("p", {text: item.error?.message || "Dados indisponíveis."})])
      ]));
      continue;
    }
    const session = getSession(practice.id);
    const history = getPracticeHistory(practice.id);
    const best = history.length ? Math.max(...history.map(record => record.percent)) : null;
    const selectId = `${practice.id}-unit`;
    const select = el("select", {id: selectId});
    select.append(el("option", {value: "all", text: "Todas as unidades"}));
    for (const unit of practice.units) select.append(el("option", {value: unit.id, text: unit.title}));
    const start = () => {
      if (session && !confirm("Iniciar outra sessão? A sessão atual será substituída e o histórico será mantido.")) return;
      const unitIds = select.value === "all" ? practice.units.map(unit => unit.id) : [select.value];
      const next = createSession(practice.id, unitIds);
      saveSession(next);
      renderSession(practice, next);
    };
    panel.append(el("article", {className: "practice-choice"}, [
      el("div", {className: "availability available", text: "Disponível"}),
      el("h3", {text: practice.title}),
      el("p", {text: practice.description}),
      best === null ? null : el("span", {className: "exam-summary", text: `Melhor desempenho: ${best}%`}),
      el("div", {className: "practice-start"}, [
        el("label", {htmlFor: selectId}, [el("span", {text: "Conteúdo da sessão"}), select]),
        button(session ? "Nova sessão" : "Iniciar prática", start, session ? "danger-outline" : "primary"),
        session ? button(session.status === "review" ? "Revisar sessão"
          : session.status === "finalizing" ? "Concluir correção" : "Continuar", () => renderSession(practice, session), "primary") : null
      ])
    ]));
  }
  replace(panel, renderHistory(), renderBackupControls(message, kind));
}

function renderScore(grade) {
  return el("section", {className: "practice-result", attrs: {"aria-live": "polite", "aria-label": "Desempenho da prática"}}, [
    el("div", {}, [el("span", {text: "Desempenho geral"}), el("strong", {text: `${grade.percent}%`})]),
    el("dl", {}, [
      el("div", {}, [el("dt", {text: "Concluídos"}), el("dd", {text: `${grade.completed}/${grade.totalItems}`})]),
      el("div", {}, [el("dt", {text: "Associações"}), el("dd", {text: `${grade.autoCorrect}/${grade.autoTotal}`})]),
      el("div", {}, [el("dt", {text: "Satisfatórios"}), el("dd", {text: `${grade.satisfactory}/${grade.subjectiveItems}`})]),
      el("div", {}, [el("dt", {text: "Revisar"}), el("dd", {text: String(grade.pendingReview.length)})])
    ])
  ]);
}

function appendManualRubric(container, item, session, onAssessment) {
  const selected = session.assessment[item.id] || {};
  session.assessment[item.id] = selected;
  const rubric = el("fieldset", {className: "self-rubric"}, [el("legend", {text: "Autoavaliação desta resposta"})]);
  for (const criterion of item.rubric) {
    const id = `${item.id}-${criterion.id}`;
    const select = el("select", {id});
    select.append(
      el("option", {value: "not_met", text: "Não atendido"}),
      el("option", {value: "partial", text: "Parcial (50 %)"}),
      el("option", {value: "met", text: "Atendido"})
    );
    select.value = selected[criterion.id] === true ? "met" : selected[criterion.id] || "not_met";
    select.addEventListener("change", () => {
      selected[criterion.id] = select.value;
      onAssessment(container, item.id);
    });
    rubric.append(el("label", {className: "rubric-item", htmlFor: id}, [el("span", {text: criterion.label}), select, el("b", {text: `${criterion.points} pt`})]));
  }
  container.append(rubric);
}

function renderPracticeAIItemReview(item, session) {
  const suggestion = session.aiGrading?.[item.id];
  if (!suggestion?.accepted) return null;
  const maximum = Number(item.maxPoints) || item.rubric.reduce((sum, criterion) => sum + Number(criterion.points), 0);
  const fullScore = Number(suggestion.finalPoints) >= maximum;
  const panel = el("section", {className: `ai-item-review ${suggestion.confidence === "low" || suggestion.status !== "graded" ? "needs-manual-review" : ""}`.trim()}, [
    el("div", {className: "ai-item-heading"}, [
      el("h3", {text: "Correção do Gemini"}),
      el("span", {className: "availability available", text: `${suggestion.finalPoints}/${maximum} pontos`})
    ]),
    el("p", {className: "ai-assistive-warning", text: "Correção automática definitiva."}),
    el("p", {text: suggestion.overallFeedback})
  ]);
  for (const criterion of suggestion.criteria) {
    const source = item.rubric.find(entry => entry.id === criterion.criterionId);
    const statusLabel = {met: "Atendido", partial: "Parcial", not_met: "Não atendido"}[criterion.status] || criterion.status;
    panel.append(el("div", {className: "ai-criterion ai-criterion-readonly"}, [
      el("span", {}, [el("strong", {text: `${source.label} (${source.points} pt)`}), el("small", {text: criterion.feedback})]),
      el("b", {text: statusLabel})
    ]));
  }
  const coaching = suggestion.coachingFeedback;
  if (coaching) panel.append(el("div", {className: "ai-coaching"}, [
    el("section", {}, [el("h4", {text: fullScore ? "O que você acertou" : "Por que errou"}), el("p", {text: coaching.explanation})]),
    el("section", {}, [el("h4", {text: "Como melhorar"}), el("p", {text: coaching.improvementTip})]),
    el("section", {}, [el("h4", {text: "Dica para lembrar"}), el("p", {text: coaching.memoryTip})])
  ]));
  return panel;
}

function appendAssessment(container, item, session, onAssessment, answerProvided) {
  const aiReview = renderPracticeAIItemReview(item, session);
  if (aiReview) {
    container.append(aiReview);
    return;
  }
  if (!answerProvided) {
    container.append(el("p", {className: "muted ai-item-empty", text: "Resposta em branco: 0 ponto."}));
    return;
  }
  appendManualRubric(container, item, session, onAssessment);
}

function renderPracticeGradingPanel(session, grading = false) {
  const method = session.gradingMethod;
  const pending = session.status === "finalizing";
  const title = grading ? "Corrigindo prática com IA…"
    : pending ? "Correção pendente"
    : method === "ai" ? "Correção automática concluída"
      : method === "local" ? "Correção local concluída" : "Correção manual";
  const description = grading ? "As respostas estão bloqueadas enquanto o Gemini aplica as rubricas."
    : pending ? "As respostas estão salvas e bloqueadas. Continue a correção para obter o resultado."
    : method === "ai" ? "A nota foi aplicada pela IA e não pode ser ajustada. As associações de letras foram corrigidas localmente."
      : method === "local" ? "Não havia respostas escritas para enviar à IA; respostas em branco receberam zero."
        : session.gradingMessage || "Use as rubricas para concluir a autoavaliação das respostas escritas.";
  return el("section", {className: "panel ai-grading-panel", attrs: {"aria-labelledby": "aiPracticeHeading"}}, [
    el("h2", {id: "aiPracticeHeading", text: title}),
    el("p", {text: description}),
    grading ? statusMessage("Corrigindo 0 respostas…", "", "practiceGradingStatus") : null
  ]);
}

function completeSession(practice, session, method, message = "") {
  pendingFinalization = null;
  session.status = "review";
  session.gradingMethod = method;
  session.gradingModel = method === "ai" ? GEMINI_MODEL : null;
  session.gradingMessage = message;
  const grade = gradePractice(practice, session);
  saveSession(session);
  savePracticeHistory(historyRecord(practice, session, grade));
  renderSession(practice, session);
}

function completeManually(practice, session, fallback = false, message = "") {
  session.aiGrading = {};
  completeSession(practice, session, fallback ? "manual_fallback" : "manual", message);
}

async function continueFinalization(practice, session) {
  const availability = aiGradingAvailability();
  if (availability.code === "unconfigured") {
    completeManually(practice, session, false, "A chave do Gemini não está configurada. Use as rubricas para concluir a correção manual.");
    return;
  }
  if (["locked", "consent"].includes(availability.code)) {
    pendingFinalization = {practice, session};
    window.dispatchEvent(new CustomEvent("medlex-open-ai-settings", {detail: {
      message: "As respostas foram salvas. Desbloqueie a chave e confirme o consentimento para concluir a correção.",
      focus: availability.code === "locked" ? "#aiUnlockPassword" : "#aiConsent"
    }}));
    return;
  }
  if (!availability.available) {
    console.warn("Correção automática da prática indisponível:", availability.reason);
    completeManually(practice, session, true, `${availability.reason} Use as rubricas para concluir a correção manual.`);
    return;
  }

  const items = buildPracticeAIItems(practice, session);
  const answered = items.filter(item => String(item.studentAnswer).trim()).length;
  if (!answered) {
    session.aiGrading = {};
    completeSession(practice, session, "local");
    return;
  }

  renderSession(practice, session, true);
  const status = root.querySelector("#practiceGradingStatus");
  try {
    const results = await gradeItemsWithAI({
      parentId: practice.id,
      contentVersion: practice.contentVersion || practice.schemaVersion,
      items,
      feedbackProfile: "learning-coach",
      feedbackLanguage: "pt-BR",
      onProgress: (done, total) => {
        if (status) status.textContent = `Corrigindo ${done} de ${total} respostas…`;
      }
    });
    applyPracticeAIResults(practice, session, results);
    completeSession(practice, session, "ai");
  } catch (error) {
    console.warn("Falha na correção automática da prática; usando correção manual:", error);
    completeManually(practice, session, true, `${error.message} Use as rubricas para concluir a correção manual.`);
  }
}

function renderTranslationBlock(block, session, review, locked, onAnswer, onAssessment, pending) {
  const section = el("section", {className: "practice-block"}, [el("p", {className: "section-instructions", text: block.instructions})]);
  for (const item of block.items) {
    const answerId = `${item.id}-answer`;
    const answer = session.answers[item.id] || "";
    const textarea = el("textarea", {id: answerId, value: answer, disabled: locked, attrs: {rows: "3"}});
    const sentence = el("p", {className: "source-sentence"});
    for (const segment of item.segments) sentence.append(segment.target ? el("mark", {text: segment.text}) : document.createTextNode(segment.text));
    const article = el("article", {className: `exam-question open-question ${review && pending.includes(item.id) ? "needs-review" : ""}`.trim()}, [
      sentence,
      el("label", {htmlFor: answerId}, [el("strong", {text: "Traducción en español"}), textarea])
    ]);
    textarea.addEventListener("input", () => { session.answers[item.id] = textarea.value; onAnswer(); });
    if (review) {
      article.classList.add("review-answer-layout");
      article.append(el("div", {className: "suggested-answer"}, [el("h3", {text: "Respuesta esperada"}), el("p", {text: item.expectedAnswer})]));
      appendAssessment(article, item, session, onAssessment, Boolean(String(answer).trim()));
    }
    section.append(article);
  }
  return section;
}

function renderMatchingBlock(block, session, review, locked, onAnswer, onAssessment, pending) {
  const section = el("section", {className: "practice-block"}, [el("p", {className: "section-instructions", text: block.instructions})]);
  const options = el("ol", {className: "matching-options"});
  for (const option of block.options) options.append(el("li", {}, [el("b", {text: `${option.id}. `}), option.text]));
  section.append(options);
  for (const item of block.questions) {
    const answer = session.answers[item.id] || {choice: "", translation: ""};
    session.answers[item.id] = answer;
    const selectId = `${item.id}-choice`;
    const translationId = `${item.id}-translation`;
    const select = el("select", {id: selectId, value: answer.choice, disabled: locked});
    select.append(el("option", {value: "", text: "Selecione"}));
    for (const option of block.options) select.append(el("option", {value: option.id, text: option.id}));
    select.value = answer.choice;
    const textarea = el("textarea", {id: translationId, value: answer.translation, disabled: locked, attrs: {rows: "3"}});
    const article = el("article", {className: `exam-question ${review && pending.includes(item.id) ? "needs-review" : ""}`.trim()}, [
      el("h3", {text: item.question}),
      el("div", {className: "matching-answer"}, [
        el("label", {htmlFor: selectId}, [el("span", {text: "Letra"}), select]),
        el("label", {htmlFor: translationId}, [el("span", {text: "Su traducción"}), textarea])
      ])
    ]);
    select.addEventListener("change", () => { answer.choice = select.value; onAnswer(); });
    textarea.addEventListener("input", () => { answer.translation = textarea.value; onAnswer(); });
    if (review) {
      const option = block.options.find(entry => entry.id === item.correctOption);
      const correct = answer.choice === item.correctOption;
      article.append(
        el("p", {className: "answer-feedback", text: correct ? `Asociación correcta: ${item.correctOption}` : `Asociación correcta: ${item.correctOption} (su respuesta: ${answer.choice || "sin respuesta"})`}),
        el("div", {className: "suggested-answer"}, [el("h3", {text: "Traducción sugerida"}), el("p", {text: option.expectedTranslation})])
      );
      if (!correct) article.classList.add("incorrect");
      const aiReview = renderPracticeAIItemReview(item, session);
      if (aiReview) article.append(aiReview);
      else if (String(answer.translation).trim()) {
        const assessment = session.assessment[item.id] || {};
        session.assessment[item.id] = assessment;
        const checkId = `${item.id}-translation-ok`;
        const checkbox = el("input", {id: checkId, type: "checkbox", checked: Boolean(assessment.translation)});
        checkbox.addEventListener("change", () => { assessment.translation = checkbox.checked; onAssessment(article, item.id); });
        article.append(el("label", {className: "check-option practice-self-check", htmlFor: checkId}, [checkbox, el("span", {text: item.rubric[0].label})]));
      } else article.append(el("p", {className: "muted ai-item-empty", text: "Tradução em branco: 0 ponto."}));
    }
    section.append(article);
  }
  return section;
}

function renderOpenBlock(block, session, review, locked, onAnswer, onAssessment, pending) {
  const section = el("section", {className: "practice-block"}, [el("p", {className: "section-instructions", text: block.instructions})]);
  for (const item of block.items) {
    const answerId = `${item.id}-answer`;
    const answer = session.answers[item.id] || "";
    const textarea = el("textarea", {id: answerId, value: answer, disabled: locked, attrs: {rows: "3"}});
    const article = el("article", {className: `exam-question open-question ${review && pending.includes(item.id) ? "needs-review" : ""}`.trim()}, [
      el("p", {className: "source-sentence", text: item.text}),
      el("label", {htmlFor: answerId}, [el("strong", {text: item.question}), textarea])
    ]);
    textarea.addEventListener("input", () => { session.answers[item.id] = textarea.value; onAnswer(); });
    if (review) {
      article.classList.add("review-answer-layout");
      article.append(el("div", {className: "suggested-answer"}, [el("h3", {text: "Respuesta esperada"}), el("p", {text: item.expectedAnswer})]));
      appendAssessment(article, item, session, onAssessment, Boolean(String(answer).trim()));
    }
    section.append(article);
  }
  return section;
}

function historyRecord(practice, session, grade) {
  return {
    sessionId: session.id,
    practiceId: practice.id,
    practiceTitle: practice.title,
    unitIds: [...session.unitIds],
    units: practice.units.filter(unit => session.unitIds.includes(unit.id)).map(unit => unit.title),
    date: new Date(session.finalizedAt).toISOString(),
    durationMs: session.durationMs,
    percent: grade.percent,
    pendingReview: grade.pendingReview.length,
    gradingMethod: session.gradingMethod || "manual",
    gradingModel: session.gradingModel || null,
    grading: Object.fromEntries(Object.entries(session.aiGrading || {}).map(([itemId, result]) => [itemId, {
      gradingMethod: result.gradingMethod,
      aiSuggestedPoints: result.aiSuggestedPoints,
      finalPoints: result.finalPoints,
      manuallyAdjusted: Boolean(result.manuallyAdjusted),
      accepted: Boolean(result.accepted)
    }]))
  };
}

function renderSession(practice, session, grading = false) {
  const review = session.status === "review";
  const finalizing = session.status === "finalizing";
  const locked = review || finalizing;
  let grade = gradePractice(practice, session);
  const status = statusMessage("Respostas salvas automaticamente.");
  const progressText = el("span", {text: `${grade.completed} de ${grade.totalItems} respondidos`});
  const progress = el("progress", {attrs: {max: String(grade.totalItems), value: String(grade.completed), "aria-label": "Progresso da prática"}});
  const header = el("header", {className: "exam-run-header"}, [
    el("div", {}, [el("h1", {text: practice.title}), el("p", {text: practice.units.filter(unit => session.unitIds.includes(unit.id)).map(unit => unit.title).join(" · ")})]),
    el("div", {className: "exam-run-meta"}, [el("label", {}, [progressText, progress])])
  ]);
  const scoreSlot = el("div");

  const persist = () => {
    try {
      saveSession(session);
      status.textContent = "Respostas salvas neste navegador.";
      return true;
    } catch {
      status.textContent = "Não foi possível salvar. Exporte um backup antes de sair.";
      status.className = "exam-status error";
      return false;
    }
  };
  const updateProgress = () => {
    grade = gradePractice(practice, session);
    progress.value = grade.completed;
    progressText.textContent = `${grade.completed} de ${grade.totalItems} respondidos`;
  };
  const updateScore = () => {
    grade = gradePractice(practice, session);
    persist();
    savePracticeHistory(historyRecord(practice, session, grade));
    scoreSlot.replaceChildren(renderScore(grade));
  };
  const onAnswer = () => { persist(); updateProgress(); };
  const onAssessment = (container, itemId) => {
    updateScore();
    container.classList.toggle("needs-review", grade.pendingReview.includes(itemId));
  };

  if (review) scoreSlot.append(renderScore(grade));
  const content = el("main", {className: "exam-questions"});
  for (const unit of practice.units.filter(item => session.unitIds.includes(item.id))) {
    const section = el("section", {className: "exam-section practice-unit"}, [
      el("h2", {text: unit.title}),
      unit.source ? el("p", {className: "muted practice-source", text: unit.source}) : null
    ]);
    for (const block of unit.blocks) {
      if (block.type === "translation") section.append(renderTranslationBlock(block, session, review, locked, onAnswer, onAssessment, grade.pendingReview));
      if (block.type === "matching") section.append(renderMatchingBlock(block, session, review, locked, onAnswer, onAssessment, grade.pendingReview));
      if (block.type === "open") section.append(renderOpenBlock(block, session, review, locked, onAnswer, onAssessment, grade.pendingReview));
    }
    content.append(section);
  }

  const actions = el("div", {className: "exam-footer-actions"});
  if (review) {
    actions.append(
      button("Voltar às práticas", () => renderSelection()),
      button("Revisar respostas", () => root.querySelector(".needs-review")?.scrollIntoView({behavior: "smooth", block: "center"})),
      button("Iniciar nova sessão", () => {
        if (!confirm("Iniciar uma nova sessão? As respostas atuais serão removidas, mas o histórico será mantido.")) return;
        clearSession(practice.id);
        renderSelection();
      }, "primary")
    );
  } else if (finalizing) {
    actions.append(
      button("Voltar às práticas", () => renderSelection()),
      button("Continuar correção", () => continueFinalization(practice, session), "primary", grading)
    );
  } else {
    actions.append(
      button("Abandonar por agora", () => { persist(); renderSelection("Sessão salva. Você pode continuar depois.", "success"); }),
      button("Reiniciar prática", () => {
        if (!confirm("Reiniciar esta prática? As respostas atuais serão apagadas.")) return;
        clearSession(practice.id);
        renderSelection();
      }, "danger-outline"),
      button("Finalizar prática", async () => {
        if (!persist()) return;
        if (!confirm("Finalizar a prática? As respostas originais ficarão bloqueadas para edição.")) return;
        session.status = "finalizing";
        session.finalizedAt = Date.now();
        session.durationMs = durationOf(session);
        session.aiGrading = {};
        if (!persist()) {
          session.status = "in-progress";
          return;
        }
        await continueFinalization(practice, session);
      }, "primary")
    );
  }
  replace(header, scoreSlot, ...(locked ? [renderPracticeGradingPanel(session, grading)] : []), content, status, actions);
}

async function init() {
  try {
    const entries = await loadPracticeIndex();
    catalog = await Promise.all(entries.map(async entry => {
      if (entry.available === false) return {entry};
      try {
        return {entry, practice: await loadPractice(entry)};
      } catch (error) {
        console.error(`Falha ao carregar ${entry.id}:`, error);
        return {entry, error};
      }
    }));
    renderSelection();
  } catch (error) {
    console.error("Falha ao abrir as práticas:", error);
    replace(el("section", {className: "panel exam-error"}, [
      el("h2", {text: "Não foi possível abrir as práticas"}),
      el("p", {text: error.message}),
      button("Tentar novamente", init, "primary")
    ]));
  }
}

window.addEventListener("medlex-backup-restored", init);
window.addEventListener("medlex-ai-state-changed", () => {
  if (pendingFinalization && aiGradingAvailability().available) {
    const pending = pendingFinalization;
    pendingFinalization = null;
    window.dispatchEvent(new CustomEvent("medlex-switch-view", {detail: {view: "practice"}}));
    continueFinalization(pending.practice, pending.session);
    return;
  }
  const active = catalog.map(item => item.practice).find(practice => practice && getSession(practice.id)?.status === "review");
  if (active && root.closest(".view")?.classList.contains("active")) renderSession(active, getSession(active.id));
});
init();
