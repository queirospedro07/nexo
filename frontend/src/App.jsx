import { Brand, ThemeButton, Hero, CourseCover, Sidebar, PageFooter } from './Presentation';
import React, { useEffect, useState } from 'react';
import { request } from './api';

import './styles.css';
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return route;
}
function Account({ user, onUser, notify }) {
  const [register, setRegister] = useState(location.hash === '#/register'),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (user) {
        onUser(await request('/profile', { method: 'PATCH', body: JSON.stringify(data) }));
        notify('Perfil atualizado.');
      } else {
        const result = await request('/auth/' + (register ? 'register' : 'login'), {
          method: 'POST',
          body: JSON.stringify(data),
        });
        sessionStorage.setItem('nexo_session', result.token);
        onUser(result.user);
        notify('Sessão iniciada.');
      }
    } catch (error) {
      notify(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={'panel ' + (user ? 'profile-panel' : 'auth')}>
      {!user && <Brand />}
      <h2>{user ? 'O meu perfil' : register ? 'Criar conta' : 'Entrar na NEXO'}</h2>
      {!user && (
        <p className="account-description">
          Aceda à sua conta e continue o seu percurso de aprendizagem.
        </p>
      )}
      <form
        key={user?.id || String(register)}
        onSubmit={submit}
      >
        {(user || register) && (
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={user?.name || ''}
              autoComplete="name"
            />
          </label>
        )}
        {user ? (
          <>
            <p>{user.email}</p>
            <label>
              Biografia
              <textarea
                name="bio"
                maxLength={1000}
                defaultValue={user.bio}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={200}
                autoComplete="email"
              />
            </label>
            <label>
              Palavra-passe
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : 1}
                maxLength={72}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
            </label>
          </>
        )}
        <button disabled={busy}>
          {busy ? 'A guardar…' : user ? 'Guardar perfil' : register ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      {!user && (
        <p>
          <button
            className="secondary"
            onClick={() => setRegister(!register)}
          >
            {register ? 'Já tenho conta' : 'Ainda não tenho conta'}
          </button>
        </p>
      )}
    </section>
  );
}

function CourseEditor({ id, onSaved, notify }) {
  const [course, setCourse] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (id)
      request('/creator/courses/' + id)
        .then(setCourse)
        .catch((e) => notify(e.message, true));
  }, [id]);
  if (id && !course) return <p role="status">A carregar curso…</p>;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const questions = values.questions
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('|').map((p) => p.trim());
          const correct = Number(parts.pop()) - 1;
          return { prompt: parts.shift(), options: parts, correct };
        });
      const result = await request('/courses' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ ...values, questions }),
      });
      notify(id ? 'Curso atualizado.' : 'Curso criado.');
      onSaved(id || result.id);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{id ? 'Editar curso' : 'Criar curso'}</h2>
      <form
        key={id || 'new'}
        onSubmit={submit}
      >
        <div className="split">
          <label>
            Nome do curso
            <input
              name="title"
              required
              maxLength={150}
              defaultValue={course?.title}
            />
          </label>
          <label>
            Tema
            <input
              name="theme"
              required
              maxLength={80}
              defaultValue={course?.theme}
            />
          </label>
        </div>
        <label>
          Dificuldade
          <select
            name="difficulty"
            defaultValue={course?.difficulty || 'Iniciante'}
          >
            <option>Iniciante</option>
            <option>Intermédio</option>
            <option>Avançado</option>
          </select>
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            required
            maxLength={2000}
            defaultValue={course?.description}
          />
        </label>
        <label>
          Conteúdo da aula
          <textarea
            name="content"
            required
            maxLength={10000}
            defaultValue={course?.content}
          />
        </label>
        <label>
          Perguntas e respostas
          <textarea
            name="questions"
            required
            defaultValue={course?.questions
              .map((q) => [q.prompt, ...q.options, q.correct + 1].join(' | '))
              .join('\n')}
            placeholder="O que estrutura uma página? | HTML | CSS | 1"
          />
        </label>
        <p className="muted">
          Uma pergunta por linha. Separa a pergunta, as opções e o número da resposta certa com |.
          Exemplo: O que estrutura uma página? | HTML | CSS | 1. Editar perguntas reinicia as
          pontuações deste curso.
        </p>
        <button disabled={busy}>{busy ? 'A guardar…' : 'Guardar curso'}</button>
      </form>
    </section>
  );
}
function Learning({ course, notify }) {
  const [learning, setLearning] = useState(null),
    [error, setError] = useState(''),
    [answers, setAnswers] = useState({}),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () =>
    request('/courses/' + course.id + '/learning').then((data) => {
      setLearning(data);
      setError('');
    });
  useEffect(() => {
    let active = true;
    request('/courses/' + course.id + '/learning')
      .then((data) => {
        if (active) {
          setLearning(data);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [course.id]);
  async function enroll() {
    setBusy(true);
    try {
      await request('/courses/' + course.id + '/enroll', { method: 'POST' });
      await load();
      notify('Inscrição concluída.');
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function complete(lesson) {
    setBusy(true);
    try {
      await request('/courses/' + course.id + '/lessons/' + lesson.id, {
        method: 'PUT',
        body: JSON.stringify({ completed: !lesson.completed }),
      });
      await load();
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function evaluate(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await request('/courses/' + course.id + '/answers', {
        method: 'POST',
        body: JSON.stringify({
          answers: learning.questions.map((q) => ({ id: q.id, answer: Number(answers[q.id]) })),
        }),
      });
      setResult(data);
      await load();
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  if (!learning)
    return (
      <section className="panel">
        <p role="status">{error || 'A carregar aprendizagem…'}</p>
        {error && (
          <button
            disabled={busy}
            onClick={enroll}
          >
            Inscrever-me gratuitamente
          </button>
        )}
      </section>
    );
  const completed = learning.lessons.filter((l) => l.completed).length;
  return (
    <>
      <section className="panel">
        <h2>As tuas aulas</h2>
        <p>
          {completed} de {learning.lessons.length} aulas concluídas
        </p>
        <progress
          className="progress"
          max={learning.lessons.length || 1}
          value={completed}
          aria-label="Progresso nas aulas"
        />
        {learning.lessons.map((l) => (
          <article key={l.id}>
            <h3>{l.title}</h3>
            <p className="lesson">{l.content}</p>
            <button
              disabled={busy}
              className={l.completed ? 'secondary' : ''}
              onClick={() => complete(l)}
            >
              {l.completed ? 'Marcar como não concluída' : 'Concluir aula'}
            </button>
          </article>
        ))}
      </section>
      <section className="panel section-title">
        <h2>Testa os teus conhecimentos</h2>
        <p>
          Melhor pontuação: {learning.best === null ? 'ainda sem tentativas' : learning.best + '%'}
        </p>
        <form onSubmit={evaluate}>
          {learning.questions.map((q, index) => (
            <fieldset key={q.id}>
              <legend>
                {index + 1}. {q.prompt}
              </legend>
              {q.options.map((option, i) => (
                <label
                  className="choice"
                  key={i}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={i}
                    required
                    checked={answers[q.id] === String(i)}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="actions">
            <button disabled={busy}>Submeter respostas</button>
          </div>
        </form>
        {result && (
          <p role="status">
            Pontuação: {result.score}% — {result.correct} de {result.total} respostas certas.
          </p>
        )}
      </section>
    </>
  );
}

export default function App() {
  const route = useRoute();
  const [courses, setCourses] = useState([]),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(''),
    [theme, setTheme] = useState(''),
    [notice, setNotice] = useState(null);
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true);
  const notify = (text, error = false) => setNotice({ text, error });
  const refresh = () =>
    request('/courses')
      .then(setCourses)
      .catch((e) => notify(e.message, true))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    setNotice(null);
    window.scrollTo(0, 0);
  }, [route]);
  useEffect(() => {
    let active = true;
    const expired = () => {
      setUser(null);
      notify('A sessão terminou. Volta a entrar.', true);
    };
    window.addEventListener('session-expired', expired);
    if (sessionStorage.getItem('nexo_session'))
      request('/profile')
        .then((u) => {
          if (active) setUser(u);
        })
        .catch((e) => {
          if (active) notify(e.message, true);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    else setChecking(false);
    return () => {
      active = false;
      window.removeEventListener('session-expired', expired);
    };
  }, []);
  function logout() {
    sessionStorage.removeItem('nexo_session');
    setUser(null);
    location.hash = '/account';
  }

  const courseId = route.startsWith('/course/') ? route.split('/')[2] : null;
  const selected = courses.find((c) => c.id === courseId);
  const filtered = courses.filter(
    (c) =>
      (!theme || c.theme === theme) &&
      (c.title + ' ' + c.description)
        .toLocaleLowerCase('pt-PT')
        .includes(search.toLocaleLowerCase('pt-PT')),
  );
  return (
    <>
      <header>
        <nav aria-label="Navegação principal">
          <Brand />
          <div className="links">
            <a href="#/courses">Explorar cursos</a>
            <a href="#/account">{user ? user.name : 'Iniciar sessão'}</a>
            {user?.role === 'CREATOR' && <a href="#/create">Criar curso</a>}
            {user && (
              <button
                className="secondary"
                onClick={logout}
              >
                Sair
              </button>
            )}
            <ThemeButton />
            {!user && (
              <a
                className="button"
                href="#/register"
              >
                Criar Conta <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
        </nav>
      </header>
      {user && route !== '/' && (
        <Sidebar
          user={user}
          route={route}
          learning
        />
      )}
      <main
        className={
          'page-main ' +
          (route === '/'
            ? 'landing-main'
            : (route === '/account' || route === '/register') && !user
              ? 'auth-main'
              : 'workspace-main') +
          (user && route !== '/' ? ' has-sidebar' : '')
        }
      >
        {notice && (
          <div
            className={'notice' + (notice.error ? ' error' : '')}
            role={notice.error ? 'alert' : 'status'}
          >
            {notice.text}
          </div>
        )}
        {checking ? (
          <p role="status">A verificar sessão…</p>
        ) : route === '/account' || route === '/register' ? (
          <Account
            key={(user?.id || 'guest') + route}
            user={user}
            onUser={setUser}
            notify={notify}
          />
        ) : route === '/create' || route.startsWith('/edit/') ? (
          user?.role === 'CREATOR' ? (
            <CourseEditor
              key={route}
              id={route.startsWith('/edit/') ? route.split('/')[2] : null}
              notify={notify}
              onSaved={async (id) => {
                await refresh();
                location.hash = '/course/' + id;
              }}
            />
          ) : (
            <p>É necessário iniciar sessão como formador.</p>
          )
        ) : courseId ? (
          loading ? (
            <p role="status">A carregar curso…</p>
          ) : selected ? (
            <>
              <a href="#/courses">← Voltar aos cursos</a>
              <h1>{selected.title}</h1>
              <span className="tag">{selected.theme}</span>
              <span className="tag">{selected.difficulty}</span>
              <p>{selected.description}</p>
              {user ? (
                <Learning
                  key={user.id + selected.id}
                  course={selected}
                  notify={notify}
                />
              ) : (
                <a
                  className="button"
                  href="#/account"
                >
                  Entrar para me inscrever
                </a>
              )}
              {user?.id === selected.creator_id && (
                <div className="actions">
                  <a
                    className="button secondary"
                    href={'#/edit/' + selected.id}
                  >
                    Editar curso
                  </a>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (!confirm('Eliminar este curso, inscrições e pontuações?')) return;
                      try {
                        await request('/courses/' + selected.id, { method: 'DELETE' });
                        await refresh();
                        location.hash = '/courses';
                      } catch (e) {
                        notify(e.message, true);
                      }
                    }}
                  >
                    Eliminar curso
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>
              Curso não encontrado. <a href="#/courses">Voltar ao catálogo</a>
            </p>
          )
        ) : (
          <>
            {route === '/' && (
              <Hero
                accounts
                learning
              />
            )}
            <section>
              <div className="row catalogue-heading">
                <div>
                  <h2>Explore o Conhecimento</h2>
                  <p>Encontre cursos para desenvolver as suas competências.</p>
                </div>
                <span className="muted">{filtered.length} cursos disponíveis</span>
              </div>
              <div className="toolbar">
                <input
                  type="search"
                  aria-label="Pesquisar cursos"
                  placeholder="O que queres aprender?"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filtrar por tema"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="">Todos os temas</option>
                  {[...new Set(courses.map((c) => c.theme))].sort().map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              {loading ? (
                <p role="status">A carregar cursos…</p>
              ) : (
                <div className="grid">
                  {filtered.map((c, i) => (
                    <article
                      className="card"
                      key={c.id}
                    >
                      <CourseCover course={c} />
                      <div className="course-kind">
                        <span>{c.difficulty}</span>
                        <span>Auto-estudo</span>
                      </div>
                      <h3>{c.title}</h3>
                      <p>{c.description}</p>
                      <a
                        className="button secondary"
                        href={'#/course/' + c.id}
                      >
                        Ver curso →
                      </a>
                    </article>
                  ))}
                </div>
              )}
              {!loading && !filtered.length && (
                <p className="empty">Não foram encontrados cursos. Experimenta outra pesquisa.</p>
              )}
            </section>
          </>
        )}
      </main>
      <PageFooter
        accounts
        sidebar={Boolean(user && route !== '/')}
      />
    </>
  );
}
