# Correção automática com IA

## Finalidade e limites

O MedLex pode usar o modelo `gemini-3.5-flash-lite` para corrigir respostas abertas. A IA compara somente a pergunta, a resposta da usuária, a resolução sugerida, variantes documentadas, as regras de pontuação e o texto-fonte do simulado.

Ela não corrige questões objetivas, não atua nos flashcards, não busca na internet, não usa grounding ou ferramentas, não gera conteúdo e não completa respostas ou regras ausentes. A Seção C usa a escala holística de 0 a 3 prevista nas provas e a resolução fornecida pela fonte.

O endpoint é `POST https://generativelanguage.googleapis.com/v1beta/interactions`. Cada interação é isolada, usa `store: false` e não contém histórico, ferramentas, execução em segundo plano ou fallback de modelo.

## Configuração da chave

1. Abra **Configuração** e localize **Correção com IA — Gemini**.
2. Informe a chave, uma senha local com pelo menos oito caracteres e a confirmação.
3. Guarde a senha em um local seguro. Ela não pode ser recuperada pelo site.
4. Use **Testar conexão**.
5. Leia o aviso de privacidade e marque o consentimento somente se concordar.

Após recarregar a página, a chave aparece como configurada e bloqueada. Informe somente a senha local para desbloqueá-la. A senha nunca é salva nem enviada.

## Como o cofre funciona

A senha deriva uma chave de 256 bits com PBKDF2, SHA-256, salt aleatório e 250.000 iterações. A credencial é cifrada com AES-GCM e IV aleatório. O `localStorage` recebe somente versão, algoritmos, iterações, salt, IV, ciphertext e data de criação. A credencial descriptografada fica apenas na memória do módulo até bloqueio ou recarga.

Isso reduz exposição acidental em disco, mas não equivale à proteção de um backend: o navegador precisa descriptografar a chave para chamar a API, e código executado na mesma origem durante a sessão poderia acessar recursos da página. A própria documentação do Gemini recomenda manter chaves no servidor em aplicações de produção. Esta implementação é uma opção BYOK consciente dessa limitação para um site estático pessoal.

Para remover a chave, use **Esquecer chave**. A ação apaga somente `medlex:ai-key-vault`; não apaga progresso. A exportação e a importação de backup não incluem nem substituem cofre, senha, consentimento, configurações ou cache de IA.

## Consentimento e dados

Antes da primeira correção é necessário consentimento explícito. O registro local contém apenas versão, aceitação e data. O consentimento pode ser revogado desmarcando a opção.

São enviados:

- ID técnico do item;
- enunciado;
- resposta da usuária;
- resolução sugerida;
- rubrica ou escala de pontuação;
- idioma esperado;
- variantes documentadas;
- trecho-fonte necessário, quando existir no JSON.

Não são enviados nome, e-mail, estatísticas, histórico, outros simulados, flashcards, conteúdo geral do `localStorage`, senha, chave no corpo, identificador de dispositivo nem comentários pessoais. No nível gratuito, o Google pode usar os dados processados para melhorar seus produtos; consulte a política e os termos atuais do provedor antes de ativar.

## Fluxo de correção

Ao finalizar um simulado ou uma prática de formas em `-ing`, as respostas são salvas e bloqueadas antes de qualquer chamada. Com a chave pronta e o consentimento ativo, a correção começa automaticamente e envia somente respostas escritas não vazias, em lotes de no máximo seis. Se a chave estiver bloqueada, a área **Configuração** é aberta e a finalização é retomada após o desbloqueio. Respostas vazias recebem zero localmente e não usam a API.

Na Seção B, o Gemini devolve `graded`, confiança e a classificação `met`, `partial` ou `not_met` para cada critério. O JavaScript valida todos os IDs e campos e calcula os pontos:

- `met`: 100% dos pontos do critério;
- `partial`: 50%;
- `not_met`: 0%.

Na Seção C, o Gemini escolhe um valor permitido pela escala de 0 a 3 com base na consigna, texto e resolução. A nota dos simulados é aplicada automaticamente e não pode ser ajustada.

Nas práticas de formas `-ing`, todas as traduções e respostas abertas são corrigidas automaticamente. Nos exercícios de associação, a letra continua local e somente a tradução escrita é enviada, junto com o texto e a resolução da opção correta. A nota da IA é definitiva. A revisão mostra critérios, pontos, explicação do erro ou do acerto, orientação de melhoria e dica de memorização em PT-BR; formas e exemplos acadêmicos permanecem em espanhol ou inglês.

## Cache

Antes de chamar a API, o site calcula SHA-256 sobre o ID e versão do conteúdo, item, resposta, resolução, variantes, regras de pontuação, perfil e idioma da devolutiva, modelo e versões de prompt/schema. Uma resposta inalterada reutiliza a classificação local. Alterar a resposta ou o perfil pedagógico gera outro hash sem invalidar itens não relacionados.

O cache guarda hash, classificação, pontos calculados, modelo, versões, data, confiança e feedback validado. Não guarda chave, senha, cabeçalhos nem payload bruto e fica fora do backup.

As chaves locais são `medlex:ai-key-vault`, `medlex:ai-settings`, `medlex:ai-consent` e `medlex:ai-grading-cache`. Elas foram introduzidas pelo schema local 4 e são independentes dos dados de estudo.

## Erros e fallback manual

O cliente trata ausência/bloqueio da chave, consentimento, falta de conexão, erros 400/401/403/404/429/500/503, timeout, CORS, resposta vazia/incompleta e JSON inválido. Erros transitórios têm no máximo uma repetição curta; autenticação não é repetida. Uma saída estruturada inválida recebe uma única nova tentativa com saída menor. Não há troca de modelo.

Em qualquer falha, o simulado ou a prática inteira entra em correção manual, sem aplicar resultados parciais. Para diagnosticar:

1. confirme que a chave está desbloqueada e o consentimento ativo;
2. use **Testar conexão**;
3. confira cota, disponibilidade do modelo e conexão;
4. recarregue para atualizar os arquivos em cache;
5. verifique o console apenas por códigos genéricos — credenciais nunca devem ser registradas.

## Manutenção

O modelo está definido uma única vez em `GEMINI_MODEL`, em `js/ai-grading.mjs`. Alterá-lo exige confirmar suporte a Interactions e saída estruturada, atualizar a documentação, incrementar `CONTENT_VERSION` e testar sem fallback automático.

Qualquer mudança nas instruções ou semântica do pedido incrementa `AI_GRADING_PROMPT_VERSION`. Qualquer mudança no contrato JSON de saída incrementa `AI_GRADING_SCHEMA_VERSION`. Isso também invalida o cache relacionado.

Para adicionar uma questão corrigível:

1. transcreva a resposta esperada fielmente da fonte;
2. crie critérios com IDs únicos e pontos positivos;
3. garanta que a soma da rubrica seja igual ao máximo ou que a fonte forneça uma escala holística explícita;
4. declare `gradingMode: "ai_or_manual"`, `answerLanguage` e, quando aplicável, `gradingType: "holistic"`;
5. adicione variantes/trecho somente quando documentados;
6. execute a auditoria e os testes de schema;
7. mantenha o fallback manual.

As regras de desenvolvimento ficam também em `AGENTS.md`, e a situação atual dos conteúdos está em `reports/ai-grading-readiness.md`.
