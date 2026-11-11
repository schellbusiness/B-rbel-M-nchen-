# Unsere Wohnung – Einrichtung

Einmalig ca. 15 Minuten. Danach braucht ihr nur noch den Link.

**Kurz:** Supabase-Projekt anlegen → zwei Konten anlegen → SQL ausführen → Seite online stellen → verbinden.

> Ohne Einrichtung ausprobieren: Seite öffnen und **„Erst mal mit Beispieldaten ausprobieren“** wählen.
> Im Demo-Modus wird alles nur im jeweiligen Browser gespeichert.

---

## 1. Supabase-Projekt anlegen (kostenlos)

1. Auf [supabase.com](https://supabase.com) registrieren und **New project** wählen.
2. Name z. B. `wohnung`, Region **Central EU (Frankfurt)**.
3. Das Datenbank-Passwort generieren lassen und sicher aufheben. Die App braucht es nicht.

## 2. Eure beiden Konten anlegen

1. Links **Authentication → Users → Add user → Create new user**.
2. E-Mail und Passwort eingeben, dann das Häkchen bei **Auto Confirm User** setzen.
3. Das Gleiche für Lisa. Sie kann ihr Passwort später in der App unter *Einstellungen* selbst ändern.
4. Empfohlen: Unter **Authentication → Sign In / Providers** die Option **Allow new users to sign up** ausschalten.
   Auch wenn sie an bleibt, sieht ein fremdes Konto nichts. Die Datenbank lässt nur freigeschaltete Konten rein.

## 3. Datenbank einrichten

1. Links **SQL Editor → New query**.
2. Den kompletten Inhalt von [`supabase/setup.sql`](supabase/setup.sql) einfügen und **Run** klicken.
3. Unten erscheinen eure beiden E-Mail-Adressen. Das sind die freigeschalteten Konten.

Das Skript legt Tabellen, Zugriffsregeln, den privaten Foto-Speicher und die Live-Aktualisierung an.
Es kann gefahrlos mehrmals ausgeführt werden, z. B. wenn ihr später noch ein Konto anlegt.

## 4. Seite online stellen

Die Seite ist eine reine statische Webseite ohne Build-Schritt. Sie läuft bei jedem Hoster.

**Variante A: GitHub Pages**
Geht nur, wenn das Repository öffentlich ist oder ihr GitHub Pro habt.
Im Code stehen keine Geheimnisse. Eure Daten liegen geschützt hinter dem Login in Supabase.

1. Im Repository **Settings → Pages**.
2. *Source*: **Deploy from a branch**, den Branch mit der Seite wählen, Ordner **/ (root)**, **Save**.
3. Nach 1–2 Minuten läuft die Seite unter `https://schellbusiness.github.io/Antalya-/`.

**Variante B: Netlify oder Cloudflare Pages (Repo bleibt privat)**

1. Bei [Netlify](https://app.netlify.com) einloggen und **Add new site → Import an existing project → GitHub** wählen, dann das Repo auswählen.
2. Den Branch wählen. *Build command* bleibt **leer**, *Publish directory* ist **`.`**. Dann **Deploy**.
3. Ihr bekommt eine Adresse wie `https://unsere-wohnung.netlify.app` (umbenennbar).

## 5. Verbinden

In Supabase oben auf **Connect** klicken (oder **Project Settings → Data API / API Keys**). Ihr braucht:

- **Project URL**, z. B. `https://abcdefgh.supabase.co`
- **Publishable key** (`sb_publishable_…`) oder den **anon**-Key (`eyJ…`)

Dann eine der beiden Möglichkeiten:

- **Einfach:** Die Seite öffnen und beide Werte einfügen. Danach unter *Einstellungen → Link kopieren* den Link
  an Lisa schicken. Wer ihn öffnet, ist sofort verbunden und meldet sich nur noch mit dem eigenen Konto an.
- **Dauerhaft:** Beide Werte in [`config.js`](config.js) eintragen und committen. Dann ist jedes Gerät automatisch verbunden.

Beide Werte sind für den Browser gedacht und dürfen öffentlich sein.
Den **service_role**- bzw. **secret**-Key niemals verwenden.

---

## Als App aufs Handy

- **iPhone:** Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**
- **Android:** Seite in Chrome öffnen → ⋮ → **App installieren** bzw. **Zum Startbildschirm**

## Gut zu wissen

- **Pausieren:** Kostenlose Supabase-Projekte werden nach etwa einer Woche ohne Nutzung pausiert.
  Im Supabase-Dashboard lässt sich das Projekt mit einem Klick wieder starten. Die Daten bleiben erhalten.
- **Speicher:** Fotos werden vor dem Hochladen verkleinert. Der kostenlose Speicher reicht für Tausende Fotos.
- **Live:** Was einer von euch einträgt, erscheint beim anderen nach ein bis zwei Sekunden.
- **Passwort vergessen:** In Supabase unter *Authentication → Users* das Konto öffnen und ein neues Passwort setzen.
- **Lokal testen:** Im Projektordner `python3 -m http.server` starten und `http://localhost:8000` öffnen.

## Was wo im Code liegt

| Datei | Inhalt |
|---|---|
| `index.html`, `config.js` | Einstieg und optionale Verbindungsdaten |
| `assets/app.js` | Navigation und Rahmen |
| `assets/store.js` | Daten: Supabase bzw. Demo im Browser, Live-Aktualisierung, Uploads |
| `assets/sheets.js` | Formulare (Sache, Ausgabe, Aufgabe, Raum, Vertrag, Kiste, Einstellungen) |
| `assets/views/` | Seiten: Übersicht, Räume, Budget, To-Dos, Umzug, Anmeldung |
| `assets/seed.js` | Startinhalte: Räume, Umzugs-Checkliste, Verträge |
| `assets/styles.css` | Design (hell und dunkel) |
| `supabase/setup.sql` | Datenbank, Zugriffsregeln, Foto-Speicher |
| `vendor/` | Preact + htm, supabase-js (lokal, keine CDN nötig) |
