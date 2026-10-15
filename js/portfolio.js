/* Выводит на главной обложки открытых галерей из data/galleries.json */
(async () => {
  const box = document.getElementById('galleryGrid');
  if (!box) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  try {
    const d = await (await fetch('data/galleries.json', { cache: 'no-store' })).json();
    const gs = d.galleries.filter((g) => g.count);
    box.innerHTML = gs.length ? gs.map((g) => {
      const cover = g.cover, n = g.count;
      const date = g.date ? g.date.split('-').reverse().join('.') + ' · ' : '';
      return `<a class="gcard" href="gallery.html?g=${g.slug}"><img loading="lazy" src="${cover}" alt="${esc(g.title)}" style="object-position:${esc(g.focus || '50% 50%')}">` +
        `<span class="crt"><span class="crt__rec">PLAY</span></span><span class="gcard__t">${esc(g.title)}</span><span class="gcard__m mono">${date}${n} фото</span></a>`;
    }).join('') : '<p class="mono">Скоро здесь появятся съёмки.</p>';
  } catch (e) {
    box.innerHTML = '<p class="mono">Не удалось загрузить галереи.</p>';
  }
})();

/* «Обо мне» и слайдер лучших кадров из data/site.json (заполняется в админке) */
(async () => {
  let d = { about: null, slider: [] };
  try { d = Object.assign(d, await (await fetch('data/site.json', { cache: 'no-store' })).json()); } catch (e) { /* ещё не настроено */ }

  // Фото «Обо мне»
  const img = document.getElementById('aboutImg');
  if (img) {
    if (d.about && d.about.file) {
      img.src = 'photos/site/web/' + d.about.file;
      img.style.objectPosition = d.about.focus || '50% 35%';
    } else {
      document.getElementById('aboutPhoto').remove();
      document.querySelector('.about__grid').classList.add('no-photo');
    }
  }

  // Карусель лучших кадров
  const sec = document.getElementById('reel');
  const list = (d.slider || []).filter((x) => x && x.file);
  if (!sec || !list.length) return;
  sec.hidden = false;
  const box = document.getElementById('reelSlides');
  const count = document.getElementById('reelCount');
  const bar = document.getElementById('reelBar');
  const stage = document.getElementById('reelStage');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = 5000;
  const pad = (n) => String(n).padStart(2, '0');
  box.innerHTML = list.map((x, i) =>
    `<figure class="reel__slide" data-i="${i}"><img src="photos/site/web/${x.file}" alt="Кадр ${i + 1}" ${i > 1 && i < list.length - 1 ? 'loading="lazy"' : ''} draggable="false"></figure>`
  ).join('');
  const slides = [...box.children];
  const n = slides.length;
  let cur = 0, acc = 0, t0 = 0, paused = false, visible = true;

  const layout = () => {
    slides.forEach((s, i) => {
      let d = (i - cur + n) % n;          // 0 — центр, 1 — следующий, n-1 — предыдущий
      if (d > n / 2) d -= n;
      s.className = 'reel__slide ' + (d === 0 ? 'is-center' : d === 1 ? 'is-next' : d === -1 ? 'is-prev' : d > 0 ? 'is-far-r' : 'is-far-l');
    });
    if (n === 2) slides[(cur + 1) % 2].className = 'reel__slide is-next';
    const c = slides[cur];
    c.classList.add('flash');
    count.textContent = `${pad(cur + 1)} / ${pad(n)}`;
  };
  const go = (i) => { cur = (i + n) % n; acc = 0; layout(); };
  const tick = (now) => {
    if (!paused && visible && !reduce && n > 1) {
      acc += now - t0;
      if (acc >= DUR) go(cur + 1);
      bar.style.width = Math.min(100, acc / DUR * 100) + '%';
    }
    t0 = now;
    requestAnimationFrame(tick);
  };
  layout();
  requestAnimationFrame((t) => { t0 = t; tick(t); });

  stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reel]');
    if (b) return go(cur + Number(b.dataset.reel));
    const s = e.target.closest('.reel__slide');
    if (s && s.classList.contains('is-next')) go(cur + 1);
    if (s && s.classList.contains('is-prev')) go(cur - 1);
  });
  stage.addEventListener('mouseenter', () => { paused = true; });
  stage.addEventListener('mouseleave', () => { paused = false; });
  document.addEventListener('keydown', (e) => {
    if (!visible) return;
    if (e.key === 'ArrowRight') go(cur + 1);
    if (e.key === 'ArrowLeft') go(cur - 1);
  });
  let sx = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; paused = true; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx !== null) {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    }
    sx = null; paused = false;
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.3 }).observe(stage);
})();
