// Bildschirme vor der eigentlichen App: Verbinden, Anmelden, Name, Fehler.
import { html, useState } from '../lib.js';
import {
  state, saveConnection, tryDemo, signIn, signOut, saveMyName, errorText, forgetConnection,
} from '../store.js';
import { Icon } from '../ui.js';

const Logo = () => html`<div class="logo"><svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
  <rect width="64" height="64" rx="16" fill="var(--accent)" />
  <path d="M16 31 32 18l16 13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M21 28v17h22V28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M32 40.5s-5-3-5-6.3a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1c0 3.3-5 6.3-5 6.3z" fill="#fff" />
</svg></div>`;

function Frame({ title, children }) {
  return html`<div class="start">
    <div class="start-card">
      <${Logo} />
      <h1>${title}</h1>
      ${children}
    </div>
  </div>`;
}

export function Splash() {
  return html`<div class="start"><div class="start-card"><${Logo} /><p class="muted">Lädt …</p></div></div>`;
}

export function Setup() {
  const [url, setUrl] = useState(window.WOHNUNG_CONFIG?.supabaseUrl || '');
  const [key, setKey] = useState('');
  const [err, setErr] = useState(state.error);
  const submit = (e) => {
    e.preventDefault();
    setErr(saveConnection(url, key));
  };
  return html`<${Frame} title="Unsere Wohnung">
    <p class="lead">Eure gemeinsame Planung für die neue Wohnung: Räume, Budget, To-Dos und Umzug.</p>
    <form class="form" onSubmit=${submit}>
      <div class="start-section">Mit eurer Datenbank verbinden</div>
      <label class="field"><span class="field-label">Supabase Project URL</span>
        <input class="input" type="url" required placeholder="https://abcdefgh.supabase.co" value=${url}
          onInput=${(e) => setUrl(e.currentTarget.value)} autocomplete="off" /></label>
      <label class="field"><span class="field-label">Supabase Key (anon / publishable)</span>
        <input class="input" required placeholder="eyJhbGciOi… oder sb_publishable_…" value=${key}
          onInput=${(e) => setKey(e.currentTarget.value)} autocomplete="off" /></label>
      ${err && html`<p class="form-error">${err}</p>`}
      <button class="btn primary block" type="submit">Verbinden</button>
    </form>
    <div class="or"><span>oder</span></div>
    <button class="btn block" onClick=${tryDemo}>Erst mal mit Beispieldaten ausprobieren</button>
    <p class="fineprint">Die Anleitung zum Einrichten steht in <b>ANLEITUNG.md</b> im Repository.</p>
  <//>`;
}

export function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await signIn(email, pw);
    } catch (ex) {
      setErr(errorText(ex));
      setBusy(false);
    }
  };
  return html`<${Frame} title="Willkommen zuhause">
    <p class="lead">Meldet euch mit eurem eigenen Konto an.</p>
    <form class="form" onSubmit=${submit}>
      <label class="field"><span class="field-label">E-Mail</span>
        <input class="input" type="email" required autocomplete="username" value=${email} onInput=${(e) => setEmail(e.currentTarget.value)} /></label>
      <label class="field"><span class="field-label">Passwort</span>
        <input class="input" type="password" required autocomplete="current-password" value=${pw} onInput=${(e) => setPw(e.currentTarget.value)} /></label>
      ${err && html`<p class="form-error">${err}</p>`}
      <button class="btn primary block" type="submit" disabled=${busy}>${busy ? 'Anmelden …' : 'Anmelden'}</button>
    </form>
    ${state.configSource === 'browser' && html`<button class="btn ghost small muted-text" onClick=${forgetConnection}>Andere Datenbank verbinden</button>`}
  <//>`;
}

export function NameScreen() {
  const [name, setName] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (name.trim()) await saveMyName(name);
  };
  return html`<${Frame} title="Wie heißt du?">
    <p class="lead">Damit ihr seht, wer was eingetragen oder bezahlt hat.</p>
    <form class="form" onSubmit=${submit}>
      <input class="input" required autofocus placeholder="Dein Vorname" value=${name} onInput=${(e) => setName(e.currentTarget.value)} />
      <button class="btn primary block" type="submit">Los geht's</button>
    </form>
  <//>`;
}

export function Denied() {
  return html`<${Frame} title="Noch nicht freigeschaltet">
    <p class="lead">Du bist als <b>${state.email}</b> angemeldet, aber dieses Konto hat noch keinen Zugriff.</p>
    <p class="muted">Führt das Skript <b>supabase/setup.sql</b> im SQL-Editor von Supabase noch einmal aus. Es schaltet alle vorhandenen Konten frei. Danach die Seite neu laden.</p>
    <div class="stack">
      <button class="btn primary block" onClick=${() => location.reload()}>Neu laden</button>
      <button class="btn ghost block" onClick=${signOut}><${Icon} name="logout" size=${18} />Abmelden</button>
    </div>
  <//>`;
}

export function ErrorScreen() {
  return html`<${Frame} title="Hoppla">
    <p class="lead">${state.error}</p>
    <div class="stack">
      <button class="btn primary block" onClick=${() => location.reload()}>Nochmal versuchen</button>
      ${state.mode === 'supabase' && html`<button class="btn ghost block" onClick=${signOut}>Abmelden</button>`}
      ${state.configSource === 'browser' && html`<button class="btn ghost block muted-text" onClick=${forgetConnection}>Verbindung ändern</button>`}
    </div>
  <//>`;
}
