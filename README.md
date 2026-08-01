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

`english,spanish,portuguese,example_en,example_es,example_pt,source,tags`

Quando uma palavra em inglês já existir, a importação atualiza o conteúdo sem apagar o progresso de revisão.

## Backup

O progresso fica salvo no navegador. Use **Importar → Exportar backup completo** regularmente; o arquivo inclui cartões, simulados e práticas.

## Conteúdo de provas e práticas

Os PDFs e documentos de origem não fazem parte do site. O navegador carrega somente os JSONs em `data/exams/` e `data/practice/`. Consulte [docs/content-schema.md](./docs/content-schema.md) para adicionar provas ou unidades.
