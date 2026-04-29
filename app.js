/**
 * ============================================================
 *  MINIMALIST YOUTUBE DASHBOARD — app.js
 *  Vanilla JS, no frameworks, no build tools.
 *  Loads data.json, renders playlists, plays embedded videos.
 * ============================================================
 */

/* ──────────────────────────────────────────────────────────
   STATE
   Centralised mutable state for the current session.
────────────────────────────────────────────────────────── */
const state = {
  playlists: [],          // All playlist objects from data.json
  view: 'home',           // 'home' | 'playlist' | 'player' | 'search'
  activePlaylistIdx: null,// Index of the currently viewed playlist
  activeVideoIdx: null,   // Index of the currently playing video
  searchQuery: '',        // Live search string
};

/* ──────────────────────────────────────────────────────────
   DOM REFERENCES
   Grabbed once at startup for performance.
────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const dom = {
  sidebar:        $('sidebar'),
  sidebarOverlay: $('sidebarOverlay'),
  sidebarNav:     $('sidebarNav'),
  menuToggle:     $('menuToggle'),
  closeSidebarBtn:$('closeSidebarBtn'),
  contentCanvas:  $('contentCanvas'),
  pageTitle:      $('pageTitle'),
  pageSubtitle:   $('pageSubtitle'),
  backBtn:        $('backBtn'),
  searchInput:    $('searchInput'),
  themeToggle:    $('themeToggle'),
  statsLabel:     $('statsLabel'),
  loadingOverlay: $('loadingOverlay'),
  loadDataBtn:    $('loadDataBtn'),
  fileInput:      $('fileInput'),
  activeFileName: $('activeFileName'),
};

/* ──────────────────────────────────────────────────────────
   UTILITY HELPERS
────────────────────────────────────────────────────────── */

/**
 * Extrage YouTube Video ID dintr-un URL.
 * Suportă:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  const patterns = [
    /[?&]v=([^&#]+)/,       // watch?v=...
    /youtu\.be\/([^?&#]+)/, // youtu.be/...
    /embed\/([^?&#]+)/,     // embed/...
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Returnează URL-ul imaginii de previzualizare YouTube (HQ default).
 * @param {string} videoId
 * @returns {string}
 */
function thumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Calculează totalul de minute al unui playlist.
 * Duratele sunt în format "MM:SS" sau "H:MM:SS".
 * @param {Array} videos
 * @returns {number} minute totale (rotunjite)
 */
function totalMinutes(videos) {
  let secs = 0;
  for (const v of videos) {
    const parts = (v.duration || '0:00').split(':').map(Number);
    if (parts.length === 3) secs += parts[0]*3600 + parts[1]*60 + parts[2];
    else if (parts.length === 2) secs += parts[0]*60 + parts[1];
  }
  return Math.round(secs / 60);
}

/**
 * Formatează minute într-un string lizibil: "2h 35min" sau "48min".
 * @param {number} mins
 * @returns {string}
 */
function formatDuration(mins) {
  if (mins >= 60) return `${Math.floor(mins/60)}h ${mins%60}min`;
  return `${mins}min`;
}

/**
 * Sanitize HTML pentru a preveni XSS (afișăm titluri din JSON).
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Normalizează un string pentru căutare insensibilă la:
 *   - majuscule/minuscule  (toLowerCase)
 *   - diacritice române și generale  (NFD + eliminare combining marks)
 *
 * Exemple:
 *   "Știință"  → "stiinta"
 *   "Gaură"    → "gaura"
 *   "Înapoi"   → "inapoi"
 *   "Ș/Ț"      → "s/t"
 *
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return (str || '')
    .toLowerCase()
    // Descompune caracterele compuse (ex: ă → a + combining breve)
    .normalize('NFD')
    // Elimină toate combining diacritical marks (U+0300–U+036F)
    .replace(/[\u0300-\u036f]/g, '')
    // Tratament explicit pentru ș/ț cu virgulă (U+015F, U+0163) care
    // nu se descompun întotdeauna corect prin NFD în toate browserele
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
}

/* ──────────────────────────────────────────────────────────
   TEMA (DARK / LIGHT)
────────────────────────────────────────────────────── */

/** Aplică sau înlătură clasa `dark` pe <html>.
 *  Toggle pill-ul se mișcă automat prin clasa CSS dark:translate-x-6.
 */
function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

/** Comută tema și salvează preferința în localStorage. */
function toggleTheme() {
  const isDark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('ytdash-theme', isDark ? 'dark' : 'light');
  applyTheme(isDark);
}

/** Încarcă tema salvată sau deduce preferința sistemului. */
function initTheme() {
  const saved = localStorage.getItem('ytdash-theme');
  if (saved) {
    applyTheme(saved === 'dark');
  } else {
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
}

/* ──────────────────────────────────────────────────────────
   LOAD DATA — încărcare fișier JSON extern
────────────────────────────────────────────────────────── */

/**
 * Procesează un fișier JSON încărcat de utilizator.
 * Validează structura minimă, actualizează state-ul și re-randează UI-ul.
 *
 * Fluxul complet:
 *   click buton → input[type=file] → change event → readAsText → parseJSON
 *   → validare → actualizare state → navigateHome()
 *
 * @param {File} file – obiectul File din input[type=file]
 */
function loadDataFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    let data;

    // ── Parsare JSON ──────────────────────────────────────
    try {
      data = JSON.parse(e.target.result);
    } catch (parseErr) {
      showLoadError(`Fișierul nu este un JSON valid.\n${parseErr.message}`);
      return;
    }

    // ── Validare structură minimă ─────────────────────────
    if (!data.playlists || !Array.isArray(data.playlists)) {
      showLoadError('Structură invalidă: lipsește câmpul "playlists" (Array).');
      return;
    }

    // Numără câte playlist-uri și clipuri valide există
    const totalVideos = data.playlists.reduce((s, pl) => {
      return s + (Array.isArray(pl.videos) ? pl.videos.length : 0);
    }, 0);

    // ── Actualizare state ─────────────────────────────────
    state.playlists = data.playlists;

    // Actualizează eticheta cu numele fișierului în sidebar
    dom.activeFileName.textContent = file.name;
    dom.activeFileName.title       = file.name; // tooltip pentru nume lung

    // Reset complet la home cu noile date
    navigateHome();

    // Feedback vizual: flash portocaliu pe buton
    flashLoadBtn(`✓ ${data.playlists.length} liste, ${totalVideos} clipuri`);
  };

  reader.onerror = () => {
    showLoadError('Eroare la citirea fișierului.');
  };

  reader.readAsText(file, 'UTF-8');
}

/**
 * Afișează un mesaj de eroare temporar pe butonul Load Data.
 * @param {string} message
 */
function showLoadError(message) {
  console.error('[YT Dashboard] Load error:', message);

  const btn = dom.loadDataBtn;
  const originalHTML = btn.innerHTML;

  btn.innerHTML = `
    <span class="material-icons-round text-[18px] text-red-500">error_outline</span>
    <span class="text-red-500 text-[12px] truncate">JSON invalid</span>
  `;
  btn.title = message;

  // Revine la starea normală după 3 secunde
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.title = '';
    // Re-atașează referința la activeFileName după innerHTML reset
    dom.activeFileName = $('activeFileName');
  }, 3000);
}

/**
 * Flash de confirmare pe butonul Load Data: afișează temporar un mesaj de succes.
 * @param {string} message
 */
function flashLoadBtn(message) {
  const btn      = dom.loadDataBtn;
  const span     = btn.querySelector('span:nth-child(2)'); // span cu textul "Load Data"
  const original = span ? span.textContent : 'Load Data';

  if (span) span.textContent = message;
  btn.style.color = '';
  btn.classList.add('text-orange-500', 'dark:text-orange-400',
                    'border-orange-300', 'dark:border-orange-700');

  setTimeout(() => {
    if (span) span.textContent = original;
    btn.classList.remove('text-orange-500', 'dark:text-orange-400',
                         'border-orange-300', 'dark:border-orange-700');
  }, 2500);
}

/* ──────────────────────────────────────────────────────────
   SIDEBAR
────────────────────────────────────────────────────── */

/** Deschide / închide sidebar-ul pe mobile. */
function toggleSidebar(open) {
  const isClosed = dom.sidebar.classList.contains('-translate-x-[110%]');
  const shouldOpen = (open !== undefined) ? open : isClosed;

  if (shouldOpen) {
    dom.sidebar.classList.remove('-translate-x-[110%]');
    dom.sidebarOverlay.classList.remove('hidden');
    requestAnimationFrame(() => dom.sidebarOverlay.classList.remove('opacity-0'));
  } else {
    dom.sidebar.classList.add('-translate-x-[110%]');
    dom.sidebarOverlay.classList.add('opacity-0');
    setTimeout(() => dom.sidebarOverlay.classList.add('hidden'), 300);
  }
}

/**
 * Randează butoanele de navigare în sidebar.
 * Primul buton = "Acasă" (toate playlist-urile).
 * Urmează câte un buton per playlist.
 */
function renderSidebar() {
  const nav = dom.sidebarNav;
  nav.innerHTML = '';

  // ── Buton „Acasă" ──────────────────────────────────────
  nav.appendChild(createNavBtn({
    icon: 'home',
    label: 'Acasă',
    active: state.view === 'home',
    onClick: () => {
      navigateHome();
      toggleSidebar(false);
    },
  }));

  // Separator vizual subtil
  nav.insertAdjacentHTML('beforeend',
    '<div class="my-2 mx-3 h-px bg-black/5 dark:bg-white/5"></div>');

  // ── Butoane Playlist ────────────────────────────────────
  state.playlists.forEach((pl, idx) => {
    nav.appendChild(createNavBtn({
      icon: 'queue_music',
      label: pl.title,
      active: state.view === 'playlist' && state.activePlaylistIdx === idx,
      onClick: () => {
        navigatePlaylist(idx);
        toggleSidebar(false);
      },
    }));
  });

  // ── Stats (total clipuri) ───────────────────────────────
  const total = state.playlists.reduce((s, p) => s + p.videos.length, 0);
  dom.statsLabel.textContent = `${state.playlists.length} liste · ${total} clipuri`;
}

/**
 * Creează un element buton de navigare pentru sidebar.
 * @param {{ icon: string, label: string, active: boolean, onClick: Function }} opts
 * @returns {HTMLButtonElement}
 */
function createNavBtn({ icon, label, active, onClick }) {
  const btn = document.createElement('button');
  btn.className = `nav-btn ${active ? 'active' : ''}`;
  btn.innerHTML = `
    <span class="material-icons-round nav-icon">${icon}</span>
    <span class="truncate text-[14px]">${esc(label)}</span>
  `;
  btn.addEventListener('click', onClick);
  return btn;
}

/* ──────────────────────────────────────────────────────────
   NAVIGARE
────────────────────────────────────────────────────── */

/** Navighează la ecranul principal cu toate playlist-urile. */
function navigateHome() {
  state.view = 'home';
  state.activePlaylistIdx = null;
  state.activeVideoIdx    = null;
  state.searchQuery       = '';
  dom.searchInput.value = '';
  renderSidebar();
  renderHome();
  updateHeader('Toate Playlist-urile', `${state.playlists.length} colecții`, false);
}

/**
 * Navighează la lista de clipuri a unui playlist.
 * @param {number} idx – indexul playlist-ului în state.playlists
 */
function navigatePlaylist(idx) {
  state.view              = 'playlist';
  state.activePlaylistIdx = idx;
  state.activeVideoIdx    = null;
  const pl = state.playlists[idx];
  renderSidebar();
  renderPlaylist(pl);
  const mins = totalMinutes(pl.videos);
  updateHeader(pl.title, `${pl.videos.length} clipuri · ${formatDuration(mins)}`, true);
}

/**
 * Navighează la player-ul unui video.
 * @param {number} playlistIdx
 * @param {number} videoIdx
 */
function navigateVideo(playlistIdx, videoIdx) {
  state.view              = 'player';
  state.activePlaylistIdx = playlistIdx;
  state.activeVideoIdx    = videoIdx;
  const video = state.playlists[playlistIdx].videos[videoIdx];
  renderSidebar();
  renderPlayer(video, playlistIdx, videoIdx);
  updateHeader(video.title, state.playlists[playlistIdx].title, true);
}

/* ──────────────────────────────────────────────────────────
   HEADER UTILITIES
────────────────────────────────────────────────────── */

/**
 * Actualizează titlul paginii, subtitlul și vizibilitatea butonului Înapoi.
 * @param {string} title
 * @param {string} subtitle
 * @param {boolean} showBack
 */
function updateHeader(title, subtitle, showBack) {
  dom.pageTitle.textContent    = title;
  dom.pageSubtitle.textContent = subtitle;
  dom.backBtn.classList.toggle('hidden',  !showBack);
  dom.backBtn.classList.toggle('flex',     showBack);
}

/* ──────────────────────────────────────────────────────────
   RENDER — HOME (toate playlist-urile ca overview cards)
────────────────────────────────────────────────────── */

/** Afișează grid-ul cu overview-ul tuturor playlist-urilor. */
function renderHome() {
  const canvas = dom.contentCanvas;
  canvas.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';

  state.playlists.forEach((pl, idx) => {
    grid.appendChild(createPlaylistCard(pl, idx));
  });

  canvas.appendChild(grid);
}

/**
 * Creează un card de overview pentru un playlist.
 * Afișează 4 thumbnail-uri în preview + metadata.
 * @param {Object} pl   – obiectul playlist
 * @param {number} idx  – indexul în state.playlists
 * @returns {HTMLElement}
 */
function createPlaylistCard(pl, idx) {
  const card = document.createElement('div');
  card.className = `playlist-card cursor-pointer rounded-[1.5rem] overflow-hidden
    bg-white/60 dark:bg-white/4
    backdrop-blur-xl
    border border-white/50 dark:border-white/8
    shadow-lg shadow-black/5 dark:shadow-black/30
    hover:shadow-xl hover:shadow-orange-500/8
    group`;
  card.style.animationDelay = `${idx * 0.05}s`;

  // Primele 4 video-uri pentru preview thumbnails
  const previewVideos = pl.videos.slice(0, 4);
  const thumbsHtml = previewVideos.map(v => {
    const vid = extractVideoId(v.url) || '';
    return `<div class="relative overflow-hidden bg-slate-200 dark:bg-white/5">
      <div class="thumb-skeleton"></div>
      <img
        src="${thumbUrl(vid)}"
        alt="${esc(v.title)}"
        loading="lazy"
        class="thumb-img w-full h-full object-cover"
        onload="this.classList.add('loaded'); this.previousElementSibling?.remove()"
        onerror="this.style.opacity='0'"
      />
    </div>`;
  }).join('');

  const mins = totalMinutes(pl.videos);

  card.innerHTML = `
    <!-- Preview thumbnails 2×2 -->
    <div class="grid grid-cols-2 gap-0.5 bg-black/5 dark:bg-black/20 aspect-video">
      ${thumbsHtml}
    </div>

    <!-- Metadata -->
    <div class="p-4">
      <h2 class="font-display font-semibold text-[16px] leading-snug dark:text-white
                 group-hover:text-orange-600 dark:group-hover:text-orange-400
                 transition-colors duration-200 truncate">${esc(pl.title)}</h2>
      <div class="flex items-center gap-3 mt-1.5">
        <span class="flex items-center gap-1 text-[12px] text-slate-400 dark:text-slate-500">
          <span class="material-icons-round text-[14px]">video_library</span>
          ${pl.videos.length} clipuri
        </span>
        <span class="flex items-center gap-1 text-[12px] text-slate-400 dark:text-slate-500">
          <span class="material-icons-round text-[14px]">schedule</span>
          ${formatDuration(mins)}
        </span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => navigatePlaylist(idx));
  return card;
}

/* ──────────────────────────────────────────────────────────
   RENDER — PLAYLIST (grid de video cards)
────────────────────────────────────────────────────── */

/**
 * Afișează grid-ul de video cards pentru un playlist dat.
 * @param {Object} pl – obiectul playlist
 */
function renderPlaylist(pl) {
  const canvas = dom.contentCanvas;
  canvas.innerHTML = '';

  const grid = document.createElement('div');
  // Grid responsiv: 1 col mobile → 2 sm → 3 lg → 4 xl
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

  pl.videos.forEach((video, vidIdx) => {
    const playlistIdx = state.playlists.indexOf(pl);
    grid.appendChild(createVideoCard(video, playlistIdx, vidIdx));
  });

  canvas.appendChild(grid);
}

/**
 * Creează un card clickabil pentru un video.
 * @param {Object} video       – obiectul video { title, url, duration }
 * @param {number} playlistIdx
 * @param {number} videoIdx
 * @returns {HTMLElement}
 */
function createVideoCard(video, playlistIdx, videoIdx) {
  const videoId = extractVideoId(video.url) || '';
  const card    = document.createElement('div');

  card.className = `video-card cursor-pointer rounded-[1.5rem] overflow-hidden
    bg-white/60 dark:bg-white/4
    backdrop-blur-xl
    border border-white/50 dark:border-white/8
    shadow-md shadow-black/5 dark:shadow-black/30
    hover:shadow-xl hover:shadow-orange-500/10
    transition-all duration-300 group`;

  card.innerHTML = `
    <!-- Thumbnail -->
    <div class="relative aspect-video overflow-hidden bg-slate-200 dark:bg-white/5">
      <!-- Skeleton loader -->
      <div class="thumb-skeleton" id="sk-${videoId}-${videoIdx}"></div>

      <!-- Thumbnail image (lazy loaded) -->
      <img
        src="${thumbUrl(videoId)}"
        alt="${esc(video.title)}"
        loading="lazy"
        class="thumb-img absolute inset-0 w-full h-full object-cover"
        onload="this.classList.add('loaded'); document.getElementById('sk-${videoId}-${videoIdx}')?.remove()"
        onerror="this.style.opacity='0.3'"
      />

      <!-- Dark overlay on hover -->
      <div class="play-overlay absolute inset-0 bg-black/40"></div>

      <!-- Play button overlay (centrat) -->
      <div class="play-overlay absolute inset-0 flex items-center justify-center">
        <div class="w-12 h-12 rounded-full
                    bg-orange-500/90 backdrop-blur-md
                    flex items-center justify-center
                    shadow-lg shadow-orange-500/50
                    scale-90 group-hover:scale-100
                    transition-transform duration-300">
          <span class="material-icons-round text-white text-[24px] ml-0.5">play_arrow</span>
        </div>
      </div>

      <!-- Duration badge (bottom-right) -->
      <div class="absolute bottom-2 right-2
                  bg-black/65 backdrop-blur-md
                  px-1.5 py-0.5 rounded
                  text-[11px] font-mono text-white/90">
        ${esc(video.duration)}
      </div>
    </div>

    <!-- Title -->
    <div class="px-3.5 py-3">
      <p class="text-[13px] font-medium leading-snug dark:text-white/90
                line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400
                transition-colors duration-200">${esc(video.title)}</p>
    </div>
  `;

  card.addEventListener('click', () => navigateVideo(playlistIdx, videoIdx));
  return card;
}

/* ──────────────────────────────────────────────────────────
   RENDER — PLAYER (iframe embed + sugestii)
────────────────────────────────────────────────────── */

/**
 * Afișează player-ul YouTube embed și lista restantă a playlist-ului.
 * @param {Object} video
 * @param {number} playlistIdx
 * @param {number} videoIdx
 */
function renderPlayer(video, playlistIdx, videoIdx) {
  const canvas  = dom.contentCanvas;
  const videoId = extractVideoId(video.url) || '';
  const pl      = state.playlists[playlistIdx];

  canvas.innerHTML = '';

  // Wrapper cu animație fade-in
  const wrapper = document.createElement('div');
  wrapper.id        = 'playerWrapper';
  wrapper.className = 'flex flex-col xl:flex-row gap-6';

  // ── Coloana stângă: player + info ────────────────────────
  const playerCol = document.createElement('div');
  playerCol.className = 'flex-1 min-w-0';

  playerCol.innerHTML = `
    <!-- iFrame embed -->
    <div class="relative rounded-[1.5rem] overflow-hidden
                shadow-2xl shadow-black/20 dark:shadow-black/50
                bg-black aspect-video">
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1&origin=https://www.youtube.com"
        title="${esc(video.title)}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
        class="absolute inset-0 w-full h-full"
      ></iframe>
    </div>

    <!-- Titlu + info -->
    <div class="mt-4 px-1">
      <h2 class="font-display font-semibold text-[20px] lg:text-[22px] leading-snug dark:text-white">${esc(video.title)}</h2>
      <div class="flex flex-wrap items-center gap-3 mt-2">
        <span class="playlist-badge">
          <span class="material-icons-round text-[12px]">queue_music</span>
          ${esc(pl.title)}
        </span>
        <span class="flex items-center gap-1 text-[12px] text-slate-400">
          <span class="material-icons-round text-[14px]">schedule</span>
          ${esc(video.duration)}
        </span>
        <span class="flex items-center gap-1 text-[12px] text-slate-400">
          <span class="material-icons-round text-[14px]">format_list_numbered</span>
          ${videoIdx + 1} / ${pl.videos.length}
        </span>
      </div>
    </div>

    <!-- Navigare Prev / Next -->
    <div class="flex gap-3 mt-4 px-1">
      <button onclick="navigateVideo(${playlistIdx}, ${videoIdx - 1})"
              ${videoIdx === 0 ? 'disabled' : ''}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium
                     bg-black/5 dark:bg-white/5
                     border border-black/8 dark:border-white/8
                     hover:bg-orange-50 dark:hover:bg-orange-900/20
                     hover:text-orange-600 dark:hover:text-orange-400
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-200 active:scale-95">
        <span class="material-icons-round text-[16px]">skip_previous</span>
        Anterior
      </button>
      <button onclick="navigateVideo(${playlistIdx}, ${videoIdx + 1})"
              ${videoIdx === pl.videos.length - 1 ? 'disabled' : ''}
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium
                     bg-black/5 dark:bg-white/5
                     border border-black/8 dark:border-white/8
                     hover:bg-orange-50 dark:hover:bg-orange-900/20
                     hover:text-orange-600 dark:hover:text-orange-400
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-200 active:scale-95">
        Următor
        <span class="material-icons-round text-[16px]">skip_next</span>
      </button>
    </div>
  `;

  // ── Coloana dreaptă: Up Next queue ───────────────────────
  const queueCol = document.createElement('div');
  queueCol.className = 'xl:w-[300px] flex-shrink-0';

  const upNext = pl.videos.slice(videoIdx + 1, videoIdx + 8); // max 7 sugestii

  if (upNext.length > 0) {
    queueCol.innerHTML = `
      <h3 class="font-display font-semibold text-[15px] dark:text-white mb-3 px-1">
        Urmează în playlist
      </h3>
    `;

    const list = document.createElement('div');
    list.className = 'space-y-2';

    upNext.forEach((v, i) => {
      const vid  = extractVideoId(v.url) || '';
      const item = document.createElement('div');
      item.className = `flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer
        bg-white/50 dark:bg-white/4
        backdrop-blur-sm
        border border-white/40 dark:border-white/6
        hover:bg-orange-50/70 dark:hover:bg-orange-900/15
        hover:border-orange-200 dark:hover:border-orange-800/50
        transition-all duration-200 group`;
      item.style.animationDelay = `${i * 0.04}s`;

      item.innerHTML = `
        <!-- Mini thumbnail -->
        <div class="relative w-20 flex-shrink-0 aspect-video rounded-xl overflow-hidden
                    bg-slate-200 dark:bg-white/5">
          <div class="thumb-skeleton"></div>
          <img src="${thumbUrl(vid)}" alt="${esc(v.title)}" loading="lazy"
               class="thumb-img absolute inset-0 w-full h-full object-cover"
               onload="this.classList.add('loaded'); this.previousElementSibling?.remove()"
               onerror="this.style.opacity='0'" />
          <div class="play-overlay absolute inset-0 flex items-center justify-center bg-black/30">
            <span class="material-icons-round text-white text-[16px]">play_arrow</span>
          </div>
          <div class="absolute bottom-1 right-1 bg-black/65 backdrop-blur-sm
                      px-1 rounded text-[9px] font-mono text-white/90">${esc(v.duration)}</div>
        </div>
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-medium leading-tight dark:text-white/85 line-clamp-2
                    group-hover:text-orange-600 dark:group-hover:text-orange-400
                    transition-colors duration-200">${esc(v.title)}</p>
        </div>
      `;

      item.addEventListener('click', () => navigateVideo(playlistIdx, videoIdx + 1 + i));
      list.appendChild(item);
    });

    queueCol.appendChild(list);
  }

  wrapper.appendChild(playerCol);
  wrapper.appendChild(queueCol);
  canvas.appendChild(wrapper);
}

/* ──────────────────────────────────────────────────────────
   SEARCH
────────────────────────────────────────────────────── */

/**
 * Caută `query` în:
 *   1. Titlul fiecărui clip (din toate playlist-urile)
 *   2. Numele playlist-ului — un match pe playlist întoarce TOATE clipurile lui
 *
 * Căutarea este insensibilă la majuscule ȘI la diacritice (prin normalize()).
 * Rezultatele sunt grupate pe playlist-uri care au matches, cu o secțiune
 * separată pentru clipurile găsite individual.
 *
 * @param {string} query
 */
function performSearch(query) {
  query = query.trim();
  if (!query) { navigateHome(); return; }

  state.view        = 'search';
  state.searchQuery = query;
  renderSidebar();

  const canvas = dom.contentCanvas;
  canvas.innerHTML = '';

  // Termenul normalizat pentru comparații
  const q = normalize(query);

  /**
   * Structura rezultatelor — un Map indexat după plIdx pentru a evita
   * duplicatele când atât numele playlist-ului cât și un clip din el matchuiesc.
   *
   * Map<plIdx, { plTitle, matchedByPlaylist: bool, videos: [{video, vidIdx}] }>
   */
  const grouped = new Map();

  state.playlists.forEach((pl, plIdx) => {
    const plNameMatches = normalize(pl.title).includes(q);

    pl.videos.forEach((video, vidIdx) => {
      const titleMatches = normalize(video.title).includes(q);

      // Include clipul dacă titlul lui dă match SAU dacă numele
      // playlist-ului dă match (întoarcem tot playlist-ul în acel caz)
      if (titleMatches || plNameMatches) {
        if (!grouped.has(plIdx)) {
          grouped.set(plIdx, {
            plTitle: pl.title,
            matchedByPlaylist: plNameMatches,
            videos: [],
          });
        }
        grouped.get(plIdx).videos.push({ video, vidIdx });
      }
    });
  });

  // Număr total de clipuri găsite (pentru subtitre header)
  const totalFound = [...grouped.values()].reduce((s, g) => s + g.videos.length, 0);

  updateHeader(
    `Rezultate: „${query}"`,
    totalFound > 0
      ? `${totalFound} ${totalFound === 1 ? 'clip găsit' : 'clipuri găsite'} în ${grouped.size} ${grouped.size === 1 ? 'playlist' : 'playlist-uri'}`
      : 'Niciun rezultat',
    false
  );

  // ── Stare goală ─────────────────────────────────────────
  if (grouped.size === 0) {
    canvas.innerHTML = `
      <div class="empty-state flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5
                    flex items-center justify-center mb-4">
          <span class="material-icons-round text-[32px] text-slate-300 dark:text-slate-600">
            search_off
          </span>
        </div>
        <p class="font-display font-semibold text-[18px] dark:text-white/80">
          Niciun rezultat
        </p>
        <p class="text-[13px] text-slate-400 mt-1">
          Încearcă fără diacritice sau cu un alt termen.
        </p>
      </div>`;
    return;
  }

  // ── Randare rezultate grupate pe playlist ───────────────
  // Contor global de animație staggered (continuă între grupuri)
  let cardIndex = 0;

  grouped.forEach(({ plTitle, matchedByPlaylist, videos }, plIdx) => {
    // Titlu secțiune playlist
    const section = document.createElement('div');
    section.className = 'mb-6';

    // Header secțiune: numele playlist-ului + badge tip match
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'flex items-center gap-2.5 mb-3 px-1';
    sectionHeader.innerHTML = `
      <span class="material-icons-round text-[18px] text-orange-500">queue_music</span>
      <h2 class="font-display font-semibold text-[15px] dark:text-white">${esc(plTitle)}</h2>
      ${matchedByPlaylist
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                        bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400
                        border border-orange-200 dark:border-orange-800/50">
             <span class="material-icons-round text-[10px]">folder_open</span>
             playlist
           </span>`
        : ''}
      <span class="text-[12px] text-slate-400 dark:text-slate-600 ml-auto font-mono">
        ${videos.length} ${videos.length === 1 ? 'clip' : 'clipuri'}
      </span>
    `;

    // Grid clipuri pentru această secțiune
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

    videos.forEach(({ video, vidIdx }) => {
      const videoId = extractVideoId(video.url) || '';
      const card    = document.createElement('div');
      card.className = `video-card cursor-pointer rounded-[1.5rem] overflow-hidden
        bg-white/60 dark:bg-white/4
        backdrop-blur-xl
        border border-white/50 dark:border-white/8
        shadow-md shadow-black/5 dark:shadow-black/30
        hover:shadow-xl hover:shadow-orange-500/10
        transition-all duration-300 group`;
      card.style.animationDelay = `${cardIndex * 0.04}s`;
      cardIndex++;

      card.innerHTML = `
        <div class="relative aspect-video overflow-hidden bg-slate-200 dark:bg-white/5">
          <div class="thumb-skeleton"></div>
          <img src="${thumbUrl(videoId)}" alt="${esc(video.title)}" loading="lazy"
               class="thumb-img absolute inset-0 w-full h-full object-cover"
               onload="this.classList.add('loaded'); this.previousElementSibling?.remove()"
               onerror="this.style.opacity='0.3'" />
          <div class="play-overlay absolute inset-0 bg-black/40"></div>
          <div class="play-overlay absolute inset-0 flex items-center justify-center">
            <div class="w-12 h-12 rounded-full bg-orange-500/90 backdrop-blur-md
                        flex items-center justify-center shadow-lg shadow-orange-500/50
                        scale-90 group-hover:scale-100 transition-transform duration-300">
              <span class="material-icons-round text-white text-[24px] ml-0.5">play_arrow</span>
            </div>
          </div>
          <div class="absolute bottom-2 right-2 bg-black/65 backdrop-blur-md
                      px-1.5 py-0.5 rounded text-[11px] font-mono text-white/90">
            ${esc(video.duration)}
          </div>
        </div>
        <div class="px-3.5 py-3">
          <p class="text-[13px] font-medium leading-snug dark:text-white/90 line-clamp-2
                    group-hover:text-orange-600 dark:group-hover:text-orange-400
                    transition-colors duration-200">${esc(video.title)}</p>
        </div>
      `;

      card.addEventListener('click', () => navigateVideo(plIdx, vidIdx));
      grid.appendChild(card);
    });

    section.appendChild(sectionHeader);
    section.appendChild(grid);
    canvas.appendChild(section);
  });
}

/* ──────────────────────────────────────────────────────────
   EVENT LISTENERS
────────────────────────────────────────────────────── */

/** Înregistrează toți listener-ii globali. */
function bindEvents() {

  // ── Sidebar mobile ──────────────────────────────────────
  dom.menuToggle.addEventListener('click', () => toggleSidebar());
  dom.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  dom.closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));

  // ── Temă (pill toggle — knob-ul se mișcă prin CSS dark:translate-x-6) ──
  dom.themeToggle.addEventListener('click', toggleTheme);

  // ── Buton Înapoi ────────────────────────────────────────
  dom.backBtn.addEventListener('click', () => {
    if (state.view === 'player') {
      navigatePlaylist(state.activePlaylistIdx);
    } else {
      navigateHome();
    }
  });

  // ── Căutare ─────────────────────────────────────────────
  dom.searchInput.addEventListener('input', e => {
    const q = e.target.value;
    if (q.trim().length > 1) performSearch(q);
    else if (q.trim().length === 0) navigateHome();
  });

  // ── Escape: închide sidebar ─────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggleSidebar(false);
  });

  // ── Load Data ───────────────────────────────────────────
  // fileInput este în <body>, în afara oricărui overflow:hidden —
  // aceasta este soluția pentru .click() programatic cross-browser.
  dom.loadDataBtn.addEventListener('click', () => {
    dom.fileInput.value = '';
    dom.fileInput.click();
  });

  dom.fileInput.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (file) loadDataFile(file);
  });

  // ── Drag & Drop pe sidebar ──────────────────────────────
  dom.sidebar.addEventListener('dragover', e => {
    e.preventDefault();
    dom.sidebar.classList.add('ring-2', 'ring-orange-400/50', 'ring-inset');
  });
  dom.sidebar.addEventListener('dragleave', e => {
    if (!dom.sidebar.contains(e.relatedTarget)) {
      dom.sidebar.classList.remove('ring-2', 'ring-orange-400/50', 'ring-inset');
    }
  });
  dom.sidebar.addEventListener('drop', e => {
    e.preventDefault();
    dom.sidebar.classList.remove('ring-2', 'ring-orange-400/50', 'ring-inset');
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      showLoadError('Acceptăm doar fișiere .json');
      return;
    }
    loadDataFile(file);
  });
}

/* ──────────────────────────────────────────────────────────
   INIT — Punctul de intrare principal
────────────────────────────────────────────────────── */

/**
 * Initializează aplicația:
 * 1. Aplică tema salvată
 * 2. Încarcă data.json
 * 3. Randează UI-ul initial
 * 4. Înregistrează event listeners
 */
async function init() {
  initTheme();

  try {
    const res  = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.playlists = data.playlists || [];

    // Ascunde loading overlay cu fade
    dom.loadingOverlay.style.opacity = '0';
    dom.loadingOverlay.style.transition = 'opacity 0.4s ease';
    setTimeout(() => dom.loadingOverlay.remove(), 420);

    bindEvents();
    renderSidebar();
    renderHome();
    updateHeader(
      'Toate Playlist-urile',
      `${state.playlists.length} colecții`,
      false
    );

  } catch (err) {
    console.error('[YT Dashboard] Eroare la încărcarea data.json:', err);
    dom.loadingOverlay.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center px-6">
        <div class="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30
                    flex items-center justify-center mb-4">
          <span class="material-icons-round text-red-500 text-[32px]">error_outline</span>
        </div>
        <p class="font-display font-bold text-[18px] dark:text-white mb-1">
          Eroare la încărcare
        </p>
        <p class="text-[13px] text-slate-400 max-w-xs">
          Fișierul <code class="bg-black/5 dark:bg-white/10 px-1 rounded">data.json</code>
          nu a putut fi încărcat. Asigură-te că serverul rulează corect.
        </p>
        <p class="text-[11px] text-slate-300 dark:text-slate-600 mt-3 font-mono">${esc(err.message)}</p>
      </div>
    `;
  }
}

// Pornire aplicație când DOM-ul este gata
document.addEventListener('DOMContentLoaded', init);
