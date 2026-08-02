# MedLex Cards

Aplicativo estático de flashcards com revisão espaçada, simulados de leitura e práticas de formas em `-ing`.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub.
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/root`.
6. Aguarde o link do GitHub Pages.

No iPad, abra o link no Safari e use **Compartilhar → Adicionar à Tela de Início**.

## Importação por CSV

Use as colunas:

`id,english,spanish,portuguese,example_en,example_es,example_pt,source,tags`

O campo `id` é opcional para arquivos personalizados. Quando uma palavra em inglês já existir, a importação atualiza o conteúdo sem apagar o progresso de revisão.

## Banco padrão

O `cards.csv` contém 1.000 cartões e é carregado automaticamente a cada inicialização. O conteúdo padrão não é duplicado no `localStorage`: o navegador guarda apenas progresso, cartões personalizados, alterações e exclusões feitas pela pessoa usuária. Assim, novas versões e reordenações do CSV preservam as métricas pelo `id` estável de cada cartão.

Para reconstruir e verificar o banco:

```sh
node scripts/build-cards.mjs
node scripts/build-cards.mjs --check
```

As três origens CSV são preservadas em `data/cards/sources/cards-original.csv` e nos dois arquivos de expansão da raiz. O vocabulário curado dos simulados fica em `data/cards/sources/exam-vocabulary.csv`; cada termo precisa aparecer em um JSON de `data/exams/` ou `data/practice/`, caso contrário o construtor o rejeita. Para aproveitar um novo simulado, adicione seu JSON ao índice correspondente e inclua somente os novos termos confirmados no catálogo.

O relatório da última geração fica em `reports/cards-build-report.md`; possíveis equivalências semânticas que exigem decisão humana ficam em `reports/cards-duplicates-review.csv`.

## Backup

O progresso fica salvo no navegador em chaves `medlex:*`, com migrações incrementais de schema. Antes de uma migração, o aplicativo cria uma única cópia local para recuperação. Use **Importar → Exportar backup completo** regularmente; o arquivo inclui os dados de estudo gerenciados pelo MedLex, inclusive dados inválidos preservados para recuperação manual. O cofre, as configurações, o consentimento e o cache da correção por IA ficam fora do backup.

Em **Importar → Manutenção dos dados locais** é possível consultar as versões, validar os dados, recuperar a cópia anterior à migração e restabelecer somente os dados locais do MedLex. A última opção não chama `localStorage.clear()` e não interfere em outros sites.

Para executar as verificações automatizadas, incluindo os cenários de migração dos schemas 0, 1, 2 e atual:

```sh
node --test tests/*.test.mjs
```

## Atualizações futuras

- Mudou somente HTML, CSS, JavaScript ou conteúdo publicado: aumente `CONTENT_VERSION` em `js/storage.mjs` e mantenha o mesmo valor em `sw.js` e nas URLs de `index.html`.
- Mudou o formato dos dados locais: aumente `STORAGE_SCHEMA_VERSION`, crie a próxima migração incremental (por exemplo, `migrationFourToFive()`) em `js/storage.mjs` e acrescente-a, em ordem, ao laço de `migrateStorage()`.
- Mudou `cards.csv`: preserve os IDs existentes; cartões novos começam sem progresso e a ordem das linhas pode mudar.
- Um dado antigo deixou de ser compatível: arquive somente o registro afetado e preserve o restante.

## Conteúdo de provas e práticas

Os PDFs e documentos de origem não fazem parte do site. O navegador carrega somente os JSONs em `data/exams/` e `data/practice/`. Consulte [docs/content-schema.md](./docs/content-schema.md) para adicionar provas ou unidades.

## Correção opcional com IA

A correção assistida usa Gemini somente nas respostas abertas que possuem resolução e rubrica no JSON. Ela não altera flashcards nem questões objetivas, e a nota sugerida só é aplicada após revisão humana. Consulte [docs/ai-grading.md](./docs/ai-grading.md) para configuração, privacidade, segurança, manutenção e diagnóstico.
