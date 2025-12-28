// Lister v2 (static) — render from artists.json + audio player
(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

  const audio = $('#audio');
  const nowTitle = $('#nowTitle');
  const nowArtist = $('#nowArtist');
  const nowCover = $('#nowCover');

  const featuredTitle = $('#featuredTitle');
  const featuredArtist = $('#featuredArtist');
  const featuredCover = $('#featuredCover');
  const btnFeatured = $('#btnFeatured');
  const btnFeaturedPlay = $('#btnFeaturedPlay');

  const btnToggle = $('#btnToggle');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');
  const btnMute = $('#btnMute');
  const vol = $('#vol');
  const seekbar = $('#seekbar');
  const curTime = $('#curTime');
  const durTime = $('#durTime');

  const q = $('#q');
  const results = $('#results');
  const queueEl = $('#queue');

  const statArtists = $('#statArtists');
  const statTracks = $('#statTracks');

  const btnTheme = $('#btnTheme');
  const btnShuffle = $('#btnShuffle');
  const btnQueueOpen = $('#btnQueueOpen');

  let library = null; // loaded json
  let flatTracks = [];
  let queue = [];
  let idx = -1; // index in queue
  let userSeeking = false;

  const STORAGE_THEME = 'lister_theme_v2';

  function fmt(t){
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function setTheme(next){
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_THEME, next);
  }

  function toggleTheme(){
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  }

  function applySavedTheme(){
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved === 'light' || saved === 'dark') setTheme(saved);
    else document.documentElement.setAttribute('data-theme','dark');
  }

  function normalize(s){ return (s || '').toLowerCase().trim(); }

  function pushQueue(track, playNow=false){
    queue.push(track);
    renderQueue();
    if (playNow){
      idx = queue.length - 1;
      loadAndPlayCurrent();
    } else if (idx === -1){
      idx = 0;
      loadAndPlayCurrent(false);
    }
  }

  function setNow(track){
    nowTitle.textContent = track?.title || '재생 중인 곡 없음';
    nowArtist.textContent = track?.artist || '—';
    nowCover.src = track?.cover || 'assets/cover-aurora.svg';
  }

  function loadAndPlayCurrent(autoPlay=true){
    const track = queue[idx];
    if (!track) return;
    setNow(track);
    audio.src = track.src;
    if (autoPlay){
      audio.play().catch(()=>{ btnToggle.textContent = '▶'; });
    }
    highlightPlaying(track);
  }

  function highlightPlaying(track){
    $$('.track').forEach(btn => {
      const match = btn.dataset.src === track.src && btn.dataset.title === track.title && btn.dataset.artist === track.artist;
      btn.setAttribute('data-playing', match ? '1' : '0');
      if (match) btn.style.borderColor = 'color-mix(in oklab, var(--accent3) 72%, var(--stroke2))';
      else btn.style.borderColor = 'var(--stroke2)';
    });
  }

  function next(){
    if (!queue.length) return;
    idx = (idx + 1) % queue.length;
    loadAndPlayCurrent(true);
  }

  function prev(){
    if (!queue.length) return;
    idx = (idx - 1 + queue.length) % queue.length;
    loadAndPlayCurrent(true);
  }

  function toggle(){
    if (!audio.src){
      if (queue.length) { idx = Math.max(0, idx); loadAndPlayCurrent(true); }
      else if (flatTracks.length) { queue = [flatTracks[0]]; idx = 0; renderQueue(); loadAndPlayCurrent(true); }
      return;
    }
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
  }

  function renderQueue(){
    if (!queue.length){
      queueEl.classList.add('empty');
      queueEl.textContent = '큐가 비어있어.';
      return;
    }
    queueEl.classList.remove('empty');
    queueEl.innerHTML = '';
    queue.forEach((t, i) => {
      const row = document.createElement('button');
      row.className = 'track';
      row.style.justifyContent = 'space-between';
      row.innerHTML = `
        <span class="track-left">
          <span class="track-cover"><img alt="cover" src="${t.cover || 'assets/cover-aurora.svg'}"></span>
          <span class="track-name">${escapeHtml(t.title)}</span>
        </span>
        <span class="track-meta">${escapeHtml(t.artist)} · ${escapeHtml(t.duration || '')}</span>
      `;
      row.addEventListener('click', () => {
        idx = i;
        loadAndPlayCurrent(true);
      });
      if (i === idx) row.style.borderColor = 'color-mix(in oklab, var(--accent2) 70%, var(--stroke2))';
      queueEl.appendChild(row);
    });
  }

  function escapeHtml(s){
    return (s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  }

  function renderArtists(){
    const grid = $('#artistGrid');
    grid.innerHTML = '';
    const artists = library?.artists || [];
    artists.forEach(a => {
      const card = document.createElement('article');
      card.className = 'card';
      const tracksHtml = (a.tracks || []).map(t => {
        const trackObj = {
          title: t.title,
          artist: a.name,
          src: t.src,
          duration: t.duration || '',
          cover: t.cover || ''
        };
        const payload = encodeURIComponent(JSON.stringify(trackObj));
        return `
          <button class="track" data-payload="${payload}" data-src="${escapeHtml(trackObj.src)}" data-title="${escapeHtml(trackObj.title)}" data-artist="${escapeHtml(trackObj.artist)}">
            <span class="track-left">
              <span class="track-cover"><img alt="cover" src="${escapeHtml(trackObj.cover || 'assets/cover-aurora.svg')}"></span>
              <span class="track-name">${escapeHtml(trackObj.title)}</span>
            </span>
            <span class="track-meta">${escapeHtml(trackObj.duration)}</span>
          </button>
        `;
      }).join('');

      card.innerHTML = `
        <div class="card-head">
          <div class="avatar"><img alt="${escapeHtml(a.name)}" src="${escapeHtml(a.avatar || 'assets/avatar-aurora.svg')}"></div>
          <div>
            <div class="card-title">${escapeHtml(a.name)}</div>
            <div class="card-sub">${escapeHtml(a.genre || '')}</div>
            <div class="card-bio">${escapeHtml(a.bio || '')}</div>
          </div>
        </div>
        <div class="tracklist">${tracksHtml}</div>
      `;

      grid.appendChild(card);
    });

    // bind play events
    $$('.track').forEach(btn => {
      const payload = btn.dataset.payload;
      if (!payload) return;
      btn.addEventListener('click', () => {
        const track = JSON.parse(decodeURIComponent(payload));
        // if same track already in queue, jump to it (optional)
        const found = queue.findIndex(qt => qt.src === track.src && qt.title === track.title && qt.artist === track.artist);
        if (found >= 0){
          idx = found;
          loadAndPlayCurrent(true);
          renderQueue();
        } else {
          pushQueue(track, true);
        }
      });
    });
  }

  function buildFlatTracks(){
    flatTracks = [];
    const artists = library?.artists || [];
    artists.forEach(a => (a.tracks || []).forEach(t => {
      flatTracks.push({
        title: t.title,
        artist: a.name,
        src: t.src,
        duration: t.duration || '',
        cover: t.cover || ''
      });
    }));
  }

  function setFeatured(){
    const f = library?.featured;
    if (!f) return;
    featuredTitle.textContent = f.title || '—';
    featuredArtist.textContent = f.artist || '—';
    featuredCover.src = f.cover || 'assets/cover-aurora.svg';

    btnFeatured?.addEventListener('click', () => {
      pushQueue({ title: f.title, artist: f.artist, src: f.src, duration: f.duration || '', cover: f.cover || '' }, true);
    });
    btnFeaturedPlay?.addEventListener('click', toggle);
  }

  function setStats(){
    const artists = library?.artists || [];
    statArtists.textContent = String(artists.length);
    statTracks.textContent = String(flatTracks.length);
  }

  function shufflePlay(){
    if (!flatTracks.length) return;
    const pick = flatTracks[Math.floor(Math.random() * flatTracks.length)];
    pushQueue(pick, true);
  }

  function runSearch(term){
    const t = normalize(term);
    if (!t){
      results.classList.add('empty');
      results.textContent = '검색어를 입력해봐.';
      return;
    }
    const hits = flatTracks.filter(x => normalize(x.title).includes(t) || normalize(x.artist).includes(t));
    results.innerHTML = '';
    results.classList.remove('empty');

    if (!hits.length){
      results.classList.add('empty');
      results.textContent = '검색 결과가 없어.';
      return;
    }

    hits.slice(0, 30).forEach(track => {
      const row = document.createElement('button');
      row.className = 'track';
      row.innerHTML = `
        <span class="track-left">
          <span class="track-cover"><img alt="cover" src="${track.cover || 'assets/cover-aurora.svg'}"></span>
          <span class="track-name">${escapeHtml(track.title)}</span>
        </span>
        <span class="track-meta">${escapeHtml(track.artist)} · ${escapeHtml(track.duration || '')}</span>
      `;
      row.addEventListener('click', () => pushQueue(track, true));
      results.appendChild(row);
    });
  }

  function bindPlayer(){
    btnToggle?.addEventListener('click', toggle);
    btnPrev?.addEventListener('click', prev);
    btnNext?.addEventListener('click', next);

    btnMute?.addEventListener('click', () => {
      audio.muted = !audio.muted;
      btnMute.textContent = audio.muted ? '🔇' : '🔊';
    });

    if (vol){
      audio.volume = Number(vol.value || 0.9);
      vol.addEventListener('input', () => {
        audio.volume = Number(vol.value);
        if (audio.muted && audio.volume > 0){
          audio.muted = false;
          btnMute.textContent = '🔊';
        }
      });
    }

    if (seekbar){
      seekbar.addEventListener('input', () => { userSeeking = true; });
      seekbar.addEventListener('change', () => {
        if (!audio.duration) return;
        const v = Number(seekbar.value) / Number(seekbar.max);
        audio.currentTime = v * audio.duration;
        userSeeking = false;
      });
    }

    audio.addEventListener('timeupdate', () => {
      curTime.textContent = fmt(audio.currentTime);
      if (!audio.duration) return;
      durTime.textContent = fmt(audio.duration);
      if (!userSeeking){
        const v = (audio.currentTime / audio.duration) * Number(seekbar.max || 1000);
        seekbar.value = String(Math.floor(v));
      }
    });

    audio.addEventListener('play', () => { btnToggle.textContent = '⏸'; });
    audio.addEventListener('pause', () => { btnToggle.textContent = '▶'; });
    audio.addEventListener('ended', next);
  }

  function bindUX(){
    // search
    q?.addEventListener('input', () => runSearch(q.value));

    // '/' focus
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== q){
        e.preventDefault();
        q?.focus();
      }
      // ESC to blur
      if (e.key === 'Escape' && document.activeElement === q) q?.blur();
    });

    // theme
    btnTheme?.addEventListener('click', toggleTheme);

    // shuffle
    btnShuffle?.addEventListener('click', shufflePlay);

    // queue jump
    btnQueueOpen?.addEventListener('click', () => {
      document.getElementById('library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function init(){
    applySavedTheme();
    bindPlayer();
    bindUX();

    const res = await fetch('artists.json', { cache: 'no-store' });
    library = await res.json();

    buildFlatTracks();
    renderArtists();
    setFeatured();
    setStats();

    // prefill queue with featured (not autoplay)
    if (library?.featured){
      queue = [{ title: library.featured.title, artist: library.featured.artist, src: library.featured.src, duration: library.featured.duration || '', cover: library.featured.cover || '' }];
      idx = 0;
      renderQueue();
      setNow(queue[0]);
    }
  }

  // --- Mobile bottom UI overlap fix (iOS Safari / iOS in-app browsers / Android Chrome)
  // Many mobile browsers draw their own bottom toolbars that can overlap fixed elements.
  // We use VisualViewport when available and feed the delta into --player-bottom.
  (function setupPlayerViewportLift(){
    const root = document.documentElement;

    function compute(){
      const vv = window.visualViewport;
      // fallback: 0
      let lift = 0;
      if (vv){
        // When browser UI (or keyboard) reduces visual viewport height, innerHeight stays larger.
        // The difference is the hidden area at bottom.
        const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        // Keep a small margin so controls never kiss the toolbar.
        lift = Math.round(hidden);
      }

      // cap: avoid jumping too high
      lift = Math.min(Math.max(lift, 0), 160);
      root.style.setProperty('--player-bottom', `${lift}px`);
    }

    compute();
    window.addEventListener('resize', compute, { passive: true });
    window.addEventListener('orientationchange', compute, { passive: true });
    if (window.visualViewport){
      window.visualViewport.addEventListener('resize', compute, { passive: true });
      window.visualViewport.addEventListener('scroll', compute, { passive: true });
    }
  })();

  init().catch((err) => {
    console.error(err);
    results.classList.add('empty');
    results.textContent = 'artists.json을 불러오지 못했어. GitHub Pages 경로/파일명을 확인해줘.';
  });
})();