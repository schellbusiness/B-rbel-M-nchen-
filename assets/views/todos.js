import { html, useState, cx, daysUntil, taskDue } from '../lib.js';
import { useStore, state, add, memberName } from '../store.js';
import { PageHeader, Icon, Empty, Fab } from '../ui.js';
import { openTaskSheet } from '../sheets.js';
import { TaskRow } from './parts.js';

const GROUPS = [
  { key: 'over', title: 'Überfällig', test: (n) => n < 0 },
  { key: 'today', title: 'Heute', test: (n) => n === 0 },
  { key: 'week', title: 'Nächste 7 Tage', test: (n) => n > 0 && n <= 7 },
  { key: 'later', title: 'Später', test: (n) => n > 7 },
  { key: 'none', title: 'Ohne Datum', test: (n) => n == null },
];

export function Todos() {
  const s = useStore();
  const [who, setWho] = useState('alle');
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const move = s.settings.move_date;

  const visible = (t) => who === 'alle' || !t.assignee || t.assignee === who;
  const todos = s.tasks.filter((t) => !t.phase && visible(t));
  const open = todos.filter((t) => !t.done)
    .map((t) => ({ t, due: taskDue(t, move) }))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.t.sort || 0) - (b.t.sort || 0));
  const done = todos.filter((t) => t.done).sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')));

  const quickAdd = async (e) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setTitle('');
    const maxSort = state.tasks.reduce((m, t) => Math.max(m, t.sort || 0), 0);
    await add('tasks', { title: text, sort: maxSort + 1, done: false, assignee: who === 'alle' ? null : who });
  };

  return html`<div class="page">
    <${PageHeader} title="To-Dos" kicker=${`${open.length} offen`} />

    <form class="quick-add" onSubmit=${quickAdd}>
      <input class="input" placeholder="Neue Aufgabe … (Enter)" value=${title} onInput=${(e) => setTitle(e.currentTarget.value)}
        aria-label="Neue Aufgabe" />
      <button class="btn primary" type="submit" aria-label="Hinzufügen"><${Icon} name="plus" size=${20} /></button>
    </form>

    <div class="filter-row">
      <button class=${cx('filter', who === 'alle' && 'on')} onClick=${() => setWho('alle')}>Alle</button>
      ${s.members.map((m) => html`<button key=${m.id} class=${cx('filter', who === m.id && 'on')} onClick=${() => setWho(m.id)}>
        ${memberName(m.id)}</button>`)}
    </div>

    ${open.length === 0 && html`<${Empty} emoji="✅" title="Nichts offen" text="Neue Aufgaben oben eintippen. Die Umzugs-Checkliste findet ihr unter „Umzug“." />`}

    ${GROUPS.map((g) => {
      const rows = open.filter((x) => g.test(x.due ? daysUntil(x.due) : null));
      if (!rows.length) return null;
      return html`<section key=${g.key} class="section tight">
        <div class=${cx('group-head', g.key === 'over' && 'text-danger')}>${g.title} <span>${rows.length}</span></div>
        <div class="card list">${rows.map((x) => html`<${TaskRow} key=${x.t.id} task=${x.t} />`)}</div>
      </section>`;
    })}

    ${done.length > 0 && html`<section class="section tight">
      <button class="group-head toggle-head" onClick=${() => setShowDone(!showDone)} aria-expanded=${showDone}>
        Erledigt <span>${done.length}</span><${Icon} name="down" size=${16} class=${cx('chev', showDone && 'open')} />
      </button>
      ${showDone && html`<div class="card list">${done.map((t) => html`<${TaskRow} key=${t.id} task=${t} />`)}</div>`}
    </section>`}

    <${Fab} label="Aufgabe" onClick=${() => openTaskSheet(null, { assignee: who === 'alle' ? null : who })} />
  </div>`;
}
