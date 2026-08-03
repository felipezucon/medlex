# Auditoria de prontidão para correção por IA

Data da auditoria: 2026-08-02

## Resultado

Foram auditados os 12 simulados em `data/exams/`, a prática em `data/practice/ing-forms.json` e os materiais de origem em `materiais-fonte/`.

| Métrica | Quantidade |
| --- | ---: |
| Itens auditados | 174 |
| Itens objetivos, corrigidos localmente | 77 |
| Itens abertos | 97 |
| Itens abertos prontos para IA | 97 |
| Itens sem resposta esperada | 0 |
| Itens com pontuação inconsistente | 0 |
| IDs duplicados | 0 |

Os 97 itens abertos são as 72 perguntas da Seção B, as 12 respostas da Seção C dos simulados e os 13 itens de tradução/resposta aberta da prática de formas em `-ing`.

## Regras usadas

- A Seção A e os exercícios de associação permanecem locais e nunca são enviados à API.
- A Seção B usa as rubricas documentadas no JSON; a soma dos critérios é igual ao máximo de 4 pontos.
- A Seção C usa `gradingType: "holistic"`, a resolução sugerida e a escala integral de 0 a 3 fornecida pelas provas. Não foram inventados critérios intermediários.
- Títulos, subtítulos e explicações equivalentes são avaliados semanticamente, sem exigir igualdade textual.
- As práticas continuam com correção assistida e aceitação humana; os simulados aplicam automaticamente a correção validada.

## Segurança e fallback

Cada item corrigível tem ID estável, resposta esperada, idioma, máximo e rubrica ou escala holística. O cliente envia somente os dados necessários, usa `store: false`, não habilita ferramentas ou grounding e valida toda a saída estruturada. Respostas vazias recebem zero sem chamada à API. Qualquer falha invalida o lote do simulado e mantém disponível a correção manual, sem alterar as respostas originais.
