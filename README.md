# NEXO — Cursos e aprendizagem

Criação, edição e eliminação de cursos por formadores; inscrições; aulas; progresso persistente; perguntas de escolha múltipla e pontuação calculada no servidor.

Esta pasta é uma etapa reconstruída para simular a evolução técnica do projeto. Não é um arquivo histórico de uma entrega anterior.

## Executar

Requer Node.js 24 ou superior e npm. Executa `start.bat`, que instala as dependências em falta e inicia os serviços. Abre http://127.0.0.1:5184. Mantém a janela aberta e termina com Ctrl+C.

Em alternativa, executa `node iniciar.cjs`. Para compilar a interface: `npm --prefix frontend run build`.

## Dados e sessão

A base de dados SQLite é criada em `backend/data/nexo.db`. Cada etapa conserva os seus próprios dados. A sessão fica em sessionStorage; o segredo JWT é gerado localmente em `backend/data/.session-secret`, ou pode ser definido em `backend/.env`. A aplicação destina-se a demonstração local. Na versão atual (etapa 06), a persistência é PostgreSQL.

Não existem contas pré-registadas. Cria uma conta no ecrã Entrar.

Para testar como formador, regista uma conta e executa na pasta backend:

```powershell
npm run creator -- email@exemplo.pt
```

Termina sessão e volta a entrar. Usa Criar curso para indicar nome, tema, dificuldade, descrição, conteúdo e perguntas. Inscreve uma segunda conta no curso para testar aulas e pontuações. As perguntas de exemplo têm uma resposta correta; não há pagamentos nesta etapa.

## Verificação manual

Cria um curso como formador; inscreve um aluno; conclui uma aula; responde ao teste; atualiza a página e confirma o progresso e a melhor pontuação. Uma conta não inscrita não deve aceder às aulas.

## Testes automatizados

Depois de instalar as dependências, executa `npm --prefix backend test`. Os testes exercitam os handlers e a base de dados em memória, incluindo as permissões. Não abrem portas e não alteram as contas locais.
