/* Взрыв-схема фотоаппарата на чистом WebGL (без библиотек).
   Обобщённая зеркалка: корпус, рукоять, пентапризма, диск, объектив-зум, линзы, зеркало, матрица, экран, аккумулятор, карта. */
(() => {
  const canvas = document.getElementById('cam3d');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }
  const frame = canvas.parentElement;
  const helix = document.getElementById('helix');
  if (helix) helix.style.display = 'none';
  frame.classList.add('has-cam');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = () => document.documentElement.dataset.theme === 'dark';

  /* ---------- матрицы ---------- */
  const M = {
    id: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
    mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    tr: (x, y, z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
    rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
    ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return [t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0]; },
    look(e, c) {
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const z = nrm(sub(e, c)), x = nrm(cr([0, 1, 0], z)), y = cr(z, x);
      return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
        -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
  };
  const apply = (m, p) => { const x = p[0], y = p[1], z = p[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; };

  /* ---------- геометрия ---------- */
  function box(w, h, d, taper = 1) {
    const X = w / 2, Y = h / 2, Z = d / 2, t = taper;
    const v = [[-X,-Y,-Z],[X,-Y,-Z],[X,Y*1,-Z],[-X,Y,-Z],[-X,-Y,Z],[X,-Y,Z],[X,Y,Z],[-X,Y,Z]];
    [2, 3, 6, 7].forEach((i) => { v[i][0] *= t; });             // сужение верха (пентапризма)
    const faces = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
    const pos = [], nor = [];
    faces.forEach((f) => {
      const a = v[f[0]], b = v[f[1]], c = v[f[2]];
      const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], w2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      let n = [u[1]*w2[2]-u[2]*w2[1], u[2]*w2[0]-u[0]*w2[2], u[0]*w2[1]-u[1]*w2[0]]; const l = Math.hypot(...n); n = n.map((q) => -q / l);
      [0, 1, 2, 0, 2, 3].forEach((k) => { pos.push(...v[f[k]]); nor.push(...n); });
    });
    const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]], edges = [];
    E.forEach(([a, b]) => edges.push(...v[a], ...v[b]));
    return { pos, nor, edges };
  }
  // цилиндр вдоль оси (axis: 'z' или 'y'), rings — сколько колец-рисок нарисовать
  function cyl(r, len, axis = 'z', seg = 40, rings = 2) {
    const pos = [], nor = [], edges = [], L = len / 2;
    const P = (a, z, rr = r) => axis === 'z' ? [Math.cos(a) * rr, Math.sin(a) * rr, z] : [Math.cos(a) * rr, z, Math.sin(a) * rr];
    const N = (a) => axis === 'z' ? [Math.cos(a), Math.sin(a), 0] : [Math.cos(a), 0, Math.sin(a)];
    const cap = axis === 'z' ? [0, 0, 1] : [0, 1, 0];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const p00 = P(a0, -L), p01 = P(a0, L), p10 = P(a1, -L), p11 = P(a1, L);
      [[p00, a0], [p10, a1], [p11, a1], [p00, a0], [p11, a1], [p01, a0]].forEach(([p, a]) => { pos.push(...p); nor.push(...N(a)); });
      const cT = axis === 'z' ? [0, 0, L] : [0, L, 0], cB = axis === 'z' ? [0, 0, -L] : [0, -L, 0];
      [cT, p01, p11].forEach((p) => { pos.push(...p); nor.push(...cap); });
      [cB, p10, p00].forEach((p) => { pos.push(...p); nor.push(...cap.map((q) => -q)); });
      for (let k = 0; k < rings; k++) { const z = -L + len * k / Math.max(1, rings - 1); edges.push(...P(a0, z), ...P(a1, z)); }
    }
    return { pos, nor, edges };
  }

  /* ---------- детали: позиция, вектор разлёта, цвет ---------- */
  const AX = [0.6, -0.3];                                      // ось объектива (x, y)
  const parts = [
    { g: box(13, 9.4, 7.5), p: [0, 0, 0], e: [0, 0, 0], c: 'body' },
    { g: box(3.2, 8.8, 3.4), p: [-5.2, -0.2, 4.6], e: [-6, 0, .5], c: 'body' },
    { g: box(6.5, 3.2, 6, .62), p: [0.6, 6.3, 0.2], e: [0, 5, 0], c: 'body', label: 'Пентазеркало' },
    { g: box(2.2, .4, 2.2), p: [0.6, 8.05, 0], e: [0, 8, 0], c: 'metal' },
    { g: cyl(1.5, .9, 'y', 32, 6), p: [-4.2, 5.15, -1.2], e: [-2, 4.5, 0], c: 'metal' },
    { g: cyl(.55, .5, 'y', 24, 2), p: [-5.2, 4.75, 4.6], e: [-3, 6.5, 2], c: 'accent' },
    { g: cyl(3.3, .5, 'z', 48, 3), p: [AX[0], AX[1], 4.0], e: [0, 0, 2.2], c: 'metal' },
    { g: box(4.8, 3.4, .12), p: [AX[0], AX[1], 1.4], e: [2, -9, 3], c: 'glass', rx: -Math.PI / 4, label: 'Зеркало' },
    { g: box(3.6, 2.4, .3), p: [AX[0], AX[1], -.6], e: [3, -14, -1], c: 'sensor', label: 'Матрица // APS-C' },
    { g: box(7.6, 5.2, .35), p: [1.2, -.6, -3.95], e: [0, 0, -8], c: 'screen', label: 'Экран' },
    { g: box(2, 5.4, 3.2), p: [-5.2, -.8, 2.2], e: [-13, -4, 0], c: 'accent' },
    { g: box(.2, 2.4, 3.2), p: [-6.6, 2, -1], e: [-10, 6, -1], c: 'metal' },
    // объектив
    { g: cyl(3.2, 2.2, 'z', 48, 3), p: [AX[0], AX[1], 5.35], e: [0, 0, 3.5], c: 'body' },
    { g: cyl(3.5, 2.8, 'z', 48, 9), p: [AX[0], AX[1], 7.85], e: [0, 0, 8], c: 'rubber' },
    { g: cyl(3.25, 1.6, 'z', 48, 5), p: [AX[0], AX[1], 10.05], e: [0, 0, 12.5], c: 'body' },
    { g: cyl(3.45, 1.0, 'z', 48, 3), p: [AX[0], AX[1], 11.35], e: [0, 0, 17], c: 'body' },
    { g: cyl(2.6, .25, 'z', 40, 2), p: [AX[0], AX[1], 6.2], e: [0, 0, 6], c: 'glass' },
    { g: cyl(2.4, .25, 'z', 40, 2), p: [AX[0], AX[1], 9], e: [0, 0, 11], c: 'glass' },
    { g: cyl(2.8, .3, 'z', 40, 2), p: [AX[0], AX[1], 11.7], e: [0, 0, 21], c: 'glass', label: 'Объектив // линзы' },
  ];
  const PAL = {
    light: { body: [.17, .19, .22], metal: [.42, .45, .5], rubber: [.11, .12, .14], accent: [.1, .55, .72], sensor: [.12, .6, .78], screen: [.06, .08, .1], glass: [.62, .85, .95], edge: [.1, .61, .78] },
    dark: { body: [.14, .17, .2], metal: [.36, .4, .45], rubber: [.09, .1, .12], accent: [.23, .72, .89], sensor: [.3, .8, .95], screen: [.05, .07, .09], glass: [.6, .86, .96], edge: [.44, .82, .93] },
  };

  /* ---------- шейдеры ---------- */
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  const pMesh = prog(
    `attribute vec3 aP;attribute vec3 aN;uniform mat4 uMVP;uniform mat4 uM;varying vec3 vN;varying vec3 vW;
     void main(){vN=mat3(uM)*aN;vW=(uM*vec4(aP,1.)).xyz;gl_Position=uMVP*vec4(aP,1.);}`,
    `precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uC;uniform float uA;uniform vec3 uEye;uniform vec3 uRim;uniform float uGlow;
     void main(){vec3 n=normalize(vN);vec3 l=normalize(vec3(-.4,.8,.6));float d=max(dot(n,l),0.);
     vec3 v=normalize(uEye-vW);float rim=pow(1.-max(dot(n,v),0.),2.5);float sp=pow(max(dot(reflect(-l,n),v),0.),24.);
     vec3 c=uC*(.35+.75*d)+uRim*rim*.55+vec3(sp*.35)+uC*uGlow;gl_FragColor=vec4(c,uA);}`
  );
  const pLine = prog(
    `attribute vec3 aP;uniform mat4 uMVP;void main(){gl_Position=uMVP*vec4(aP,1.);}`,
    `precision mediump float;uniform vec4 uC;void main(){gl_FragColor=uC;}`
  );
  const buf = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; };
  parts.forEach((pt) => { let r = 0; for (let i = 0; i < pt.g.pos.length; i += 3) r = Math.max(r, Math.hypot(pt.g.pos[i], pt.g.pos[i + 1], pt.g.pos[i + 2])); pt.r = r; });
  parts.forEach((pt) => { pt.bp = buf(pt.g.pos); pt.bn = buf(pt.g.nor); pt.be = buf(pt.g.edges); pt.n = pt.g.pos.length / 3; pt.ne = pt.g.edges.length / 3; });
  const U = (p, n) => gl.getUniformLocation(p, n);
  const mu = { mvp: U(pMesh, 'uMVP'), m: U(pMesh, 'uM'), c: U(pMesh, 'uC'), a: U(pMesh, 'uA'), eye: U(pMesh, 'uEye'), rim: U(pMesh, 'uRim'), glow: U(pMesh, 'uGlow') };
  const lu = { mvp: U(pLine, 'uMVP'), c: U(pLine, 'uC') };
  const aP = gl.getAttribLocation(pMesh, 'aP'), aN = gl.getAttribLocation(pMesh, 'aN'), lP = gl.getAttribLocation(pLine, 'aP');

  /* ---------- подписи деталей ---------- */
  const labels = document.createElement('div');
  labels.className = 'cam-labels';
  frame.appendChild(labels);
  parts.filter((p) => p.label).forEach((p) => {
    p.el = document.createElement('span');
    p.el.className = 'cam-label mono';
    p.el.textContent = p.label;
    labels.appendChild(p.el);
  });

  /* ---------- цикл ---------- */
  let w = 1, h = 1, dpr = 1, visible = true, t0 = performance.now();
  const resize = () => {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = w * dpr; canvas.height = h * dpr; gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const CYCLE = 10;                                            // сек: собран → разлёт → пауза → сборка
  const explodeAt = (s) => {
    const k = (s % CYCLE) / CYCLE;
    if (k < .15) return 0;
    if (k < .38) return ease((k - .15) / .23);
    if (k < .72) return 1;
    if (k < .92) return 1 - ease((k - .72) / .2);
    return 0;
  };
  const fEl = document.getElementById('fstop'), frameNo = document.getElementById('frameNo');
  let lastCycle = -1; const cam = {};

  const draw = (now) => {
    const s = reduce ? 4 : (now - t0) / 1000;
    const f = explodeAt(s);
    const cyc = Math.floor(s / CYCLE);
    if (cyc !== lastCycle && frameNo) { lastCycle = cyc; frameNo.textContent = String(cyc + 1).padStart(4, '0'); }
    if (fEl) fEl.textContent = 'f/' + [1.8, 2.8, 4, 5.6, 8][Math.min(4, Math.floor(f * 5))];
    const pal = isDark() ? PAL.dark : PAL.light;

    const yaw = 0.62 + Math.sin(s * 0.45) * 0.38;             // чуть влево-вправо
    const pitch = 0.24 + Math.sin(s * 0.3) * 0.05;
    const G = M.mul(M.rx(pitch), M.ry(yaw));
    const asp = w / h, FOV = 0.5;
    // описанная сфера разлетевшейся схемы → центр и дистанция камеры
    const cs = parts.map((pt) => pt.p.map((v, i) => v + pt.e[i] * f));
    const cen = [0, 1, 2].map((i) => cs.reduce((a, c) => a + c[i], 0) / cs.length);
    let R = 0; cs.forEach((c, i) => { R = Math.max(R, Math.hypot(c[0] - cen[0], c[1] - cen[1], c[2] - cen[2]) + parts[i].r); });
    const fovMin = Math.min(FOV, 2 * Math.atan(Math.tan(FOV / 2) * asp));
    const target = R * 0.9 / Math.sin(fovMin / 2);
    cam.d = cam.d ? cam.d + (target - cam.d) * 0.12 : target;
    const eye = [0, 0, cam.d], center = [0, 0, 0];
    const P = M.persp(FOV, asp, 1, 500), V = M.look(eye, center), PV = M.mul(P, V);
    const shift = M.tr(-cen[0], -cen[1], -cen[2]);

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const models = parts.map((pt) => {
      const o = pt.p.map((v, i) => v + pt.e[i] * f);
      let Mm = M.mul(G, M.mul(shift, M.tr(...o)));
      if (pt.rx) Mm = M.mul(Mm, M.rx(pt.rx * (1 - f) + (-0.25) * f));
      return Mm;
    });
    const eyeW = eye;
    const drawMesh = (pt, Mm) => {
      gl.useProgram(pMesh);
      gl.uniformMatrix4fv(mu.mvp, false, new Float32Array(M.mul(PV, Mm)));
      gl.uniformMatrix4fv(mu.m, false, new Float32Array(Mm));
      gl.uniform3fv(mu.c, pal[pt.c]); gl.uniform3fv(mu.eye, eyeW); gl.uniform3fv(mu.rim, pal.edge);
      gl.uniform1f(mu.a, pt.c === 'glass' ? .38 : 1);
      gl.uniform1f(mu.glow, pt.c === 'sensor' ? .6 + .3 * Math.sin(s * 4) : pt.c === 'accent' ? .25 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, pt.bp); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, pt.bn); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, pt.n);
    };
    const drawEdges = (pt, Mm) => {
      gl.useProgram(pLine);
      gl.uniformMatrix4fv(lu.mvp, false, new Float32Array(M.mul(PV, Mm)));
      gl.uniform4f(lu.c, ...pal.edge, .35 + .45 * f);
      gl.bindBuffer(gl.ARRAY_BUFFER, pt.be); gl.enableVertexAttribArray(lP); gl.vertexAttribPointer(lP, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, pt.ne);
    };
    gl.depthMask(true);
    parts.forEach((pt, i) => { if (pt.c !== 'glass') drawMesh(pt, models[i]); });
    parts.forEach((pt, i) => drawEdges(pt, models[i]));
    gl.depthMask(false);
    parts.forEach((pt, i) => { if (pt.c === 'glass') drawMesh(pt, models[i]); });
    gl.depthMask(true);

    // подписи
    parts.forEach((pt, i) => {
      if (!pt.el) return;
      const q = apply(M.mul(PV, models[i]), [0, 0, 0]);
      const x = (q[0] * .5 + .5) * w, y = (1 - (q[1] * .5 + .5)) * h;
      const vis = Math.max(0, (f - .55) / .45);
      pt.el.classList.toggle('is-left', x > w * .5);
      pt.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      pt.el.style.opacity = vis.toFixed(2);
    });
  };
  const loop = (now) => { draw(now); if (visible && !reduce) requestAnimationFrame(loop); };

  resize();
  new ResizeObserver(() => { resize(); if (reduce) draw(performance.now()); }).observe(canvas);
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was && !reduce) requestAnimationFrame(loop); }).observe(canvas);
  requestAnimationFrame(loop);
})();
