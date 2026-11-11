// Einstieg: Navigation, Rahmen, Start.
import { html, render, useState, useEffect, cx } from './lib.js';
import { useStore, boot } from './store.js';
import { Icon, ConfirmHost, ToastHost, LightboxHost } from './ui.js';
import { openSettings } from './sheets.js';
import { Overview } from './views/overview.js';
import { Rooms, RoomDetail } from './views/rooms.js';
import { Budget } from './views/budget.js';
import { Todos } from './views/todos.js';
import { Umzug } from './views/umzug.js';
import {
  Splash, Setup, Login, NameScreen, Denied, ErrorScreen,
} from './views/start.js';

const NAV = [
  { key: 'start', href: '#/', label: 'Übersicht', icon: 'home' },
  { key: 'raeume', href: '#/raeume', label: 'Räume', icon: 'rooms' },
  { key: 'budget', href: '#/budget', label: 'Budget', icon: 'wallet' },
  { key: 'todos', href: '#/todos', label: 'To-Dos', icon: 'todo' },
  { key: 'umzug', href: '#/umzug', label: 'Umzug', icon: 'truck' },
];

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const key = NAV.some((n) => n.key === parts[0]) ? parts[0] : 'start';
  return { key, id: parts[1] || null };
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Page({ route }) {
  switch (route.key) {
    case 'raeume':
      return route.id ? html`<${RoomDetail} key=${route.id} id=${route.id} />` : html`<${Rooms} />`;
    case 'budget':
      return html`<${Budget} />`;
    case 'todos':
      return html`<${Todos} />`;
    case 'umzug':
      return html`<${Umzug} sub=${route.id} />`;
    default:
      return html`<${Overview} />`;
  }
}

function Shell() {
  const s = useStore();
  const route = useRoute();
  useEffect(() => {
    const onOpen = () => openSettings();
    window.addEventListener('wohnung:einstellungen', onOpen);
    return () => window.removeEventListener('wohnung:einstellungen', onOpen);
  }, []);
  return html`<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/">
        <span class="brand-mark"><${Icon} name="home" size=${20} /></span>
        <span><span class="brand-name">Unsere Wohnung</span><span class="brand-sub">${s.settings.address || 'München'}</span></span>
      </a>
      <nav class="side-nav" aria-label="Bereiche">
        ${NAV.map((n) => html`<a key=${n.key} href=${n.href} class=${cx('side-link', route.key === n.key && 'on')}
          aria-current=${route.key === n.key ? 'page' : null}><${Icon} name=${n.icon} />${n.label}</a>`)}
      </nav>
      <div class="side-foot">
        ${s.mode === 'demo' && html`<div class="demo-pill">Demo-Modus</div>`}
        <button class="side-link" onClick=${openSettings}><${Icon} name="settings" />Einstellungen</button>
      </div>
    </aside>
    <main class="main">
      ${s.mode === 'demo' && html`<div class="demo-bar">Demo · Daten nur in diesem Browser</div>`}
      <${Page} route=${route} />
    </main>
    <nav class="tabbar" aria-label="Bereiche">
      ${NAV.map((n) => html`<a key=${n.key} href=${n.href} class=${cx('tab', route.key === n.key && 'on')}
        aria-current=${route.key === n.key ? 'page' : null}><${Icon} name=${n.icon} size=${22} /><span>${n.label}</span></a>`)}
    </nav>
  </div>`;
}

function App() {
  const s = useStore();
  const screens = {
    boot: Splash, setup: Setup, login: Login, name: NameScreen, denied: Denied, error: ErrorScreen,
  };
  const Screen = screens[s.phase] || Shell;
  return html`<${Screen} />${s.sheet && s.sheet()}<${ConfirmHost} /><${ToastHost} /><${LightboxHost} />`;
}

render(html`<${App} />`, document.getElementById('app'));
boot();
