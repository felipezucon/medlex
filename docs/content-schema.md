# Conteúdo estruturado

Os arquivos de produção usam `schemaVersion: 1` e caminhos relativos nos índices.

## Simulados

Cada item de `data/exams/index.json` aponta para um JSON com metadados da prova, texto e parágrafos numerados, além das seções `a`, `b` e `c`. A seção A define afirmações, resposta booleana, parágrafo e pontos por item. A seção B define perguntas abertas, resolução sugerida e rubrica cuja soma corresponde ao máximo por pergunta. Ela também declara `gradingMode: "ai_or_manual"` e `answerLanguage: "es"`; o carregador deriva `maxPoints` de `pointsPerItem`, mantém `acceptedVariants` vazio quando não há variantes documentadas e expõe `suggestedAnswer` como a resposta esperada canônica. A seção C usa um ID estável, `gradingMode: "ai_or_manual"`, `gradingType: "holistic"` e `scoreScale: [0, 1, 2, 3]`, preservando a consigna e a resolução sugerida da fonte.

Para adicionar outra prova, crie o JSON no mesmo schema e acrescente somente sua entrada ao índice. A validação central em `js/exam-data.mjs` impede que um arquivo incompleto interrompa as demais provas.

## Práticas

`data/practice/index.json` aponta para conteúdos compostos por `units` e `blocks`. Os tipos aceitos são `translation`, `matching` e `open`. Traduções usam segmentos de texto com `target: true`; respostas abertas e traduções usam resolução esperada, `gradingMode: "ai_or_manual"`, `answerLanguage` e rubricas de autoavaliação. O carregador deriva `maxPoints` da soma da rubrica.

Associações definem opções, `correctOption` e `translationGrading`. A letra é corrigida localmente; a tradução escrita é enviada à IA com o texto, a resolução da opção correta e a rubrica explícita. No fallback, o mesmo critério permanece disponível para autoavaliação manual.

Uma nova unidade pode ser acrescentada ao array `units` de `ing-forms.json`, com IDs únicos. Uma prática de outra natureza deve receber seu próprio JSON e entrada no índice.

As unidades derivadas dos simulados declaram `examId`; cada item declara `sourceExamId`, `sourceParagraph` e `sourceAnswerId`, e as traduções também registram `sourceRubricId`. Os grupos dos simulados 6 e 7 contêm quatro traduções e uma pergunta aberta cada. Esses campos permitem verificar que frases, resoluções e rubricas continuam idênticas ao conteúdo de `data/exams/`.

## Compatibilidade local

O schema local atual é o 5. O armazenamento central usa chaves `medlex:*` separadas para cartões, tentativas, histórico, prática e preferências. As chaves antigas `medlexCards.v1`, `medlexReviewLog.v1`, `medlexExams.v1`, `medlexPractice.v1` e `medlexTheme` são somente fontes de migração e continuam reconhecidas. O cofre, as configurações, o consentimento e o cache de IA são locais a este navegador e ficam fora dos backups.

## Requisitos para um item corrigível por IA

- ID único e estável;
- `gradingMode: "ai_or_manual"` no item ou bloco/seção;
- enunciado e idioma esperado;
- resposta esperada transcrita de uma fonte;
- `maxPoints` explícito ou derivável do bloco/seção;
- uma rubrica com critérios de IDs únicos, rótulo e pontos positivos cuja soma seja `maxPoints`; ou
- `gradingType: "holistic"` com escala explícita fornecida pela prova;
- variantes e trecho-fonte somente quando documentados.

Sem qualquer desses dados, mantenha `gradingMode: "manual"`. Não crie conteúdo para tornar um item elegível; o modo holístico só é permitido quando a fonte define a pontuação máxima e fornece uma resolução.

## Divergências preservadas das fontes

- Práctica A: a resolução traz “Mas de uno...” sem acento e chama a situação nutricional de “nueva” no item A1, enquanto a prova usa “actual”; o JSON aprovado e o enunciado da prova foram mantidos.
- Práctica B: o texto informa fondaparinux “2·5 mg”, enquanto a resolução registra “2-5 mg”; cada forma foi preservada no campo correspondente.
- Práctica D: a resolução numera a segunda pergunta da seção B novamente como “1”; os IDs estruturados seguem a ordem lógica sem alterar o enunciado.
- Práctica E: o parágrafo 6 começa com “BS (Brain Stimulation)” em vez de “DBS”; o texto foi preservado.
- Práctica F: a resolução atribui o item A3 ao parágrafo 3, embora a comparação detalhada esteja no parágrafo 4; a chave de correção conserva o parágrafo 3 indicado pela resolução. A sexta pergunta aparece como “6. 6.” na resolução; o enunciado foi mantido sem a duplicação editorial do número.
- Formas em `-ing`: o PDF contém “can de difficult” e a resolução usa “suceptibilidad” (sem o segundo “s” de “susceptibilidad”); ambos foram preservados nos respectivos campos de origem e resposta.
