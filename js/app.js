import { BODYMAP, TECHNIQUE } from './content.js';
import {
  EXERCISES,
  CIRCUIT_ORDER,
  RULES,
  WEEKS,
  circuitFor,
  minutesFor,
  roundsFor,
  warmupFor,
  weekPlan,
} from './plan.js';
import { getState, update, requestPersistence } from './store.js';

export const APP_VERSION = '0.1.0';

const $main = document.getElementById('main');
const $title = document.getElementById('title');
const $back = document.getElementById('back');

// ---------- pomocné ----------

const html = (strings, ...values) =>
  strings.reduce((out, str, i) => out + str + (i < values.length ? [values[i]].flat().join('') : ''), '');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SIDED_NOTE = { leg: 'levá, hned pravá', side: 'levá, hned pravá strana' };

function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

function plural(n, one, few, many) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

function levelLabel(state) {
  return state.level.phase === 'ramp' ? `Týden ${state.level.week}` : 'Progrese';
}

// ---------- pohledy ----------

function viewHome() {
  const state = getState();
  const { week } = state.level;
  const plan = weekPlan(week);
  const rounds = roundsFor(week, state.settings);
  const circuit = circuitFor(week, state.settings);
  const last = state.sessions.at(-1);

  let lastLine = 'Zatím žádný zaznamenaný trénink.';
  if (last) {
    const d = daysSince(last.start);
    lastLine =
      d === 0
        ? 'Poslední trénink: dnes.'
        : `Poslední trénink před ${d} ${plural(d, 'dnem', 'dny', 'dny')}.`;
  }

  return html`
    <section class="card level">
      <p class="eyebrow">Aktuální úroveň</p>
      <h2 class="level-name">${levelLabel(state)}</h2>
      <p class="level-meta">
        <span>${rounds} ${plural(rounds, 'okruh', 'okruhy', 'okruhů')}</span>
        <span>pauza ${state.settings.restSec ?? plan.restSec} s</span>
        <span>~${minutesFor(week, state.settings)} min</span>
      </p>
      <p class="muted">${lastLine}</p>
      <a class="link-small" href="#/nastaveni">Změnit týden</a>
    </section>

    <button class="btn-primary" disabled>Začít trénink</button>
    <p class="muted center small">Spuštění tréninku přijde v dalším kroku vývoje.</p>

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

function viewExercises() {
  const state = getState();
  const { week } = state.level;
  const thisWeek = Object.fromEntries(circuitFor(week, state.settings).map((c) => [c.id, c]));

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
  const now = circuitFor(state.level.week, state.settings).find((c) => c.id === id);

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
        <legend>Aktuální týden plánu</legend>
        <div class="seg">
          ${WEEKS.map((w) => radio('week', String(w.week), `T${w.week}`, String(state.level.week)))}
        </div>
        <p class="muted small">Později bude appka posun navrhovat sama podle odcvičených tréninků.</p>
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
    </form>

    <section class="card">
      <h3>Data</h3>
      <p class="small">Všechna data jsou uložená jen v tomto telefonu. <span id="persist" class="muted">Zjišťuji stav úložiště…</span></p>
      <p class="muted small">Záloha a obnova dat přijde v kroku 5.</p>
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
  { re: /^\/plan$/, title: 'Plán', nav: 'plan', view: viewPlan },
  { re: /^\/nastaveni$/, title: 'Nastavení', nav: 'nastaveni', view: viewSettings },
];

function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) {
    $main.innerHTML = viewNotFound();
    return;
  }
  const params = path.match(route.re).slice(1);
  $main.innerHTML = route.view(...params);
  $title.textContent = route.title === 'Cvik' ? EXERCISES[params[0]]?.short ?? 'Cvik' : route.title;
  $back.hidden = !route.back;
  $back.href = route.back ?? '#/';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.nav === route.nav));
  window.scrollTo(0, 0);
  if (route.nav === 'nastaveni') bindSettings();
}

function bindSettings() {
  const form = document.getElementById('settings');
  form.addEventListener('change', (e) => {
    const { name, value, checked } = e.target;
    update((st) => {
      if (name === 'week') {
        const to = Number(value);
        st.levelHistory.push({ date: new Date().toISOString(), from: st.level.week, to, reason: 'manual' });
        st.level = { ...st.level, phase: 'ramp', week: to };
      } else if (name === 'threeRounds') {
        st.settings.threeRounds = checked;
      } else {
        st.settings[name] = value;
      }
    });
  });

  const $persist = document.getElementById('persist');
  requestPersistence().then((status) => {
    $persist.textContent = {
      granted: 'Android je nemaže ani při nedostatku místa.',
      denied: 'Android je zatím může při nedostatku místa smazat — po přidání appky na plochu to obvykle zmizí.',
      unsupported: 'Prohlížeč neumí trvalé úložiště.',
    }[status];
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
