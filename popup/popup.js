const API_BASE = 'https://hacker-news.firebaseio.com/v0';
const TOP_COUNT = 30;
let stories = [];
let currentIndex = 0;
let currentFeed = 'top'; // default

const CACHE_TTL = 1000 * 60 * 2;
const statusEl = document.getElementById('status');
const storiesEl = document.getElementById('stories');
const refreshBtn = document.getElementById('refresh');
const tabButtons = document.querySelectorAll('#tabs button');
const loadMoreBtn = document.getElementById('load-more');

refreshBtn.addEventListener('click', () => {
  currentIndex = 0;
  fetchAndRender(true)
});

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFeed = btn.dataset.feed;
    currentIndex = 0;
    fetchAndRender(false);
  });
});

loadMoreBtn.addEventListener('click', () => {
  currentIndex += TOP_COUNT;
  fetchAndRender(false, true);
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

// Update renderStories to support append mode
function renderStories(items, append = false) {
  if (!append) storiesEl.innerHTML = '';
  if (!items || items.length === 0) {
    statusEl.textContent = 'No stories found.';
    return;
  }
  statusEl.textContent = '';
  const existingIds = new Set(Array.from(storiesEl.querySelectorAll('li')).map(li => li.dataset.id));
  items.forEach((item, idx) => {
    if (!item) return;
    const li = document.createElement('li');
    li.className = 'story';
    li.dataset.id = item.id; // For deduplication

    // News number (global index)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'story-header';

    const numberSpan = document.createElement('span');
    numberSpan.className = 'story-number';
    numberSpan.textContent = `${currentIndex + idx + 1}. `;

    // Highlight if newly fetched (when appending)
    if (append && !existingIds.has(String(item.id))) {
      li.classList.add('newly-fetched');
      setTimeout(() => li.classList.remove('newly-fetched'), 1500);
    }

    // Title link
    const titleLink = document.createElement('a');
    titleLink.className = 'title';
    titleLink.textContent = item.title || '(no title)';
    titleLink.href = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';

    // Source domain
    let domain = '';
    if (item.url) {
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '');
      } catch {}
    }
    if (domain) {
      const domainSpan = document.createElement('span');
      domainSpan.className = 'source-domain';
      domainSpan.textContent = ` (${domain})`;
      domainSpan.style.color = '#888';
      domainSpan.style.fontSize = '12px';
      titleLink.appendChild(domainSpan);
    }

    headerDiv.appendChild(numberSpan);
    headerDiv.appendChild(titleLink);
    li.appendChild(headerDiv);

    // Meta info
    const meta = document.createElement('div');
    meta.className = 'meta';
    const comments = item.descendants ? `${item.descendants} comments` : '0 comments';
    meta.textContent = `${item.score || 0} pts — by ${item.by || 'unknown'} — ${timeAgo(item.time)} — ${comments}`;

    // Comments link
    const commentsLink = document.createElement('a');
    commentsLink.href = `https://news.ycombinator.com/item?id=${item.id}`;
    commentsLink.textContent = comments;
    commentsLink.target = '_blank';
    commentsLink.rel = 'noopener noreferrer';
    commentsLink.style.marginLeft = '5px';

    // Append elements
    meta.appendChild(commentsLink);
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

async function fetchAndRender(force = false, append = false) {
  if (!force && !append) {
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
      stories = ids; // Save all ids for pagination

      const slice = (stories && stories.slice(currentIndex, currentIndex + TOP_COUNT)) || [];
      const items = await Promise.all(slice.map(id => fetchItem(id)));
      const filtered = items.filter(Boolean);

      if (append) {
        // Append to existing list
        const existing = Array.from(storiesEl.querySelectorAll('li')).map(li => li.dataset.id);
        renderStories(filtered, true);
      } else {
        renderStories(filtered, false);
        saveCache(filtered);
      }

      // Hide "Load More" if no more stories
      if (currentIndex + TOP_COUNT >= stories.length) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'block';
      }

      statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      statusEl.textContent = 'Failed to fetch stories — showing cached (if any).';
      console.error(err);
    }
}

fetchAndRender();