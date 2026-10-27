const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const catalogue = require('./catalogue.json');

function createApp({ databasePath = path.resolve(__dirname, '../data/nexo.db'), secret } = {}) {
  if (!secret || secret.length < 32)
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const find = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const transaction = (fn) => {
    db.exec('BEGIN');
    try {
      const value = fn();
      db.exec('COMMIT');
      return value;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  for (const c of catalogue) {
    const inserted = run(
      'INSERT OR IGNORE INTO courses (id, title, theme, difficulty, description) VALUES (?, ?, ?, ?, ?)',
      c.id,
      c.title,
      c.theme,
      c.difficulty,
      c.description,
    );
    if (inserted.changes) {
      run(
        'INSERT INTO lessons (id, course_id, title, content) VALUES (?, ?, ?, ?)',
        c.id + '-intro',
        c.id,
        'Introdução',
        c.content,
      );
      run(
        'INSERT INTO questions (id, course_id, prompt, options, correct) VALUES (?, ?, ?, ?, ?)',
        c.id + '-q1',
        c.id,
        c.question,
        JSON.stringify(c.options),
        c.correct,
      );
    }
  }
  const app = express();
  for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
    const original = app[method].bind(app);
    app[method] = (...args) =>
      original(
        ...args.map((arg) =>
          typeof arg === 'function' && arg.constructor.name === 'AsyncFunction'
            ? (req, res, next) => Promise.resolve(arg(req, res, next)).catch(next)
            : arg,
        ),
      );
  }
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300 }));
  app.use('/api/auth', rateLimit({ windowMs: 60000, limit: 25 }));
  const userView = (u) => ({ id: u.id, name: u.name, email: u.email, bio: u.bio, role: u.role });
  const issue = (u) => ({
    user: userView(u),
    token: jwt.sign({}, secret, { subject: u.id, expiresIn: '4h', algorithm: 'HS256' }),
  });
  function authenticate(req, res, next) {
    try {
      const payload = jwt.verify(
        (req.headers.authorization || '').replace(/^Bearer /, ''),
        secret,
        { algorithms: ['HS256'] },
      );
      req.user = find('SELECT * FROM users WHERE id = ?', payload.sub);
      if (!req.user) throw new Error();
      next();
    } catch {
      res.status(401).json({ message: 'Inicia sessão para continuar.' });
    }
  }
  const text = (value, max = 200) =>
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'sqlite' }));
  app.get('/api/courses', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 150) : '';
    const theme = typeof req.query.theme === 'string' ? req.query.theme : '';
    res.json(
      all(
        "SELECT id, title, theme, difficulty, description, creator_id FROM courses WHERE (title LIKE ? OR description LIKE ?) AND (? = '' OR theme = ?) ORDER BY title",
        '%' + search + '%',
        '%' + search + '%',
        theme,
        theme,
      ),
    );
  });
  app.get('/api/courses/:id', (req, res) => {
    const course = find('SELECT * FROM courses WHERE id = ?', req.params.id);
    if (!course) return res.status(404).json({ message: 'Curso não encontrado.' });
    res.json(course);
  });
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (
      !text(name, 100) ||
      !text(email, 200) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' ||
      password.length < 10 ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      return res
        .status(400)
        .json({
          message: 'Preenche o nome, um email válido e uma palavra-passe entre 10 e 72 caracteres.',
        });
    const normalized = email.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 12);
    try {
      const id = randomUUID();
      run(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        id,
        name.trim(),
        normalized,
        hash,
      );
      res.status(201).json(issue(find('SELECT * FROM users WHERE id = ?', id)));
    } catch (error) {
      if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(error.message))
        return res.status(409).json({ message: 'Este email já está registado.' });
      throw error;
    }
  });
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (
      !text(email, 200) ||
      typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      return res.status(400).json({ message: 'Dados inválidos.' });
    const user = find('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase());
    const valid = await bcrypt.compare(
      password,
      user?.password_hash || '$2a$12$111111111111111111111uQFjGRW.4UjBNY8YKKCtbvtV1j1jPNFSu',
    );
    if (!user || !valid)
      return res.status(401).json({ message: 'Email ou palavra-passe incorretos.' });
    res.json(issue(user));
  });
  app.get('/api/profile', authenticate, (req, res) => res.json(userView(req.user)));
  app.patch('/api/profile', authenticate, (req, res) => {
    if (!text(req.body.name, 100) || typeof req.body.bio !== 'string' || req.body.bio.length > 1000)
      return res.status(400).json({ message: 'Perfil inválido.' });
    run(
      'UPDATE users SET name = ?, bio = ? WHERE id = ?',
      req.body.name.trim(),
      req.body.bio.trim(),
      req.user.id,
    );
    res.json(userView(find('SELECT * FROM users WHERE id = ?', req.user.id)));
  });

  function enrolled(userId, courseId) {
    return find('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?', userId, courseId);
  }
  function requireEnrollment(req, res, next) {
    if (!enrolled(req.user.id, req.params.id))
      return res.status(403).json({ message: 'Inscreve-te no curso para aceder.' });
    next();
  }
  function validateCourse(body) {
    return (
      text(body.title, 150) &&
      text(body.theme, 80) &&
      ['Iniciante', 'Intermédio', 'Avançado'].includes(body.difficulty) &&
      text(body.description, 2000) &&
      text(body.content, 10000) &&
      Array.isArray(body.questions) &&
      body.questions.length >= 1 &&
      body.questions.length <= 20 &&
      body.questions.every(
        (q) =>
          text(q.prompt, 500) &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          q.options.length <= 6 &&
          q.options.every((o) => text(o, 300)) &&
          Number.isInteger(q.correct) &&
          q.correct >= 0 &&
          q.correct < q.options.length,
      )
    );
  }
  function saveQuestions(courseId, questions) {
    run('DELETE FROM questions WHERE course_id = ?', courseId);
    for (const q of questions)
      run(
        'INSERT INTO questions (id, course_id, prompt, options, correct) VALUES (?, ?, ?, ?, ?)',
        randomUUID(),
        courseId,
        q.prompt.trim(),
        JSON.stringify(q.options.map((o) => o.trim())),
        q.correct,
      );
  }
  app.post('/api/courses', authenticate, (req, res) => {
    if (req.user.role !== 'CREATOR')
      return res.status(403).json({ message: 'Apenas os formadores podem criar cursos.' });
    if (!validateCourse(req.body))
      return res.status(400).json({ message: 'Revê os dados do curso e as perguntas.' });
    const id = randomUUID(),
      c = req.body;
    transaction(() => {
      run(
        'INSERT INTO courses (id, title, theme, difficulty, description, creator_id) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        c.title.trim(),
        c.theme.trim(),
        c.difficulty,
        c.description.trim(),
        req.user.id,
      );
      run(
        'INSERT INTO lessons (id, course_id, title, content) VALUES (?, ?, ?, ?)',
        randomUUID(),
        id,
        'Introdução',
        c.content.trim(),
      );
      saveQuestions(id, c.questions);
    });
    res.status(201).json({ id });
  });
  app.get('/api/creator/courses/:id', authenticate, (req, res) => {
    const c = find(
      'SELECT * FROM courses WHERE id = ? AND creator_id = ?',
      req.params.id,
      req.user.id,
    );
    if (!c) return res.status(404).json({ message: 'Curso não encontrado.' });
    const lesson = find(
      'SELECT content FROM lessons WHERE course_id = ? ORDER BY rowid LIMIT 1',
      c.id,
    );
    res.json({
      ...c,
      content: lesson?.content || '',
      questions: all('SELECT * FROM questions WHERE course_id = ? ORDER BY rowid', c.id).map(
        (q) => ({ ...q, options: JSON.parse(q.options) }),
      ),
    });
  });
  app.put('/api/courses/:id', authenticate, (req, res) => {
    if (!find('SELECT 1 FROM courses WHERE id = ? AND creator_id = ?', req.params.id, req.user.id))
      return res.status(403).json({ message: 'Não podes editar este curso.' });
    if (!validateCourse(req.body))
      return res.status(400).json({ message: 'Revê os dados do curso.' });
    const c = req.body;
    transaction(() => {
      run(
        'UPDATE courses SET title = ?, theme = ?, difficulty = ?, description = ? WHERE id = ?',
        c.title.trim(),
        c.theme.trim(),
        c.difficulty,
        c.description.trim(),
        req.params.id,
      );
      run('UPDATE lessons SET content = ? WHERE course_id = ?', c.content.trim(), req.params.id);
      saveQuestions(req.params.id, c.questions);
      run('DELETE FROM attempts WHERE course_id = ?', req.params.id);
    });
    res.json({ message: 'Curso atualizado.' });
  });
  app.delete('/api/courses/:id', authenticate, (req, res) => {
    if (!find('SELECT 1 FROM courses WHERE id = ? AND creator_id = ?', req.params.id, req.user.id))
      return res.status(403).json({ message: 'Não podes eliminar este curso.' });
    run('DELETE FROM courses WHERE id = ?', req.params.id);
    res.status(204).end();
  });
  app.post('/api/courses/:id/enroll', authenticate, (req, res) => {
    if (!find('SELECT 1 FROM courses WHERE id = ?', req.params.id))
      return res.status(404).json({ message: 'Curso não encontrado.' });
    run(
      'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
      req.user.id,
      req.params.id,
    );
    res.json({ message: 'Inscrição concluída.' });
  });
  app.get('/api/enrollments', authenticate, (req, res) =>
    res.json(
      all(
        'SELECT c.* FROM courses c JOIN enrollments e ON e.course_id = c.id WHERE e.user_id = ? ORDER BY c.title',
        req.user.id,
      ),
    ),
  );
  app.get('/api/courses/:id/learning', authenticate, requireEnrollment, (req, res) => {
    res.json({
      lessons: all(
        'SELECT l.*, EXISTS(SELECT 1 FROM progress p WHERE p.lesson_id = l.id AND p.user_id = ?) AS completed FROM lessons l WHERE l.course_id = ? ORDER BY l.rowid',
        req.user.id,
        req.params.id,
      ),
      questions: all(
        'SELECT id, prompt, options FROM questions WHERE course_id = ? ORDER BY rowid',
        req.params.id,
      ).map((q) => ({ ...q, options: JSON.parse(q.options) })),
      best:
        find(
          'SELECT MAX(score) AS score FROM attempts WHERE user_id = ? AND course_id = ?',
          req.user.id,
          req.params.id,
        )?.score ?? null,
    });
  });
  app.put('/api/courses/:id/lessons/:lessonId', authenticate, requireEnrollment, (req, res) => {
    if (
      !find(
        'SELECT 1 FROM lessons WHERE id = ? AND course_id = ?',
        req.params.lessonId,
        req.params.id,
      )
    )
      return res.status(404).json({ message: 'Aula não encontrada.' });
    if (typeof req.body.completed !== 'boolean')
      return res.status(400).json({ message: 'Estado inválido.' });
    if (req.body.completed)
      run(
        'INSERT OR IGNORE INTO progress (user_id, lesson_id) VALUES (?, ?)',
        req.user.id,
        req.params.lessonId,
      );
    else
      run(
        'DELETE FROM progress WHERE user_id = ? AND lesson_id = ?',
        req.user.id,
        req.params.lessonId,
      );
    res.json({ completed: req.body.completed });
  });
  app.post('/api/courses/:id/answers', authenticate, requireEnrollment, (req, res) => {
    const questions = all(
      'SELECT * FROM questions WHERE course_id = ? ORDER BY rowid',
      req.params.id,
    );
    const answers = req.body.answers;
    if (
      !questions.length ||
      !Array.isArray(answers) ||
      answers.length !== questions.length ||
      questions.some(
        (q) =>
          !answers.some(
            (a) =>
              a.id === q.id &&
              Number.isInteger(a.answer) &&
              a.answer >= 0 &&
              a.answer < JSON.parse(q.options).length,
          ),
      )
    )
      return res.status(400).json({ message: 'Responde a todas as perguntas.' });
    const correct = questions.filter(
      (q) => answers.find((a) => a.id === q.id).answer === q.correct,
    ).length;
    const score = Math.round((correct / questions.length) * 100);
    run(
      'INSERT INTO attempts (id, user_id, course_id, score) VALUES (?, ?, ?, ?)',
      randomUUID(),
      req.user.id,
      req.params.id,
      score,
    );
    res.json({ score, correct, total: questions.length });
  });

  app.use((_req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
  app.use((error, _req, res, _next) => {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    res
      .status(status)
      .json({ message: status === 500 ? 'Ocorreu um erro interno.' : 'Pedido inválido.' });
  });
  return { app, db, authenticate, find, all, run, close: () => db.close() };
}
module.exports = { createApp };
