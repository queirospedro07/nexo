import React, { useEffect, useState, useRef } from 'react';
export function Icon({ name, ...props }) {
  const paths = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    book: 'M4 4h6c2 0 2 1 2 2v15c0-2-2-3-4-3H4V4Zm16 0h-6c-2 0-2 1-2 2v15c0-2 2-3 4-3h4V4Z',
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2 6-6 2 2-6 6-2Z',
    check: 'm5 12 4 4L19 6',
    moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
    user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-2a7 7 0 0 1 14 0v2',
    plus: 'M12 5v14M5 12h14',
    users:
      'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 20v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2',
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
export function Brand() {
  return (
    <a
      className="brand"
      href="#/"
      aria-label="NEXO — página inicial"
    >
      <img
        src="/favicon.svg"
        alt=""
      />
      <span>NEXO</span>
      <i className="brand-dot" />
    </a>
  );
}
export function ThemeButton() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('nexo_visual_theme') === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('nexo_visual_theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  return (
    <button
      className="theme-toggle"
      onClick={() => setDark(!dark)}
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title="Alternar tema"
    >
      <Icon name={dark ? 'moon' : 'sun'} />
    </button>
  );
}
export function Hero({ accounts = false, learning = false, community = false }) {
  const video = useRef(null);
  useEffect(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      video.current?.play().catch(() => {});
  }, []);
  return (
    <>
      <section className="hero">
        <div className="hero-media">
          <video
            ref={video}
            poster="/hero-showcase.jpg"
            src="/video.mp4"
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="Apresentação da plataforma NEXO"
          />
        </div>
        <div className="hero-text">
          <h1>Aprenda, construa e evolua.</h1>
          <p>
            Uma plataforma pensada para estudar ao seu ritmo: descubra cursos práticos, desenvolva
            novas competências
            {community
              ? ' e aprenda com a comunidade.'
              : learning
                ? ' e acompanhe o seu progresso.'
                : ', um passo de cada vez.'}
          </p>
          <div className="actions">
            {accounts && (
              <a
                className="button"
                href="#/register"
              >
                Criar Conta Gratuita <Icon name="arrow" />
              </a>
            )}
            <a
              className={'button' + (accounts ? ' secondary' : '')}
              href="#/courses"
            >
              <Icon name="compass" />
              Explorar Catálogo
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <Icon name="check" />
              Acesso flexível
            </span>
            <span>
              <Icon name="check" />
              {community ? 'Comunidade de aprendizagem' : 'Aprendizagem ao seu ritmo'}
            </span>
          </div>
        </div>
      </section>
      <div className="feature-strip">
        <div>
          <span>Acesso</span>
          <strong>Cursos e recursos online</strong>
        </div>
        <div>
          <span>Conhecimento</span>
          <strong>Conteúdos organizados</strong>
        </div>
        <div>
          <span>{learning ? 'Progresso' : 'Descoberta'}</span>
          <strong>{learning ? 'Acompanhe a sua evolução' : 'Encontre o próximo curso'}</strong>
        </div>
        <div>
          <span>Aprendizagem</span>
          <strong>Ao seu ritmo</strong>
        </div>
      </div>
    </>
  );
}
export function CourseCover({ course, community = false }) {
  return (
    <div className="visual">
      <img
        src="/hero-showcase.jpg"
        alt=""
        loading="lazy"
      />
      <div className="cover-gradient" />
      <span className="cover-badge">
        <Icon name="book" />
        {course.theme}
      </span>
      <span className="cover-badge price">Gratuito</span>
      <span className="cover-bottom">
        <Icon name={community ? 'users' : 'book'} />
        {community ? 'Comunidade' : 'Auto-estudo'}
      </span>
    </div>
  );
}
export function Sidebar({ user, route, learning = false }) {
  return (
    <aside
      className="sidebar"
      aria-label="Área pessoal"
    >
      <span className="sidebar-label">A sua aprendizagem</span>
      <a
        className={route === '/courses' || route.startsWith('/course/') ? 'active' : ''}
        href="#/courses"
      >
        <Icon name="compass" />
        Explorar cursos
      </a>
      <a
        className={route === '/account' ? 'active' : ''}
        href="#/account"
      >
        <Icon name="user" />O meu perfil
      </a>
      {learning && user.role === 'CREATOR' && (
        <>
          <span
            className="sidebar-label"
            style={{ marginTop: 25 }}
          >
            Estúdio do criador
          </span>
          <a
            className={route === '/create' || route.startsWith('/edit/') ? 'active' : ''}
            href="#/create"
          >
            <Icon name="plus" />
            Criar um curso
          </a>
        </>
      )}
      <div className="sidebar-note">
        <strong>Um passo de cada vez.</strong>
        <p>Continue a explorar e desenvolva novas competências ao seu ritmo.</p>
      </div>
    </aside>
  );
}
export function PageFooter({ accounts = false, sidebar = false }) {
  return (
    <footer className={'site-footer' + (sidebar ? ' with-sidebar' : '')}>
      <div className="footer-content">
        <div>
          <Brand />
          <p>Aprenda, partilhe e evolua. O seu próximo passo começa com conhecimento.</p>
        </div>
        <div className="footer-links">
          <a href="#/courses">Explorar catálogo</a>
          {accounts && <a href="#/account">A minha conta</a>}
          <a href="#/">Página inicial</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>NEXO · Plataforma de aprendizagem e comunidade</span>
        <span>Conhecimento que aproxima.</span>
      </div>
    </footer>
  );
}
