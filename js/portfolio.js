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
        `<span class="gcard__t">${esc(g.title)}</span><span class="gcard__m mono">${date}${n} фото</span></a>`;
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

  // Слайдер
  const sec = document.getElementById('reel');
  const list = (d.slider || []).filter((x) => x && x.file);
  if (!sec || !list.length) return;
  sec.hidden = false;
  const box = document.getElementById('reelSlides');
  const count = document.getElementById('reelCount');
  const bar = document.getElementById('reelBar');
  const stage = document.getElementById('reelStage');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = 5500;
  const pad = (n) => String(n).padStart(2, '0');
  box.innerHTML = list.map((x, i) => {
    const u = 'photos/site/web/' + x.file;
    return `<div class="reel__slide" data-i="${i}"><div class="bg" style="background-image:url('${u}')"></div><img src="${u}" alt="Кадр ${i + 1}" ${i ? 'loading="lazy"' : ''}></div>`;
  }).join('');
  const slides = [...box.children];
  let cur = -1, t0 = 0, paused = false, visible = true, acc = 0;

  const show = (i) => {
    i = (i + slides.length) % slides.length;
    if (i === cur) return;
    slides.forEach((s, k) => s.classList.toggle('is-on', k === i));
    const s = slides[i];
    s.classList.remove('glitch-in'); void s.offsetWidth; s.classList.add('glitch-in');
    cur = i; acc = 0; t0 = performance.now();
    count.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
  };
  const tick = (now) => {
    if (!paused && visible && !reduce && slides.length > 1) {
      acc += now - t0;
      if (acc >= DUR) show(cur + 1);
      bar.style.width = Math.min(100, acc / DUR * 100) + '%';
    }
    t0 = now;
    requestAnimationFrame(tick);
  };
  show(0);
  requestAnimationFrame((n) => { t0 = n; tick(n); });

  stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reel]');
    if (b) show(cur + Number(b.dataset.reel));
  });
  stage.addEventListener('mouseenter', () => { paused = true; });
  stage.addEventListener('mouseleave', () => { paused = false; });
  document.addEventListener('keydown', (e) => {
    if (!visible) return;
    if (e.key === 'ArrowRight') show(cur + 1);
    if (e.key === 'ArrowLeft') show(cur - 1);
  });
  let sx = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
    sx = null;
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.3 }).observe(stage);
})();
