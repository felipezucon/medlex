# Auditoria de prontidão para correção por IA

Data da auditoria: 2026-08-02

## Escopo e critérios

Foram auditados os 12 simulados em `data/exams/`, a atividade em `data/practice/ing-forms.json`, os módulos de carregamento, correção e armazenamento, e os materiais em `materiais-fonte/`.

Um item foi considerado **pronto em conteúdo** quando possui ID único, enunciado, resposta esperada, rubrica com critérios identificáveis e soma de pontos coerente. Para ser **canônico**, ele também precisa declarar explicitamente `gradingMode`, `answerLanguage`, `maxPoints` e IDs estáveis para todos os critérios.

A IA permanece proibida para a Seção A dos simulados e para exercícios de associação. Itens sem resposta esperada ou rubrica continuam disponíveis apenas para correção manual.

## Resultado geral

| Métrica | Quantidade |
| --- | ---: |
| Itens auditados | 174 |
| Itens objetivos, corrigidos localmente | 77 |
| Itens abertos | 97 |
| Itens abertos prontos em conteúdo para IA | 85 |
| Itens já no schema canônico completo | 0 |
| Itens sem resposta esperada | 0 |
| Itens sem rubrica suficiente | 12 |
| Itens com pontuação inconsistente | 0 |
| IDs duplicados | 0 |
| Itens que exigem revisão humana/manual | 12 |

Os 85 itens prontos em conteúdo são as 72 perguntas da Seção B dos simulados e os 13 itens de tradução/resposta aberta da prática de formas em `-ing`. Os 12 itens bloqueados são as questões da Seção C: todos possuem título sugerido, mas nenhum material-fonte fornece critérios de avaliação. Criar esses critérios seria inventar conteúdo de correção, portanto a Seção C deve permanecer manual.

## Simulados

Cada simulado contém 6 itens objetivos na Seção A, 6 perguntas abertas na Seção B e 1 resposta aberta na Seção C.

| Prova | Objetivos | Abertos | Prontos em conteúdo | Sem resposta | Sem rubrica | Pontuação inconsistente | IDs duplicados | Revisão humana |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Práctica Pre-final A | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Práctica Pre-final B | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Práctica Pre-final C | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Práctica Pre-final D | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Práctica Pre-final E | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Práctica Pre-final F | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Smoking and depression | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Simulado 01 — Sleep apnea | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Simulado 02 — Pitavastatin and HIV | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Simulado 03 — Post-infectious ME/CFS | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Simulado 04 — Cannabis | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| Simulado 05 — Antibiotic resistance | 6 | 7 | 6 | 0 | 1 (C) | 0 | 0 | 1 |
| **Total** | **72** | **84** | **72** | **0** | **12** | **0** | **0** | **12** |

### Bloqueio da Seção C

Os PDFs de prova, PDFs de resolução sugerida, arquivos Markdown e o ZIP foram consultados. Eles fornecem uma versão sugerida do título, porém não fornecem rubrica nem distribuição de pontos por critério. Não há base documental para criar critérios. Esses 12 itens ficam com `gradingMode: "manual"` e autoavaliação de 0 a 3 pontos.

## Práctica de formas en -ing

| Atividade | Objetivos | Traduções abertas | Outras abertas | Prontos em conteúdo | Sem resposta | Sem rubrica | Inconsistências | Revisão humana obrigatória |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Práctica de formas en `-ing` | 5 | 7 | 6 | 13 | 0 | 0 | 0 | 0 |

Os 5 exercícios de associação permanecem locais e nunca serão enviados à API. As 7 traduções e 6 respostas abertas possuem resposta esperada e rubrica. Não há variantes aceitas explícitas nos materiais; o campo canônico deve ser um array vazio, sem criar variantes novas.

## Lacunas do schema atual

- Os itens abertos ainda não declaram `gradingMode`, `answerLanguage` e `maxPoints` no próprio item.
- As rubricas precisam de IDs estáveis por critério para correlacionar a saída estruturada.
- Traduções não possuem `acceptedVariants` nem `requiredMeaningUnits` explícitos; os critérios existentes podem ser normalizados como unidades de significado sem alterar seu texto.
- A versão e o carregador atuais rejeitam campos desconhecidos apenas de forma parcial; a integração deve validar estritamente a porção enviada à IA.
- Os 12 itens da Seção C não podem ser normalizados como `ai_or_manual` sem inventar rubricas.

## Arquitetura e segurança existentes

- A aplicação é estática, sem dependências, bundler ou backend.
- Carregamento, correção e armazenamento já são separados em módulos ES.
- A correção objetiva e o cálculo das notas são locais.
- A autoavaliação manual já preserva as respostas originais após a finalização.
- O `localStorage` é centralizado em `js/storage.mjs`, atualmente no schema 3, com migrações incrementais.
- O backup atual exporta todas as chaves gerenciadas; ele precisa excluir cofre, consentimento/configuração e cache de IA, e a importação precisa preservá-los.
- Não existe `sessionStorage`, dependência remota ou script remoto.
- Não existe Content Security Policy. Deve ser adicionada uma CSP restrita, liberando apenas `https://generativelanguage.googleapis.com` em `connect-src`.
- Conteúdo da usuária e futuro feedback da IA devem continuar sendo renderizados com `textContent`/nós DOM, nunca como HTML.
- O service worker usa caminhos relativos e cache com versão explícita; a versão deve ser incrementada ao adicionar módulos e documentação.

## Condições para ativação

1. Normalizar os 85 itens prontos sem alterar o conteúdo pedagógico.
2. Manter os 12 itens da Seção C em correção manual.
3. Validar localmente a presença e a soma da rubrica antes de qualquer chamada.
4. Exigir cofre desbloqueado, consentimento vigente e conexão.
5. Enviar somente dados do item, com `store: false`, sem ferramentas, grounding ou histórico.
6. Validar a resposta estruturada e calcular todos os pontos localmente.
7. Exigir revisão e aceitação humana antes de aplicar a sugestão da IA.
8. Manter a correção manual disponível em todos os erros e indisponibilidades.

## Conclusão

A integração pode avançar para os 72 itens da Seção B e os 13 itens abertos da prática de `-ing`. A prova-piloto será a **Práctica Pre-final A**, limitada inicialmente às 6 perguntas da Seção B. Nenhuma resposta, variante ou rubrica ausente será gerada pela IA ou pelo código.
