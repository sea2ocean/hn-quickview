const API_BASE = 'https://hacker-news.firebaseio.com/v0';
const TOP_COUNT = 30;
let currentFeed = 'top'; // default

const CACHE_TTL = 1000 * 60 * 2;
const statusEl = document.getElementById('status');
const storiesEl = document.getElementById('stories');
const refreshBtn = document.getElementById('refresh');
const tabButtons = document.querySelectorAll('#tabs button');

refreshBtn.addEventListener('click', () => fetchAndRender(true));

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFeed = btn.dataset.feed;
    fetchAndRender(false);
  });
});

function cacheKey() {
  return `hn_quickview_cache_${currentFeed}`;
}

function timeAgo(unixSecs) {
  const diff = Date.now() - unixSecs * 1000;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function renderStories(items) {
  storiesEl.innerHTML = '';
  if (!items || items.length === 0) {
    statusEl.textContent = 'No stories found.';
    return;
  }
  statusEl.textContent = '';
  items.forEach(item => {
    if (!item) return;
    const li = document.createElement('li');
    li.className = 'story';

    const titleLink = document.createElement('a');
    titleLink.className = 'title';
    titleLink.textContent = item.title || '(no title)';
    titleLink.href = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const comments = item.descendants ? `${item.descendants} comments` : '0 comments';
    meta.textContent = `${item.score || 0} pts — by ${item.by || 'unknown'} — ${timeAgo(item.time)} — ${comments}`;

    li.appendChild(titleLink);
    li.appendChild(meta);
    storiesEl.appendChild(li);
  });
}

function saveCache(items) {
  const payload = { ts: Date.now(), items };
  localStorage.setItem(cacheKey(), JSON.stringify(payload));
}

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.ts || !data.items) return null;
    if (Date.now() - data.ts > CACHE_TTL) return null;
    return data.items;
  } catch {
    return null;
  }
}

async function fetchItem(id) {
  try {
    const url = `${API_BASE}/item/${id}.json`;
    const r = await fetch(url);
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchAndRender(force = false) {
  if (!force) {
    const cached = loadCache();
    if (cached) {
      renderStories(cached);
    }
  }

  statusEl.textContent = 'Fetching stories…';
  const endpoint = currentFeed === 'top' ? 'topstories' : 'newstories';

  try {
    const topUrl = `${API_BASE}/${endpoint}.json`;
    const r = await fetch(topUrl);
    const ids = await r.json();
    const slice = (ids && ids.slice(0, TOP_COUNT)) || [];
    const items = await Promise.all(slice.map(id => fetchItem(id)));
    const filtered = items.filter(Boolean);
    renderStories(filtered);
    saveCache(filtered);
    statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    statusEl.textContent = 'Failed to fetch stories — showing cached (if any).';
    console.error(err);
  }
}

fetchAndRender();