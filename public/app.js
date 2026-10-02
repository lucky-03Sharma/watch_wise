/* =============================================
   WatchWise — Frontend Application
   ============================================= */

const API = '';

// ---- State ----
const state = {
  view: 'home',
  movies: { featured: [], trending: [], topPicks: [] },
  allMovies: [],
  genreMovies: [],
  genres: [],
  selectedGenre: 'all',
  searchResults: [],
  searchQuery: '',
  favorites: [],
  watchlist: [],
  libraryTab: 'favorites',
  selectedMovie: null,
  user: JSON.parse(localStorage.getItem('watchwise_user') || 'null'),
  token: localStorage.getItem('watchwise_token') || null,
  authTab: 'login',
};

// ---- DOM Refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  searchInput: $('#search-input'),
  searchClear: $('#search-clear'),
  viewHome: $('#view-home'),
  viewSearch: $('#view-search'),
  viewLibrary: $('#view-library'),
  viewAuth: $('#view-auth'),
  viewBda: $('#view-bda'),
  navAuthItem: $('#nav-auth-item'),
  formLogin: $('#form-login'),
  formRegister: $('#form-register'),
  tabLogin: $('#tab-login'),
  tabRegister: $('#tab-register'),
  btnDemoLogin: $('#btn-demo-login'),
  authTitle: $('#auth-title'),
  authSubtitle: $('#auth-subtitle'),
  trendingRow: $('#trending-row'),
  picksGrid: $('#picks-grid'),
  genrePillBar: $('#genre-pill-bar'),
  genreMoviesGrid: $('#genre-movies-grid'),
  genreSelectedText: $('#genre-selected-text'),
  genreSection: $('#genre-section'),
  searchGrid: $('#search-grid'),
  searchTitle: $('#search-results-title'),
  searchCount: $('#search-count'),
  noResults: $('#no-results'),
  featuredContainer: $('#featured-hero-container'),
  libraryContent: $('#library-content'),
  modalBackdrop: $('#modal-backdrop'),
  modalTitle: $('#modal-title'),
  modalHeroImg: $('#modal-hero-img'),
  modalMeta: $('#modal-meta'),
  modalOverview: $('#modal-overview'),
  modalGenres: $('#modal-genres'),
  modalActions: $('#modal-actions'),
  modalRecs: $('#modal-recommendations'),
  toastContainer: $('#toast-container'),
  statusDot: $('#status-dot'),
  statStatus: $('#stat-status'),
};

// ---- API Helpers ----
async function apiFetch(path, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('API Error:', err);
    return null;
  }
}

// ---- Toast ----
function showToast(message, type = 'success') {
  const iconMap = {
    success: '<i class="bi bi-check-circle-fill toast-icon"></i>',
    info: '<i class="bi bi-info-circle-fill toast-icon"></i>',
    error: '<i class="bi bi-exclamation-triangle-fill toast-icon"></i>',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${iconMap[type] || iconMap.success}<span>${message}</span>`;
  dom.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ---- Movie Card HTML ----
function movieCardHTML(movie) {
  if (!movie) return '';
  const posterSrc = movie.poster;
  // Strictly filter out any movie whose poster is missing or placeholder
  if (!posterSrc || posterSrc === 'null' || posterSrc === 'undefined' || posterSrc.includes('unsplash')) {
    return '';
  }
  const isFav = state.favorites.some(f => f.tmdb_id === movie.tmdb_id);
  const isWatch = state.watchlist.some(w => w.tmdb_id === movie.tmdb_id);
  const posterContent = `<img class="movie-poster" src="${posterSrc}" alt="${movie.title}" loading="lazy" onerror="this.closest('.movie-card')?.remove()" />`;

  return `
    <div class="movie-card" data-tmdb-id="${movie.tmdb_id}">
      <div class="poster-wrap">
        ${posterContent}
        <div class="rating-badge"><i class="bi bi-star-fill"></i> ${movie.rating?.toFixed(1) || 'N/A'}</div>
        <div class="poster-overlay">
          <div class="overlay-actions">
            <button class="action-btn fav ${isFav ? 'active' : ''}" data-action="fav" data-tmdb-id="${movie.tmdb_id}" title="Favorite">
              <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i>
            </button>
            <button class="action-btn watch ${isWatch ? 'active' : ''}" data-action="watch" data-tmdb-id="${movie.tmdb_id}" title="Watchlist">
              <i class="bi ${isWatch ? 'bi-bookmark-check-fill' : 'bi-bookmark-plus'}"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-meta">
          <span class="movie-year">${movie.year || ''}</span>
          ${movie.director ? `<span class="movie-director">&middot; ${movie.director}</span>` : ''}
        </div>
        <div class="genre-tags">
          ${(movie.genre || []).slice(0, 3).map(g => `<span class="genre-tag" data-genre="${g}" title="Filter by ${g}">${g}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ---- Small Recommendation Card (for modal) ----
function recCardHTML(movie) {
  if (!movie || !movie.tmdb_id) return '';
  const posterSrc = movie.poster;
  if (!posterSrc || posterSrc === 'null' || posterSrc === 'undefined' || posterSrc.includes('unsplash')) {
    return '';
  }
  return `
    <div class="rec-card" data-tmdb-id="${movie.tmdb_id}" role="button" tabindex="0" title="Click to view details for ${movie.title}">
      <div class="rec-poster-wrap">
        <img class="rec-poster" src="${posterSrc}" alt="${movie.title}" loading="lazy" onerror="this.closest('.rec-card')?.remove()" />
      </div>
      <div class="rec-info">
        <div class="rec-title">${movie.title}</div>
        <div class="rec-meta"><i class="bi bi-star-fill"></i> ${movie.rating?.toFixed(1) || 'N/A'} &middot; ${movie.year || ''}</div>
      </div>
    </div>
  `;
}

// ---- Skeleton Card ----
function skeletonCard() {
  return `
    <div class="skeleton-card">
      <div class="skeleton skeleton-poster"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
    </div>
  `;
}

// ---- Featured Hero ----
function featuredHeroHTML(movie) {
  if (!movie) return '';
  return `
    <div class="featured-hero" data-tmdb-id="${movie.tmdb_id}">
      <img class="featured-hero-img" src="${movie.poster || ''}" alt="${movie.title}" />
      <div class="featured-hero-overlay">
        <div class="featured-label"><i class="bi bi-award-fill"></i> Featured Movie</div>
        <h2 class="featured-hero-title">${movie.title}</h2>
        <div class="featured-hero-meta">
          <span><i class="bi bi-star-fill"></i> ${movie.rating?.toFixed(1)}</span>
          <span><i class="bi bi-calendar3"></i> ${movie.year}</span>
          <span><i class="bi bi-camera-reels-fill"></i> ${movie.director || ''}</span>
          <span>${(movie.genre || []).join(' · ')}</span>
        </div>
        <p class="featured-hero-desc">${movie.overview || ''}</p>
        <div class="featured-hero-actions">
          <button class="btn btn-primary" data-action="open-modal" data-tmdb-id="${movie.tmdb_id}"><i class="bi bi-play-circle-fill"></i> View Details</button>
          <button class="btn btn-ghost" data-action="fav" data-tmdb-id="${movie.tmdb_id}"><i class="bi bi-heart"></i> Favorite</button>
        </div>
      </div>
    </div>
  `;
}

// ---- View Navigation ----
function showView(view) {
  state.view = view;
  dom.viewHome.style.display = view === 'home' ? '' : 'none';
  dom.viewSearch.style.display = view === 'search' ? '' : 'none';
  dom.viewLibrary.style.display = view === 'library' ? '' : 'none';
  dom.viewAuth.style.display = view === 'auth' ? '' : 'none';
  if (dom.viewBda) dom.viewBda.style.display = view === 'bda' ? '' : 'none';

  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (view === 'library') {
    renderLibrary();
    loadLibrary();
  } else if (view === 'bda') {
    loadBdaData();
  }
}

// ---- BDA (Big Data Analytics) & Flume Pipeline ----
async function loadBdaData() {
  try {
    const [statusRes, eventsRes] = await Promise.all([
      apiFetch('/api/bda/status'),
      apiFetch('/api/bda/events?limit=25')
    ]);

    if (statusRes?.status === 'ok') {
      const d = statusRes.data;
      const totalEl = $('#bda-stat-total');
      const agentEl = $('#bda-stat-agent');
      const batchesEl = $('#bda-stat-batches');
      const confEl = $('#bda-stat-conf');

      if (totalEl) totalEl.textContent = Number(d.metrics?.totalEventsIngested || 0).toLocaleString();
      if (agentEl) {
        agentEl.innerHTML = `<span style="color: #10b981; display: inline-flex; align-items: center; gap: 0.35rem;"><i class="bi bi-check-circle-fill"></i> ACTIVE</span>`;
      }
      if (batchesEl) batchesEl.textContent = d.metrics?.activeBatches || 0;
      if (confEl) confEl.textContent = 'HDFS Partition Sink';
    }

    if (eventsRes?.status === 'ok') {
      renderBdaEvents(eventsRes.data || []);
    }
  } catch (err) {
    console.error('Error loading BDA data:', err);
  }
}

function renderBdaEvents(events) {
  const tbody = $('#bda-events-body');
  if (!tbody) return;

  if (!events || events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No events logged yet. Perform a search or click "Simulate Clickstream Batch" above.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(evt => {
    let payloadSummary = '';
    const p = evt.payload || {};
    if (p.title) payloadSummary += `<strong>Movie:</strong> ${p.title} `;
    if (p.genre) payloadSummary += `<strong>Genre:</strong> ${Array.isArray(p.genre) ? p.genre.join(', ') : p.genre} `;
    if (p.query) payloadSummary += `<strong>Query:</strong> "${p.query}" (${p.count || 0} hits) `;
    if (p.topRecommendation) payloadSummary += `<strong>Rec:</strong> ${p.topRecommendation} `;
    if (!payloadSummary) payloadSummary = JSON.stringify(p);

    const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Just now';

    return `
      <tr>
        <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.8rem;">
          <i class="bi bi-clock"></i> ${timeStr}
        </td>
        <td>
          <span class="evt-badge ${evt.eventType}">${evt.eventType}</span>
        </td>
        <td>
          <code style="font-size: 0.75rem; color: var(--accent-indigo);">${evt.eventId}</code>
        </td>
        <td style="font-size: 0.85rem;">
          ${payloadSummary}
        </td>
      </tr>
    `;
  }).join('');
}

async function simulateBdaTraffic() {
  const btn = $('#btn-bda-simulate');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Ingesting...`;
  }

  try {
    const res = await apiFetch('/api/bda/simulate', {
      method: 'POST',
      body: JSON.stringify({ count: 25 })
    });
    if (res?.status === 'ok') {
      showToast(`Ingested 25 clickstream events into Apache Flume -> HDFS partition!`, 'success');
      await loadBdaData();
    } else {
      showToast('Simulation failed', 'error');
    }
  } catch (e) {
    showToast('Network error during BDA simulation', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-lightning-charge-fill"></i> Simulate Clickstream Batch (25 Events)`;
    }
  }
}

async function runBdaAnalytics() {
  const container = $('#bda-analytics-container');
  const content = $('#bda-analytics-content');
  const btn = $('#btn-bda-analytics');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Running MapReduce...`;
  }

  try {
    const res = await apiFetch('/api/bda/analytics');
    if (res?.status === 'ok' && res.data) {
      const d = res.data;
      if (container) container.style.display = 'block';

      const renderList = (items, keyField) => {
        if (!items || !items.length) return '<div style="color:var(--text-muted);font-size:0.8rem;">No data yet</div>';
        return `
          <ul class="bda-rank-list">
            ${items.map(it => `
              <li class="bda-rank-item">
                <span>${it[keyField]}</span>
                <span class="bda-rank-count">${it.count}</span>
              </li>
            `).join('')}
          </ul>
        `;
      };

      if (content) {
        content.innerHTML = `
          <div class="bda-analytics-col">
            <h4><i class="bi bi-film"></i> Most Viewed Movies (HDFS)</h4>
            ${renderList(d.topMovies, 'title')}
          </div>
          <div class="bda-analytics-col">
            <h4><i class="bi bi-tags-fill"></i> Top Engaged Genres</h4>
            ${renderList(d.topGenres, 'genre')}
          </div>
          <div class="bda-analytics-col">
            <h4><i class="bi bi-search"></i> Top Search Queries</h4>
            ${renderList(d.topSearches, 'query')}
          </div>
        `;
      }
      showToast(`Processed ${d.totalLogsRead} records across HDFS data blocks!`, 'success');
    }
  } catch (err) {
    showToast('Failed to run BDA analytics', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-play-circle-fill"></i> Run HDFS MapReduce Analytics`;
    }
  }
}

// ---- Auth Management ----
function renderNavAuth() {
  if (!dom.navAuthItem) return;
  if (state.user) {
    const firstName = (state.user.name || 'User').split(' ')[0];
    const avatar = state.user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(state.user.name || 'User')}`;
    dom.navAuthItem.innerHTML = `
      <div class="user-profile-chip" title="Signed in as ${state.user.email}">
        <img class="user-chip-avatar" src="${avatar}" alt="${state.user.name}" onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=U'" />
        <span class="user-chip-name">${firstName}</span>
        <button class="btn-signout" id="btn-logout" title="Sign Out" aria-label="Sign Out">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    `;
    const logoutBtn = $('#btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLogout();
      });
    }
  } else {
    dom.navAuthItem.innerHTML = `
      <a href="#" class="nav-link nav-auth-btn ${state.view === 'auth' ? 'active' : ''}" data-view="auth" id="nav-auth-btn">
        <i class="bi bi-person-circle"></i> <span>Sign In</span>
      </a>
    `;
    const loginLink = $('#nav-auth-btn');
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showView('auth');
      });
    }
  }
}

function handleLogout() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('watchwise_user');
  localStorage.removeItem('watchwise_token');
  renderNavAuth();
  showToast('You have signed out', 'info');
  if (state.view === 'auth') {
    showView('home');
  }
}

function switchAuthTab(tab) {
  state.authTab = tab;
  if (tab === 'login') {
    dom.tabLogin.classList.add('active');
    dom.tabRegister.classList.remove('active');
    dom.formLogin.style.display = 'flex';
    dom.formRegister.style.display = 'none';
    dom.authTitle.textContent = 'Welcome to WatchWise';
    dom.authSubtitle.textContent = 'Sign in to sync your favorites, watchlist, and personalized recommendations across devices.';
  } else {
    dom.tabRegister.classList.add('active');
    dom.tabLogin.classList.remove('active');
    dom.formRegister.style.display = 'flex';
    dom.formLogin.style.display = 'none';
    dom.authTitle.textContent = 'Create an Account';
    dom.authSubtitle.textContent = 'Join WatchWise to save your favorite movies, build a personal watchlist, and discover films you love.';
  }
}

async function handleLogin(email, password) {
  const submitBtn = $('#btn-login-submit');
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;"></span> Signing in...`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      state.user = data.user;
      state.token = data.token;
      localStorage.setItem('watchwise_user', JSON.stringify(data.user));
      localStorage.setItem('watchwise_token', data.token);
      renderNavAuth();
      showToast(`Welcome back, ${data.user.name}!`, 'success');
      showView('home');
    } else {
      showToast(data.message || 'Invalid email or password', 'error');
    }
  } catch (err) {
    showToast('Network error while signing in', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}

async function handleRegister(name, email, password) {
  const submitBtn = $('#btn-reg-submit');
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:8px;"></span> Creating account...`;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      state.user = data.user;
      state.token = data.token;
      localStorage.setItem('watchwise_user', JSON.stringify(data.user));
      localStorage.setItem('watchwise_token', data.token);
      renderNavAuth();
      showToast(`Account created! Welcome, ${data.user.name}!`, 'success');
      showView('home');
    } else {
      showToast(data.message || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Network error while registering', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}

// ---- Genre Icons Map ----
const genreIcons = {
  'all': 'bi-film',
  'action': 'bi-lightning-charge-fill',
  'adventure': 'bi-compass-fill',
  'animation': 'bi-palette-fill',
  'comedy': 'bi-emoji-laughing-fill',
  'crime': 'bi-shield-shaded',
  'drama': 'bi-mask',
  'family': 'bi-people-fill',
  'fantasy': 'bi-magic',
  'history': 'bi-hourglass-split',
  'horror': 'bi-moon-stars-fill',
  'music': 'bi-music-note-beamed',
  'mystery': 'bi-search-heart',
  'romance': 'bi-heart-fill',
  'sci-fi': 'bi-rocket-takeoff-fill',
  'thriller': 'bi-fire',
  'biography': 'bi-person-badge-fill'
};

// ---- Render Genre Pills Bar ----
function renderGenreBar() {
  if (!dom.genrePillBar) return;
  const totalCount = state.allMovies.length || 46;
  const isAllActive = state.selectedGenre === 'all';

  const allPill = `
    <button class="genre-pill ${isAllActive ? 'active' : ''}" data-genre="all">
      <i class="bi bi-film genre-pill-icon"></i>
      <span>All Movies</span>
      <span class="genre-pill-count">${totalCount}</span>
    </button>
  `;

  const pills = state.genres.map(g => {
    const iconClass = genreIcons[g.name.toLowerCase()] || 'bi-tag-fill';
    const isActive = state.selectedGenre.toLowerCase() === g.name.toLowerCase();
    return `
      <button class="genre-pill ${isActive ? 'active' : ''}" data-genre="${g.name}">
        <i class="bi ${iconClass} genre-pill-icon"></i>
        <span>${g.name}</span>
        <span class="genre-pill-count">${g.count}</span>
      </button>
    `;
  }).join('');

  dom.genrePillBar.innerHTML = allPill + pills;

  // Add click listeners to each pill
  dom.genrePillBar.querySelectorAll('.genre-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const genre = btn.dataset.genre;
      selectGenre(genre);
    });
  });
}

// ---- Select & Filter Movies by Genre ----
async function selectGenre(genre) {
  state.selectedGenre = genre || 'all';
  renderGenreBar();

  if (dom.genreMoviesGrid) {
    dom.genreMoviesGrid.innerHTML = Array(12).fill(skeletonCard()).join('');
  }

  let movies = [];
  if (!genre || genre.toLowerCase() === 'all') {
    movies = (state.allMovies.length ? state.allMovies : [...state.movies.trending, ...state.movies.topPicks])
      .filter(m => m && m.poster && !m.poster.includes('unsplash'));
    if (dom.genreSelectedText) {
      dom.genreSelectedText.textContent = `All Genres (${movies.length} Movies)`;
    }
  } else {
    const res = await apiFetch(`/api/movies/genre/${encodeURIComponent(genre)}?limit=48`);
    if (res && res.status === 'ok' && res.data && res.data.length > 0) {
      movies = res.data.filter(m => m && m.poster && !m.poster.includes('unsplash'));
      // Register all genre movies into state.allMovies so they can be clicked
      movies.forEach(m => {
        if (m && m.tmdb_id && !state.allMovies.some(a => a.tmdb_id === m.tmdb_id)) {
          state.allMovies.push(m);
        }
      });
    } else {
      movies = state.allMovies.filter(m => m && m.poster && !m.poster.includes('unsplash') && (m.genre || []).some(g => g.toLowerCase() === genre.toLowerCase()));
    }
    if (dom.genreSelectedText) {
      dom.genreSelectedText.textContent = `${genre} (${movies.length} Movies)`;
    }
  }

  state.genreMovies = movies;
  if (dom.genreMoviesGrid) {
    if (movies.length === 0) {
      dom.genreMoviesGrid.innerHTML = `
        <div class="empty-library" style="grid-column: 1 / -1; padding: 3rem 1rem;">
          <div class="empty-library-icon"><i class="bi bi-camera-reels"></i></div>
          <h3>No ${genre} movies found</h3>
          <p>Try selecting another genre from the bar above.</p>
        </div>
      `;
    } else {
      dom.genreMoviesGrid.innerHTML = movies.map(movieCardHTML).join('');
    }
  }
}

// ---- Load Home Data ----
async function loadHome() {
  // Show skeletons
  if (dom.genreMoviesGrid) {
    dom.genreMoviesGrid.innerHTML = Array(8).fill(skeletonCard()).join('');
  }
  dom.trendingRow.innerHTML = Array(6).fill(skeletonCard()).join('');
  dom.picksGrid.innerHTML = Array(8).fill(skeletonCard()).join('');

  const data = await apiFetch('/api/movies/home');
  if (!data || data.status !== 'ok') {
    showToast('Failed to load movies', 'error');
    return;
  }

  const { featured, trending, topPicks, genres } = data.data;
  const hasValidPoster = m => m && m.poster && !m.poster.includes('unsplash') && m.poster !== 'null';
  
  const validFeatured = (featured || []).filter(hasValidPoster);
  const validTrending = (trending || []).filter(hasValidPoster);
  const validTopPicks = (topPicks || []).filter(hasValidPoster);

  state.movies = { featured: validFeatured, trending: validTrending, topPicks: validTopPicks };
  state.genres = genres || [];

  // Build unique collection of all available movies
  const movieMap = new Map();
  [...validFeatured, ...validTrending, ...validTopPicks].forEach(m => {
    if (m && m.tmdb_id) movieMap.set(m.tmdb_id, m);
  });
  state.allMovies = Array.from(movieMap.values());

  // Render Genre Filter Bar & Initial Genre Grid
  renderGenreBar();
  selectGenre('all');

  // Featured hero
  if (validFeatured && validFeatured.length > 0) {
    const hero = validFeatured[Math.floor(Math.random() * Math.min(3, validFeatured.length))];
    dom.featuredContainer.innerHTML = featuredHeroHTML(hero);
  }

  // Trending row
  dom.trendingRow.innerHTML = validTrending.map(movieCardHTML).join('');

  // Picks grid
  dom.picksGrid.innerHTML = validTopPicks.map(movieCardHTML).join('');
}

// ---- Search ----
let searchTimeout = null;

function handleSearch(query) {
  clearTimeout(searchTimeout);
  state.searchQuery = query;
  dom.searchClear.classList.toggle('visible', query.length > 0);

  if (!query.trim()) {
    showView('home');
    return;
  }

  searchTimeout = setTimeout(async () => {
    showView('search');
    dom.searchTitle.textContent = `Results for "${query}"`;
    dom.searchCount.textContent = 'Searching...';
    dom.searchGrid.innerHTML = Array(6).fill(skeletonCard()).join('');
    dom.noResults.style.display = 'none';

    const data = await apiFetch(`/api/movies/search?query=${encodeURIComponent(query)}`);
    if (!data || data.status !== 'ok') {
      dom.searchGrid.innerHTML = '';
      dom.noResults.style.display = '';
      dom.searchCount.textContent = '';
      return;
    }

    state.searchResults = data.data;
    if (data.data.length === 0) {
      dom.searchGrid.innerHTML = '';
      dom.noResults.style.display = '';
      dom.searchCount.textContent = '0 results found';
    } else {
      dom.noResults.style.display = 'none';
      dom.searchGrid.innerHTML = data.data.map(movieCardHTML).join('');
      dom.searchCount.textContent = `${data.data.length} movie${data.data.length !== 1 ? 's' : ''} found`;
    }
  }, 350);
}

// ---- Library ----
async function loadLibrary() {
  // First load from localStorage for instant display
  try {
    const localFavs = JSON.parse(localStorage.getItem('watchwise_favs') || '[]');
    const localWatch = JSON.parse(localStorage.getItem('watchwise_watch') || '[]');
    if (localFavs.length && !state.favorites.length) state.favorites = localFavs;
    if (localWatch.length && !state.watchlist.length) state.watchlist = localWatch;
    renderLibrary();
  } catch (e) {}

  // Then sync with server
  const [favData, watchData] = await Promise.all([
    apiFetch('/api/library/favorites'),
    apiFetch('/api/library/watchlist'),
  ]);

  const serverFavs = favData?.data || [];
  const serverWatch = watchData?.data || [];

  const localFavs = JSON.parse(localStorage.getItem('watchwise_favs') || '[]');
  const localWatch = JSON.parse(localStorage.getItem('watchwise_watch') || '[]');

  const favMap = new Map();
  [...serverFavs, ...localFavs, ...state.favorites].forEach(f => {
    if (f && f.tmdb_id) favMap.set(Number(f.tmdb_id), f);
  });
  state.favorites = Array.from(favMap.values());
  localStorage.setItem('watchwise_favs', JSON.stringify(state.favorites));

  const watchMap = new Map();
  [...serverWatch, ...localWatch, ...state.watchlist].forEach(w => {
    if (w && w.tmdb_id) watchMap.set(Number(w.tmdb_id), w);
  });
  state.watchlist = Array.from(watchMap.values());
  localStorage.setItem('watchwise_watch', JSON.stringify(state.watchlist));

  renderLibrary();
  refreshCards();
}

function renderLibrary() {
  const isFavTab = state.libraryTab === 'favorites';
  const items = isFavTab ? state.favorites : state.watchlist;
  const label = isFavTab ? 'favorites' : 'watchlist';

  $$('.tab-btn').forEach(t => t.classList.toggle('active', t.dataset.tab === state.libraryTab));

  if (!items || items.length === 0) {
    dom.libraryContent.innerHTML = `
      <div class="empty-library">
        <div class="empty-library-icon"><i class="bi ${isFavTab ? 'bi-heart' : 'bi-eye'}"></i></div>
        <h3>No ${label} yet</h3>
        <p>Browse movies and click the heart or bookmark icon to add them to your ${label}!</p>
      </div>
    `;
    return;
  }

  const validCards = items.map(movieCardHTML).filter(Boolean);
  if (validCards.length === 0) {
    dom.libraryContent.innerHTML = `
      <div class="empty-library">
        <div class="empty-library-icon"><i class="bi ${isFavTab ? 'bi-heart' : 'bi-eye'}"></i></div>
        <h3>No ${label} yet</h3>
        <p>Browse movies and click the heart or bookmark icon to add them to your ${label}!</p>
      </div>
    `;
    return;
  }

  dom.libraryContent.innerHTML = `<div class="movies-grid large">${validCards.join('')}</div>`;
}

// ---- Favorite / Watchlist Actions ----
async function toggleFavorite(tmdbId) {
  const idNum = Number(tmdbId);
  if (!idNum) return;

  const allMovies = [
    ...(state.movies?.featured || []),
    ...(state.movies?.trending || []),
    ...(state.movies?.topPicks || []),
    ...(state.searchResults || []),
    ...(state.genreMovies || []),
    ...(state.allMovies || []),
    ...(state.favorites || []),
    ...(state.watchlist || []),
    ...(state.selectedMovie ? [state.selectedMovie] : [])
  ];

  let movie = allMovies.find(m => m && Number(m.tmdb_id) === idNum);
  if (!movie) {
    const fetched = await apiFetch(`/api/movies/${idNum}`);
    if (fetched && fetched.status === 'ok' && fetched.data) {
      movie = fetched.data;
    }
  }
  if (!movie) return;

  const movieEntry = {
    tmdb_id: idNum,
    title: movie.title,
    poster: movie.poster,
    rating: movie.rating || 7.5,
    year: movie.year || 2018,
    genre: movie.genre || ['Drama'],
    director: movie.director || 'N/A',
    overview: movie.overview || ''
  };

  const isFav = state.favorites.some(f => Number(f.tmdb_id) === idNum);
  if (isFav) {
    state.favorites = state.favorites.filter(f => Number(f.tmdb_id) !== idNum);
    localStorage.setItem('watchwise_favs', JSON.stringify(state.favorites));
    apiFetch(`/api/library/favorites/${idNum}`, { method: 'DELETE' });
    showToast(`Removed "${movie.title}" from favorites`, 'info');
  } else {
    if (!state.favorites.some(f => Number(f.tmdb_id) === idNum)) {
      state.favorites.push(movieEntry);
    }
    localStorage.setItem('watchwise_favs', JSON.stringify(state.favorites));
    apiFetch('/api/library/favorites', {
      method: 'POST',
      body: JSON.stringify(movieEntry),
    });
    showToast(`Added "${movie.title}" to favorites`, 'success');
  }

  refreshCards();
  if (state.view === 'library') {
    renderLibrary();
  }
}

async function toggleWatchlist(tmdbId) {
  const idNum = Number(tmdbId);
  if (!idNum) return;

  const allMovies = [
    ...(state.movies?.featured || []),
    ...(state.movies?.trending || []),
    ...(state.movies?.topPicks || []),
    ...(state.searchResults || []),
    ...(state.genreMovies || []),
    ...(state.allMovies || []),
    ...(state.favorites || []),
    ...(state.watchlist || []),
    ...(state.selectedMovie ? [state.selectedMovie] : [])
  ];

  let movie = allMovies.find(m => m && Number(m.tmdb_id) === idNum);
  if (!movie) {
    const fetched = await apiFetch(`/api/movies/${idNum}`);
    if (fetched && fetched.status === 'ok' && fetched.data) {
      movie = fetched.data;
    }
  }
  if (!movie) return;

  const movieEntry = {
    tmdb_id: idNum,
    title: movie.title,
    poster: movie.poster,
    rating: movie.rating || 7.5,
    year: movie.year || 2018,
    genre: movie.genre || ['Drama'],
    director: movie.director || 'N/A',
    overview: movie.overview || ''
  };

  const isWatch = state.watchlist.some(w => Number(w.tmdb_id) === idNum);
  if (isWatch) {
    state.watchlist = state.watchlist.filter(w => Number(w.tmdb_id) !== idNum);
    localStorage.setItem('watchwise_watch', JSON.stringify(state.watchlist));
    apiFetch(`/api/library/watchlist/${idNum}`, { method: 'DELETE' });
    showToast(`Removed "${movie.title}" from watchlist`, 'info');
  } else {
    if (!state.watchlist.some(w => Number(w.tmdb_id) === idNum)) {
      state.watchlist.push(movieEntry);
    }
    localStorage.setItem('watchwise_watch', JSON.stringify(state.watchlist));
    apiFetch('/api/library/watchlist', {
      method: 'POST',
      body: JSON.stringify(movieEntry),
    });
    showToast(`Added "${movie.title}" to watchlist`, 'success');
  }

  refreshCards();
  if (state.view === 'library') {
    renderLibrary();
  }
}

function refreshCards() {
  if (state.view === 'home') {
    dom.trendingRow.innerHTML = state.movies.trending.map(movieCardHTML).join('');
    dom.picksGrid.innerHTML = state.movies.topPicks.map(movieCardHTML).join('');
    if (dom.genreMoviesGrid && state.genreMovies) {
      dom.genreMoviesGrid.innerHTML = state.genreMovies.map(movieCardHTML).join('');
    }
  } else if (state.view === 'search') {
    dom.searchGrid.innerHTML = state.searchResults.map(movieCardHTML).join('');
  } else if (state.view === 'library') {
    renderLibrary();
  }
}

// ---- Modal ----
async function openModal(tmdbId) {
  if (tmdbId === undefined || tmdbId === null || isNaN(tmdbId) || tmdbId === 0) return;

  const allMovies = [
    ...state.movies.featured,
    ...state.movies.trending,
    ...state.movies.topPicks,
    ...(state.allMovies || []),
    ...(state.genreMovies || []),
    ...state.searchResults,
    ...state.favorites,
    ...state.watchlist
  ];
  let movie = allMovies.find(m => m.tmdb_id === tmdbId);

  // If not found in memory, fetch directly from API
  if (!movie) {
    const fetched = await apiFetch(`/api/movies/${tmdbId}`);
    if (fetched && fetched.status === 'ok' && fetched.data) {
      movie = fetched.data;
      if (!state.allMovies.some(m => m.tmdb_id === movie.tmdb_id)) {
        state.allMovies.push(movie);
      }
    }
  }

  if (!movie) {
    showToast('Movie details could not be loaded', 'error');
    return;
  }

  state.selectedMovie = movie;
  dom.modalTitle.textContent = movie.title;
  dom.modalHeroImg.src = movie.poster || '';
  dom.modalHeroImg.alt = movie.title;
  dom.modalHeroImg.onerror = () => {
    dom.modalHeroImg.style.display = 'none';
  };
  dom.modalOverview.textContent = movie.overview || 'No description available in dataset.';

  dom.modalGenres.innerHTML = (movie.genre || []).map(g => `<span class="genre-tag" data-genre="${g}" title="Click to filter by ${g}"><i class="bi bi-tag-fill"></i> ${g}</span>`).join('');

  dom.modalMeta.innerHTML = `
    <span class="modal-rating"><i class="bi bi-star-fill"></i> ${movie.rating?.toFixed(1) || 'N/A'}</span>
    <span><i class="bi bi-calendar3"></i> ${movie.year || ''}</span>
    <span><i class="bi bi-camera-reels-fill"></i> ${movie.director || 'Director'}</span>
  `;

  const isFav = state.favorites.some(f => f.tmdb_id === tmdbId);
  const isWatch = state.watchlist.some(w => w.tmdb_id === tmdbId);

  dom.modalActions.innerHTML = `
    <button class="btn ${isFav ? 'btn-primary' : 'btn-ghost'}" data-action="fav" data-tmdb-id="${tmdbId}">
      <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i> ${isFav ? 'In Favorites' : 'Add to Favorites'}
    </button>
    <button class="btn ${isWatch ? 'btn-primary' : 'btn-ghost'}" data-action="watch" data-tmdb-id="${tmdbId}">
      <i class="bi ${isWatch ? 'bi-bookmark-check-fill' : 'bi-bookmark-plus'}"></i> ${isWatch ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
  `;

  // Show loading for recommendations
  dom.modalRecs.innerHTML = `
    <div class="recs-header">
      <h3><i class="bi bi-lightbulb-fill"></i> Recommended For You</h3>
      <p>Real-time Cosine Similarity across 45,447 movies &middot; 50,000 TF-IDF features</p>
    </div>
    <div class="recs-grid">
      ${Array(4).fill('<div class="skeleton-card rec-skeleton"><div class="skeleton" style="height:100%;"></div></div>').join('')}
    </div>
  `;

  // Open modal immediately and scroll modal to top
  dom.modalBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
  const modalElem = $('.modal');
  if (modalElem) modalElem.scrollTop = 0;

  // Fetch recommendations from the API (similar movies based on genre from trained data)
  const detail = await apiFetch(`/api/movies/${tmdbId}`);
  if (detail && detail.status === 'ok') {
    if (detail.data?.overview && (!movie.overview || movie.overview === 'No description available in dataset.')) {
      dom.modalOverview.textContent = detail.data.overview;
    }

    const similar = (detail.data?.similar || []).filter(s => s && s.tmdb_id && s.poster && !s.poster.includes('unsplash') && s.poster !== 'null');
    if (similar.length > 0) {
      // Register ALL similar movies into state.allMovies so they can be clicked and opened!
      similar.forEach(sim => {
        if (sim && sim.tmdb_id && !state.allMovies.some(m => m.tmdb_id === sim.tmdb_id)) {
          state.allMovies.push(sim);
        }
      });

      dom.modalRecs.innerHTML = `
        <div class="recs-header">
          <h3><i class="bi bi-lightbulb-fill"></i> Recommended For You</h3>
          <p>Real-time Cosine Similarity across 45,447 movies &middot; 50,000 TF-IDF features</p>
        </div>
        <div class="recs-grid">
          ${similar.map(recCardHTML).join('')}
        </div>
      `;
    } else {
      // Fallback: recommend from popularMovies by genre
      const fallbackRecs = state.movies.trending
        .filter(m => m.tmdb_id !== tmdbId && (m.genre || []).some(g => (movie.genre || []).includes(g)))
        .slice(0, 6);
      if (fallbackRecs.length > 0) {
        dom.modalRecs.innerHTML = `
          <div class="recs-header">
            <h3><i class="bi bi-lightbulb-fill"></i> You Might Also Like</h3>
            <p>Similar genre picks from our curated collection</p>
          </div>
          <div class="recs-grid">
            ${fallbackRecs.map(recCardHTML).join('')}
          </div>
        `;
      } else {
        dom.modalRecs.innerHTML = `
          <div class="recs-header">
            <h3><i class="bi bi-lightbulb-fill"></i> Recommended For You</h3>
            <p>Start the Python ML service for AI-powered recommendations.</p>
          </div>
        `;
      }
    }
  }
}

function closeModal() {
  dom.modalBackdrop.classList.remove('open');
  document.body.style.overflow = '';
  state.selectedMovie = null;
}

// ---- Status Check ----
async function checkStatus() {
  const data = await apiFetch('/api/status');
  if (data && data.status === 'online') {
    dom.statusDot.className = 'stat-dot';
    if (data.mlEngine && data.mlEngine.status === 'online') {
      dom.statStatus.innerHTML = `<span class="stat-dot"></span> ML Engine Online (45,447 Movies &middot; 50k Features)`;
    } else {
      dom.statStatus.innerHTML = `<span class="stat-dot"></span> Server Online`;
    }

    const bdaChip = $('#stat-bda-chip');
    if (bdaChip && data.bdaPipeline) {
      bdaChip.innerHTML = `<span class="stat-dot" style="background:#10b981"></span> Flume: Active`;
    }
  } else {
    dom.statusDot.className = 'stat-dot offline';
    dom.statStatus.innerHTML = `<span class="stat-dot offline"></span> Offline`;
  }
}

// ---- Event Delegation ----
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (target) {
    const action = target.dataset.action;
    const tmdbId = parseInt(target.dataset.tmdbId);

    if (action === 'fav') {
      e.stopPropagation();
      toggleFavorite(tmdbId);
      return;
    }
    if (action === 'watch') {
      e.stopPropagation();
      toggleWatchlist(tmdbId);
      return;
    }
    if (action === 'open-modal') {
      e.stopPropagation();
      openModal(tmdbId);
      return;
    }
  }

  // Click on genre tag anywhere (movie card or modal)
  const genreTag = e.target.closest('.genre-tag');
  if (genreTag) {
    e.stopPropagation();
    const g = genreTag.dataset.genre || genreTag.textContent.trim();
    if (g) {
      if (state.selectedMovie) closeModal();
      showView('home');
      selectGenre(g);
      dom.genreSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  // Click on movie card (main grid or modal recs)
  const card = e.target.closest('.movie-card') || e.target.closest('.rec-card');
  if (card && !e.target.closest('.action-btn')) {
    openModal(parseInt(card.dataset.tmdbId));
    return;
  }

  // Featured hero click
  const hero = e.target.closest('.featured-hero');
  if (hero && !e.target.closest('[data-action]')) {
    openModal(parseInt(hero.dataset.tmdbId));
    return;
  }
});

// Nav
$('#nav-home').addEventListener('click', (e) => {
  e.preventDefault();
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  showView('home');
});

$('#nav-library').addEventListener('click', (e) => {
  e.preventDefault();
  showView('library');
  loadLibrary();
});

$('#nav-bda')?.addEventListener('click', (e) => {
  e.preventDefault();
  showView('bda');
});

$('#btn-bda-simulate')?.addEventListener('click', simulateBdaTraffic);
$('#btn-bda-analytics')?.addEventListener('click', runBdaAnalytics);
$('#btn-bda-refresh')?.addEventListener('click', loadBdaData);

$('#nav-logo').addEventListener('click', (e) => {
  e.preventDefault();
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  showView('home');
});

// Hero buttons
$('#hero-explore-btn').addEventListener('click', () => {
  dom.genreSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#hero-library-btn').addEventListener('click', () => {
  showView('library');
  loadLibrary();
});

// Search
dom.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
dom.searchClear.addEventListener('click', () => {
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  showView('home');
  dom.searchInput.focus();
});

// Library tabs
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.libraryTab = btn.dataset.tab;
    renderLibrary();
  });
});

// Modal
$('#modal-close').addEventListener('click', closeModal);
dom.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === dom.modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Modal actions delegation
dom.modalActions.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const tmdbId = parseInt(btn.dataset.tmdbId);
  if (btn.dataset.action === 'fav') {
    toggleFavorite(tmdbId).then(() => {
      if (state.selectedMovie) openModal(tmdbId);
    });
  }
  if (btn.dataset.action === 'watch') {
    toggleWatchlist(tmdbId).then(() => {
      if (state.selectedMovie) openModal(tmdbId);
    });
  }
});

// Auth Tabs
if (dom.tabLogin) {
  dom.tabLogin.addEventListener('click', () => switchAuthTab('login'));
}
if (dom.tabRegister) {
  dom.tabRegister.addEventListener('click', () => switchAuthTab('register'));
}

// Password toggle buttons
$$('.btn-toggle-pass').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = `<i class="bi ${isPass ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
  });
});

// Login Form Submit
if (dom.formLogin) {
  dom.formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    handleLogin(email, password);
  });
}

// Register Form Submit
if (dom.formRegister) {
  dom.formRegister.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#reg-name').value.trim();
    const email = $('#reg-email').value.trim();
    const password = $('#reg-password').value;
    handleRegister(name, email, password);
  });
}

// Quick Demo Login Button
if (dom.btnDemoLogin) {
  dom.btnDemoLogin.addEventListener('click', () => {
    $('#login-email').value = 'demo@watchwise.tv';
    $('#login-password').value = 'password123';
    handleLogin('demo@watchwise.tv', 'password123');
  });
}

// Forgot Password link
const forgotLink = $('#link-forgot-pass');
if (forgotLink) {
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Demo mode: Use password "password123" to sign in', 'info');
  });
}

// ---- Init ----
async function init() {
  renderNavAuth();
  await Promise.all([loadHome(), loadLibrary(), checkStatus()]);
}

init();
