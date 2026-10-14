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
