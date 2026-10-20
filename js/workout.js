// Průvodce tréninkem: rozehřátí → cviky s přechody → pauza po okruhu → … → shrnutí a uložení.
// Celý rozpracovaný trénink žije v state.inProgress a ukládá se po každém kroku,
// takže zavření appky ani zamčený telefon o nic nepřipraví.
import { TECHNIQUE } from './content.js';
import { EXERCISES, PROGRESSION, circuitFor, roundsFor, stageLabel, warmupFor, weekPlan } from './plan.js';
import { suggestAfterSession } from './progress.js';
import { keepScreenOn, signalGo, signalNext, signalSoon, unlockAudio } from './signals.js';
import { getState, update } from './store.js';
import { esc, formatClock, html, plural } from './util.js';

const SIDE_NAME = {
  leg: { L: 'Levá noha', R: 'Pravá noha' },
  side: { L: 'Levá strana', R: 'Pravá strana' },
};
const SOON_SEC = 5;

// ---------- založení / zahození ----------

export function startWorkout() {
  update((s) => {
    const { week } = s.level;
    const rowVariant = s.settings.rowVariant !== 'band' ? EXERCISES.row.variants[s.settings.rowVariant].name : null;
    s.inProgress = {
      start: new Date().toISOString(),
      week,
      phase: s.level.phase,
      rounds: roundsFor(week, s.settings),
      restSec: s.settings.restSec ?? weekPlan(week).restSec,
      transitionSec: s.settings.transitionSec,
      circuit: circuitFor(s.level, s.settings).map(({ id, reps, sided, variant, stage }) => ({
        id,
        reps,
        sided,
        variant: id === 'row' && rowVariant ? [rowVariant, variant].filter(Boolean).join(' · ') : variant ?? null,
        ...(stage != null && { stage }),
      })),
      warmup: warmupFor(week).map((w) => ({ text: w.text, detail: w.detail ?? null, done: false })),
      step: 0,
      results: [],
      timer: null,
      endedAt: null,
      completed: false,
      stepBeforeEnd: null,
      cleanTechnique: null,
      soreness: null,
      reserve: {}, // fáze progrese: cviky s rezervou 2+ opakování
      note: '',
    };
  });
}

export function discardWorkout() {
  update((s) => {
    s.inProgress = null;
  });
}

// Pořadí kroků se odvozuje z okruhu, ukládá se jen index aktuálního kroku.
export function buildSteps(w) {
  const steps = [{ t: 'warmup' }];
  for (let r = 0; r < w.rounds; r++) {
    w.circuit.forEach((c, i) => {
      for (const side of c.sided ? ['L', 'R'] : [null]) steps.push({ t: 'ex', r, i, side });
      if (i < w.circuit.length - 1) steps.push({ t: 'trans', r, i: i + 1 });
    });
    if (r < w.rounds - 1) steps.push({ t: 'rest', r: r + 1 });
  }
  steps.push({ t: 'done' });
  return steps;
}

function getReps(w, r, c, side) {
  const v = w.results[r]?.[c.id];
  if (v == null) return null;
  return side ? v[side] ?? null : v;
}

function setReps(w, r, c, side, value) {
  w.results[r] ??= {};
  if (side) {
    w.results[r][c.id] ??= {};
    w.results[r][c.id][side] = value;
  } else {
    w.results[r][c.id] = value;
  }
}

function totalDone(w, c) {
  return w.results.reduce((sum, round) => {
    const v = round?.[c.id];
    if (v == null) return sum;
    return sum + (typeof v === 'number' ? v : (v.L ?? 0) + (v.R ?? 0));
  }, 0);
}

function roundsDone(w) {
  return w.results.filter((round) => round && w.circuit.every((c) => round[c.id] != null && (!c.sided || round[c.id].R != null))).length;
}

function volumeText(c) {
  const unit = c.sided === 'leg' ? ' / noha' : c.sided === 'side' ? ' / strana' : '';
  return `${c.reps}${unit}`;
}

function figureOf(id) {
  const content = TECHNIQUE[id] ?? '';
  const end = content.indexOf('<div class="muscles">');
  return end > 0 ? content.slice(0, end) : content;
}

// ---------- obrazovka ----------

export function mountWorkout(root) {
  if (!getState().inProgress) {
    location.replace('#/');
    return () => {};
  }
  const w = () => getState().inProgress;
  const steps = buildSteps(w());
  const doneIndex = steps.length - 1;
  let soonFired = false;
  let shownStep = null;

  document.body.classList.add('in-workout');
  keepScreenOn(true);
  root.addEventListener('pointerdown', unlockAudio);

  const save = (fn) => update((s) => fn(s.inProgress));

  function goTo(index, { completed } = {}) {
    save((x) => {
      x.step = index;
      const st = steps[index];
      const sec = st.t === 'trans' ? x.transitionSec : st.t === 'rest' ? x.restSec : 0;
      x.timer = sec > 0 ? { endsAt: Date.now() + sec * 1000 } : null;
      if (st.t === 'done') {
        x.endedAt ??= new Date().toISOString();
        if (completed != null) x.completed = completed;
      } else {
        x.endedAt = null;
      }
    });
    soonFired = false;
    const st = steps[index];
    if ((st.t === 'trans' || st.t === 'rest') && !w().timer) return goTo(index + 1);
    render();
  }

  const next = () => goTo(w().step + 1, { completed: w().step + 1 === doneIndex ? true : undefined });

  function prev() {
    for (let i = w().step - 1; i >= 0; i--) {
      if (steps[i].t === 'ex' || steps[i].t === 'warmup') return goTo(i);
    }
  }

  function quit() {
    if (!confirm('Ukončit trénink? Co jsi odcvičil, se uloží.')) return;
    save((x) => {
      x.stepBeforeEnd = x.step;
    });
    goTo(doneIndex, { completed: false });
  }

  function remaining() {
    const t = w()?.timer;
    if (!t) return 0;
    return t.paused ? t.remaining : (t.endsAt - Date.now()) / 1000;
  }

  // ---------- jednotlivé kroky ----------

  function topBar(st) {
    const x = w();
    const pct = Math.round((x.step / doneIndex) * 100);
    const label = st.t === 'warmup' ? 'Rozehřátí' : `Okruh ${Math.min(st.r + 1, x.rounds)} / ${x.rounds}`;
    return html`
      <div class="wk-top">
        <span class="wk-where">${label}</span>
        <button type="button" class="btn-text" data-act="quit">Ukončit</button>
      </div>
      <div class="wk-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>`;
  }

  function viewWarmup() {
    const x = w();
    return html`
      <div class="wk-body">
        <h2 class="wk-title">Rozehřátí</h2>
        <p class="muted">3 minuty, nevynechávat — okruh začíná nejhlubším pohybem celé rutiny.</p>
        <ul class="wk-check">
          ${x.warmup.map(
            (it, i) => html`
              <li>
                <button type="button" class="${it.done ? 'done' : ''}" data-act="wu" data-i="${i}" aria-pressed="${it.done}">
                  <span class="box" aria-hidden="true"></span>
                  <span>${esc(it.text)}${it.detail ? html`<small>${esc(it.detail)}</small>` : ''}</span>
                </button>
              </li>`,
          )}
        </ul>
      </div>
      <div class="wk-actions">
        <button type="button" class="btn-primary" data-act="warmup-done">Začít okruh</button>
      </div>`;
  }

  function viewExercise(st) {
    const x = w();
    const c = x.circuit[st.i];
    const ex = EXERCISES[c.id];
    const reps = getReps(x, st.r, c, st.side) ?? c.reps;
    const sideName = st.side ? SIDE_NAME[c.sided][st.side] : null;
    return html`
      <div class="wk-body">
        <p class="eyebrow">Cvik ${st.i + 1} / ${x.circuit.length}</p>
        <h2 class="wk-title">${esc(ex.name)}</h2>
        <div class="chips">
          ${sideName ? html`<span class="chip side">${sideName}</span>` : ''}
          ${c.variant ? html`<span class="chip">${esc(c.variant)}</span>` : ''}
        </div>
        <div class="wk-reps">
          <button type="button" class="step" data-act="reps" data-d="-1" aria-label="Ubrat">−</button>
          <output id="reps" aria-live="polite">${reps}</output>
          <button type="button" class="step" data-act="reps" data-d="1" aria-label="Přidat">+</button>
        </div>
        <p class="wk-unit">${reps === c.reps ? 'opakování podle plánu' : html`opakování · plán ${c.reps}`}</p>
        <dl class="wk-facts">
          <div><dt>Tempo</dt><dd>${esc(ex.tempo)}</dd></div>
          <div><dt>Pozor</dt><dd>${esc(ex.cue)}</dd></div>
          ${st.side === 'L' ? html`<div><dt>Pak</dt><dd>hned ${SIDE_NAME[c.sided].R.toLowerCase()}, bez pauzy</dd></div>` : ''}
        </dl>
        <details class="wk-fig">
          <summary>Nákres a technika</summary>
          <div class="technique">${figureOf(c.id)}</div>
        </details>
      </div>
      <div class="wk-actions">
        <button type="button" class="btn-primary" data-act="ex-done">Hotovo</button>
        <button type="button" class="btn-text" data-act="prev">‹ Předchozí</button>
      </div>`;
  }

  function viewTransition(st) {
    const c = w().circuit[st.i];
    return html`
      <div class="wk-body center">
        <p class="eyebrow">Přechod — nesedat</p>
        <div class="wk-clock" id="clock">${formatClock(remaining())}</div>
        <p class="muted">Další cvik</p>
        <h2 class="wk-title">${esc(EXERCISES[c.id].name)}</h2>
        <p class="wk-next-vol">${esc(volumeText(c))}${c.variant ? html` · ${esc(c.variant)}` : ''}</p>
      </div>
      <div class="wk-actions">
        <button type="button" class="btn-primary" data-act="skip">Jsem připravený</button>
      </div>`;
  }

  function viewRest(st) {
    const x = w();
    const first = x.circuit[0];
    const paused = x.timer?.paused;
    return html`
      <div class="wk-body center">
        <p class="eyebrow">Pauza po okruhu ${st.r} / ${x.rounds}</p>
        <div class="wk-clock big ${paused ? 'paused' : ''}" id="clock">${formatClock(remaining())}</div>
        <p>Nesedej a nelehej si — choď a dýchej nosem.</p>
        <p class="muted">Okruh ${st.r + 1} začíná:</p>
        <h2 class="wk-title">${esc(EXERCISES[first.id].name)}</h2>
        <p class="wk-next-vol">${esc(volumeText(first))}${first.variant ? html` · ${esc(first.variant)}` : ''}</p>
      </div>
      <div class="wk-actions">
        <div class="wk-row">
          <button type="button" class="btn-secondary" data-act="plus">+15 s</button>
          <button type="button" class="btn-secondary" data-act="pause">${paused ? 'Pokračovat' : 'Pozastavit'}</button>
        </div>
        <button type="button" class="btn-primary" data-act="skip">Přeskočit pauzu</button>
      </div>`;
  }

  function viewDone() {
    const x = w();
    const minutes = Math.max(1, Math.round((new Date(x.endedAt) - new Date(x.start)) / 60000));
    const done = roundsDone(x);
    const yesNo = (name, value) => html`
      <div class="seg two">
        <button type="button" data-act="answer" data-q="${name}" data-v="true" class="${value === true ? 'on' : ''}">Ano</button>
        <button type="button" data-act="answer" data-q="${name}" data-v="false" class="${value === false ? 'on' : ''}">Ne</button>
      </div>`;
    const ready = x.cleanTechnique != null && x.soreness != null;
    return html`
      <div class="wk-body">
        <p class="eyebrow">${x.completed ? 'Hotovo' : 'Trénink ukončen předčasně'}</p>
        <h2 class="wk-title">${x.completed ? 'Dobrá práce' : 'Uložíme, co jsi stihl'}</h2>
        <p class="level-meta">
          <span>${minutes} min</span>
          <span>${done} / ${x.rounds} ${plural(x.rounds, 'okruh', 'okruhy', 'okruhů')}</span>
          <span>Týden ${x.week}</span>
        </p>
        <table class="wk-sum">
          <thead><tr><th>Cvik</th><th>Plán</th><th>Odcvičeno</th></tr></thead>
          <tbody>
            ${x.circuit.map((c) => {
              const planned = c.reps * (c.sided ? 2 : 1) * x.rounds;
              const actual = totalDone(x, c);
              return html`<tr class="${actual < planned ? 'short' : ''}"><td>${esc(EXERCISES[c.id].short)}</td><td>${planned}</td><td>${actual}</td></tr>`;
            })}
          </tbody>
        </table>
        <p class="muted small">Součet opakování ze všech okruhů (u jednostranných cviků obě strany).</p>

        <section class="card">
          <h3>Byla technika ve všech cvicích čistá?</h3>
          ${yesNo('cleanTechnique', x.cleanTechnique)}
          <h3>Měl jsi ještě svalovku z minulého tréninku?</h3>
          ${yesNo('soreness', x.soreness)}
          ${x.phase === 'progression'
            ? html`
              <h3>U kterých cviků jsi měl rezervu 2+ opakování?</h3>
              <p class="muted small">Na posledním okruhu, s čistou technikou. Dvakrát po sobě ano → appka navrhne vyšší stupeň.</p>
              <div class="reserve">
                ${x.circuit
                  .filter((c) => PROGRESSION[c.id])
                  .map(
                    (c) => html`
                      <button type="button" data-act="reserve" data-id="${c.id}" class="${x.reserve?.[c.id] ? 'on' : ''}" aria-pressed="${!!x.reserve?.[c.id]}">
                        <span>${esc(EXERCISES[c.id].short)}</span>
                        <small>${esc(stageLabel(c.id, c.stage ?? 0))}</small>
                      </button>`,
                  )}
              </div>`
            : ''}
          <label class="note-field">
            <span>Poznámka <span class="muted">(nepovinná)</span></span>
            <textarea id="note" rows="3" placeholder="Např. koleno při dřepu, nová guma…">${esc(x.note)}</textarea>
          </label>
        </section>
      </div>
      <div class="wk-actions">
        <button type="button" class="btn-primary" data-act="save" ${ready ? '' : 'disabled'}>Uložit trénink</button>
        ${ready ? '' : html`<p class="muted small center">Odpověz na obě otázky — appka podle nich bude navrhovat posun v plánu.</p>`}
        ${x.completed ? '' : html`<button type="button" class="btn-text" data-act="resume">‹ Zpět do tréninku</button>`}
      </div>`;
  }

  function render() {
    const st = steps[w().step];
    const views = { warmup: viewWarmup, ex: viewExercise, trans: viewTransition, rest: viewRest, done: viewDone };
    root.innerHTML = html`<div class="wk wk-${st.t}">${st.t === 'done' ? '' : topBar(st)}${views[st.t](st)}</div>`;
    if (w().step !== shownStep) window.scrollTo(0, 0);
    shownStep = w().step;
  }

  // ---------- ovládání ----------

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const st = steps[w().step];
    const act = btn.dataset.act;

    if (act === 'quit') quit();
    else if (act === 'prev') prev();
    else if (act === 'skip') next();
    else if (act === 'wu') {
      const i = Number(btn.dataset.i);
      save((x) => {
        x.warmup[i].done = !x.warmup[i].done;
      });
      btn.classList.toggle('done');
      btn.setAttribute('aria-pressed', String(w().warmup[i].done));
    } else if (act === 'warmup-done') {
      if (w().warmup.every((it) => it.done) || confirm('Rozehřátí není celé odškrtnuté. Přesto začít okruh?')) next();
    } else if (act === 'reps') {
      const c = w().circuit[st.i];
      const current = getReps(w(), st.r, c, st.side) ?? c.reps;
      const value = Math.min(99, Math.max(0, current + Number(btn.dataset.d)));
      save((x) => setReps(x, st.r, c, st.side, value));
      root.querySelector('#reps').textContent = value;
      root.querySelector('.wk-unit').textContent = value === c.reps ? 'opakování podle plánu' : `opakování · plán ${c.reps}`;
    } else if (act === 'ex-done') {
      const c = w().circuit[st.i];
      if (getReps(w(), st.r, c, st.side) == null) save((x) => setReps(x, st.r, c, st.side, c.reps));
      next();
    } else if (act === 'plus') {
      save((x) => {
        if (x.timer.paused) x.timer.remaining += 15;
        else x.timer.endsAt += 15000;
      });
      soonFired = remaining() <= SOON_SEC;
      tick();
    } else if (act === 'pause') {
      save((x) => {
        x.timer = x.timer.paused ? { endsAt: Date.now() + x.timer.remaining * 1000 } : { paused: true, remaining: remaining() };
      });
      render();
    } else if (act === 'answer') {
      save((x) => {
        x[btn.dataset.q] = btn.dataset.v === 'true';
      });
      render();
    } else if (act === 'reserve') {
      save((x) => {
        x.reserve ??= {};
        x.reserve[btn.dataset.id] = !x.reserve[btn.dataset.id];
      });
      render();
    } else if (act === 'resume') {
      goTo(w().stepBeforeEnd ?? doneIndex - 1);
    } else if (act === 'save') {
      saveSession();
    }
  }

  function onInput(e) {
    if (e.target.id === 'note') save((x) => {
      x.note = e.target.value;
    });
  }

  function saveSession() {
    update((s) => {
      const x = s.inProgress;
      s.sessions.push({
        id: x.start,
        start: x.start,
        end: x.endedAt,
        week: x.week,
        phase: x.phase,
        rounds: x.rounds,
        roundsDone: roundsDone(x),
        completed: x.completed,
        restSec: x.restSec,
        circuit: x.circuit,
        results: x.results,
        cleanTechnique: x.cleanTechnique,
        soreness: x.soreness,
        ...(x.phase === 'progression' && { reserve: { ...x.reserve } }),
        note: x.note.trim(),
      });
      s.inProgress = null;
      s.pendingSuggestion = suggestAfterSession(s);
    });
    location.hash = '#/';
  }

  // Odpočet počítá z času konce, ne z počtu tiků — při zamčeném telefonu se nezpozdí.
  function tick() {
    const x = w();
    if (!x) return;
    const st = steps[x.step];
    if (st.t !== 'trans' && st.t !== 'rest') return;
    const rem = remaining();
    const clock = root.querySelector('#clock');
    if (clock) clock.textContent = formatClock(rem);
    if (x.timer?.paused) return;
    if (st.t === 'rest' && rem <= SOON_SEC && !soonFired) {
      soonFired = true;
      if (rem > 0.5) signalSoon();
    }
    if (rem <= 0) {
      if (st.t === 'rest') signalGo();
      else signalNext();
      next();
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  const timer = setInterval(tick, 250);
  render();
  tick();

  return () => {
    clearInterval(timer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('pointerdown', unlockAudio);
    document.body.classList.remove('in-workout');
    keepScreenOn(false);
  };
}
