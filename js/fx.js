/* Общие эффекты сайта Plёnka: фон с параллаксом, пылинки, линза для фото */
(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* ---------- фон с параллаксом: два слоя пятен ---------- */
  const COLORS = ['#b8682c', '#6e1f2c', '#1f4f4d', '#d88a3c', '#8a2a2a', '#2c5e5a'];
  const page = document.querySelector('.page') || document.body;
  const build = () => {
    const H = page.offsetHeight, vh = innerHeight;
    [['#bgFar', .55, 1.25, .40], ['#bgNear', .25, .8, .22]].forEach(([id, k, size, op], L) => {
      const el = $(id); el.dataset.k = k; el.style.height = (H * (1 - k) + vh * 1.5) + 'px';
      let html = '', y = -vh * .3, i = L * 2;
      while (y < H * (1 - k) + vh) {
        const s = (L ? 34 : 58) * size, x = ((i * 37 + L * 23) % 100) - 15;
        html += `<i style="width:${s}vmax;height:${s}vmax;left:${x}vw;top:${y}px;opacity:${op}"><b style="background:radial-gradient(circle,${COLORS[i % COLORS.length]},transparent 65%);animation-delay:-${i * 4}s"></b></i>`;
        y += vh * (L ? .75 : 1.05); i++;
      }
      el.innerHTML = html;
    });
  };
  const par = () => { const y = scrollY; document.querySelectorAll('.bgm').forEach((el) => { el.style.transform = `translate3d(0,${(y * el.dataset.k).toFixed(1)}px,0)`; }); };
  addEventListener('load', () => { build(); par(); }); build(); par();
  addEventListener('resize', () => { build(); par(); });
  if (!reduce) addEventListener('scroll', par, { passive: true });

  /* ---------- линза: бочкообразное искажение + хроматическая аберрация ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.style.position = 'absolute';
  document.body.appendChild(svg);
  const map = (() => { const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), d = x.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1, v = j / (n - 1) * 2 - 1, r2 = Math.min(2, u * u + v * v), k = (j * n + i) * 4;
      d.data[k] = 128 - u * r2 * 32; d.data[k + 1] = 128 - v * r2 * 32; d.data[k + 2] = 128; d.data[k + 3] = 255; }
    x.putImageData(d, 0, 0); return c.toDataURL(); })();
  let fid = 0;
  function lens(el, strength = .06, ca = .45) {
    const id = 'lens' + (++fid), f = document.createElementNS(NS, 'filter');
    f.id = id; f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = '<feImage result="m" preserveAspectRatio="none"/>' +
      ['r', 'g', 'b'].map((c, i) => `<feDisplacementMap in="SourceGraphic" in2="m" xChannelSelector="R" yChannelSelector="G" result="d${c}"/>` +
        `<feColorMatrix in="d${c}" type="matrix" values="${i === 0 ? '1 0 0 0 0 ' : '0 0 0 0 0 '}${i === 1 ? '0 1 0 0 0 ' : '0 0 0 0 0 '}${i === 2 ? '0 0 1 0 0 ' : '0 0 0 0 0 '}0 0 0 1 0" result="${c}"/>`).join('') +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
    svg.appendChild(f);
    const img = f.querySelector('feImage'); img.setAttribute('href', map);
    const fit = () => { const w = el.offsetWidth, h = el.offsetHeight, s = Math.min(w, h) * strength * 4;
      [f, img].forEach((n) => { n.setAttribute('x', 0); n.setAttribute('y', 0); n.setAttribute('width', w); n.setAttribute('height', h); });
      f.querySelectorAll('feDisplacementMap').forEach((m, i) => m.setAttribute('scale', s * [1 + ca, 1, 1 - ca][i])); };
    fit(); new ResizeObserver(fit).observe(el); el.style.filter = `url(#${id})`;
  }

  /* ---------- пылинки ---------- */
  const cv = $('#dust'), cx = cv.getContext('2d'); let W, H, D = Math.min(devicePixelRatio || 1, 2);
  const rs = () => { W = innerWidth; H = innerHeight; cv.width = W * D; cv.height = H * D; cx.setTransform(D, 0, 0, D, 0, 0); };
  rs(); addEventListener('resize', rs);
  const R = (a, b) => a + Math.random() * (b - a);
  const P = Array.from({ length: 100 }, (_, i) => ({ x: R(0, innerWidth), y: R(0, innerHeight), z: R(.2, 1), vx: R(-.08, .08), vy: R(-.12, .02), ph: R(0, 6.28), big: i < 8 }));
  const COL = '255,206,160';
  let lastY = scrollY;
  const tick = (t) => {
    cx.clearRect(0, 0, W, H);
    const dy = scrollY - lastY; lastY = scrollY;           // пылинки чуть отстают от прокрутки — тоже параллакс
    const gx = W * .3, gy = H * .1, reach = Math.max(W, H) * .95;
    for (const p of P) {
      p.vx += R(-.004, .004); p.vy += R(-.004, .004); p.vx *= .995; p.vy *= .995;
      p.x += p.vx * p.z * 2; p.y += (p.vy - .03) * p.z * 2 - dy * p.z * .35;
      if (p.y < -20) { p.y = H + 20; p.x = R(0, W); } if (p.y > H + 20) { p.y = -20; p.x = R(0, W); }
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      const d = Math.hypot(p.x - gx, p.y - gy), l = Math.max(0, 1 - d / reach) ** 1.6, tw = .6 + .4 * Math.sin(t / 900 + p.ph);
      if (p.big) { const r = 6 + p.z * 12, g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(${COL},${.07 * l * tw})`); g.addColorStop(1, `rgba(${COL},0)`); cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 6.28); cx.fill(); }
      else { cx.fillStyle = `rgba(${COL},${(.05 + .5 * l) * tw * p.z})`; cx.beginPath(); cx.arc(p.x, p.y, .4 + p.z * 1.2, 0, 6.28); cx.fill(); }
    }
    if (!reduce) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.PLENKA = { lens, rebuildBg: () => { build(); par(); } };
})();
