import {loadExamIndex, loadExam} from "./exam-data.mjs";
import {
  createAttempt,
  getAttempt,
  saveAttempt,
  clearAttempt,
  saveHistory,
  getHistory,
  getAllHistory,
  exportExamBackup,
  parseExamBackup,
  importExamBackup
} from "./exam-storage.mjs";
import {gradeExam, examMaximums, examItemCount} from "./exam-grading.mjs";
import {
  aiGradingAvailability,
  calculateItemPoints,
  gradeItemsWithAI,
  validateGradableItem
} from "./ai-grading.mjs";

const root = document.querySelector("#examApp");
let catalog = [];
let timerId;

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.id) node.id = options.id;
  if (options.type) node.type = options.type;
  if (options.name) node.name = options.name;
  if (options.value !== undefined) node.value = options.value;
  if (options.checked !== undefined) node.checked = options.checked;
  if (options.disabled !== undefined) node.disabled = options.disabled;
  if (options.min !== undefined) node.min = options.min;
  if (options.max !== undefined) node.max = options.max;
  if (options.accept) node.accept = options.accept;
  if (options.htmlFor) node.htmlFor = options.htmlFor;
  if (options.open !== undefined) node.open = options.open;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  if (options.on) for (const [event, handler] of Object.entries(options.on)) node.addEventListener(event, handler);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

function button(text, onClick, className = "", disabled = false) {
  return el("button", {type: "button", className, text, disabled, on: {click: onClick}});
}

function replace(...nodes) {
  clearInterval(timerId);
  root.replaceChildren(...nodes);
  window.scrollTo({top: 0, behavior: "smooth"});
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], {type: "application/json"}));
  const link = el("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, "0")).join(":");
}

function durationOf(attempt) {
  return attempt.durationMs ?? Math.max(0, Date.now() - attempt.startedAt);
}

function statusMessage(text, kind = "") {
  return el("p", {className: `exam-status ${kind}`.trim(), text, attrs: {"aria-live": "polite"}});
}

function renderBackupControls(statusText = "", statusKind = "") {
  const input = el("input", {id: "examBackupInput", type: "file", accept: ".json,application/json"});
  const status = statusMessage(statusText, statusKind);
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      parseExamBackup(text);
      if (!confirm("Importar este backup e substituir os dados locais dos simulados?")) {
        input.value = "";
        return;
      }
      importExamBackup(text);
      renderSelection("Backup de simulados restaurado com sucesso.", "success");
    } catch (error) {
      status.textContent = `Erro: ${error.message}`;
      status.className = "exam-status error";
      input.value = "";
    }
  });

  return el("section", {className: "panel exam-tools", attrs: {"aria-labelledby": "examToolsTitle"}}, [
    el("div", {className: "section-heading"}, [
      el("div", {}, [
        el("h3", {id: "examToolsTitle", text: "Backup dos simulados"}),
        el("p", {text: "Exporte o progresso antes de trocar de navegador ou dispositivo."})
      ]),
      el("div", {className: "exam-actions"}, [
        button("Exportar JSON", () => download("medlex-simulados.json", exportExamBackup())),
        el("label", {className: "file-label secondary", htmlFor: "examBackupInput", text: "Importar backup"}, input)
      ])
    ]),
    status
  ]);
}

function renderHistory(exam = null) {
  const history = exam ? getHistory(exam.id) : getAllHistory();
  const section = el("section", {className: "panel exam-history", attrs: {"aria-labelledby": "examHistoryTitle"}}, [
    el("h3", {id: "examHistoryTitle", text: "Histórico local"})
  ]);
  if (!history.length) {
    section.append(el("p", {className: "muted", text: "Nenhuma tentativa finalizada ainda."}));
    return section;
  }
  const list = el("div", {className: "history-list"});
  for (const item of history) {
    list.append(el("article", {className: "history-row"}, [
      el("div", {}, [
        el("strong", {text: item.examTitle}),
        el("span", {text: new Date(item.date).toLocaleString("pt-BR")})
      ]),
      el("div", {className: "history-result"}, [
        el("strong", {text: `${item.score}/${item.totalPoints || exam?.totalPoints || catalog.find(entry => entry.exam?.id === item.examId)?.exam.totalPoints || 36}`}),
        el("span", {text: `${item.passed ? "Aprobado" : "No aprobado"} · ${formatDuration(item.durationMs)}`})
      ])
    ]));
  }
  section.append(list);
  return section;
}

function renderSelection(message = "", kind = "") {
  const panel = el("section", {className: "panel exam-selection", attrs: {"aria-labelledby": "examSelectionTitle"}}, [
    el("div", {className: "section-heading"}, [
      el("div", {}, [
        el("h2", {id: "examSelectionTitle", text: "Simulado"}),
        el("p", {text: "Escolha uma prova e continue do ponto em que parou."})
      ])
    ])
  ]);
  const list = el("div", {className: "exam-list"});

  for (const item of catalog) {
    const exam = item.exam;
    const attempt = exam ? getAttempt(exam.id) : null;
    const history = exam ? getHistory(exam.id) : [];
    const last = history[0];
    const best = history.length ? Math.max(...history.map(record => record.score)) : null;
    const available = item.entry.available !== false && exam;
    const actionText = attempt?.status === "review" ? "Revisar tentativa"
      : attempt ? "Continuar" : "Começar";
    list.append(el("article", {className: "exam-choice"}, [
      el("div", {}, [
        el("div", {className: `availability ${available ? "available" : "unavailable"}`, text: available ? "Disponível" : "Indisponível"}),
        el("h3", {text: exam?.title || item.entry.id}),
        el("p", {text: exam?.theme || item.error?.message || "Dados indisponíveis."}),
        exam ? el("span", {className: "exam-summary", text: `${exam.totalPoints} pontos · aprovação: ${exam.passingScore}`}) : null,
        last ? el("span", {className: "exam-summary", text: `Última: ${last.passed ? "Aprobado" : "No aprobado"} (${last.score}/${exam.totalPoints}) · melhor: ${best}/${exam.totalPoints}`}) : null
      ]),
      button(actionText, () => attempt ? renderAttempt(exam, attempt) : renderIntro(exam), "primary", !available)
    ]));
  }
  panel.append(list);
  const nodes = [panel];
  if (catalog.some(item => item.exam)) nodes.push(renderHistory());
  nodes.push(renderBackupControls(message, kind));
  replace(...nodes);
}

function renderIntro(exam) {
  const timer = el("input", {id: "examTimer", type: "checkbox", checked: true});
  const panel = el("section", {className: "panel exam-intro", attrs: {"aria-labelledby": "examIntroTitle"}}, [
    button("← Voltar às provas", () => renderSelection(), "text-button"),
    el("div", {className: "availability available", text: "Disponível"}),
    el("h2", {id: "examIntroTitle", text: exam.title}),
    el("p", {className: "exam-theme", text: exam.theme}),
    exam.description ? el("p", {className: "muted", text: exam.description}) : null,
    el("dl", {className: "exam-facts"}, [
      el("div", {}, [el("dt", {text: "Pontuação total"}), el("dd", {text: `${exam.totalPoints} pontos`})]),
      el("div", {}, [el("dt", {text: "Aprovação"}), el("dd", {text: `${exam.passingScore} pontos`})]),
      el("div", {}, [el("dt", {text: "Questões"}), el("dd", {text: `${examItemCount(exam)} itens`})])
    ]),
    el("label", {className: "timer-option", htmlFor: "examTimer"}, [
      timer,
      el("span", {}, [
        el("strong", {text: "Exibir cronômetro"}),
        el("small", {text: "A duração será registrada no histórico mesmo com a exibição desativada."})
      ])
    ]),
    button("Iniciar simulado", () => {
      const attempt = createAttempt(exam.id, timer.checked, exam.contentVersion || exam.schemaVersion);
      saveAttempt(attempt);
      renderAttempt(exam, attempt);
    }, "primary start-exam")
  ]);
  replace(panel, renderHistory(exam), renderBackupControls());
}

function completedAnswers(exam, attempt) {
  const a = exam.sections.a.items.filter(item => attempt.answers.a[item.id]?.touched).length;
  const b = exam.sections.b.items.filter(item => String(attempt.answers.b[item.id] || "").trim()).length;
  const c = String(attempt.answers.c || "").trim() ? 1 : 0;
  return a + b + c;
}

function persist(attempt, announce) {
  try {
    saveAttempt(attempt);
    if (announce) announce.textContent = "Respostas salvas neste navegador.";
  } catch {
    if (announce) announce.textContent = "Não foi possível salvar. Exporte um backup antes de sair.";
  }
}

function historyRecord(exam, attempt, grade) {
  return {
    attemptId: attempt.id,
    examId: exam.id,
    examTitle: exam.title,
    date: new Date(attempt.finalizedAt).toISOString(),
    durationMs: attempt.durationMs,
    score: grade.total,
    totalPoints: exam.totalPoints,
    passed: grade.passed,
    grading: Object.fromEntries(Object.entries(attempt.aiGrading || {}).map(([itemId, result]) => [itemId, {
      gradingMethod: result.gradingMethod,
      aiSuggestedPoints: result.aiSuggestedPoints,
      finalPoints: result.finalPoints,
      manuallyAdjusted: Boolean(result.manuallyAdjusted),
      accepted: Boolean(result.accepted)
    }]))
  };
}

function renderScore(exam, grade) {
  const maximums = examMaximums(exam);
  return el("section", {className: `exam-result ${grade.passed ? "passed" : "failed"}`, attrs: {"aria-live": "polite", "aria-label": "Resultado do simulado"}}, [
    el("div", {}, [
      el("span", {text: grade.passed ? "Aprobado" : "No aprobado"}),
      el("strong", {text: `${grade.total}/${exam.totalPoints}`})
    ]),
    el("dl", {}, [
      el("div", {}, [el("dt", {text: "Seção A"}), el("dd", {text: `${grade.sections.a}/${maximums.a}`})]),
      el("div", {}, [el("dt", {text: "Seção B"}), el("dd", {text: `${grade.sections.b}/${maximums.b}`})]),
      el("div", {}, [el("dt", {text: "Seção C"}), el("dd", {text: `${grade.sections.c}/${maximums.c}`})])
    ])
  ]);
}

function renderArticle(exam) {
  const details = el("details", {className: "exam-text", open: true}, [
    el("summary", {text: "Texto de referência"}),
    el("article", {}, [el("h2", {text: exam.article.title})])
  ]);
  const article = details.querySelector("article");
  for (const paragraph of exam.article.paragraphs) {
    article.append(el("p", {}, [el("b", {text: `(${paragraph.number}) `}), paragraph.text]));
  }
  return details;
}

function renderSectionA(exam, attempt, review, grade, onSave) {
  const section = el("section", {className: "exam-section", attrs: {"aria-labelledby": "sectionATitle"}}, [
    el("h2", {id: "sectionATitle", text: exam.sections.a.title}),
    el("p", {className: "section-instructions", text: exam.sections.a.instructions})
  ]);
  for (const [index, item] of exam.sections.a.items.entries()) {
    const answer = attempt.answers.a[item.id] || {developed: false, paragraph: "", touched: false};
    attempt.answers.a[item.id] = answer;
    const developedId = `${item.id}-developed`;
    const paragraphId = `${item.id}-paragraph`;
    const developed = el("input", {id: developedId, type: "checkbox", checked: answer.developed, disabled: review});
    const paragraph = el("input", {
      id: paragraphId,
      type: "text",
      value: answer.paragraph,
      disabled: review || !answer.developed,
      attrs: {inputmode: "numeric", placeholder: "Ej.: 2, 3"}
    });
    const fieldset = el("fieldset", {className: "exam-question"}, [
      el("legend", {text: `${index + 1}. ${item.statement}`}),
      el("div", {className: "objective-answer"}, [
        el("label", {className: "check-option", htmlFor: developedId}, [developed, el("span", {text: "El tema se desarrolla"})]),
        el("label", {htmlFor: paragraphId}, [el("span", {text: "Párrafo(s)"}), paragraph])
      ])
    ]);
    developed.addEventListener("change", () => {
      answer.developed = developed.checked;
      answer.touched = true;
      if (!developed.checked) {
        answer.paragraph = "";
        paragraph.value = "";
      }
      paragraph.disabled = !developed.checked;
      onSave();
    });
    developed.addEventListener("blur", () => {
      if (!answer.touched) {
        answer.touched = true;
        onSave();
      }
    });
    paragraph.addEventListener("input", () => {
      answer.paragraph = paragraph.value;
      answer.touched = true;
      onSave();
    });
    if (review) {
      const correct = grade.sectionAResults[item.id];
      fieldset.classList.add(correct ? "correct" : "incorrect", ...(correct ? [] : ["needs-review"]));
      fieldset.append(el("p", {className: "answer-feedback", text: correct
        ? `Correcto · ${exam.sections.a.pointsPerItem} punto(s)`
        : `Respuesta correcta: ${item.developed
          ? `se desarrolla en ${(() => {
            const references = Array.isArray(item.paragraphs) ? item.paragraphs : [item.paragraph];
            return references.length === 1 ? `el párrafo ${references[0]}` : `los párrafos ${references.join(" y ")}`;
          })()}`
          : "no se desarrolla"}.`}));
    }
    section.append(fieldset);
  }
  return section;
}

function renderSectionB(exam, attempt, review, onSave) {
  const section = el("section", {className: "exam-section", attrs: {"aria-labelledby": "sectionBTitle"}}, [
    el("h2", {id: "sectionBTitle", text: exam.sections.b.title}),
    el("p", {className: "section-instructions", text: exam.sections.b.instructions})
  ]);
  for (const [index, item] of exam.sections.b.items.entries()) {
    const answerId = `${item.id}-answer`;
    const textarea = el("textarea", {
      id: answerId,
      value: attempt.answers.b[item.id] || "",
      disabled: review,
      attrs: {rows: "5"}
    });
    const article = el("article", {className: "exam-question open-question"}, [
      el("label", {htmlFor: answerId}, [
        el("strong", {text: `${index + 1}. ${item.question}`}),
        textarea
      ])
    ]);
    textarea.addEventListener("input", () => {
      attempt.answers.b[item.id] = textarea.value;
      onSave();
    });
    if (review) {
      article.classList.add("review-answer-layout");
      const selected = attempt.assessment.b[item.id] || {};
      attempt.assessment.b[item.id] = selected;
      const rubric = el("fieldset", {className: "self-rubric"}, [
        el("legend", {text: "Autoevaluación de esta respuesta"})
      ]);
      for (const criterion of item.rubric) {
        const id = `${item.id}-${criterion.id}`;
        const select = el("select", {id});
        select.append(
          el("option", {value: "not_met", text: "No cumplido"}),
          el("option", {value: "partial", text: "Parcial (50 %)"}),
          el("option", {value: "met", text: "Cumplido"})
        );
        select.value = selected[criterion.id] === true ? "met" : selected[criterion.id] || "not_met";
        select.addEventListener("change", () => {
          selected[criterion.id] = select.value;
          if (attempt.aiGrading?.[item.id]?.accepted) {
            attempt.aiGrading[item.id].accepted = false;
            attempt.aiGrading[item.id].gradingMethod = "manual";
          }
          onSave(true);
        });
        rubric.append(el("label", {className: "rubric-item", htmlFor: id}, [
          el("span", {text: criterion.label}),
          select,
          el("b", {text: `${criterion.points} pt`})
        ]));
      }
      const itemScore = calculateItemPoints(item, selected);
      if (itemScore < exam.sections.b.pointsPerItem) article.classList.add("needs-review");
      article.append(
        el("div", {className: "suggested-answer"}, [
          el("h3", {text: "Resolución sugerida"}),
          el("p", {text: item.suggestedAnswer})
        ]),
        rubric,
        renderAIItemReview(item, attempt, onSave)
      );
    }
    section.append(article);
  }
  return section;
}

function renderAIItemReview(item, attempt, onSave) {
  const suggestion = attempt.aiGrading?.[item.id];
  if (!suggestion) return el("p", {className: "muted ai-item-empty", text: "Puede usar la rúbrica manual o solicitar una sugerencia de IA para la sección."});
  const panel = el("section", {className: `ai-item-review ${suggestion.confidence === "low" || suggestion.status !== "graded" ? "needs-manual-review" : ""}`.trim()}, [
    el("div", {className: "ai-item-heading"}, [
      el("h3", {text: "Sugerencia de Gemini"}),
      el("span", {className: "availability", text: suggestion.cached ? "Resultado guardado" : `Confianza: ${suggestion.confidence}`})
    ]),
    el("p", {className: "ai-assistive-warning", text: "Corrección asistida por IA. Revise el resultado antes de aceptarlo."}),
    suggestion.confidence === "low" || suggestion.status !== "graded"
      ? el("p", {className: "answer-feedback ai-review-warning", text: "Revisión manual recomendada."}) : null,
    el("p", {text: suggestion.overallFeedback})
  ]);
  const statuses = suggestion.finalStatuses || Object.fromEntries(suggestion.criteria.map(criterion => [criterion.criterionId, criterion.status]));
  suggestion.finalStatuses = statuses;
  const pointsId = `${item.id}-ai-final-points`;
  const finalPoints = el("input", {id: pointsId, type: "number", value: String(suggestion.finalPoints ?? suggestion.aiSuggestedPoints), min: "0", max: String(item.maxPoints), attrs: {step: "0.5"}});
  finalPoints.addEventListener("change", () => {
    suggestion.finalPoints = Math.min(item.maxPoints, Math.max(0, Number(finalPoints.value) || 0));
    finalPoints.value = String(suggestion.finalPoints);
    suggestion.manuallyAdjusted = suggestion.finalPoints !== suggestion.aiSuggestedPoints;
    onSave();
  });
  for (const criterion of suggestion.criteria) {
    const source = item.rubric.find(entry => entry.id === criterion.criterionId);
    const id = `${item.id}-${criterion.criterionId}-ai`;
    const select = el("select", {id});
    select.append(
      el("option", {value: "not_met", text: "No cumplido"}),
      el("option", {value: "partial", text: "Parcial (50 %)"}),
      el("option", {value: "met", text: "Cumplido"})
    );
    select.value = statuses[criterion.criterionId];
    select.addEventListener("change", () => {
      statuses[criterion.criterionId] = select.value;
      suggestion.finalPoints = calculateItemPoints(item, statuses);
      finalPoints.value = String(suggestion.finalPoints);
      suggestion.manuallyAdjusted = suggestion.finalPoints !== suggestion.aiSuggestedPoints;
      onSave();
    });
    panel.append(el("label", {className: "ai-criterion", htmlFor: id}, [
      el("span", {}, [el("strong", {text: `${source.label} (${source.points} pt)`}), el("small", {text: criterion.feedback})]),
      select
    ]));
  }
  const noteId = `${item.id}-ai-note`;
  const note = el("textarea", {id: noteId, value: suggestion.personalNote || "", attrs: {rows: "2"}});
  note.addEventListener("input", () => { suggestion.personalNote = note.value; onSave(); });
  panel.append(
    el("label", {className: "ai-personal-note", htmlFor: noteId}, [el("span", {text: "Observación personal (no se envía a Gemini)"}), note]),
    el("p", {className: "ai-points", text: `Sugerencia de IA: ${suggestion.aiSuggestedPoints}/${item.maxPoints} puntos`}),
    el("label", {className: "ai-final-points", htmlFor: pointsId}, [el("span", {text: "Puntuación final (ajuste humano)"}), finalPoints]),
    el("div", {className: "exam-actions"}, [
      button("Aceptar corrección revisada", () => {
        Object.assign(attempt.assessment.b[item.id], statuses);
        suggestion.gradingMethod = "ai_reviewed";
        suggestion.finalPoints = Math.min(item.maxPoints, Math.max(0, Number(finalPoints.value) || 0));
        suggestion.manuallyAdjusted = suggestion.finalPoints !== suggestion.aiSuggestedPoints;
        suggestion.accepted = true;
        onSave(true);
      }, "primary", suggestion.status !== "graded"),
      button("Descartar sugerencia", () => {
        delete attempt.aiGrading[item.id];
        onSave(true);
      })
    ]),
    suggestion.accepted ? el("p", {className: "exam-status success", text: `Corrección aceptada: ${suggestion.finalPoints}/${item.maxPoints} puntos.`}) : null
  );
  return panel;
}

function renderAIGradingPanel(exam, attempt) {
  const availability = aiGradingAvailability();
  const answered = exam.sections.b.items.filter(item => String(attempt.answers.b[item.id] || "").trim());
  const allGradable = answered.every(item => validateGradableItem(item).gradable);
  const status = statusMessage();
  const run = async force => {
    const buttons = panel.querySelectorAll("button");
    buttons.forEach(control => { control.disabled = true; });
    status.textContent = "Corrigiendo 0 de " + answered.length + " respuestas…";
    status.className = "exam-status";
    try {
      const items = answered.map(item => ({...item, studentAnswer: attempt.answers.b[item.id]}));
      const results = await gradeItemsWithAI({
        parentId: exam.id,
        contentVersion: exam.contentVersion || exam.schemaVersion,
        items,
        force,
        onProgress: (done, total) => { status.textContent = `Corrigiendo ${done} de ${total} respuestas…`; }
      });
      attempt.aiGrading ||= {};
      for (const result of results) {
        const previous = attempt.aiGrading[result.itemId];
        attempt.aiGrading[result.itemId] = {
          ...result,
          aiSuggestedPoints: result.points,
          finalStatuses: Object.fromEntries(result.criteria.map(criterion => [criterion.criterionId, criterion.status])),
          finalPoints: result.points,
          personalNote: previous?.personalNote || "",
          gradingMethod: "ai_pending",
          manuallyAdjusted: false,
          accepted: false
        };
      }
      saveAttempt(attempt);
      renderAttempt(exam, attempt);
    } catch (error) {
      status.textContent = `${error.message} Puede continuar con la corrección manual.`;
      status.className = "exam-status error";
      buttons.forEach(control => { control.disabled = false; });
    }
  };
  const reason = !answered.length ? "No hay respuestas abiertas para enviar. Las respuestas en blanco valen cero y no usan la API."
    : !allGradable ? "Faltan datos de corrección en uno o más ítems. Use la autoevaluación manual."
      : availability.reason;
  const panel = el("section", {className: "panel ai-grading-panel", attrs: {"aria-labelledby": "aiExamHeading"}}, [
    el("div", {className: "section-heading"}, [
      el("div", {}, [el("h2", {id: "aiExamHeading", text: "Corrección de respuestas abiertas"}), el("p", {text: "Gemini solo compara su respuesta con la resolución y la rúbrica del JSON."})]),
      el("div", {className: "exam-actions"}, [
        button("Corregir con IA", () => run(false), "primary", !availability.available || !allGradable || !answered.length),
        button("Corregir manualmente", () => root.querySelector(".self-rubric")?.scrollIntoView({behavior: "smooth", block: "center"})),
        Object.keys(attempt.aiGrading || {}).length ? button("Corregir nuevamente", () => run(true), "", !availability.available || !allGradable || !answered.length) : null
      ])
    ]),
    el("p", {className: "ai-assistive-warning", text: "Corrección asistida por IA. La nota solo cambia cuando usted acepta cada resultado."}),
    el("p", {className: "muted", text: "La Sección C continúa en autoevaluación manual porque las fuentes no contienen una rúbrica."}),
    reason ? el("p", {className: "exam-status", text: reason}) : null,
    status
  ]);
  return panel;
}

function renderSectionC(exam, attempt, review, onSave) {
  const answerId = "section-c-answer";
  const textarea = el("textarea", {id: answerId, value: attempt.answers.c || "", disabled: review, attrs: {rows: "3"}});
  const section = el("section", {className: "exam-section", attrs: {"aria-labelledby": "sectionCTitle"}}, [
    el("h2", {id: "sectionCTitle", text: exam.sections.c.title}),
    el("p", {className: "section-instructions", text: exam.sections.c.instructions}),
    el("div", {className: "exam-question open-question"}, [
      el("label", {htmlFor: answerId}, [el("strong", {text: exam.sections.c.answerLabel || "Versión en español"}), textarea])
    ])
  ]);
  textarea.addEventListener("input", () => {
    attempt.answers.c = textarea.value;
    onSave();
  });
  if (review) {
    const selectId = "section-c-score";
    const select = el("select", {id: selectId, value: String(attempt.assessment.c)});
    for (const score of exam.sections.c.scoreScale) {
      select.append(el("option", {value: String(score), text: `${score} ponto${score === 1 ? "" : "s"}`}));
    }
    select.value = String(attempt.assessment.c);
    select.addEventListener("change", () => {
      attempt.assessment.c = Number(select.value);
      onSave(true);
    });
    const question = section.querySelector(".exam-question");
    if (Number(attempt.assessment.c) < exam.sections.c.maxPoints) question.classList.add("needs-review");
    question.append(
      el("div", {className: "suggested-answer"}, [
        el("h3", {text: "Resolución sugerida"}),
        el("p", {text: exam.sections.c.suggestedAnswer})
      ]),
      el("label", {className: "title-score", htmlFor: selectId}, [
        el("span", {text: "Autoavaliação do título"}),
        select
      ])
    );
  }
  return section;
}

function renderAttempt(exam, attempt) {
  const review = attempt.status === "review";
  let grade = gradeExam(exam, attempt);
  const itemCount = examItemCount(exam);
  const savedStatus = statusMessage("Respostas salvas automaticamente.");
  const progressText = el("span", {text: `0 de ${itemCount} respondidos`});
  const progress = el("progress", {attrs: {max: String(itemCount), value: "0", "aria-label": "Progresso do simulado"}});
  const timer = el("time", {className: "exam-timer", text: formatDuration(durationOf(attempt))});
  const header = el("header", {className: "exam-run-header"}, [
    el("div", {}, [el("h1", {text: exam.title}), el("p", {text: exam.theme})]),
    el("div", {className: "exam-run-meta"}, [
      el("label", {}, [progressText, progress]),
      attempt.timerEnabled ? timer : null
    ])
  ]);
  const scoreSlot = el("div");

  const updateProgress = () => {
    const completed = completedAnswers(exam, attempt);
    progress.value = completed;
    progressText.textContent = `${completed} de ${itemCount} respondidos`;
  };
  const updateHistoryAndScore = () => {
    grade = gradeExam(exam, attempt);
    persist(attempt, savedStatus);
    saveHistory(historyRecord(exam, attempt, grade));
    scoreSlot.replaceChildren(renderScore(exam, grade));
  };
  const onSave = updateScore => {
    persist(attempt, savedStatus);
    updateProgress();
    if (updateScore) {
      updateHistoryAndScore();
      setTimeout(() => renderAttempt(exam, attempt), 0);
    }
  };

  const questions = el("main", {className: "exam-questions"});
  questions.append(
    renderSectionA(exam, attempt, review, grade, onSave),
    renderSectionB(exam, attempt, review, onSave),
    renderSectionC(exam, attempt, review, onSave)
  );

  const actions = el("div", {className: "exam-footer-actions"});
  if (review) {
    scoreSlot.append(renderScore(exam, grade));
    actions.append(
      button("Voltar às provas", () => renderSelection()),
      button("Revisar erros", () => document.querySelector("#examApp .needs-review")?.scrollIntoView({behavior: "smooth", block: "center"})),
      button("Iniciar nova tentativa", () => {
        if (!confirm("Iniciar uma nova tentativa? As respostas desta tentativa serão removidas, mas o histórico será mantido.")) return;
        clearAttempt(exam.id);
        renderIntro(exam);
      }, "primary")
    );
  } else {
    actions.append(
      button("Abandonar por agora", () => {
        persist(attempt, savedStatus);
        renderSelection("Tentativa salva. Você pode continuar depois.", "success");
      }),
      button("Reiniciar prova", () => {
        if (!confirm("Reiniciar esta prova? As respostas atuais serão apagadas.")) return;
        clearAttempt(exam.id);
        renderIntro(exam);
      }, "danger-outline"),
      button("Finalizar simulado", () => {
        if (!confirm("Finalizar o simulado? As respostas originais ficarão bloqueadas para edição.")) return;
        attempt.status = "review";
        attempt.finalizedAt = Date.now();
        attempt.durationMs = durationOf(attempt);
        grade = gradeExam(exam, attempt);
        persist(attempt, savedStatus);
        saveHistory(historyRecord(exam, attempt, grade));
        renderAttempt(exam, attempt);
      }, "primary")
    );
  }

  const layout = el("div", {className: "exam-layout"}, [
    el("aside", {className: "exam-reference"}, [renderArticle(exam)]),
    questions
  ]);
  replace(header, scoreSlot, ...(review ? [renderAIGradingPanel(exam, attempt)] : []), layout, savedStatus, actions);
  updateProgress();
  if (!review && attempt.timerEnabled) {
    timerId = setInterval(() => {
      timer.textContent = formatDuration(durationOf(attempt));
    }, 1000);
  }
}

async function init() {
  try {
    const entries = await loadExamIndex();
    catalog = await Promise.all(entries.map(async entry => {
      if (!entry.available) return {entry};
      try {
        return {entry, exam: await loadExam(entry)};
      } catch (error) {
        console.error(`Falha ao carregar ${entry.id}:`, error);
        return {entry, error};
      }
    }));
    renderSelection();
  } catch (error) {
    replace(el("section", {className: "panel exam-error"}, [
      el("h2", {text: "Não foi possível abrir os simulados"}),
      el("p", {text: error.message}),
      button("Tentar novamente", init, "primary")
    ]));
  }
}

window.addEventListener("medlex-backup-restored", init);
window.addEventListener("medlex-ai-state-changed", () => {
  const active = catalog.map(item => item.exam).find(exam => exam && getAttempt(exam.id)?.status === "review");
  if (active && root.closest(".view")?.classList.contains("active")) renderAttempt(active, getAttempt(active.id));
});
init();
