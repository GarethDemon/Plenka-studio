/* Выводит на главной обложки открытых галерей из data/galleries.json */
(async () => {
  const box = document.getElementById('galleryGrid');
  if (!box) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  try {
    const d = await (await fetch('data/galleries.json', { cache: 'no-store' })).json();
    const gs = d.galleries.filter((g) => !g.hidden && g.folders.some((f) => f.photos.length));
    box.innerHTML = gs.length ? gs.map((g) => {
      const f = g.folders.find((x) => x.photos.length);
      const cover = g.cover || `photos/${g.slug}/${f.id}/thumb/${f.photos[0]}`;
      const n = g.folders.reduce((s, x) => s + x.photos.length, 0);
      const date = g.date ? g.date.split('-').reverse().join('.') + ' · ' : '';
      return `<a class="gcard" href="gallery.html?g=${g.slug}"><img loading="lazy" src="${cover}" alt="${esc(g.title)}">` +
        `<span class="gcard__t">${esc(g.title)}</span><span class="gcard__m mono">${date}${n} фото</span></a>`;
    }).join('') : '<p class="mono">Скоро здесь появятся съёмки.</p>';
  } catch (e) {
    box.innerHTML = '<p class="mono">Не удалось загрузить галереи.</p>';
  }
})();
