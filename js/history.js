// Historie tréninků, pravidelnost a progress po cvicích.
import { CIRCUIT_ORDER, EXERCISES, stageLabel } from './plan.js';
import { getState, update } from './store.js';
import { esc, formatTime, html, plural } from './util.js';

const DAY = 86400000;
const WEEKS_SHOWN = 12;
const TARGET_PER_WEEK = 2;

// ---------- odvozená data ----------

export function sessionTotal(s, id) {
  return s.results.reduce((sum, round) => {
    const v = round?.[id];
    if (v == null) return sum;
    return sum + (typeof v === 'number' ? v : (v.L ?? 0) + (v.R ?? 0));
  }, 0);
}

function plannedTotal(s, c) {
  return c.reps * (c.sided ? 2 : 1) * s.rounds;
}

function minutes(s) {
  return Math.max(1, Math.round((new Date(s.end) - new Date(s.start)) / 60000));
}

function sessionLevel(s) {
  return s.phase === 'progression' ? 'Progrese' : `Týden ${s.week}`;
}

function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const fmtDay = (d) => new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
const fmtDate = (d) => new Date(d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });

function weeklyCounts(sessions) {
  const thisMonday = mondayOf(Date.now()).getTime();
  return Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = thisMonday - (WEEKS_SHOWN - 1 - i) * 7 * DAY;
    const count = sessions.filter((s) => {
      const t = new Date(s.start).getTime();
      return t >= start && t < start + 7 * DAY;
    }).length;
    return { start, count };
  });
}

// Nejmenší „hezké“ číslo nad maximem, aby osa končila na kulaté hodnotě.
function niceCeil(v) {
  const steps = [5, 10, 20, 25, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 100) * 100;
}

// ---------- grafy (SVG, jedna řada = jedna barva, bez legendy) ----------

const W = 340;
const PAD = { l: 30, r: 34, t: 14, b: 22 };

// Body pro tooltip si graf nese v data-points; čte je bindCharts().
function lineChart(id, points) {
  const H = 130;
  const max = niceCeil(Math.max(...points.map((p) => p.y)) * 1.05);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const last = points.at(-1);
  const ticks = [0, max / 2, max];
  const pts = points.map((p, i) => ({ x: +x(i).toFixed(1), y: +y(p.y).toFixed(1), value: p.label, sub: p.sub }));

  return html`
    <div class="chart" data-chart="${id}" data-points="${esc(JSON.stringify(pts))}" tabindex="0"
         aria-label="Graf, šipkami vlevo a vpravo projdeš jednotlivé tréninky">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">
        ${ticks.map(
          (t) => html`
            <line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"></line>
            <text class="tick" x="${PAD.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t}</text>`,
        )}
        <path class="area" d="${area}"></path>
        <path class="line" d="${path}"></path>
        <line class="xh" x1="0" x2="0" y1="${PAD.t}" y2="${PAD.t + ih}" visibility="hidden"></line>
        <circle class="dot" cx="${x(points.length - 1)}" cy="${y(last.y)}" r="4"></circle>
        <circle class="dot hl" r="4" visibility="hidden"></circle>
        <text class="end" x="${x(points.length - 1) + 8}" y="${y(last.y) + 4}">${last.y}</text>
        <text class="tick" x="${PAD.l}" y="${H - 6}">${esc(points[0].axis)}</text>
        ${points.length > 1 ? html`<text class="tick" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${esc(last.axis)}</text>` : ''}
      </svg>
      <div class="tip" hidden></div>
    </div>`;
}

function weekChart(weeks) {
  const H = 120;
  const max = Math.max(3, ...weeks.map((w) => w.count));
  const iw = W - PAD.l - 10;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / weeks.length;
  const bw = Math.min(24, slot - 2);
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);
  const pts = weeks.map((w, i) => ({
    x: +(PAD.l + slot * i + slot / 2).toFixed(1),
    value: `${w.count} ${plural(w.count, 'trénink', 'tréninky', 'tréninků')}`,
    sub: `týden od ${fmtDay(w.start)}`,
  }));

  // Sloupec: zaoblený jen datový konec (4 px), u základny rovný.
  const bar = (cx, v) => {
    if (!v) return '';
    const top = y(v);
    const base = y(0);
    const r = Math.min(4, (base - top) / 2);
    const l = cx - bw / 2;
    return `<path class="bar" d="M${l} ${base} V${top + r} Q${l} ${top} ${l + r} ${top} H${l + bw - r} Q${l + bw} ${top} ${l + bw} ${top + r} V${base} Z"></path>`;
  };

  return html`
    <div class="chart" data-chart="weeks" data-points="${esc(JSON.stringify(pts))}" data-mode="bars" tabindex="0"
         aria-label="Tréninky po týdnech, šipkami projdeš jednotlivé týdny">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">
        ${ticks.map(
          (t) => html`
            <line class="grid" x1="${PAD.l}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}"></line>
            <text class="tick" x="${PAD.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${t}</text>`,
        )}
        ${weeks.map((w, i) => bar(PAD.l + slot * i + slot / 2, w.count))}
        <line class="target" x1="${PAD.l}" x2="${W - 10}" y1="${y(TARGET_PER_WEEK)}" y2="${y(TARGET_PER_WEEK)}"></line>
        <text class="tick target-label" x="${W - 10}" y="${y(TARGET_PER_WEEK) - 4}" text-anchor="end">cíl</text>
        <rect class="bar-hl" visibility="hidden" y="${PAD.t}" width="${slot}" height="${ih}"></rect>
        ${weeks.map((w, i) =>
          i % 3 === 2 || i === weeks.length - 1
            ? html`<text class="tick" x="${PAD.l + slot * i + slot / 2}" y="${H - 6}" text-anchor="middle">${i === weeks.length - 1 ? 'tento' : fmtDay(w.start)}</text>`
            : '',
        )}
      </svg>
      <div class="tip" hidden></div>
    </div>`;
}

// ---------- pohledy ----------

const REASON = {
  manual: 'ručně v nastavení',
  advance: 'posun podle plánu',
  back: 'zpět po pauze',
  restart: 'od začátku po pauze',
  progression: 'přechod do progrese',
  stage: 'vyšší stupeň',
  stagesDown: 'stupně dolů po pauze',
};

function levelText(l) {
  if (l == null) return '?';
  if (typeof l === 'number') return `Týden ${l}`; // záznamy z verze 0.1
  return l.phase === 'progression' ? 'Progrese' : `Týden ${l.week}`;
}

function levelChangeText(h) {
  if (h.reason === 'stage' || h.reason === 'stagesDown' || (h.reason === 'manual' && h.from?.phase === 'progression' && h.to?.phase === 'progression')) {
    const changes = Object.keys(h.to?.progression ?? {})
      .filter((id) => h.from?.progression?.[id] !== h.to.progression[id])
      .map((id) => `${EXERCISES[id].short} ${h.from?.progression?.[id] ?? 0} → ${h.to.progression[id]}`);
    if (changes.length) return changes.join(', ');
  }
  return `${levelText(h.from)} → ${levelText(h.to)}`;
}

export function viewHistory() {
  const { sessions, levelHistory } = getState();
  if (!sessions.length) {
    return html`
      <section class="card">
        <h3>Zatím tu nic není</h3>
        <p class="muted">Po prvním uloženém tréninku tu uvidíš seznam tréninků, pravidelnost a jak ti rostou čísla u jednotlivých cviků.</p>
        <a class="link-small" href="#/">Na začátek tréninku</a>
      </section>`;
  }

  const weeks = weeklyCounts(sessions);
  const last8 = weeks.slice(-9, -1); // celé uplynulé týdny bez rozběhnutého
  const avg = last8.reduce((a, w) => a + w.count, 0) / last8.length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = sessions.filter((s) => new Date(s.start) >= monthStart).length;

  const charts = CIRCUIT_ORDER.map((id) => {
    const points = sessions
      .filter((s) => s.circuit.some((c) => c.id === id))
      .map((s) => {
        const c = s.circuit.find((x) => x.id === id);
        const total = sessionTotal(s, id);
        const stage = c.stage != null ? ` · ${stageLabel(id, c.stage)}` : c.variant ? ` · ${c.variant}` : '';
        return {
          y: total,
          label: `${total} opakování`,
          sub: `${fmtDay(s.start)} · ${sessionLevel(s)}${stage}`,
          axis: fmtDay(s.start),
          raw: { date: s.start, total, planned: plannedTotal(s, c), level: sessionLevel(s) + stage },
        };
      });
    return { id, points };
  }).filter((c) => c.points.length);

  return html`
    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Tréninků celkem</span><span class="kpi-value">${sessions.length}</span></div>
      <div class="kpi"><span class="kpi-label">Tento měsíc</span><span class="kpi-value">${thisMonth}</span></div>
      <div class="kpi"><span class="kpi-label">Průměr za týden</span><span class="kpi-value">${avg.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })}×</span><span class="kpi-sub">posledních 8 týdnů · cíl ${TARGET_PER_WEEK}×</span></div>
    </div>

    <section class="card">
      <h3>Pravidelnost</h3>
      <p class="muted small">Tréninky za týden, posledních ${WEEKS_SHOWN} týdnů. Vodorovná čára = cíl ${TARGET_PER_WEEK}× týdně.</p>
      ${weekChart(weeks)}
    </section>

    <h3 class="list-head">Progress po cvicích</h3>
    <p class="muted small">Součet opakování za trénink (všechny okruhy, u jednostranných cviků obě strany). Ve fázi progrese čísla stojí a roste obtížnost — stupeň uvidíš po klepnutí na bod.</p>
    ${charts.map(
      (c) => html`
        <section class="card chart-card">
          <h3>${esc(EXERCISES[c.id].name)}</h3>
          ${lineChart(c.id, c.points)}
          <details class="chart-table">
            <summary>Tabulka</summary>
            <table>
              <thead><tr><th>Datum</th><th>Úroveň</th><th>Plán</th><th>Odcvičeno</th></tr></thead>
              <tbody>
                ${c.points
                  .slice()
                  .reverse()
                  .map((p) => html`<tr><td>${fmtDay(p.raw.date)}</td><td>${esc(p.raw.level)}</td><td>${p.raw.planned}</td><td>${p.raw.total}</td></tr>`)}
              </tbody>
            </table>
          </details>
        </section>`,
    )}

    ${levelHistory.length
      ? html`
        <h3 class="list-head">Změny úrovně</h3>
        <ol class="timeline card">
          ${levelHistory
            .slice()
            .reverse()
            .map(
              (h) => html`
                <li>
                  <span class="tl-date">${fmtDay(h.date)}</span>
                  <span><strong>${esc(levelChangeText(h))}</strong> <span class="muted small">${esc(REASON[h.reason] ?? h.reason)}</span></span>
                </li>`,
            )}
        </ol>`
      : ''}

    <h3 class="list-head">Tréninky</h3>
    <ul class="ex-list">
      ${sessions
        .slice()
        .reverse()
        .map(
          (s) => html`
            <li>
              <a class="ex-row session-row" href="#/historie/${encodeURIComponent(s.id)}">
                <span class="ex-text">
                  <span class="ex-name">${fmtDate(s.start)}</span>
                  <span class="ex-target">${sessionLevel(s)} · ${minutes(s)} min · ${s.roundsDone}/${s.rounds} ${plural(s.rounds, 'okruh', 'okruhy', 'okruhů')}${s.completed ? '' : ' · nedokončený'}</span>
                  ${s.note ? html`<span class="session-note">${esc(s.note)}</span>` : ''}
                </span>
                <span class="flags">
                  ${s.cleanTechnique ? html`<span class="flag-ok" title="Čistá technika">✓ technika</span>` : html`<span class="flag-warn">✗ technika</span>`}
                  ${s.soreness ? html`<span class="flag-warn">svalovka</span>` : ''}
                </span>
              </a>
            </li>`,
        )}
    </ul>
  `;
}

export function viewSession(rawId) {
  const id = decodeURIComponent(rawId);
  const s = getState().sessions.find((x) => x.id === id);
  if (!s) return html`<p class="card">Trénink nenalezen. <a href="#/historie">Zpět na historii</a></p>`;
  const rounds = Array.from({ length: s.rounds }, (_, r) => r);
  const cell = (r, c) => {
    const v = s.results[r]?.[c.id];
    if (v == null) return '<td class="muted">—</td>';
    const short = (n) => (n < c.reps ? `<span class="short">${n}</span>` : n);
    return `<td>${typeof v === 'number' ? short(v) : `${v.L == null ? '—' : short(v.L)}/${v.R == null ? '—' : short(v.R)}`}</td>`;
  };

  return html`
    <header class="ex-header">
      <p class="eyebrow">${sessionLevel(s)} · ${formatTime(s.start)}–${formatTime(s.end)}</p>
      <h2>${fmtDate(s.start)}</h2>
      <div class="chips">
        <span class="chip">${minutes(s)} min</span>
        <span class="chip">${s.roundsDone} / ${s.rounds} ${plural(s.rounds, 'okruh', 'okruhy', 'okruhů')}</span>
        ${s.completed ? '' : html`<span class="chip warn">nedokončený</span>`}
      </div>
    </header>

    <dl class="facts card">
      <div><dt>Technika</dt><dd>${s.cleanTechnique ? 'čistá' : 'nečistá'}</dd></div>
      <div><dt>Svalovka</dt><dd>${s.soreness ? 'ano, z minulého tréninku' : 'ne'}</dd></div>
      ${s.reserve
        ? html`<div><dt>Rezerva 2+</dt><dd>${Object.entries(s.reserve).filter(([, v]) => v).map(([k]) => EXERCISES[k].short).join(', ') || 'u žádného cviku'}</dd></div>`
        : ''}
      ${s.note ? html`<div><dt>Poznámka</dt><dd>${esc(s.note)}</dd></div>` : ''}
    </dl>

    <section class="card">
      <h3>Po okruzích</h3>
      <p class="muted small">Jednostranné cviky: levá / pravá. Červeně méně, než bylo v plánu.</p>
      <div class="tablewrap flush">
        <table class="plan rounds">
          <thead><tr><th>Cvik</th><th>Plán</th>${rounds.map((r) => html`<th>${r + 1}.</th>`)}</tr></thead>
          <tbody>
            ${s.circuit.map(
              (c) => html`
                <tr>
                  <td>${esc(EXERCISES[c.id].short)}${c.variant ? html`<em>${esc(c.variant)}</em>` : ''}</td>
                  <td>${c.reps}</td>
                  ${rounds.map((r) => cell(r, c))}
                </tr>`,
            )}
          </tbody>
        </table>
      </div>
    </section>

    <button type="button" class="btn-text danger" data-act="delete-session" data-id="${esc(s.id)}">Smazat tento trénink</button>
  `;
}

// ---------- interakce ----------

export function bindHistory(root) {
  root.querySelectorAll('.chart').forEach(bindChart);
  root.querySelector('[data-act="delete-session"]')?.addEventListener('click', (e) => {
    if (!confirm('Smazat tento trénink z historie? Nejde to vrátit.')) return;
    const id = e.currentTarget.dataset.id;
    update((s) => {
      s.sessions = s.sessions.filter((x) => x.id !== id);
      if (s.pendingSuggestion?.sessionId === id) s.pendingSuggestion = null;
    });
    location.hash = '#/historie';
  });
}

// Klepnutí / tah prstem / šipky: nejbližší bod, svislá čára a popisek. Tooltip jen doplňuje — hodnoty jsou i v tabulce.
function bindChart(el) {
  const pts = JSON.parse(el.dataset.points);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('.tip');
  const bars = el.dataset.mode === 'bars';
  const xh = svg.querySelector('.xh');
  const hl = svg.querySelector('.dot.hl');
  const barHl = svg.querySelector('.bar-hl');
  let current = -1;

  function show(i) {
    current = i;
    const p = pts[i];
    if (bars) {
      barHl.setAttribute('x', p.x - Number(barHl.getAttribute('width')) / 2);
      barHl.setAttribute('visibility', 'visible');
    } else {
      xh.setAttribute('x1', p.x);
      xh.setAttribute('x2', p.x);
      xh.setAttribute('visibility', 'visible');
      hl.setAttribute('cx', p.x);
      hl.setAttribute('cy', p.y);
      hl.setAttribute('visibility', 'visible');
    }
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = p.value;
    const sub = document.createElement('span');
    sub.textContent = p.sub;
    tip.append(strong, sub);
    tip.hidden = false;
    const scale = el.clientWidth / W;
    const left = Math.min(Math.max(p.x * scale - tip.offsetWidth / 2, 0), el.clientWidth - tip.offsetWidth);
    tip.style.left = `${left}px`;
  }

  function hide() {
    current = -1;
    tip.hidden = true;
    xh?.setAttribute('visibility', 'hidden');
    hl?.setAttribute('visibility', 'hidden');
    barHl?.setAttribute('visibility', 'hidden');
  }

  function nearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i;
    });
    return best;
  }

  el.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) show(nearest(e.clientX));
  });
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hide();
  });
  el.addEventListener('blur', hide);
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    show(Math.min(pts.length - 1, Math.max(0, (current < 0 ? (step > 0 ? -1 : pts.length) : current) + step)));
  });
}
