const CATEGORY_LABELS = {
  construction: 'Construction & Projets',
  land: 'Foncier & Transactions',
  power: 'Énergie & Réseau',
  legislation: 'Législation',
  market: 'État du marché',
  competition: 'Concurrence & Acteurs',
};

const RELATION_LABELS = {
  concurrent: 'Concurrent',
  partenaire: 'Partenaire',
  'à-qualifier': 'À qualifier',
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
      const related = veilleItems.filter((item) =>
        (c.keywords || []).some((kw) => {
          const hay = `${item.title} ${item.summary}`.toLowerCase();
          return hay.includes(kw.toLowerCase());
        })
      );
      const factsHtml = (c.facts || []).map((f) => `<li>${f}</li>`).join('');
      const relatedHtml = related.length
        ? `<div class="wl-related">
             <span class="wl-related-label">Actus liées (${related.length})</span>
             ${related.map((r) => `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a>`).join('')}
           </div>`
        : `<div class="wl-related"><span class="wl-related-label wl-muted">Aucune actu détectée pour l'instant</span></div>`;
      const website = c.website
        ? `<a class="wl-link" href="${c.website}" target="_blank" rel="noopener noreferrer">${c.website.replace(/^https?:\/\//, '')} →</a>`
        : '';
      const card = document.createElement('article');
      card.className = 'wl-card';
      card.dataset.relation = c.relation;
      card.innerHTML = `
        <div class="wl-head">
          <h3>${c.name}</h3>
          <span class="wl-tag wl-tag-${c.relation}">${RELATION_LABELS[c.relation] || c.relation}</span>
        </div>
        <dl class="wl-meta">
          <div><dt>Forme</dt><dd>${c.legalForm}</dd></div>
          <div><dt>Siège</dt><dd>${c.hq}</dd></div>
          <div><dt>Créée</dt><dd>${c.founded}</dd></div>
        </dl>
        <p class="wl-focus">${c.focus}</p>
        <ul class="wl-facts">${factsHtml}</ul>
        <p class="wl-watch"><span>À surveiller —</span> ${c.watch}</p>
        ${relatedHtml}
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
  const polyGrid = document.getElementById('polymarket-grid');
  let config = { manifoldTerms: ['data center'], polymarket: [] };
  try {
    const res = await fetch('data/predictions.json', { cache: 'no-store' });
    config = await res.json();
  } catch (e) { /* use defaults */ }

  // Polymarket curated links
  polyGrid.innerHTML = (config.polymarket || []).map((p) => `
    <a class="predict-card predict-link" href="${p.url}" target="_blank" rel="noopener noreferrer">
      <span class="predict-platform">Polymarket</span>
      <h4>${p.title}</h4>
      <p>${p.note || ''}</p>
      <span class="predict-cta">Voir le marché →</span>
    </a>
  `).join('');

  // Manifold live
  try {
    const seen = new Set();
    const markets = [];
    for (const term of (config.manifoldTerms || [])) {
      const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&limit=8&sort=score&filter=open`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const m of data) {
        if (m.outcomeType !== 'BINARY' || m.isResolved) continue;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        markets.push(m);
      }
    }
    markets.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    const top = markets.slice(0, 9);
    if (!top.length) {
      manifoldGrid.innerHTML = '<p class="empty-state">Aucun marché ouvert trouvé pour ces termes actuellement.</p>';
      return;
    }
    manifoldGrid.innerHTML = top.map((m) => {
      const pct = Math.round((m.probability || 0) * 100);
      return `
        <a class="predict-card" href="${m.url}" target="_blank" rel="noopener noreferrer">
          <span class="predict-platform">Manifold</span>
          <h4>${m.question}</h4>
          <div class="predict-prob">
            <div class="predict-bar"><span style="width:${pct}%"></span></div>
            <span class="predict-pct">${pct}%</span>
          </div>
          <span class="predict-cta">Voir le marché →</span>
        </a>`;
    }).join('');
  } catch (err) {
    manifoldGrid.innerHTML = '<p class="empty-state">Impossible de charger les cotes Manifold (réseau ?).</p>';
    console.error('Manifold fetch failed', err);
  }
}

/* ---------- Situation ---------- */
async function loadSituation() {
  const grid = document.getElementById('kpi-grid');
  const asOf = document.getElementById('situation-asof');
  const note = document.getElementById('situation-note');
  try {
    const res = await fetch('data/situation.json', { cache: 'no-store' });
    const data = await res.json();
    asOf.textContent = `Chiffres clés — arrêtés au ${data.asOf}.`;
    note.textContent = data.note || '';
    grid.innerHTML = data.kpis.map((k) => `
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-group">${k.group || ''}</span>
          <span class="kpi-trend kpi-trend-${k.trend || 'flat'}">${trendIcon(k.trend)}</span>
        </div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-sub">${k.sub || ''}</div>
        <a class="kpi-source" href="${k.url}" target="_blank" rel="noopener noreferrer">${k.source} →</a>
      </div>
    `).join('');
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
