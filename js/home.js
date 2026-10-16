/* Главная: обо мне, карусель, архив, тарифы */
(async () => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  let site = { about: { file: '9e49d66b9c4e.jpg', focus: '50% 35%' }, slider: [] }, gal = { galleries: [] };
  try { site = Object.assign(site, await (await fetch('data/site.json', { cache: 'no-store' })).json()); } catch (e) {}
  try { gal = await (await fetch('data/galleries.json', { cache: 'no-store' })).json(); } catch (e) {}
  const src = (f) => 'photos/site/web/' + f;

  const lens = window.PLENKA.lens;
  /* ---------- обо мне ---------- */
  if (site.about) { $('#aboutImg').src = src(site.about.file); $('#aboutImg').style.objectPosition = site.about.focus || '50% 35%'; }
  lens($('#aboutF'), .05, 0);   // только искажение линзы, без аберрации

  /* ---------- карусель ---------- */
  const list = (site.slider || []).map((x) => x.file);
  if (!list.length) $('#reel').remove();
  else {
    const box = $('#reelS'), n = list.length;
    box.innerHTML = list.map((f, i) => `<figure class="sl"><img src="${src(f)}" alt="Кадр ${i + 1}" draggable="false"></figure>`).join('');
    const sl = [...box.children]; let cur = 0, acc = 0, t0 = 0, paused = false;
    const lay = () => { sl.forEach((s, i) => { let d = (i - cur + n) % n; if (d > n / 2) d -= n;
      s.className = 'sl ' + (d === 0 ? 'c' : d === 1 ? 'n' : d === -1 ? 'p' : d > 0 ? 'fr2' : 'fl'); });
      $('#reelCount').textContent = `CH ${pad(cur + 1)} / ${pad(n)}`; };
    const go = (i) => { cur = (i + n) % n; acc = 0; lay(); };
    const st = $('#reelStage');
    st.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) return go(cur + +b.dataset.r);
      const s = e.target.closest('.sl'); if (s && s.classList.contains('n')) go(cur + 1); if (s && s.classList.contains('p')) go(cur - 1); });
    st.addEventListener('mouseenter', () => { paused = true; }); st.addEventListener('mouseleave', () => { paused = false; });
    let sx = null; st.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    st.addEventListener('touchend', (e) => { if (sx !== null) { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); } sx = null; });
    const tk = (now) => { if (!paused && !reduce) { acc += now - t0; if (acc > 5000) go(cur + 1); } t0 = now; requestAnimationFrame(tk); };
    lay(); requestAnimationFrame((t) => { t0 = t; tk(t); });
  }

  /* ---------- архив съёмок ---------- */
  const gs = (gal.galleries || []).filter((g) => g.count);
  $('#arch').innerHTML = gs.length ? gs.map((g) => {
    const d = g.date ? g.date.split('-').reverse().join('.') + ' · ' : '';
    return `<a class="gc" href="gallery.html?g=${g.slug}"><div class="gc__f" style="--u:url('${g.cover}')"><span class="gc__play">● PLAY</span><img src="${g.cover}" alt="" loading="lazy" style="object-position:${g.focus || '50% 50%'}"></div>
      <h3>${g.title.replace(/</g, '&lt;')}</h3><span class="mono">${d}${g.count} фото</span></a>`; }).join('') : '<p class="mono">Скоро здесь появятся съёмки.</p>';
  document.querySelectorAll('.gc__f').forEach((el) => lens(el, .05, .5));
  window.PLENKA.rebuildBg();

  /* ---------- тарифы на плёнке ---------- */
  const msg = (n) => 'https://t.me/ph_Plenkaa?text=' + encodeURIComponent(`Привет! Меня заинтересовал тариф «${n}» на сайте Plёnka Studio — хочу обсудить детали съёмки 📸`);
  const plans = [
    { n: 'Фрагмент', m: 60, u: 'мин', p: '4 900 ₽', l: ['1 зал на выбор', '15 кадров в авторской обработке'] },
    { n: 'Секвенция', m: 120, u: 'мин', p: '9 900 ₽', l: ['2 зала на выбор', '35 кадров в авторской обработке', 'Помощь в поиске визажиста — его услуги отдельно'] },
    { n: 'Полная синхронизация', m: 180, u: 'мин', p: '19 900 ₽', l: ['3 зала — любой можно заменить часом съёмки', '60 кадров в авторской обработке', 'Помощь в поиске визажиста и стилиста', 'Исходники — по желанию'] },
    { n: 'Предметная', m: '10+', u: 'кадров', p: 'от 590 ₽<small>/кадр</small>', l: ['Белый фон, интерьер или с моделью', 'Для маркетплейсов, каталогов и соцсетей', 'Заказ от 10 кадров'] },
  ];
  const empty = (k) => `<div class="fr empty"><div class="fr__in"><span class="fr__no mono">▸ ${k}</span></div></div>`;
  const plan = (x, i) => `<article class="fr"><div class="fr__in"><span class="fr__no mono">▸ ${12 + i}A</span><span class="fr__min">${x.m}<small>${x.u}</small></span>
    <h3>${x.n}</h3><ul>${x.l.map((t) => `<li>${t}</li>`).join('')}</ul>
    <div class="fr__foot"><span class="fr__price">${x.p}</span><a class="key key--sm" href="${msg(x.n)}" target="_blank" rel="noopener"><b></b><span>Выбрать</span></a></div></div></article>`;
  const track = $('#track');
  const edgeT = Array.from({ length: 16 }, (_, i) => `PLЁNKA 400 ▸ ${8 + i}A &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ▸ ${9 + i}`).join(' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ');
  const edgeB = Array.from({ length: 16 }, () => '◂ SAFETY FILM &nbsp; 2018 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SPB').join(' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ');
  track.innerHTML = `<div class="holes holes--t"></div><div class="holes holes--b"></div><span class="edge edge--t">${edgeT}</span><span class="edge edge--b">${edgeB}</span>` +
    empty('10A') + empty('11A') + plans.map(plan).join('') + empty('16A') + empty('17A');
  const holes = () => track.querySelectorAll('.holes').forEach((h) => { h.innerHTML = '<span></span>'.repeat(Math.ceil(track.scrollWidth / 42) + 2); });
  holes(); addEventListener('resize', holes);

  // пошаговый слайдер: на компьютере видно 3 тарифа, на телефоне — 1; дальше крайних тарифов не листается
  const film = $('#film'), cards = [...track.querySelectorAll('article')], cnt = $('#filmCount');
  let fi = 0;
  const vis = () => (innerWidth <= 960 ? 1 : 3);
  const pos = (i) => { const v = vis(), a = cards[i], z = cards[i + v - 1]; return film.clientWidth / 2 - (a.offsetLeft + z.offsetLeft + z.offsetWidth) / 2; };
  const setX = (x, anim) => { track.style.transition = anim ? 'transform .7s cubic-bezier(.2,.75,.2,1)' : 'none'; track.style.transform = `translateX(${x.toFixed(1)}px)`; };
  const place = (anim = true) => {
    const v = vis(), max = cards.length - v; fi = Math.max(0, Math.min(fi, max));
    setX(pos(fi), anim);
    cnt.textContent = v === 1 ? `${pad(fi + 1)} / ${pad(cards.length)}` : `${pad(fi + 1)}–${pad(fi + v)} / ${pad(cards.length)}`;
    document.querySelectorAll('[data-f]').forEach((b) => { b.disabled = (+b.dataset.f < 0 && fi === 0) || (+b.dataset.f > 0 && fi === max); });
  };
  document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { fi += +b.dataset.f; place(); }));
  // свайп: плёнка едет за пальцем, после отпускания доводится до ближайшего тарифа
  let t0 = null;
  film.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    t0 = { x: p.clientX, y: p.clientY, base: pos(fi), lo: pos(cards.length - vis()), hi: pos(0), dir: 0, lx: p.clientX, lt: performance.now(), vx: 0 };
  }, { passive: true });
  film.addEventListener('touchmove', (e) => {
    if (!t0) return;
    const p = e.touches[0], dx = p.clientX - t0.x, dy = p.clientY - t0.y;
    if (!t0.dir) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; t0.dir = Math.abs(dx) > Math.abs(dy) ? 1 : -1; }
    if (t0.dir < 0) return; // вертикальная прокрутка страницы
    if (e.cancelable) e.preventDefault();
    const now = performance.now(); t0.vx = (p.clientX - t0.lx) / Math.max(1, now - t0.lt); t0.lx = p.clientX; t0.lt = now;
    let x = t0.base + dx;
    if (x > t0.hi) x = t0.hi + (x - t0.hi) / 3; else if (x < t0.lo) x = t0.lo + (x - t0.lo) / 3; // мягкий упор на краях
    t0.cur = x; setX(x, false);
  }, { passive: false });
  const tEnd = () => {
    if (!t0) return;
    if (t0.dir > 0 && t0.cur != null) {
      const step = cards[1].offsetLeft - cards[0].offsetLeft, moved = (t0.base - t0.cur) / step;
      let n = Math.round(moved);
      if (n === 0 && Math.abs(t0.vx) > 0.35) n = t0.vx < 0 ? 1 : -1; // быстрый взмах — на соседний
      fi += n;
    }
    t0 = null; place();
  };
  film.addEventListener('touchend', tEnd); film.addEventListener('touchcancel', tEnd);
  place(false); addEventListener('resize', () => place(false)); addEventListener('load', () => place(false));
  if (document.fonts) document.fonts.ready.then(() => place(false));
})();
