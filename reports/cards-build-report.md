# Relatório de construção dos cartões

Gerado deterministicamente por `node scripts/build-cards.mjs`.

## Auditoria dos CSVs originais

| Origem | Linhas | Válidas | Inválidas | Únicas preservadas |
|---|---:|---:|---:|---:|
| cards.csv original | 72 | 72 | 0 | 72 |
| medlex-cards-expansion-to-320.csv | 248 | 248 | 0 | 248 |
| medlex-expansion-150-pubmed.csv | 150 | 150 | 0 | 150 |

- Duplicatas exatas removidas: 0.
- Duplicatas normalizadas removidas: 0.
- Conflitos de tradução: 0.
- Total único preservado dos CSVs: 470.

## Vocabulário dos simulados

- Candidatos curados: 580.
- Candidatos aceitos: 530.
- Candidatos rejeitados: 50.
- Motivos de rejeição: termo não encontrado nas fontes (33); duplicata canônica (6); limite de cartões (11).

| Fonte primária | Cartões extraídos |
|---|---:|
| exam-smoking-depression-2022-reconstructed | 46 |
| ing-forms | 11 |
| prefinal-a | 46 |
| prefinal-b | 33 |
| prefinal-c | 46 |
| prefinal-d | 27 |
| prefinal-e | 49 |
| prefinal-f | 47 |
| simulado-01-sleep-apnea | 46 |
| simulado-02-pitavastatin-hiv | 46 |
| simulado-03-post-infectious-mecfs | 50 |
| simulado-04-cannabis-cardiovascular | 44 |
| simulado-05-antibiotic-resistance | 39 |

## Resultado

- Cartões finais: **1000**.
- Faltam para 1000: **0**.
- IDs duplicados: 0.
- Frentes canônicas duplicadas: 0.
- Linhas ou campos obrigatórios inválidos: 0.
- Codificação de saída: UTF-8 com BOM.

## Categorias

- adjective: 16
- antimicrobial: 41
- cannabis: 44
- certainty: 3
- clinical: 102
- comparison: 8
- connector: 1
- connectors: 6
- declare: 36
- disease: 3
- general: 2
- grade: 56
- growth: 47
- hematology: 6
- hiv: 46
- hospital: 4
- hypress: 58
- infectious-disease: 2
- measurement: 27
- mecfs: 49
- mental-health: 45
- negative: 2
- neurology: 49
- nutrition: 45
- outcomes: 2
- quantity: 3
- results: 5
- safety: 2
- sleep-medicine: 47
- study: 66
- summary: 1
- thrombosis: 59
- time: 4
- trauma: 3
- treatment: 24
- vaccination: 47
- verb: 31
- verbs: 8

## Revisão manual

7 possível(is) equivalência(s) semântica(s) foram mantidas e listadas em `reports/cards-duplicates-review.csv`.
