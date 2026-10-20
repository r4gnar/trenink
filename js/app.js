import { BODYMAP, TECHNIQUE } from './content.js';
import {
  EXERCISES,
  CIRCUIT_ORDER,
  PROGRESSION,
  RULES,
  WEEKS,
  circuitFor,
  minutesFor,
  roundsFor,
  stageLabel,
  warmupFor,
  weekPlan,
} from './plan.js';
import { backupReminder, canShareFile, downloadBackup, parseBackup, restoreBackup, shareBackup, snoozeReminder } from './backup.js';
import { bindHistory, viewHistory, viewSession } from './history.js';
import { applySuggestion, cleanStreak, describeChange, suggestAfterGap, zeroStages } from './progress.js';
import { signalGo, unlockAudio } from './signals.js';
import { getState, update, requestPersistence, resetAll } from './store.js';
import { daysSince, esc, formatTime, html, plural } from './util.js';
import { discardWorkout, mountWorkout, startWorkout } from './workout.js';

export const APP_VERSION = '0.5.1';

const $main = document.getElementById('main');
const $title = document.getElementById('title');
const $back = document.getElementById('back');

// ---------- pomocné ----------

const SIDED_NOTE = { leg: 'levá, hned pravá', side: 'levá, hned pravá strana' };

function levelLabel(state) {
  return state.level.phase === 'ramp' ? `Týden ${state.level.week}` : 'Progrese';
}

// ---------- pohledy ----------

function viewHome() {
  const state = getState();
  const { week } = state.level;
  const plan = weekPlan(week);
  const rounds = roundsFor(week, state.settings);
  const circuit = circuitFor(state.level, state.settings);
  const last = state.sessions.at(-1);

  let lastLine = 'Zatím žádný zaznamenaný trénink.';
  if (last) {
    const d = daysSince(last.start);
    lastLine =
      d === 0
        ? 'Poslední trénink: dnes.'
        : `Poslední trénink před ${d} ${plural(d, 'dnem', 'dny', 'dny')}.`;
  }

  const sug = currentSuggestion(state);
  const streak = cleanStreak(state);
  const remind = backupReminder(state);

  return html`
    ${sug
      ? html`
        <section class="card suggestion">
          <p class="eyebrow">Návrh podle plánu</p>
          <h3>${esc(sug.title)}</h3>
          <p>${esc(sug.text)}</p>
          ${describeChange(sug, state).length
            ? html`<ul class="plain-list">${describeChange(sug, state).map((line) => html`<li>${esc(line)}</li>`)}</ul>`
            : ''}
          ${sug.kind === 'repeat'
            ? html`<button type="button" class="btn-primary" data-act="sug-no">Rozumím</button>`
            : html`
              <div class="wk-row">
                <button type="button" class="btn-secondary" data-act="sug-no">Ještě ne</button>
                <button type="button" class="btn-primary small-btn" data-act="sug-yes">Potvrdit</button>
              </div>`}
        </section>`
      : ''}

    ${remind
      ? html`
        <section class="card reminder">
          <h3>Čas na zálohu</h3>
          <p class="small">${remind.never ? 'Data ještě nemáš zálohovaná' : `Poslední záloha před ${remind.days} dny`} a přibylo ${remind.fresh} ${plural(remind.fresh, 'trénink', 'tréninky', 'tréninků')}. Bez zálohy o ně při výměně telefonu přijdeš.</p>
          <div class="wk-row">
            <button type="button" class="btn-secondary" data-act="snooze-backup">Za týden</button>
            <a class="btn-primary small-btn link-btn" href="#/nastaveni">Zálohovat</a>
          </div>
        </section>`
      : ''}

    <section class="card level">
      <p class="eyebrow">Aktuální úroveň</p>
      <h2 class="level-name">${levelLabel(state)}</h2>
      <p class="level-meta">
        <span>${rounds} ${plural(rounds, 'okruh', 'okruhy', 'okruhů')}</span>
        <span>pauza ${state.settings.restSec ?? plan.restSec} s</span>
        <span>~${minutesFor(week, state.settings)} min</span>
      </p>
      <p class="muted">${lastLine}</p>
      <p class="streak small">
        ${Array.from({ length: streak.needed }, (_, i) => html`<i class="${i < streak.done ? 'on' : ''}"></i>`)}
        <span>${state.level.phase === 'ramp'
          ? `Čisté tréninky na tomto týdnu: ${streak.done} / ${streak.needed}`
          : `Čisté tréninky v řadě: ${streak.done} / ${streak.needed}`}</span>
      </p>
      <a class="link-small" href="#/nastaveni">Změnit úroveň</a>
    </section>

    ${state.inProgress
      ? html`
        <section class="card resume">
          <h3>Rozpracovaný trénink</h3>
          <p class="muted small">Začatý ${new Date(state.inProgress.start).toLocaleDateString('cs-CZ')} v ${formatTime(state.inProgress.start)} · týden ${state.inProgress.week}</p>
          <button type="button" class="btn-primary" data-act="resume">Pokračovat</button>
          <button type="button" class="btn-text" data-act="discard">Zahodit</button>
        </section>`
      : html`<button type="button" class="btn-primary" data-act="start">Začít trénink</button>`}

    <section class="card">
      <h3>Dnešní trénink</h3>
      <p class="eyebrow">Rozehřátí · 3 min</p>
      <ul class="plain-list">
        ${warmupFor(week).map((w) => html`<li>${esc(w.text)}${w.detail ? html` <span class="muted">— ${esc(w.detail)}</span>` : ''}</li>`)}
      </ul>
      <p class="eyebrow">Okruh · ${rounds}×</p>
      <ol class="circuit">
        ${circuit.map(
          (c) => html`
            <li>
              <a href="#/cvik/${c.id}">
                <span class="c-name">${esc(EXERCISES[c.id].name)}</span>
                <span class="c-vol">${esc(c.volume)}</span>
                ${c.variant ? html`<span class="c-var">${esc(c.variant)}</span>` : ''}
              </a>
            </li>`,
        )}
      </ol>
      <p class="muted small">Mezi cviky přechod ${state.settings.transitionSec} s, pauza ${state.settings.restSec ?? plan.restSec} s až po celém okruhu.</p>
    </section>
  `;
}

// Návrh po posledním tréninku má přednost před návrhem po pauze.
function currentSuggestion(state) {
  return state.pendingSuggestion ?? suggestAfterGap(state);
}

function viewExercises() {
  const state = getState();
  const { week } = state.level;
  const thisWeek = Object.fromEntries(circuitFor(state.level, state.settings).map((c) => [c.id, c]));

  const row = (id, idx) => {
    const ex = EXERCISES[id];
    const now = thisWeek[id];
    return html`
      <li>
        <a class="ex-row" href="#/cvik/${id}">
          ${idx ? html`<span class="ex-idx">${idx}</span>` : ''}
          <span class="ex-text">
            <span class="ex-name">${esc(ex.name)}</span>
            <span class="ex-target">${esc(ex.target)}</span>
          </span>
          <span class="ex-now">${now ? esc(now.volume) : '—'}</span>
        </a>
      </li>`;
  };

  return html`
    <p class="muted small">Počty u cviků platí pro ${levelLabel(state).toLowerCase()}. Pořadí v okruhu se nemění.</p>
    <h3 class="list-head">Okruh</h3>
    <ul class="ex-list">${CIRCUIT_ORDER.filter((id) => id !== 'superman').map((id, i) => row(id, i + 1))}</ul>
    <h3 class="list-head">Volitelný, na konec okruhu</h3>
    <ul class="ex-list">${row('superman')}</ul>
    <h3 class="list-head">Rozehřátí</h3>
    <ul class="ex-list">${row('pullapart')}</ul>
    <ul class="plain-list card">
      ${warmupFor(5)
        .filter((w) => !w.exercise)
        .map((w) => html`<li>${esc(w.text)}${w.detail ? html` <span class="muted">— ${esc(w.detail)}</span>` : ''}</li>`)}
    </ul>
    <h3 class="list-head">Čtyři pravidla pro všechno</h3>
    <dl class="card rules">
      ${RULES.map((r) => html`<div><dt>${esc(r.title)}</dt><dd>${esc(r.text)}</dd></div>`)}
    </dl>
  `;
}

function viewExercise(id) {
  const ex = EXERCISES[id];
  if (!ex) return viewNotFound();
  const state = getState();
  const now = circuitFor(state.level, state.settings).find((c) => c.id === id);

  let variants = '';
  if (ex.variants) {
    const chosen = state.settings.rowVariant;
    variants = html`
      <section class="card">
        <h3>Varianta</h3>
        <ul class="variants">
          ${Object.entries(ex.variants).map(
            ([key, v]) => html`
              <li class="${key === chosen ? 'chosen' : ''}">
                <strong>${esc(v.name)}</strong>${key === chosen ? ' <span class="chip">vybraná</span>' : ''}
                <p>${esc(v.text)}</p>
              </li>`,
          )}
        </ul>
        <p class="muted small">Variantu změníš v Nastavení. Nákresy níže jsou pro gumu.</p>
      </section>`;
  }

  return html`
    <header class="ex-header">
      <p class="eyebrow">${esc(ex.target)}</p>
      <h2>${esc(ex.name)}</h2>
      <div class="chips">
        ${now
          ? html`<span class="chip">${esc(levelLabel(state))}: ${esc(now.volume)}</span>${now.variant ? html`<span class="chip">${esc(now.variant)}</span>` : ''}`
          : id === 'pullapart'
            ? html`<span class="chip plain">v rozehřátí od 2. týdne</span>`
            : html`<span class="chip plain">${esc(levelLabel(state))}: nezařazeno</span>`}
      </div>
    </header>

    <dl class="facts card">
      <div><dt>Tempo</dt><dd>${esc(ex.tempo)}</dd></div>
      ${ex.sided ? html`<div><dt>Strany</dt><dd>${SIDED_NOTE[ex.sided]}, bez pauzy mezi nimi</dd></div>` : ''}
      <div><dt>Proč tady</dt><dd>${esc(ex.why)}</dd></div>
      <div><dt>Hlavní myšlenka</dt><dd>${esc(ex.cue)}</dd></div>
    </dl>

    ${variants}

    <section class="technique">${TECHNIQUE[id] ?? ''}</section>
  `;
}

function viewPlan() {
  const state = getState();
  const cell = (item, id) => {
    if (!item) return '—';
    const sided = item.sided === false ? null : EXERCISES[id].sided;
    return html`${item.reps}${sided ? html`<small> /${sided === 'leg' ? 'n' : 's'}</small>` : ''}${item.variant ? html`<em>${esc(item.variant)}</em>` : ''}`;
  };

  return html`
    <p class="muted small">Čísla jsou opakování v každém okruhu. /n = na každou nohu, /s = na každou stranu.</p>
    <div class="tablewrap card">
      <table class="plan">
        <thead>
          <tr><th></th>${WEEKS.map((w) => html`<th class="${w.week === state.level.week ? 'current' : ''}">T${w.week}</th>`)}</tr>
        </thead>
        <tbody>
          <tr class="strong"><td>Okruhy</td>${WEEKS.map((w) => html`<td>${w.rounds}</td>`)}</tr>
          ${CIRCUIT_ORDER.map(
            (id) => html`<tr><td>${esc(EXERCISES[id].short)}</td>${WEEKS.map((w) => html`<td>${cell(w.items[id], id)}</td>`)}</tr>`,
          )}
          <tr><td>Pauza</td>${WEEKS.map((w) => html`<td>${w.restSec} s</td>`)}</tr>
          <tr><td>Rozpažování</td>${WEEKS.map((w) => html`<td>${w.week >= 2 ? '✓' : '—'}</td>`)}</tr>
          <tr><td>Čas</td>${WEEKS.map((w) => html`<td>~${w.minutes}′</td>`)}</tr>
        </tbody>
      </table>
    </div>

    <section class="card">
      <h3>Kdy se posunout dál</h3>
      <ol class="plain-list numbered">
        <li><strong>Podle techniky, ne podle kalendáře.</strong> Další týden až po dvou trénincích s čistou technikou.</li>
        <li><strong>Svalovka do dalšího tréninku</strong> → stejný týden ještě jednou.</li>
        <li><strong>Vynechaný celý týden</strong> → o stupeň zpět. Po pauze delší než 3 týdny znovu od 1. týdne.</li>
        <li><strong>Po 5. týdnu</strong> se posouváš podle pravidla progrese, u každého cviku zvlášť.</li>
      </ol>
    </section>

    <section class="card">
      <h3>Pravidlo progrese po 5. týdnu</h3>
      <ol class="plain-list numbered">
        <li>4 okruhy × 10 čistě a 2+ opakování v rezervě → spouštěcí fáze na <strong>3 s</strong>.</li>
        <li>Sedí i pomalá verze → <strong>těžší varianta</strong> cviku.</li>
        <li>Došly varianty → <strong>zátěž</strong> (batoh s knihami).</li>
      </ol>
      <p class="muted small">Škrtá se vždycky okruh, nikdy kvalita. Čas se nepřidává.</p>
    </section>

    <section class="card">
      <h3>Stupně progrese</h3>
      <p class="muted small">Objem a okruhy zůstávají jako v 5. týdnu. Co už 5. týden obsahuje, je rovnou ve stupni 0. Posun o stupeň appka navrhne, když u cviku dvakrát po sobě zvládneš plný objem čistě a s rezervou 2+ opakování.</p>
      ${Object.entries(PROGRESSION).map(([id, stages]) => {
        const current = state.level.phase === 'progression' ? state.level.progression[id] ?? 0 : null;
        return html`
          <div class="stages">
            <strong>${esc(EXERCISES[id].short)}</strong>
            <ol start="0">
              ${stages.map((label, i) => html`<li class="${i === current ? 'current' : ''}">${esc(label ?? 'základ')}</li>`)}
            </ol>
          </div>`;
      })}
    </section>
  `;
}

function viewSettings() {
  const state = getState();
  const s = state.settings;
  const radio = (name, value, label, current) => html`
    <label class="opt"><input type="radio" name="${name}" value="${value}" ${current === value ? 'checked' : ''}><span>${label}</span></label>`;

  return html`
    <form id="settings" class="settings">
      <fieldset class="card">
        <legend>Aktuální úroveň</legend>
        <div class="seg six">
          ${WEEKS.map((w) => radio('week', String(w.week), `T${w.week}`, state.level.phase === 'ramp' ? String(state.level.week) : 'P'))}
          ${radio('week', 'P', 'P', state.level.phase === 'ramp' ? String(state.level.week) : 'P')}
        </div>
        <p class="muted small">T1–T5 = týdny náběhu, P = fáze progrese. Posun appka navrhuje sama po trénincích — tady jen ruční oprava.</p>
        ${state.level.phase === 'progression'
          ? html`
            <div class="stage-select">
              ${Object.entries(PROGRESSION).map(
                ([id, stages]) => html`
                  <label>
                    <span>${esc(EXERCISES[id].short)}</span>
                    <select name="stage" data-id="${id}">
                      ${stages.map((_, i) => html`<option value="${i}" ${i === (state.level.progression[id] ?? 0) ? 'selected' : ''}>${i} — ${esc(stageLabel(id, i))}</option>`)}
                    </select>
                  </label>`,
              )}
            </div>`
          : ''}
      </fieldset>

      <fieldset class="card">
        <legend>Superman</legend>
        ${radio('superman', 'auto', 'Automaticky — jen v týdnu bez veslování (T1)', s.superman)}
        ${radio('superman', 'always', 'Vždy, na konec okruhu', s.superman)}
        ${radio('superman', 'never', 'Nikdy', s.superman)}
      </fieldset>

      <fieldset class="card">
        <legend>Varianta veslování</legend>
        ${Object.entries(EXERCISES.row.variants).map(([k, v]) => radio('rowVariant', k, v.name, s.rowVariant))}
      </fieldset>

      <fieldset class="card">
        <legend>Délka tréninku</legend>
        <label class="opt"><input type="checkbox" name="threeRounds" ${s.threeRounds ? 'checked' : ''}><span>Natrvalo 3 okruhy místo 4 (vejde se do ~21 min)</span></label>
      </fieldset>

      <fieldset class="card">
        <legend>Signály během tréninku</legend>
        <label class="opt"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>Pípnutí na konci přechodu a pauzy</span></label>
        <label class="opt"><input type="checkbox" name="vibration" ${s.vibration ? 'checked' : ''}><span>Vibrace</span></label>
        <button type="button" class="btn-secondary" id="test-signal">Vyzkoušet</button>
        <p class="muted small">Pípnutí jde přes reproduktor médií — hlasitost médií nesmí být ztlumená.</p>
      </fieldset>

      <fieldset class="card">
        <legend>Časy</legend>
        <p class="small strong-label">Přechod mezi cviky</p>
        <div class="seg four">
          ${[10, 15, 20, 30].map((v) => radio('transitionSec', String(v), `${v} s`, String(s.transitionSec)))}
        </div>
        <p class="small strong-label">Pauza po okruhu</p>
        <div class="seg five">
          ${radio('restSec', 'plan', 'plán', s.restSec == null ? 'plan' : String(s.restSec))}
          ${[60, 90, 120, 150].map((v) => radio('restSec', String(v), `${v} s`, s.restSec == null ? 'plan' : String(s.restSec)))}
        </div>
        <p class="muted small">„Plán“ = podle týdne (120 s v T1–T2, jinak 90 s). Plán doporučuje přechod ~15 s a pauzu prodlužovat nejvýš o 30 s. Změny platí od dalšího tréninku.</p>
      </fieldset>
    </form>

    <section class="card">
      <h3>Záloha dat</h3>
      <p class="small">Všechna data jsou uložená jen v tomto telefonu. <span id="persist" class="muted">Zjišťuji stav úložiště…</span></p>
      <p class="small">${state.lastBackup
        ? `Poslední záloha: ${new Date(state.lastBackup).toLocaleDateString('cs-CZ')}.`
        : 'Zatím jsi nezálohoval.'} Při výměně telefonu nebo smazání dat prohlížeče o data bez zálohy přijdeš.</p>
      ${canShareFile()
        ? html`<button type="button" class="btn-primary small-btn" data-act="share-backup">Poslat zálohu…</button>
               <p class="muted small">Otevře sdílení — pošli si soubor mailem nebo ho ulož na Disk.</p>`
        : ''}
      <button type="button" class="btn-secondary" data-act="download-backup">Uložit zálohu do telefonu</button>
      <p class="muted small">Soubor se uloží do Stažených souborů.</p>
    </section>

    <section class="card">
      <h3>Obnova ze zálohy</h3>
      <p class="small">Načte data ze souboru zálohy — např. na novém telefonu. <strong>Současná data v appce se nahradí.</strong></p>
      <label class="btn-secondary file-btn">
        Vybrat soubor zálohy…
        <input type="file" id="import-file" accept="application/json,.json,text/plain,.txt" hidden>
      </label>
      <div id="import-result"></div>
    </section>

    <section class="card">
      <h3>Smazat všechna data</h3>
      <p class="small muted">Smaže všechny tréninky, úroveň i nastavení z tohoto telefonu. Nejdřív si udělej zálohu.</p>
      <button type="button" class="btn-text danger" data-act="reset-all">Smazat všechna data…</button>
    </section>

    <p class="muted center small">Verze ${APP_VERSION}</p>
  `;
}

function viewNotFound() {
  return html`<p class="card">Tahle stránka neexistuje. <a href="#/">Zpět domů</a></p>`;
}

// ---------- router ----------

const ROUTES = [
  { re: /^\/?$/, title: 'Trénink', nav: 'home', view: viewHome },
  { re: /^\/cviky$/, title: 'Cviky', nav: 'cviky', view: viewExercises },
  { re: /^\/cvik\/(\w+)$/, title: 'Cvik', nav: 'cviky', view: viewExercise, back: '#/cviky' },
  { re: /^\/historie$/, title: 'Historie', nav: 'historie', view: viewHistory, bind: bindHistory },
  { re: /^\/historie\/(.+)$/, title: 'Trénink', nav: 'historie', view: viewSession, bind: bindHistory, back: '#/historie' },
  { re: /^\/plan$/, title: 'Plán', nav: 'plan', view: viewPlan },
  { re: /^\/nastaveni$/, title: 'Nastavení', nav: 'nastaveni', view: viewSettings },
  { re: /^\/trenink$/, title: 'Trénink', nav: 'home', mount: mountWorkout },
];

let unmount = null;

function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) {
    $main.innerHTML = viewNotFound();
    return;
  }
  const params = path.match(route.re).slice(1);
  unmount?.();
  unmount = null;
  if (route.mount) unmount = route.mount($main);
  else $main.innerHTML = route.view(...params);
  $title.textContent = route.title === 'Cvik' ? EXERCISES[params[0]]?.short ?? 'Cvik' : route.title;
  $back.hidden = !route.back;
  $back.href = route.back ?? '#/';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.nav === route.nav));
  window.scrollTo(0, 0);
  route.bind?.($main);
  if (route.view === viewSettings) bindSettings();
  if (route.view === viewHome) bindHome();
}

function bindHome() {
  $main.querySelector('[data-act="start"]')?.addEventListener('click', () => {
    unlockAudio();
    startWorkout();
    location.hash = '#/trenink';
  });
  $main.querySelector('[data-act="resume"]')?.addEventListener('click', () => {
    unlockAudio();
    location.hash = '#/trenink';
  });
  const answer = (accept) => {
    update((s) => {
      const sug = currentSuggestion(s);
      if (!sug) return;
      if (accept) applySuggestion(s, sug);
      if (sug.key) s.dismissed = [...(s.dismissed ?? []), sug.key].slice(-20);
      else s.pendingSuggestion = null;
    });
    render();
  };
  $main.querySelector('[data-act="sug-yes"]')?.addEventListener('click', () => answer(true));
  $main.querySelector('[data-act="snooze-backup"]')?.addEventListener('click', () => {
    snoozeReminder();
    render();
  });
  $main.querySelector('[data-act="sug-no"]')?.addEventListener('click', () => answer(false));
  $main.querySelector('[data-act="discard"]')?.addEventListener('click', () => {
    if (!confirm('Zahodit rozpracovaný trénink? Nic z něj se neuloží.')) return;
    discardWorkout();
    render();
  });
}

function bindSettings() {
  const form = document.getElementById('settings');
  form.addEventListener('change', (e) => {
    const { name, value, checked } = e.target;
    update((st) => {
      if (name === 'week' || name === 'stage') {
        const from = structuredClone(st.level);
        if (name === 'stage') st.level.progression[e.target.dataset.id] = Number(value);
        else if (value === 'P') st.level = { phase: 'progression', week: 5, progression: st.level.progression ?? zeroStages() };
        else st.level = { ...st.level, phase: 'ramp', week: Number(value) };
        st.levelHistory.push({ date: new Date().toISOString(), from, to: structuredClone(st.level), reason: 'manual' });
        st.pendingSuggestion = null;
      } else if (e.target.type === 'checkbox') {
        st.settings[name] = checked;
      } else if (name === 'transitionSec' || name === 'restSec') {
        st.settings[name] = value === 'plan' ? null : Number(value);
      } else {
        st.settings[name] = value;
      }
    });
    if (name === 'week') {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    }
  });

  document.getElementById('test-signal').addEventListener('click', () => {
    unlockAudio();
    signalGo();
  });
  bindBackup();

  const $persist = document.getElementById('persist');
  requestPersistence().then((status) => {
    $persist.textContent = {
      granted: 'Android je nemaže ani při nedostatku místa.',
      denied: 'Android je zatím může při nedostatku místa smazat — po přidání appky na plochu to obvykle zmizí.',
      unsupported: 'Prohlížeč neumí trvalé úložiště.',
    }[status];
  });
}

function bindBackup() {
  $main.querySelector('[data-act="share-backup"]')?.addEventListener('click', async () => {
    try {
      if (await shareBackup()) render();
    } catch (err) {
      alert(`Sdílení se nepovedlo. Zkus „Uložit zálohu do telefonu“.\n\n(${err.name}: ${err.message})`);
    }
  });
  $main.querySelector('[data-act="download-backup"]')?.addEventListener('click', () => {
    downloadBackup();
    render();
  });
  $main.querySelector('[data-act="reset-all"]')?.addEventListener('click', () => {
    if (!confirm('Opravdu smazat všechna data? Tréninky, úroveň i nastavení zmizí z tohoto telefonu.')) return;
    if (!confirm('Poslední kontrola: smazání nejde vrátit. Smazat?')) return;
    resetAll();
    location.hash = '#/';
  });

  const $result = document.getElementById('import-result');
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    $result.replaceChildren();
    try {
      const { data, summary } = parseBackup(await file.text());
      const current = getState().sessions.length;
      const n = (k) => `${k} ${plural(k, 'trénink', 'tréninky', 'tréninků')}`;
      const lines = [
        `Záloha${summary.exportedAt ? ' z ' + new Date(summary.exportedAt).toLocaleDateString('cs-CZ') : ''}: ${n(summary.sessions)}`,
        summary.last
          ? `Poslední trénink ${new Date(summary.last).toLocaleDateString('cs-CZ')}, úroveň ${summary.level}.`
          : `Úroveň ${summary.level}.`,
        `V appce je teď ${n(current)} — budou nahrazeny.`,
      ];
      const box = document.createElement('div');
      box.className = 'import-box';
      for (const line of lines) {
        const el = document.createElement('p');
        el.className = 'small';
        el.textContent = line;
        box.append(el);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-primary small-btn';
      btn.dataset.act = 'confirm-import';
      btn.textContent = 'Nahradit data zálohou';
      btn.addEventListener('click', () => {
        if (getState().inProgress && !confirm('Máš rozpracovaný trénink — obnovou se zahodí. Pokračovat?')) return;
        restoreBackup(data);
        alert(`Obnoveno: ${n(summary.sessions)}.`);
        location.hash = '#/';
      });
      box.append(btn);
      $result.append(box);
    } catch (err) {
      const el = document.createElement('p');
      el.className = 'small import-error';
      el.textContent = err.message;
      $result.append(el);
    }
  });
}

// ---------- service worker a aktualizace ----------

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (worker) => {
      const bar = document.getElementById('update');
      bar.hidden = false;
      bar.querySelector('button').onclick = () => worker.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// ---------- start ----------

document.getElementById('sprites').innerHTML = BODYMAP;
window.addEventListener('hashchange', render);
render();
setupServiceWorker();
