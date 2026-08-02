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

O `cards.csv` contém 1.000 cartões e é carregado automaticamente. Ao receber uma nova versão do banco, o aplicativo incorpora somente os cartões ausentes e preserva as métricas dos cartões já estudados em `medlexCards.v1`.

Para reconstruir e verificar o banco:

```sh
node scripts/build-cards.mjs
node scripts/build-cards.mjs --check
```

As três origens CSV são preservadas em `data/cards/sources/cards-original.csv` e nos dois arquivos de expansão da raiz. O vocabulário curado dos simulados fica em `data/cards/sources/exam-vocabulary.csv`; cada termo precisa aparecer em um JSON de `data/exams/` ou `data/practice/`, caso contrário o construtor o rejeita. Para aproveitar um novo simulado, adicione seu JSON ao índice correspondente e inclua somente os novos termos confirmados no catálogo.

O relatório da última geração fica em `reports/cards-build-report.md`; possíveis equivalências semânticas que exigem decisão humana ficam em `reports/cards-duplicates-review.csv`.

## Backup

O progresso fica salvo no navegador. Use **Importar → Exportar backup completo** regularmente; o arquivo inclui cartões, simulados e práticas.

## Conteúdo de provas e práticas

Os PDFs e documentos de origem não fazem parte do site. O navegador carrega somente os JSONs em `data/exams/` e `data/practice/`. Consulte [docs/content-schema.md](./docs/content-schema.md) para adicionar provas ou unidades.
