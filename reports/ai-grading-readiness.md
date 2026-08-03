# Auditoria de prontidão para correção por IA

Data da auditoria: 2026-08-03

## Resultado

Foram auditados os 12 simulados em `data/exams/`, a prática em `data/practice/ing-forms.json` e os materiais de origem em `materiais-fonte/`.

| Métrica | Quantidade |
| --- | ---: |
| Componentes de resposta auditados | 179 |
| Itens objetivos, corrigidos localmente | 77 |
| Respostas escritas | 102 |
| Respostas escritas prontas para IA | 102 |
| Itens sem resposta esperada | 0 |
| Itens com pontuação inconsistente | 0 |
| IDs duplicados | 0 |

As 102 respostas escritas são as 72 perguntas da Seção B, as 12 respostas da Seção C dos simulados e os 18 itens escritos da prática de formas em `-ing`, incluindo as cinco traduções dos exercícios de associação.

## Regras usadas

- A Seção A e as letras dos exercícios de associação permanecem locais. As traduções escritas nas associações são avaliadas contra o texto e a resolução da opção correta.
- A Seção B usa as rubricas documentadas no JSON; a soma dos critérios é igual ao máximo de 4 pontos.
- A Seção C usa `gradingType: "holistic"`, a resolução sugerida e a escala integral de 0 a 3 fornecida pelas provas. Não foram inventados critérios intermediários.
- Títulos, subtítulos e explicações equivalentes são avaliados semanticamente, sem exigir igualdade textual.
- Simulados e práticas aplicam automaticamente a correção validada, sem controles para ajustar a nota da IA. Nas práticas, a devolutiva pedagógica é apresentada em PT-BR.

## Segurança e fallback

Cada item corrigível tem ID estável, resposta esperada, idioma, máximo e rubrica ou escala holística. O cliente envia somente os dados necessários, usa `store: false`, não habilita ferramentas ou grounding e valida toda a saída estruturada. Respostas vazias recebem zero sem chamada à API. Qualquer falha invalida a correção automática completa e mantém disponível a correção manual, sem alterar as respostas originais.
