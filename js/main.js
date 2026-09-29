(() => {
  'use strict';

  const CONFIG = Object.assign({ formEndpoint: '', openHour: 10, closeHour: 20 }, window.MEMORIA_CONFIG);
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const storage = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* приватный режим */ } },
  };

  /* ---------------- Загрузочный экран ---------------- */

  function runBoot(onDone) {
    const boot = $('#boot');
    const finish = () => {
      document.body.classList.remove('is-booting');
      boot.classList.add('is-done');
      storage.set('memoria-booted', '1');
      onDone();
      setTimeout(() => boot.remove(), 800);
    };

    if (reducedMotion || storage.get('memoria-booted')) {
      boot.style.transition = 'none';
      finish();
      return;
    }

    const log = $('#bootLog');
    const bar = $('#bootBar');
    const pct = $('#bootPct');
    const lines = [
      '> Инициализация ядра MEMORIA… <b>OK</b>',
      '> Загрузка генетической памяти субъекта…',
      '> Калибровка объектива f/1.4 … <b>OK</b>',
      '> Восстановление фрагментов: 1 240 … <b>OK</b>',
      '> Настройка студийного света … <b>OK</b>',
      '> Синхронизация с воспоминанием…',
    ];
    const duration = 3000;
    let start = null;
    let shown = 0;
    let finished = false;

    const end = () => {
      if (finished) return;
      finished = true;
      boot.classList.add('is-flash');
      setTimeout(finish, 450);
    };

    const tick = (ts) => {
      if (finished) return;
      if (start === null) start = ts;
      const p = clamp((ts - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 2);
      bar.style.width = `${eased * 100}%`;
      pct.textContent = `${Math.round(eased * 100)}%`;
      const need = Math.min(lines.length, Math.floor(p * (lines.length + 0.5)) + 1);
      while (shown < need) log.innerHTML += (shown ? '\n' : '') + lines[shown++];
      if (p < 1) requestAnimationFrame(tick);
      else end();
    };

    $('#bootSkip').addEventListener('click', end);
    requestAnimationFrame(tick);
  }

  /* ---------------- Появление блоков ---------------- */

  function initReveal() {
    // Небольшая задержка между соседними элементами
    const groups = new Map();
    $$('.reveal').forEach((el) => {
      const i = groups.get(el.parentElement) || 0;
      groups.set(el.parentElement, i + 1);
      el.style.setProperty('--d', `${Math.min(i, 6) * 0.08}s`);
    });

    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    $$('.reveal').forEach((el) => io.observe(el));
  }

  /* ---------------- Счётчики ---------------- */

  function initCounters() {
    const els = $$('[data-count]');
    const run = (el) => {
      const target = Number(el.dataset.count);
      const fmt = new Intl.NumberFormat('ru-RU');
      if (reducedMotion) { el.textContent = fmt.format(target); return; }
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 1600, 0, 1);
        el.textContent = fmt.format(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------------- Печатающаяся строка ---------------- */

  function initTyped() {
    const el = $('#typed');
    const phrases = [
      '> Портрет, который расскажет о вас больше слов',
      '> Love story — история двоих в одном кадре',
      '> Семейный архив для следующих поколений',
      '> Fashion-съёмка с командой визажистов',
    ];
    if (reducedMotion) { el.textContent = phrases[0]; return; }

    let p = 0;
    let i = 0;
    let deleting = false;
    const loop = () => {
      const text = phrases[p];
      i += deleting ? -1 : 1;
      el.textContent = text.slice(0, i);
      let delay = deleting ? 22 : 45 + Math.random() * 40;
      if (!deleting && i === text.length) { deleting = true; delay = 2200; }
      else if (deleting && i === 0) { deleting = false; p = (p + 1) % phrases.length; delay = 400; }
      setTimeout(loop, delay);
    };
    loop();
  }

  /* ---------------- Фон: плавающие фрагменты ---------------- */

  function initBackground() {
    const canvas = $('#bg');
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let shapes = [];
    let nodes = [];
    let mx = 0;
    let my = 0;
    let raf = 0;

    const seed = () => {
      const area = w * h;
      shapes = Array.from({ length: clamp(Math.round(area / 70000), 8, 24) }, () => ({
        x: rand(0, w), y: rand(0, h),
        r: rand(8, 56),
        a: rand(0, Math.PI * 2),
        va: rand(-0.003, 0.003),
        vx: rand(-0.08, 0.08),
        vy: rand(-0.2, -0.04),
        z: rand(0.3, 1),
        sides: Math.random() < 0.7 ? 3 : 6,
        fill: Math.random() < 0.4,
      }));
      nodes = Array.from({ length: clamp(Math.round(area / 32000), 18, 55) }, () => ({
        x: rand(0, w), y: rand(0, h), vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15),
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const polygon = (x, y, r, sides, a) => {
      ctx.beginPath();
      for (let k = 0; k < sides; k++) {
        const ang = a + (k / sides) * Math.PI * 2;
        const px = x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Сеть точек
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = dx * dx + dy * dy;
          if (d < 16000) {
            ctx.strokeStyle = `rgba(26,156,198,${0.14 * (1 - d / 16000)})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(26,156,198,.35)';
      for (const n of nodes) ctx.fillRect(n.x - 1, n.y - 1, 2, 2);

      // Фрагменты-полигоны
      for (const s of shapes) {
        s.x += s.vx; s.y += s.vy; s.a += s.va;
        if (s.y < -s.r * 2) { s.y = h + s.r * 2; s.x = rand(0, w); }
        if (s.x < -s.r * 2) s.x = w + s.r;
        if (s.x > w + s.r * 2) s.x = -s.r;
        const ox = mx * s.z * 24;
        const oy = my * s.z * 24;
        polygon(s.x + ox, s.y + oy, s.r, s.sides, s.a);
        if (s.fill) {
          ctx.fillStyle = `rgba(255,255,255,${0.35 * s.z})`;
          ctx.fill();
        }
        ctx.strokeStyle = `rgba(21,32,43,${0.08 * s.z})`;
        ctx.stroke();
      }
    };

    const loop = () => { draw(); raf = requestAnimationFrame(loop); };

    resize();
    window.addEventListener('resize', resize);
    if (reducedMotion) { draw(); return; }

    window.addEventListener('pointermove', (e) => {
      mx = e.clientX / w - 0.5;
      my = e.clientY / h - 0.5;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) loop();
    });
    loop();
  }

  /* ---------------- Спираль ДНК ---------------- */

  function initHelix() {
    const canvas = $('#helix');
    const ctx = canvas.getContext('2d');
    const glyphs = [];
    let w = 0;
    let h = 0;
    let t = 0;
    let raf = 0;
    let visible = true;
    let highlight = 7;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const n = 24;
      const top = h * 0.13;
      const bottom = h * 0.87;
      const step = (bottom - top) / (n - 1);
      const cx = w / 2;
      const amp = Math.min(w * 0.2, 100);

      // Сканирующая линия
      const sy = (t * 70) % (h + 80) - 40;
      const grad = ctx.createLinearGradient(0, sy - 40, 0, sy);
      grad.addColorStop(0, 'rgba(111,208,238,0)');
      grad.addColorStop(1, 'rgba(111,208,238,.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, sy - 40, w, 40);
      ctx.fillStyle = 'rgba(26,156,198,.5)';
      ctx.fillRect(0, sy, w, 1);

      const points = [];
      for (let i = 0; i < n; i++) {
        const y = top + i * step;
        const ph = t + i * 0.42;
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        points.push({ y, x1: cx + s * amp, x2: cx - s * amp, z1: c, z2: -c, i });
      }

      // Перемычки
      for (const p of points) {
        const g = ctx.createLinearGradient(p.x1, 0, p.x2, 0);
        g.addColorStop(0, `rgba(26,156,198,${0.15 + 0.25 * (p.z1 + 1) / 2})`);
        g.addColorStop(1, `rgba(21,32,43,${0.08 + 0.2 * (p.z2 + 1) / 2})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y);
        ctx.lineTo(p.x2, p.y);
        ctx.stroke();
      }

      // Нити
      const strand = (key, zKey, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        points.forEach((p, k) => (k ? ctx.lineTo(p[key], p.y) : ctx.moveTo(p[key], p.y)));
        ctx.stroke();
        for (const p of points) {
          const z = (p[zKey] + 1) / 2;
          const r = 1.8 + z * 3.2;
          const isHi = p.i === highlight && key === 'x1';
          ctx.fillStyle = isHi ? '#d2393c' : color.replace(/[\d.]+\)$/, `${0.35 + z * 0.65})`);
          ctx.beginPath();
          ctx.arc(p[key], p.y, r, 0, Math.PI * 2);
          ctx.fill();
          if (isHi) {
            ctx.strokeStyle = 'rgba(210,57,60,.6)';
            ctx.beginPath();
            ctx.arc(p[key], p.y, r + 6 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(210,57,60,.85)';
            ctx.fillText('ВОСПОМИНАНИЕ', p[key] + r + 12, p.y + 3);
            ctx.strokeStyle = color;
          }
        }
      };
      strand('x2', 'z2', 'rgba(21,32,43,1)');
      strand('x1', 'z1', 'rgba(26,156,198,1)');

      // Всплывающие символы
      if (Math.random() < 0.18) {
        glyphs.push({
          x: rand(w * 0.08, w * 0.92), y: h * 0.9, life: 1,
          ch: 'ACGT01'[Math.floor(Math.random() * 6)],
        });
      }
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let k = glyphs.length - 1; k >= 0; k--) {
        const g = glyphs[k];
        g.y -= 0.6;
        g.life -= 0.006;
        if (g.life <= 0) { glyphs.splice(k, 1); continue; }
        ctx.fillStyle = `rgba(127,141,154,${g.life * 0.6})`;
        ctx.fillText(g.ch, g.x, g.y);
      }
    };

    const loop = () => {
      t += 0.012;
      draw();
      if (visible) raf = requestAnimationFrame(loop);
    };

    resize();
    new ResizeObserver(() => { resize(); if (reducedMotion) draw(); }).observe(canvas);
    if (reducedMotion) { draw(); return; }

    new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) loop();
    }).observe(canvas);

    setInterval(() => { highlight = Math.floor(rand(3, 21)); }, 3200);
    loop();

    const code = $('#dnaCode');
    const hex = '0123456789ABCDEF';
    setInterval(() => {
      const r = () => hex[Math.floor(Math.random() * 16)];
      code.textContent = `${'ACGT'[Math.floor(Math.random() * 4)]}${r()}-${'ACGT'[Math.floor(Math.random() * 4)]}${r()}`;
    }, 1800);
  }

  /* ---------------- Индикатор синхронизации и навигация ---------------- */

  function initScroll() {
    const fill = $('#syncFill');
    const value = $('#syncValue');
    const sync = $('.sync');
    let ticking = false;

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      const pct = Math.round(p * 100);
      fill.style.height = `${pct}%`;
      value.textContent = `${pct}%`;
      sync.classList.toggle('is-full', pct >= 99);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    // Подсветка активного пункта меню
    const links = $$('.nav a[href^="#"]:not(.btn)');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => io.observe(s));

    // Мобильное меню
    const burger = $('#burger');
    const nav = $('#nav');
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  }

  /* ---------------- Галерея ---------------- */

  function initGallery() {
    const shots = $$('.shot');
    const filters = $$('.filter');

    filters.forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filters.forEach((b) => b.classList.toggle('is-active', b === btn));
      shots.forEach((s) => {
        const show = f === 'all' || s.dataset.cat === f;
        s.classList.toggle('is-hidden', !show);
        if (show) s.classList.add('is-in');
      });
    }));

    const dialog = $('#lightbox');
    const img = $('#lbImg');
    const caption = $('#lbCaption');
    const frame = $('.lightbox__frame');
    let list = [];
    let index = 0;

    const show = (i) => {
      index = (i + list.length) % list.length;
      const shot = list[index];
      const src = shot.querySelector('img');
      // Для picsum берём версию крупнее; свои фото откроются как есть
      img.src = src.currentSrc.replace(/\/(\d+)\/(\d+)$/, (_, a, b) => `/${a * 2}/${b * 2}`);
      img.alt = src.alt;
      caption.textContent = `${shot.querySelector('figcaption').textContent} · ${index + 1} / ${list.length}`;
      frame.style.animation = 'none';
      void frame.offsetWidth;
      frame.style.animation = '';
    };

    shots.forEach((shot) => {
      shot.tabIndex = 0;
      shot.setAttribute('role', 'button');
      const open = () => {
        list = shots.filter((s) => !s.classList.contains('is-hidden'));
        show(list.indexOf(shot));
        if (typeof dialog.showModal === 'function') dialog.showModal();
      };
      shot.addEventListener('click', open);
      shot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    dialog.addEventListener('click', (e) => {
      const action = e.target.closest('[data-lb]')?.dataset.lb;
      if (action === 'prev') show(index - 1);
      else if (action === 'next') show(index + 1);
      else if (action === 'close' || e.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
  }

  /* ---------------- Уведомления ---------------- */

  let toastTimer = 0;
  function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('is-error', isError);
    el.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-shown'), 4200);
  }

  /* ---------------- Форма заявки ---------------- */

  function initForm() {
    const form = $('#bookingForm');
    const panel = form.closest('.panel');
    const result = $('#result');
    const submitBtn = $('#submitBtn');
    const btnText = submitBtn.querySelector('.btn__text');
    const btnProgress = submitBtn.querySelector('.btn__progress');
    const dateInput = $('#f-date');
    const phoneInput = $('#f-phone');

    // Минимальная дата — сегодня
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    dateInput.min = today;

    // Слоты времени
    const timeSelect = $('#f-time');
    for (let hour = CONFIG.openHour; hour <= CONFIG.closeHour; hour++) {
      timeSelect.add(new Option(`${pad(hour)}:00`));
    }

    // Выбор услуги/тарифа из карточек
    const scrollToForm = () => $('#booking').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    $$('[data-service]').forEach((btn) => btn.addEventListener('click', () => {
      const radio = form.querySelector(`input[name="service"][value="${CSS.escape(btn.dataset.service)}"]`);
      if (radio) { radio.checked = true; clearError('service'); }
      scrollToForm();
      toast(`Секвенция «${btn.dataset.service}» выбрана`);
    }));
    $$('[data-package]').forEach((btn) => btn.addEventListener('click', () => {
      form.elements.package.value = btn.dataset.package;
      scrollToForm();
      toast(`Тариф «${btn.dataset.package}» выбран`);
    }));

    // Мягкая маска телефона: оставляем только допустимые символы
    phoneInput.addEventListener('input', () => {
      const cleaned = phoneInput.value.replace(/[^\d+()\-\s]/g, '');
      if (cleaned !== phoneInput.value) phoneInput.value = cleaned;
    });
    phoneInput.addEventListener('focus', () => { if (!phoneInput.value) phoneInput.value = '+7 '; });
    phoneInput.addEventListener('blur', () => { if (phoneInput.value.trim() === '+7') phoneInput.value = ''; });

    const fieldBox = (name) => form.querySelector(`[data-field="${name}"]`);

    function setError(name, message) {
      const box = fieldBox(name);
      box.classList.remove('is-invalid');
      void box.offsetWidth; // перезапуск анимации
      box.classList.add('is-invalid');
      box.querySelector('.field__error').textContent = message;
    }

    function clearError(name) {
      const box = fieldBox(name);
      if (!box) return;
      box.classList.remove('is-invalid');
      const err = box.querySelector('.field__error');
      if (err) err.textContent = '';
    }

    const validators = {
      service: () => (form.elements.service.value ? '' : 'выберите тип съёмки'),
      date: () => {
        const v = dateInput.value;
        if (!v) return 'укажите желаемую дату';
        if (v < today) return 'эта дата уже в прошлом';
        return '';
      },
      name: () => (form.elements.name.value.trim().length >= 2 ? '' : 'укажите имя'),
      phone: () => {
        const digits = phoneInput.value.replace(/\D/g, '');
        if (!digits) return 'укажите телефон';
        return digits.length >= 10 && digits.length <= 15 ? '' : 'проверьте номер телефона';
      },
      contact: () => {
        const v = form.elements.contact.value.trim();
        if (!v) return '';
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        const isTg = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v);
        return isEmail || isTg ? '' : 'нужен e-mail или @username';
      },
      consent: () => (form.elements.consent.checked ? '' : 'нужно согласие на обработку данных'),
    };

    // Снимаем ошибку, как только поле исправлено
    form.addEventListener('input', (e) => {
      const box = e.target.closest('[data-field]');
      if (!box || !box.classList.contains('is-invalid')) return;
      const check = validators[box.dataset.field];
      if (check && !check()) clearError(box.dataset.field);
    });
    form.addEventListener('change', (e) => {
      const box = e.target.closest('[data-field]');
      if (box && validators[box.dataset.field] && !validators[box.dataset.field]()) clearError(box.dataset.field);
    });

    function validate() {
      let first = null;
      for (const [name, check] of Object.entries(validators)) {
        const msg = check();
        if (msg) {
          setError(name, msg);
          first = first || name;
        } else {
          clearError(name);
        }
      }
      if (first) {
        const focusable = fieldBox(first).querySelector('input, select, textarea');
        focusable?.focus({ preventScroll: true });
        fieldBox(first).scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      }
      return !first;
    }

    function collect() {
      const el = form.elements;
      const [y, m, d] = el.date.value.split('-');
      const contact = el.contact.value.trim();
      const data = {
        'Услуга': el.service.value,
        'Тариф': el.package.value,
        'Участников': el.people.value,
        'Дата': `${d}.${m}.${y}`,
        'Время': el.time.value,
        'Имя': el.name.value.trim(),
        'Телефон': el.phone.value.trim(),
        'E-mail / Telegram': contact || '—',
        'Комментарий': el.comment.value.trim() || '—',
      };
      const payload = {
        ...data,
        _subject: `Заявка на фотосессию: ${data['Услуга']}, ${data['Дата']}`,
        _gotcha: el._gotcha.value,
      };
      if (contact.includes('@') && contact.includes('.')) payload.email = contact;
      return { data, payload };
    }

    function animateProgress(ms) {
      return new Promise((resolve) => {
        const t0 = performance.now();
        const step = (now) => {
          const p = clamp((now - t0) / ms, 0, 1);
          const pct = Math.round(p * 100);
          btnProgress.style.width = `${pct}%`;
          btnText.textContent = `Синхронизация… ${pct}%`;
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    async function send(payload) {
      if (!CONFIG.formEndpoint) {
        console.info('[MEMORIA] Демо-режим: formEndpoint не задан в js/config.js. Заявка:', payload);
        return { demo: true };
      }
      const res = await fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { demo: false };
    }

    function showResult(data, demo) {
      const summary = $('#resultSummary');
      summary.innerHTML = '';
      const id = `MEM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const rows = [['Код', id], ['Услуга', data['Услуга']], ['Дата', `${data['Дата']}, ${data['Время']}`], ['Имя', data['Имя']]];
      for (const [k, v] of rows) {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = k;
        dd.textContent = v;
        summary.append(dt, dd);
      }
      $('#resultText').textContent = demo
        ? 'Сайт работает в демо-режиме: заявка не отправлена. Подключите приём заявок в js/config.js.'
        : `${data['Имя']}, спасибо! Мы свяжемся с вами в ближайшее время, чтобы подтвердить запись.`;
      form.hidden = true;
      result.hidden = false;
      panel.classList.add('is-synced');
      setTimeout(() => panel.classList.remove('is-synced'), 1000);
      panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }

    function resetButton() {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      btnText.textContent = 'Начать синхронизацию';
      btnProgress.style.width = '0';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) {
        toast('Десинхронизация: проверьте отмеченные поля', true);
        return;
      }

      const { data, payload } = collect();
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;

      try {
        const [res] = await Promise.all([send(payload), animateProgress(reducedMotion ? 10 : 1400)]);
        showResult(data, res.demo);
        if (res.demo) toast('Демо-режим: заявка выведена в консоль браузера');
      } catch (err) {
        console.error('[MEMORIA] Ошибка отправки заявки', err);
        toast('Связь с Анимусом потеряна. Попробуйте ещё раз или позвоните нам.', true);
      } finally {
        resetButton();
      }
    });

    $('#resetBtn').addEventListener('click', () => {
      form.reset();
      Object.keys(validators).forEach(clearError);
      result.hidden = true;
      form.hidden = false;
      form.elements.service[0].focus();
    });
  }

  /* ---------------- Старт ---------------- */

  $('#year').textContent = new Date().getFullYear();
  initBackground();
  initHelix();
  initScroll();
  initGallery();
  initForm();
  initTyped();
  runBoot(() => {
    initReveal();
    initCounters();
  });
})();
