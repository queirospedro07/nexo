const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app.cjs');

function dispatch(instance, route, method = 'GET', body = {}, token, expected = 200) {
  const url = new URL('/api' + route, 'http://localhost');
  const layer = instance.app._router.stack.find(
    (layer) =>
      layer.route && layer.route.methods[method.toLowerCase()] && layer.match(url.pathname),
  );
  assert(layer, 'Rota não encontrada: ' + route);
  const req = {
    method,
    url: url.pathname,
    params: layer.params,
    body,
    headers: token ? { authorization: 'Bearer ' + token } : {},
    query: Object.fromEntries(url.searchParams),
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pedido sem resposta: ' + route)), 5000);
    const finish = (data) => {
      clearTimeout(timer);
      try {
        assert.equal(res.statusCode, expected, JSON.stringify(data));
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    res.json = finish;
    res.end = () => finish(null);
    layer.route.dispatch(req, res, (error) => {
      clearTimeout(timer);
      reject(error || new Error('Sem resposta'));
    });
  });
}

test('registo, sessão e edição de perfil sem elevação de privilégios', async () => {
  const instance = createApp({
    databasePath: ':memory:',
    secret: 'segredo-exclusivo-dos-testes-com-mais-de-32-caracteres',
  });
  try {
    const call = (...args) => dispatch(instance, ...args);
    await call('/profile', 'GET', {}, null, 401);
    await call(
      '/auth/register',
      'POST',
      { name: 'Aluno', email: 'inválido', password: 'curta' },
      null,
      400,
    );
    const account = { name: 'Aluno', email: 'aluno@example.test', password: 'palavra-passe-2026' };
    const session = await call('/auth/register', 'POST', account, null, 201);
    await call('/auth/register', 'POST', account, null, 409);
    await call('/auth/login', 'POST', { email: account.email, password: 'errada' }, null, 401);
    assert.equal((await call('/auth/login', 'POST', account)).user.id, session.user.id);
    assert(!('password_hash' in session.user));
    await call(
      '/profile',
      'PATCH',
      { name: 'Novo nome', bio: 'Biografia', role: 'CREATOR' },
      session.token,
    );
    const profile = await call('/profile', 'GET', {}, session.token);
    assert.equal(profile.name, 'Novo nome');
    assert.equal(profile.role, 'STUDENT');

    await call('/courses/web/learning', 'GET', {}, session.token, 403);
    await call('/courses', 'POST', {}, session.token, 403);
    await call('/courses/web/enroll', 'POST', {}, session.token);
    await call('/courses/web/enroll', 'POST', {}, session.token);
    assert.equal((await call('/enrollments', 'GET', {}, session.token)).length, 1);
    const learning = await call('/courses/web/learning', 'GET', {}, session.token);
    assert(!('correct' in learning.questions[0]));
    await call(
      '/courses/web/lessons/' + learning.lessons[0].id,
      'PUT',
      { completed: true },
      session.token,
    );
    assert.equal(
      (await call('/courses/web/learning', 'GET', {}, session.token)).lessons[0].completed,
      1,
    );
    await call('/courses/web/answers', 'POST', { answers: [] }, session.token, 400);
    const answer = [{ id: learning.questions[0].id, answer: 0 }];
    assert.equal(
      (await call('/courses/web/answers', 'POST', { answers: answer }, session.token)).score,
      100,
    );
    await call(
      '/courses/web/answers',
      'POST',
      { answers: [{ ...answer[0], answer: 1 }] },
      session.token,
    );
    assert.equal((await call('/courses/web/learning', 'GET', {}, session.token)).best, 100);
    const author = await call(
      '/auth/register',
      'POST',
      { name: 'Formador', email: 'autor@example.test', password: account.password },
      null,
      201,
    );
    instance.db.prepare("UPDATE users SET role = 'CREATOR' WHERE id = ?").run(author.user.id);
    const course = {
      title: 'Curso',
      theme: 'Programação',
      difficulty: 'Iniciante',
      description: 'Descrição',
      content: 'Conteúdo',
      questions: [{ prompt: 'Quanto é 1+1?', options: ['2', '3'], correct: 0 }],
    };
    const created = await call('/courses', 'POST', course, author.token, 201);
    await call('/courses/' + created.id, 'PUT', course, session.token, 403);
    await call('/courses/' + created.id, 'DELETE', {}, session.token, 403);
    await call(
      '/courses/' + created.id,
      'PUT',
      { ...course, title: 'Curso atualizado' },
      author.token,
    );
    assert.equal((await call('/courses/' + created.id)).title, 'Curso atualizado');
    await call('/courses/' + created.id, 'DELETE', {}, author.token, 204);
  } finally {
    instance.close();
  }
});
