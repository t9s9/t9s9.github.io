/*
  Publication list — the single source of the markup for the papers in
  publications.json.

  Two consumers, one renderer:

    the browser      imports this module from index.html, hydrates the list that
                     is already in the HTML, and drives the Relevant/All and
                     theme/date controls
    tools/build-publications.mjs
                     imports `renderList` and writes the default view straight
                     into index.html, so the papers are in the served HTML for
                     crawlers (and readers with JS off) instead of appearing
                     only after a fetch

  Anything that produces markup must stay in the pure section below — the moment
  the two consumers render differently, the committed HTML and the live page
  drift apart. `node tools/build-publications.mjs --check` catches that.
*/

/* ------------------------------------------------------------------ *
 * Pure rendering — no DOM, safe to import in Node.
 * ------------------------------------------------------------------ */

const ICON_ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const ICON_CHEV  = '<svg class="chev" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_STAR  = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.7 6.5L22 9.3l-5.5 4.7L18 21l-6-3.4L6 21l1.5-7L2 9.3l7.3-.8L12 2z"/></svg>';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Everything interpolated into the markup goes through this — the JSON is rendered as HTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Stamps `__uid` on every publication from its position in the JSON, so the
 * abstract/author element ids stay stable however the list is filtered or grouped.
 * Mutates and returns `data`.
 */
export function prepare(data) {
  (data.groups || []).forEach((g, gi) => {
    (g.publications || []).forEach((p, pi) => { p.__uid = `${gi}-${pi}`; });
  });
  return data;
}

// Bold the site owner wherever they appear, ignoring a trailing shared-authorship marker.
// Long lists collapse to "<first N>, et al." behind a toggle.
function renderAuthors(authors, me, max, restId) {
  const list = authors || [];
  const name = (a) => (me && a.replace(/\*+$/, '') === me ? `<b>${esc(a)}</b>` : esc(a));
  if (list.length <= max) return list.map(name).join(', ');
  return list.slice(0, max).map(name).join(', ')
    + `<span class="pub-authors-rest" id="${restId}" hidden>, ${list.slice(max).map(name).join(', ')}</span>`
    + `<button class="pub-authors-toggle" aria-expanded="false" aria-controls="${restId}"`
    + ` aria-label="Toggle full author list">`
    + `<span class="et-al">, et al.</span><span class="fewer"> · show less</span>`
    + `</button>`;
}

function renderPub(pub, me, max) {
  const absId = `abs-${pub.__uid}`;
  const restId = `authors-${pub.__uid}`;
  const tag = pub.tag ?? pub.year;
  const hasAbstract = Boolean(pub.abstract);
  const links = (pub.links || [])
    .map((l) => `<a class="pub-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${ICON_ARROW}</a>`)
    .join('');

  return `
      <article class="pub${pub.featured ? ' highlight' : ''}">
        <div class="venue">
          <strong>${esc(pub.venue)}</strong>${tag ? `<span class="venue-tag">${esc(tag)}</span>` : ''}
        </div>
        <div>
          ${pub.award ? `<span class="highlight-badge">${ICON_STAR} ${esc(pub.award)}</span>` : ''}
          <h4 class="pub-title">${pub.url
            ? `<a href="${esc(pub.url)}" target="_blank" rel="noopener">${esc(pub.title)}</a>`
            : esc(pub.title)}</h4>
          <div class="pub-authors">${renderAuthors(pub.authors, me, max, restId)}${pub.note ? ` · <em>${esc(pub.note)}</em>` : ''}</div>
          ${hasAbstract || links ? `<div class="pub-actions">
            ${hasAbstract ? `<button class="pub-abstract-toggle" aria-expanded="false" aria-controls="${absId}">Abstract ${ICON_CHEV}</button>` : ''}
            ${links}
          </div>` : ''}
          ${hasAbstract ? `<p class="pub-abstract-body" id="${absId}" hidden>${esc(pub.abstract)}</p>` : ''}
        </div>
      </article>`;
}

/** Groups as rendered: the JSON's own themes, or one bucket per year, newest first. */
function groupsFor(data, byDate) {
  if (!byDate) return data.groups || [];
  const all = (data.groups || []).flatMap((g) => g.publications || []);
  const years = [...new Set(all.map((p) => p.year))].sort((a, b) => (b ?? 0) - (a ?? 0));
  return years.map((y) => ({
    title: y == null ? 'Undated' : String(y),
    publications: all.filter((p) => p.year === y)
  }));
}

/**
 * The whole list as an HTML string.
 *   showAll — every paper, or only those marked `"relevant": true` in the JSON
 *   byDate  — group by year instead of by the themes the JSON defines
 * Returns { html, count }; `count` is what the live region announces.
 */
export function renderList(data, { showAll = false, byDate = false } = {}) {
  const me = data.highlightAuthor;
  const max = data.maxAuthors ?? 4;
  let count = 0;

  const html = groupsFor(data, byDate)
    .map((group) => {
      const picked = (group.publications || []).filter((pub) => showAll || pub.relevant === true);
      if (!picked.length) return '';
      count += picked.length;
      return `
      <div class="pub-group">
        <h3 class="pub-group-title">${esc(group.title)}</h3>
        ${picked.map((pub) => renderPub(pub, me, max)).join('')}
      </div>`;
    })
    .join('');

  return {
    count,
    html: html + (data.footnote ? `<p class="pub-note">${esc(data.footnote)}</p>` : '')
  };
}

/** The view index.html is built with, and the view the page starts in. */
export const DEFAULT_VIEW = { showAll: false, byDate: false };

/**
 * True when the JSON has a meaningful relevant/all split. Without one the filter
 * would offer an empty list, so both the page and the build fall back to showing
 * everything.
 */
export function hasRelevantSplit(data) {
  const all = (data.groups || []).flatMap((g) => g.publications || []);
  const relevant = all.filter((p) => p.relevant === true).length;
  return { relevant, total: all.length, usable: Boolean(relevant) && relevant !== all.length };
}

/* ------------------------------------------------------------------ *
 * Browser behaviour — skipped entirely when imported from Node.
 * ------------------------------------------------------------------ */

function initToggles() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Delegated on `document`, so they cover both the markup that ships in the HTML
  // and anything re-rendered later. Never attach per-element handlers here.
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.pub-abstract-toggle');
    if (!btn) return;
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    if (!body) return;
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    if (!isOpen) {
      body.removeAttribute('hidden');
      if (!reduceMotion) {
        body.animate(
          [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }],
          { duration: 250, easing: 'ease' }
        );
      }
      btn.setAttribute('aria-expanded', 'true');
    } else if (!reduceMotion) {
      body.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-5px)' }],
        { duration: 180, easing: 'ease' }
      ).onfinish = () => {
        body.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      };
    } else {
      body.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.pub-authors-toggle');
    if (!btn) return;
    const rest = document.getElementById(btn.getAttribute('aria-controls'));
    if (!rest) return;
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    rest.toggleAttribute('hidden', isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
}

/**
 * Hydrates the pre-rendered list: fetches the JSON the page was built from and
 * wires the controls. The list is already on screen, so nothing here has to run
 * for a reader to see the papers — a failed fetch just leaves the built-in view
 * in place and hides the controls it cannot drive.
 */
function initList() {
  const host = document.getElementById('pub-list');
  if (!host) return;

  const filterBar = document.getElementById('pub-filter');
  const scopeEl = document.getElementById('pub-title-scope');
  const modeEl = document.getElementById('pub-title-mode');
  const groupBtn = document.getElementById('pub-group-toggle');
  const liveEl = document.getElementById('pub-live');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let data = null;
  let { showAll, byDate } = DEFAULT_VIEW;

  function syncTitle() {
    if (scopeEl) scopeEl.textContent = showAll ? 'All papers' : 'Selected papers';
    if (modeEl) modeEl.textContent = byDate ? 'date' : 'theme';
    if (groupBtn) {
      groupBtn.setAttribute('aria-pressed', String(byDate));
      groupBtn.setAttribute('aria-label', byDate
        ? 'Grouped by date — press to group by theme'
        : 'Grouped by theme — press to group by date');
    }
  }

  // Swapping the list is silent, so say what changed and cross-fade it.
  function rerender() {
    const { html, count } = renderList(data, { showAll, byDate });
    host.innerHTML = html;
    syncTitle();
    if (liveEl) {
      liveEl.textContent = `Showing ${count} ${showAll ? 'publications' : 'selected publications'}, `
        + `grouped by ${byDate ? 'date' : 'theme'}.`;
    }
    if (!reduceMotion) {
      host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease' });
    }
  }

  function initFilter() {
    const { relevant, total, usable } = hasRelevantSplit(data);
    if (!usable) {
      showAll = true;
      return;
    }
    filterBar.querySelector('[data-count="relevant"]').textContent = relevant;
    filterBar.querySelector('[data-count="all"]').textContent = total;
    filterBar.hidden = false;
    filterBar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-filter]');
      if (!btn) return;
      const next = btn.dataset.filter === 'all';
      if (showAll === next) return;
      showAll = next;
      filterBar.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String((b.dataset.filter === 'all') === showAll));
      });
      rerender();
    });
  }

  fetch('publications.json')
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then((json) => {
      data = prepare(json);
      const startedAll = showAll;
      if (filterBar) initFilter();
      else showAll = true;
      if (groupBtn) {
        groupBtn.addEventListener('click', () => { byDate = !byDate; rerender(); });
      }
      // The HTML already holds DEFAULT_VIEW; only repaint if the fallback in
      // initFilter moved us off it.
      if (showAll !== startedAll) rerender();
      else syncTitle();
    })
    .catch((err) => {
      // The built-in list stays exactly as served — only the controls go.
      console.error('Could not load publications.json:', err);
      if (filterBar) filterBar.hidden = true;
      if (groupBtn) groupBtn.disabled = true;
    });
}

if (typeof document !== 'undefined') {
  initToggles();
  initList();
}
