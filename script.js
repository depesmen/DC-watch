const CATEGORY_LABELS = {
  construction: 'Construction & Projets',
  land: 'Foncier & Transactions',
  power: 'Énergie & Réseau',
  legislation: 'Législation',
  market: 'État du marché',
  competition: 'Concurrence & Acteurs',
};

const grid = document.getElementById('card-grid');
const emptyState = document.getElementById('empty-state');
const takeawaysList = document.getElementById('takeaways-list');
const updatedBadge = document.getElementById('updated-badge');
const filterButtons = document.querySelectorAll('.filter-btn');

let allItems = [];
let activeFilter = 'all';

function formatDate(iso) {
  const parts = iso.split('-');
  if (parts.length === 3) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return iso;
}

function renderCards() {
  const items = activeFilter === 'all'
    ? allItems
    : allItems.filter((item) => item.category === activeFilter);

  grid.innerHTML = '';
  emptyState.hidden = items.length > 0;

  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.category = item.category;
    card.innerHTML = `
      <div class="card-top">
        <span class="badge badge-${item.category}">${CATEGORY_LABELS[item.category] || item.category}</span>
        <span class="card-meta">${item.region} · ${formatDate(item.date)}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <a class="card-source" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.source} →</a>
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

async function loadData() {
  try {
    const res = await fetch('data/veille.json', { cache: 'no-store' });
    const data = await res.json();
    allItems = data.items || [];
    updatedBadge.textContent = `Dernière mise à jour : ${formatDate(data.lastUpdated)}`;
    renderTakeaways(data.keyTakeaways || []);
    renderCards();
  } catch (err) {
    emptyState.hidden = false;
    emptyState.textContent = "Impossible de charger la veille pour l'instant.";
    console.error('Failed to load veille.json', err);
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
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');
    subscribeMessage.textContent = 'Merci ! Vous recevrez les prochains résumés hebdomadaires.';
    subscribeForm.reset();
  } catch (err) {
    subscribeMessage.classList.add('is-error');
    subscribeMessage.textContent = err.message || "Une erreur est survenue, réessayez plus tard.";
  }
});

loadData();
