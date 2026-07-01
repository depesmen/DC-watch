const CATEGORY_LABELS = {
  construction: 'Construction & Projets',
  land: 'Foncier & Transactions',
  power: 'Énergie & Réseau',
  legislation: 'Législation',
  market: 'État du marché',
  competition: 'Concurrence & Acteurs',
};

/* ---------- Tabs ---------- */
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
let predictionsLoaded = false;

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
    views.forEach((v) => v.classList.toggle('is-active', v.id === `view-${target}`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (target === 'previsions' && !predictionsLoaded) {
      predictionsLoaded = true;
      loadPredictions();
    }
  });
});

/* ---------- Utils ---------- */
function formatDate(iso) {
  const parts = iso.split('-');
  if (parts.length === 3) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return iso;
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function faviconOf(url) {
  const d = domainOf(url);
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=32` : '';
}

/* ---------- Veille ---------- */
const grid = document.getElementById('card-grid');
const emptyState = document.getElementById('empty-state');
const takeawaysList = document.getElementById('takeaways-list');
const updatedBadge = document.getElementById('updated-badge');
const filterButtons = document.querySelectorAll('.filter-btn');

let allItems = [];
let activeFilter = 'all';

function renderCards() {
  const items = activeFilter === 'all' ? allItems : allItems.filter((i) => i.category === activeFilter);
  grid.innerHTML = '';
  emptyState.hidden = items.length > 0;
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.category = item.category;
    const fav = faviconOf(item.url);
    card.innerHTML = `
      <div class="card-top">
        <span class="badge badge-${item.category}">${CATEGORY_LABELS[item.category] || item.category}</span>
        <span class="card-meta">${item.region} · ${formatDate(item.date)}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <a class="card-source" href="${item.url}" target="_blank" rel="noopener noreferrer">
        ${fav ? `<img class="card-favicon" src="${fav}" alt="" width="16" height="16" loading="lazy">` : ''}
        <span>${item.source} →</span>
      </a>
    `;
    grid.appendChild(card);
  }
}

function renderTakeaways(takeaways) {
  takeawaysList.innerHTML = '';
  for (const point of takeaways) {
    const li = document.createElement('li');
    li.textContent = point;
    takeawaysList.appendChild(li);
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    activeFilter = btn.dataset.filter;
    renderCards();
  });
});

function renderAggregates(items, lastUpdated) {
  // Freshness counter
  const status = document.getElementById('feed-status');
  if (status) {
    status.innerHTML = `<strong>${items.length}</strong> actus &middot; Mis à jour le ${formatDate(lastUpdated)}`;
  }

  // Filter counts
  const byCat = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] || 0) + 1;
  filterButtons.forEach((btn) => {
    const f = btn.dataset.filter;
    const n = f === 'all' ? items.length : (byCat[f] || 0);
    let badge = btn.querySelector('.filter-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'filter-count';
      btn.appendChild(badge);
    }
    badge.textContent = n;
  });

  // Region breakdown
  const byRegion = {};
  for (const it of items) byRegion[it.region] = (byRegion[it.region] || 0) + 1;
  const regionList = document.getElementById('region-breakdown');
  if (regionList) {
    regionList.innerHTML = Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `<li><span class="side-name">${name}</span><span class="side-count">${n}</span></li>`)
      .join('');
  }

  // Source breakdown (with favicon)
  const bySource = {};
  for (const it of items) {
    if (!bySource[it.source]) bySource[it.source] = { count: 0, url: it.url };
    bySource[it.source].count += 1;
  }
  const sourceList = document.getElementById('source-breakdown');
  if (sourceList) {
    sourceList.innerHTML = Object.entries(bySource)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, info]) => {
        const fav = faviconOf(info.url);
        return `<li>
          <span class="side-name">${fav ? `<img src="${fav}" alt="" width="14" height="14" loading="lazy">` : ''}${name}</span>
          <span class="side-count">${info.count}</span>
        </li>`;
      })
      .join('');
  }
}

async function loadVeille() {
  try {
    const res = await fetch('data/veille.json', { cache: 'no-store' });
    const data = await res.json();
    allItems = data.items || [];
    updatedBadge.textContent = `Dernière mise à jour : ${formatDate(data.lastUpdated)}`;
    renderTakeaways(data.keyTakeaways || []);
    renderCards();
    renderAggregates(allItems, data.lastUpdated);
    return allItems;
  } catch (err) {
    emptyState.hidden = false;
    emptyState.textContent = "Impossible de charger la veille pour l'instant.";
    console.error('Failed to load veille.json', err);
    return [];
  }
}

/* ---------- Concurrents & Partenaires ---------- */
async function loadWatchlist(veilleItems) {
  const grid = document.getElementById('watchlist-grid');
  try {
    const res = await fetch('data/watchlist.json', { cache: 'no-store' });
    const data = await res.json();
    grid.innerHTML = '';
    for (const c of data.companies) {
      // Curated news + any veille items mentioning the company (dedup by url)
      const matched = veilleItems.filter((item) =>
        (c.keywords || []).some((kw) => `${item.title} ${item.summary}`.toLowerCase().includes(kw.toLowerCase()))
      ).map((item) => ({ date: item.date, title: item.title, source: item.source, url: item.url }));
      const seenUrls = new Set((c.news || []).map((n) => n.url));
      const news = [...(c.news || []), ...matched.filter((m) => !seenUrls.has(m.url))];

      const factsHtml = (c.facts || []).map((f) => `<li>${f}</li>`).join('');
      const newsHtml = news.length
        ? `<div class="wl-news">
             <span class="wl-news-label">Dernières infos</span>
             ${news.map((n) => `
               <a class="wl-news-item" href="${n.url}" target="_blank" rel="noopener noreferrer">
                 <span class="wl-news-date">${formatDate(n.date)}</span>
                 <span class="wl-news-title">${n.title}</span>
                 <span class="wl-news-src">${n.source}</span>
               </a>`).join('')}
           </div>`
        : `<div class="wl-news"><span class="wl-news-label wl-muted">Aucune info récente</span></div>`;
      const website = c.website
        ? `<a class="wl-link" href="${c.website}" target="_blank" rel="noopener noreferrer">${c.website.replace(/^https?:\/\//, '')} →</a>`
        : '';
      const card = document.createElement('article');
      card.className = 'wl-card';
      card.dataset.accent = c.accent || 'cyan';
      card.innerHTML = `
        <div class="wl-head">
          <h3>${c.name}</h3>
        </div>
        <dl class="wl-meta">
          <div><dt>Forme</dt><dd>${c.legalForm}</dd></div>
          <div><dt>Siège</dt><dd>${c.hq}</dd></div>
        </dl>
        <p class="wl-focus">${c.focus}</p>
        <ul class="wl-facts">${factsHtml}</ul>
        ${newsHtml}
        <p class="wl-watch"><span>À surveiller —</span> ${c.watch}</p>
        ${website}
      `;
      grid.appendChild(card);
    }
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Impossible de charger la watchlist.</p>';
    console.error('Failed to load watchlist.json', err);
  }
}

/* ---------- Prévisions ---------- */
async function loadPredictions() {
  const manifoldGrid = document.getElementById('manifold-grid');
  let config = { manifold: [] };
  try {
    const res = await fetch('data/predictions.json', { cache: 'no-store' });
    config = await res.json();
  } catch (e) { /* use defaults */ }

  const entries = config.manifold || [];
  if (!entries.length) {
    manifoldGrid.innerHTML = '<p class="empty-state">Aucun marché configuré.</p>';
    return;
  }

  // Fetch each curated market live by slug
  const results = await Promise.all(entries.map(async (entry) => {
    try {
      const res = await fetch(`https://api.manifold.markets/v0/slug/${entry.slug}`);
      if (!res.ok) return null;
      const m = await res.json();
      return { titleFr: entry.titleFr, pct: Math.round((m.probability || 0) * 100), url: m.url, closed: m.isResolved };
    } catch { return null; }
  }));

  const cards = results.filter((r) => r && !r.closed);
  if (!cards.length) {
    manifoldGrid.innerHTML = '<p class="empty-state">Impossible de charger les cotes Manifold (réseau ?).</p>';
    return;
  }

  manifoldGrid.innerHTML = cards.map((c) => `
    <a class="predict-card" href="${c.url}" target="_blank" rel="noopener noreferrer">
      <span class="predict-platform">Manifold · cote en direct</span>
      <h4>${c.titleFr}</h4>
      <div class="predict-prob">
        <div class="predict-bar"><span style="width:${c.pct}%"></span></div>
        <span class="predict-pct">${c.pct}% <span class="predict-yes">Oui</span></span>
      </div>
      <span class="predict-cta">Voir le marché →</span>
    </a>`).join('');
}

/* ---------- Situation ---------- */
async function loadSituation() {
  const grid = document.getElementById('kpi-grid');
  const asOf = document.getElementById('situation-asof');
  const note = document.getElementById('situation-note');
  try {
    const res = await fetch('data/situation.json', { cache: 'no-store' });
    const data = await res.json();
    asOf.textContent = `Chiffres clés par région — arrêtés au ${data.asOf}.`;
    note.textContent = data.note || '';
    grid.innerHTML = (data.regions || []).map((region, i) => `
      <section class="kpi-region ${i === 0 ? 'is-open' : ''}">
        <button class="kpi-region-header" type="button" aria-expanded="${i === 0}">
          <span class="kpi-region-flag">${region.flag || ''}</span>
          <span class="kpi-region-name">${region.name}</span>
          <span class="kpi-region-count">${region.kpis.length}</span>
          <span class="kpi-region-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="kpi-region-body">
          <div class="kpi-region-grid">
            ${region.kpis.map((k) => `
              <div class="kpi-card">
                <div class="kpi-top">
                  <span class="kpi-group">${region.flag || ''} ${region.name}</span>
                  <span class="kpi-trend kpi-trend-${k.trend || 'flat'}">${trendIcon(k.trend)}</span>
                </div>
                <div class="kpi-value">${k.value}</div>
                <div class="kpi-label">${k.label}</div>
                <div class="kpi-sub">${k.sub || ''}</div>
                <a class="kpi-source" href="${k.url}" target="_blank" rel="noopener noreferrer">${k.source} →</a>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `).join('');

    grid.querySelectorAll('.kpi-region-header').forEach((header) => {
      header.addEventListener('click', () => {
        const region = header.closest('.kpi-region');
        const open = region.classList.toggle('is-open');
        header.setAttribute('aria-expanded', open);
      });
    });
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Impossible de charger les chiffres du marché.</p>';
    console.error('Failed to load situation.json', err);
  }
}

function trendIcon(trend) {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '■';
}

/* ---------- Newsletter ---------- */
const subscribeForm = document.getElementById('subscribe-form');
const subscribeMessage = document.getElementById('subscribe-message');

subscribeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  subscribeMessage.classList.remove('is-error');
  subscribeMessage.textContent = 'Inscription en cours…';
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erreur lors de l'inscription");
    subscribeMessage.textContent = 'Merci ! Vous recevrez les prochains résumés hebdomadaires.';
    subscribeForm.reset();
  } catch (err) {
    subscribeMessage.classList.add('is-error');
    subscribeMessage.textContent = err.message || 'Une erreur est survenue, réessayez plus tard.';
  }
});

/* ---------- Init ---------- */
(async function init() {
  const items = await loadVeille();
  loadWatchlist(items);
  loadSituation();
})();
