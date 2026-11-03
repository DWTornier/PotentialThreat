// Wire Relay — monochrome hidden-line wireframe cutscene (Canvas2D, procedural).
// Shots: room -> desktop tower LEDs | hall -> rack -> server LEDs | module LEDs -> satellite -> orbit.
export function createWireRelaySequence() {
  const TAU = Math.PI * 2;
  let canvas = null, c = null, w = 1, h = 1, dpr = 1;
  let T = 0, earthT = 0, reduced = false;
  let pal = null, sprites = null, vign = null, scenes = null, shots = null, total = 0;
  const fillCache = new Map();

  // ---------------------------------------------------------------- math
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const neg = a => [-a[0], -a[1], -a[2]];
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const rotY = a => { const cs = Math.cos(a), sn = Math.sin(a); return [[cs, 0, -sn], Y, [sn, 0, cs]]; };
  const rotX = a => { const cs = Math.cos(a), sn = Math.sin(a); return [X, [0, cs, sn], [0, -sn, cs]]; };
  const mm = (a, b) => [0, 1, 2].map(i => [0, 1, 2].map(j => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
  const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
  const tr = m => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
  const rxm = a => { const cs = Math.cos(a), sn = Math.sin(a); return [[1, 0, 0], [0, cs, -sn], [0, sn, cs]]; };
  const rym = a => { const cs = Math.cos(a), sn = Math.sin(a); return [[cs, 0, sn], [0, 1, 0], [-sn, 0, cs]]; };
  const rzm = a => { const cs = Math.cos(a), sn = Math.sin(a); return [[cs, -sn, 0], [sn, cs, 0], [0, 0, 1]]; };
  const centroid = pts => { let x = 0, y = 0, z = 0; for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; } const k = 1 / pts.length; return [x * k, y * k, z * k]; };
  const d2 = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; };

  const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let q = Math.imul(s ^ (s >>> 15), 1 | s); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const h2 = (a, b) => { let x = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x632BE5AB, 668265263); x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const h3 = (a, b, c3, s) => { let x = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c3, 0x5bd1e995) ^ Math.imul(s, 0x85ebca77); x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); x ^= x >>> 15; return (x >>> 0) / 4294967296; };
  function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), q = zf * zf * (3 - 2 * zf);
    const l = (a, b, k) => a + (b - a) * k;
    return l(
      l(l(h3(xi, yi, zi, s), h3(xi + 1, yi, zi, s), u), l(h3(xi, yi + 1, zi, s), h3(xi + 1, yi + 1, zi, s), u), v),
      l(l(h3(xi, yi, zi + 1, s), h3(xi + 1, yi, zi + 1, s), u), l(h3(xi, yi + 1, zi + 1, s), h3(xi + 1, yi + 1, zi + 1, s), u), v), q);
  }
  const fbm = (x, y, z, s) => { let a = 0.5, f = 1, r = 0; for (let i = 0; i < 4; i++) { r += a * vnoise(x * f, y * f, z * f, s + i * 17); a *= 0.5; f *= 2.03; } return r; };

  // ---------------------------------------------------------------- color (derived from ctx.theme.colors only)
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const desat = (a, k) => { const l = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114; return mixc(a, [l, l, l], k); };
  const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const rgb = a => 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')';
  const rgba = (a, al) => 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')';
  function parseCol(str, sc) {
    if (typeof str !== 'string' || !str) return null;
    sc.fillStyle = 'transparent';
    const before = sc.fillStyle;
    sc.fillStyle = str;
    const v = sc.fillStyle;
    if (v === before && !/transparent/i.test(str)) return null;
    if (v[0] === '#' && v.length >= 7) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
    const m = v.match(/[\d.]+/g);
    return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
  }
  function buildPalette(theme) {
    const sc = document.createElement('canvas').getContext('2d');
    const C = (theme && theme.colors) || {};
    const g = k => parseCol(C[k], sc);
    const bg = g('bg') || [0, 0, 0];
    const fg = g('fg') || g('wire') || [255, 255, 255];
    const dim = g('dim') || mixc(bg, fg, 0.45);
    const cool = g('ledCool') || g('cyan') || g('green') || fg;
    const green = g('green') || cool;
    const red = g('red') || g('ledWarm') || g('amber') || fg;
    const warm = g('ledWarm') || red;
    const amb = g('amber');
    const teal = scalec(desat(amb ? mixc(green, amb, 0.55) : green, 0.4), 0.9);
    const rd = scalec(desat(mixc(red, warm, 0.12), 0.34), 0.86);
    const atm = mixc(desat(g('cyan') || cool, 0.55), bg, 0.3);
    return { bg, fg, dim, teal, red: rd, atm, bgS: rgb(bg), fgS: rgb(fg), dimS: rgb(dim), atmS: rgb(atm) };
  }
  function fillS(s) {
    const k = Math.round(clamp(s, 0, 1) * 600);
    let v = fillCache.get(k);
    if (!v) { v = rgb(mixc(pal.bg, pal.fg, k / 600)); fillCache.set(k, v); }
    return v;
  }
  function mkSprite(col) {
    const s = 96, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    const hot = mixc(col, pal.fg, 0.55);
    gr.addColorStop(0, rgba(hot, 1));
    gr.addColorStop(0.07, rgba(col, 0.85));
    gr.addColorStop(0.2, rgba(col, 0.3));
    gr.addColorStop(0.45, rgba(col, 0.08));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return cv;
  }

  // ---------------------------------------------------------------- geometry
  const newScene = o => ({ objs: [], L: nrm(o.L), fog: o.fog || null, near: o.near, bsp: null, space: null });
  function mkFace(S, pts, n, o, U, V, fw, fh, opt) {
    const lit = Math.max(0, dot(n, S.L));
    return {
      pts, n, d: dot(n, pts[0]), c: centroid(pts), o, U, V, w: fw, h: fh,
      sh: (opt.sh != null ? opt.sh : 0.014 + 0.05 * lit) + (opt.emit || 0),
      la: opt.la != null ? opt.la : 0.9, dec: null, leds: null, lo: false
    };
  }
  const addObj = (S, o) => { o.c = centroid(o.verts); S.objs.push(o); return o; };
  function cuboid(S, c0, ax, hx, hy, hz, opt = {}) {
    const A = ax[0], B = ax[1], C = ax[2], only = opt.only || 'px nx py ny pz nz';
    const ext = n => Math.abs(dot(n, A)) * hx + Math.abs(dot(n, B)) * hy + Math.abs(dot(n, C)) * hz;
    const o = { faces: [], verts: [] }, F = {};
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) o.verts.push(mad(mad(mad(c0, A, hx * sx), B, hy * sy), C, hz * sz));
    const defs = [['px', A, B], ['nx', neg(A), B], ['pz', C, B], ['nz', neg(C), B], ['py', B, C], ['ny', neg(B), C]];
    for (const [k, n, V] of defs) {
      if (only.indexOf(k) < 0) continue;
      const U = crs(n, V), hn = ext(n), hu = ext(U), hv = ext(V);
      const fc = mad(c0, n, hn), org = mad(mad(fc, U, -hu), V, -hv);
      const bv = opt.bv || 0;
      const q = (a, b) => mad(mad(org, U, a), V, b);
      const f = mkFace(S, [q(bv, bv), q(2 * hu - bv, bv), q(2 * hu - bv, 2 * hv - bv), q(bv, 2 * hv - bv)], n, org, U, V, 2 * hu, 2 * hv, opt);
      o.faces.push(f); F[k] = f;
    }
    if (opt.bv) {
      const b = opt.bv, hh = [hx, hy, hz], K = [['px', 'nx'], ['py', 'ny'], ['pz', 'nz']];
      const bo = { la: (opt.la != null ? opt.la : 0.9) * 0.8, emit: 0.03 };
      const pt = (s, m) => { let p = c0; for (let i = 0; i < 3; i++) p = mad(p, ax[i], s[i] * (hh[i] - m[i] * b)); return p; };
      const push = (pts, n) => { const f = mkFace(S, pts, n, pts[0], nrm(sub(pts[1], pts[0])), nrm(sub(pts[pts.length - 1], pts[0])), 1, 1, bo); f.bs = b; o.faces.push(f); };
      const has = (i, s) => only.indexOf(K[i][s > 0 ? 0 : 1]) >= 0;
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const k = 3 - i - j;
        for (const si of [-1, 1]) for (const sj of [-1, 1]) {
          if (!has(i, si) || !has(j, sj)) continue;
          const mk = (mi, mj, t) => { const s = [0, 0, 0], m = [0, 0, 0]; s[i] = si; s[j] = sj; s[k] = t; m[i] = mi; m[j] = mj; m[k] = 1; return pt(s, m); };
          push([mk(0, 1, -1), mk(0, 1, 1), mk(1, 0, 1), mk(1, 0, -1)], nrm(add(scl(ax[i], si), scl(ax[j], sj))));
        }
      }
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        if (!has(0, sx) || !has(1, sy) || !has(2, sz)) continue;
        const s = [sx, sy, sz];
        push([pt(s, [0, 1, 1]), pt(s, [1, 0, 1]), pt(s, [1, 1, 0])], nrm(add(add(scl(ax[0], sx), scl(ax[1], sy)), scl(ax[2], sz))));
      }
    }
    addObj(S, o);
    return F;
  }
  const box = (S, x0, y0, z0, x1, y1, z1, opt) => cuboid(S, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [X, Y, Z], (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, opt);
  function frustum(S, p0, p1, r0, r1, seg, opt = {}) {
    const a = nrm(sub(p1, p0)), hl = Math.abs(a[1]) < 0.9 ? Y : X;
    const e1 = nrm(crs(hl, a)), e2 = crs(a, e1), ph = opt.ph || 0;
    const ring = (p, r) => { const out = []; for (let i = 0; i < seg; i++) { const th = (i + ph) / seg * TAU; out.push(mad(mad(p, e1, Math.cos(th) * r), e2, Math.sin(th) * r)); } return out; };
    const b = ring(p0, r0), q = ring(p1, r1), o = { faces: [], verts: b.concat(q) }, F = { side: [] };
    const mid = scl(add(p0, p1), 0.5);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg, pts = [b[i], b[j], q[j], q[i]];
      const eU = sub(pts[1], pts[0]), eV = sub(pts[3], pts[0]);
      let n = nrm(crs(eU, eV));
      if (dot(n, sub(centroid(pts), mid)) < 0) n = neg(n);
      const f = mkFace(S, pts, n, pts[0], nrm(eU), nrm(eV), len(eU), len(eV), opt);
      o.faces.push(f); F.side.push(f);
    }
    if (r0 > 0) { const f = mkFace(S, b.slice().reverse(), neg(a), mad(mad(p0, e1, -r0), e2, -r0), e1, e2, 2 * r0, 2 * r0, opt); o.faces.push(f); F.c0 = f; }
    if (r1 > 0) { const f = mkFace(S, q.slice(), a, mad(mad(p1, e1, -r1), e2, -r1), e1, e2, 2 * r1, 2 * r1, opt); o.faces.push(f); F.c1 = f; }
    addObj(S, o);
    return F;
  }
  function lines(S, polys, a = 0.8, min = 0) {
    const verts = []; for (const p of polys) for (const q of p) verts.push(q);
    const cc = centroid(verts); let rad = 0.001;
    for (const v of verts) rad = Math.max(rad, len(sub(v, cc)));
    const f = { lo: true, c: cc, rad, dec: [{ a, min, polys: polys.map(p => ({ p, cl: false })) }], leds: null };
    addObj(S, { faces: [f], verts });
  }
  const at = (f, x, y) => [f.o[0] + f.U[0] * x + f.V[0] * y, f.o[1] + f.U[1] * x + f.V[1] * y, f.o[2] + f.U[2] * x + f.V[2] * y];
  function dec(f, pts2, cl, a = 1, min = 0) {
    if (!f) return;
    const p = pts2.map(q => at(f, q[0], q[1]));
    if (!f.dec) f.dec = [];
    let g = null;
    for (const gg of f.dec) if (gg.a === a && gg.min === min) { g = gg; break; }
    if (!g) { g = { a, min, polys: [] }; f.dec.push(g); }
    g.polys.push({ p, cl });
  }
  const dLine = (f, x0, y0, x1, y1, a, m) => dec(f, [[x0, y0], [x1, y1]], false, a, m);
  const dRect = (f, x0, y0, x1, y1, a, m) => dec(f, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, a, m);
  function dChamf(f, x0, y0, x1, y1, k, a, m) { dec(f, [[x0 + k, y0], [x1 - k, y0], [x1, y0 + k], [x1, y1 - k], [x1 - k, y1], [x0 + k, y1], [x0, y1 - k], [x0, y0 + k]], true, a, m); }
  function dArc(f, x, y, r, a0, a1, a, m, seg = 16) { const p = []; for (let i = 0; i <= seg; i++) { const th = a0 + (a1 - a0) * i / seg; p.push([x + Math.cos(th) * r, y + Math.sin(th) * r]); } dec(f, p, false, a, m); }
  function dCirc(f, x, y, r, a, m, seg = 20) { const p = []; for (let i = 0; i < seg; i++) { const th = i / seg * TAU; p.push([x + Math.cos(th) * r, y + Math.sin(th) * r]); } dec(f, p, true, a, m); }
  function dHatch(f, x0, y0, x1, y1, sp, a, m) {
    for (let k = x0 - y1 + sp * 0.5; k < x1 - y0; k += sp) { const xa = Math.max(x0, y0 + k), xb = Math.min(x1, y1 + k); if (xb > xa) dLine(f, xa, xa - k, xb, xb - k, a, m); }
    for (let k = x0 + y0 + sp * 0.5; k < x1 + y1; k += sp) { const xa = Math.max(x0, k - y1), xb = Math.min(x1, k - y0); if (xb > xa) dLine(f, xa, k - xa, xb, k - xb, a, m); }
  }
  function led(f, x, y, r, col, pat, seed, g = 1, hero = false) {
    if (!f.leds) f.leds = [];
    f.leds.push({ p: mad(at(f, x, y), f.n, r * 0.2), r, col, pat, seed, g, hero });
  }

  // ---------------------------------------------------------------- BSP over convex objects (static scenes)
  function classify(o, P) {
    let mn = Infinity, mx = -Infinity;
    for (const v of o.verts) { const s = v[0] * P[0] + v[1] * P[1] + v[2] * P[2] - P[3]; if (s < mn) mn = s; if (s > mx) mx = s; }
    const e = 1e-5;
    if (mn >= -e) return mx <= e ? -1 : 1;
    if (mx <= e) return -1;
    return 0;
  }
  function tryPlanes(objs, cands) {
    let best = null, bs = Infinity;
    for (const P of cands) {
      let F = 0, B = 0, ok = true;
      for (const o of objs) { const s = classify(o, P); if (s === 0) { ok = false; break; } if (s > 0) F++; else B++; }
      if (!ok || !F || !B) continue;
      const sc = Math.abs(F - B);
      if (sc < bs) { bs = sc; best = P; if (sc <= 1) break; }
    }
    return best;
  }
  function bsp(objs, R, depth = 0) {
    if (objs.length <= 1 || depth > 60) return { leaf: objs };
    const all = [];
    for (const o of objs) for (const f of o.faces) if (!f.lo && !f.bs) all.push([f.n[0], f.n[1], f.n[2], f.d]);
    let best = null;
    if (all.length > 80) {
      const s = all.slice();
      for (let i = s.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = s[i]; s[i] = s[j]; s[j] = t; }
      s.length = 80;
      best = tryPlanes(objs, s);
    }
    if (!best) best = tryPlanes(objs, all);
    if (!best) return { leaf: objs };
    const Fs = [], Bs = [];
    for (const o of objs) (classify(o, best) > 0 ? Fs : Bs).push(o);
    return { P: best, f: bsp(Fs, R, depth + 1), b: bsp(Bs, R, depth + 1) };
  }
  function walk(node, out) {
    if (node.leaf) {
      if (node.leaf.length === 1) { out.push(node.leaf[0]); return; }
      const arr = node.leaf.slice().sort((a, b) => d2(b.c, E) - d2(a.c, E));
      for (const o of arr) out.push(o);
      return;
    }
    const P = node.P, s = E[0] * P[0] + E[1] * P[1] + E[2] * P[2] - P[3];
    if (s >= 0) { walk(node.b, out); walk(node.f, out); } else { walk(node.f, out); walk(node.b, out); }
  }

  // ---------------------------------------------------------------- camera / projection / clipping
  let E = [0, 0, 0], RX = X, UY = Y, FZ = Z, fpx = 1, cx = 0, cy = 0, planes = [];
  const SEG = [0, 1];
  function setCamera(cam) {
    E = cam.p;
    const f = nrm(sub(cam.t, cam.p));
    let r = nrm(crs(Y, f)), u = crs(f, r);
    if (cam.roll) {
      const cs = Math.cos(cam.roll), sn = Math.sin(cam.roll);
      const r2 = add(scl(r, cs), scl(u, sn)), u2 = add(scl(u, cs), scl(r, -sn));
      r = r2; u = u2;
    }
    RX = r; UY = u; FZ = f;
    fpx = 0.5 * Math.min(h, w * 9 / 16) / Math.tan(cam.fov * Math.PI / 360);
    cx = w / 2; cy = h / 2;
  }
  function mkPlanes(near) {
    const kx = (w * 0.5 / fpx) * 1.25 + 0.01, ky = (h * 0.5 / fpx) * 1.25 + 0.01;
    return [[0, 0, 1, -near], [-1, 0, kx, 0], [1, 0, kx, 0], [0, -1, ky, 0], [0, 1, ky, 0]];
  }
  const toC = p => {
    const dx = p[0] - E[0], dy = p[1] - E[1], dz = p[2] - E[2];
    return [dx * RX[0] + dy * RX[1] + dz * RX[2], dx * UY[0] + dy * UY[1] + dz * UY[2], dx * FZ[0] + dy * FZ[1] + dz * FZ[2]];
  };
  function clipPoly(pts) {
    let out = pts;
    for (const P of planes) {
      const inp = out, n = inp.length; out = [];
      if (!n) break;
      for (let i = 0; i < n; i++) {
        const A = inp[i], B = inp[(i + 1) % n];
        const da = P[0] * A[0] + P[1] * A[1] + P[2] * A[2] + P[3], db = P[0] * B[0] + P[1] * B[1] + P[2] * B[2] + P[3];
        if (da >= 0) out.push(A);
        if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]); }
      }
    }
    return out;
  }
  function clipSeg(A, B) {
    let t0 = 0, t1 = 1;
    for (const P of planes) {
      const da = P[0] * A[0] + P[1] * A[1] + P[2] * A[2] + P[3], db = P[0] * B[0] + P[1] * B[1] + P[2] * B[2] + P[3];
      if (da < 0) { if (db < 0) return null; const k = da / (da - db); if (k > t0) t0 = k; }
      else if (db < 0) { const k = da / (da - db); if (k < t1) t1 = k; }
    }
    if (t0 > t1) return null;
    SEG[0] = t0; SEG[1] = t1;
    return SEG;
  }
  function pathCam(cp, cl) {
    const n = cp.length, m = cl ? n : n - 1;
    let pen = false;
    for (let i = 0; i < m; i++) {
      const A = cp[i], B = cp[(i + 1) % n];
      if (!A || !B) { pen = false; continue; }
      const r = clipSeg(A, B);
      if (!r) { pen = false; continue; }
      const t0 = r[0], t1 = r[1];
      if (!pen || t0 > 0) {
        const P = t0 > 0 ? lerp3(A, B, t0) : A;
        c.moveTo(cx + fpx * P[0] / P[2], cy - fpx * P[1] / P[2]);
      }
      const Q = t1 < 1 ? lerp3(A, B, t1) : B;
      c.lineTo(cx + fpx * Q[0] / Q[2], cy - fpx * Q[1] / Q[2]);
      pen = t1 >= 1;
    }
  }
  const pathPoly = (pts, cl) => pathCam(pts.map(toC), cl);
  const fogA = (S, dd) => (S.fog ? 1 - (1 - S.fog[2]) * sstep(S.fog[0], S.fog[1], dd) : 1);

  // ---------------------------------------------------------------- LEDs
  function ledI(l, act) {
    if (reduced) return l.pat === 'act' ? 0.6 : 0.85;
    const tm = T;
    if (l.pat === 'pow') return 0.86 + 0.08 * Math.sin(tm * 1.7 + l.seed);
    if (l.pat === 'bea') { const ph = ((tm * 0.7 + l.seed * 0.173) % 1 + 1) % 1; return ph < 0.06 ? 1 : 0.04; }
    const a = l.hero ? act : 0.42;
    const rate = 10 + 16 * a;
    const k = Math.floor(tm * rate + l.seed * 0.37);
    const burst = h2(Math.floor(tm * (0.8 + a) + l.seed * 0.11), l.seed + 3);
    const p = (0.12 + 0.6 * a) * (burst < 0.3 + 0.5 * a ? 1 : 0.15);
    return h2(k, l.seed) < p ? 1 : 0.05;
  }
  const ledBuf = [];
  function drawLeds(S, f, fa, act) {
    ledBuf.length = 0;
    for (const l of f.leds) {
      const q = toC(l.p);
      if (q[2] < S.near) continue;
      const iz = fpx / q[2], sx = cx + q[0] * iz, sy = cy - q[1] * iz, rp = l.r * iz;
      const G = Math.max(rp * 7, 4.5);
      if (sx < -G || sx > w + G || sy < -G || sy > h + G) continue;
      ledBuf.push(sx, sy, rp, ledI(l, act) * l.g * (0.4 + 0.6 * fa), l.col === 'r' ? 1 : 0, G);
    }
    if (!ledBuf.length) return;
    for (let i = 0; i < ledBuf.length; i += 6) {
      const rp = ledBuf[i + 2];
      if (rp <= 1.1) continue;
      const sx = ledBuf[i], sy = ledBuf[i + 1], I = ledBuf[i + 3], col = ledBuf[i + 4] ? pal.red : pal.teal;
      c.globalAlpha = 1;
      c.fillStyle = rgb(mixc(pal.bg, col, 0.1 + 0.9 * clamp(I, 0, 1)));
      const rw = rp * 2.2;
      c.fillRect(sx - rw, sy - rp, rw * 2, rp * 2);
      if (rp > 3) { c.globalAlpha = 0.55 * fa; c.lineWidth = 1; c.strokeRect(sx - rw, sy - rp, rw * 2, rp * 2); }
      if (I > 0.2) {
        c.globalAlpha = clamp(I, 0, 1);
        c.fillStyle = rgb(mixc(col, pal.fg, 0.6));
        c.fillRect(sx - rw * 0.7, sy - rp * 0.45, rw * 1.4, rp * 0.9);
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ledBuf.length; i += 6) {
      const I = ledBuf[i + 3];
      if (I < 0.03) continue;
      const G = ledBuf[i + 5] * (0.55 + 0.45 * clamp(I, 0, 1));
      c.globalAlpha = Math.min(1, I * 0.9);
      c.drawImage(ledBuf[i + 4] ? sprites.r : sprites.t, ledBuf[i] - G * 1.4, ledBuf[i + 1] - G * 0.8, G * 2.8, G * 1.6);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- face drawing
  function drawDecals(f, size, fa) {
    for (const g of f.dec) {
      const lod = g.min ? clamp((size - g.min) / g.min, 0, 1) : 1;
      const a = g.a * fa * lod;
      if (a < 0.02) continue;
      c.globalAlpha = a;
      c.beginPath();
      for (const pl of g.polys) pathPoly(pl.p, pl.cl);
      c.stroke();
    }
  }
  function drawFace(S, f, act) {
    if (f.lo) {
      const q = toC(f.c);
      if (q[2] < -f.rad) return;
      const size = f.rad * 2 * fpx / Math.max(q[2], f.rad, S.near);
      drawDecals(f, size, fogA(S, len(sub(f.c, E))));
      return;
    }
    if (dot(f.n, E) - f.d <= 0) return;
    if (f.bs) { const z = (f.c[0] - E[0]) * FZ[0] + (f.c[1] - E[1]) * FZ[1] + (f.c[2] - E[2]) * FZ[2]; if (z > 0 && f.bs * fpx / z < 1.2) return; }
    const n = f.pts.length, cp = new Array(n);
    let allIn = true;
    for (let i = 0; i < n; i++) {
      const q = toC(f.pts[i]); cp[i] = q;
      if (allIn) for (const P of planes) if (P[0] * q[0] + P[1] * q[1] + P[2] * q[2] + P[3] < 0) { allIn = false; break; }
    }
    const poly = allIn ? cp : clipPoly(cp);
    if (poly.length < 3) return;
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    c.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const q = poly[i], iz = fpx / q[2], sx = cx + q[0] * iz, sy = cy - q[1] * iz;
      if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy);
      if (sx < mnx) mnx = sx; if (sx > mxx) mxx = sx; if (sy < mny) mny = sy; if (sy > mxy) mxy = sy;
    }
    c.closePath();
    if (mxx < 0 || mnx > w || mxy < 0 || mny > h) return;
    const fa = fogA(S, len(sub(f.c, E)));
    c.globalAlpha = 1; c.fillStyle = fillS(f.sh * fa); c.fill();
    c.globalAlpha = f.la * fa; c.stroke();
    const size = Math.max(mxx - mnx, mxy - mny);
    if (f.dec) drawDecals(f, size, fa);
    if (f.leds) drawLeds(S, f, fa, act);
  }

  // ---------------------------------------------------------------- space (stars, earth, orbit)
  function buildSpace(S, R, seed) {
    const RE = 6371e3, HE = 1.5e6, sp = { R: RE, H: HE, C: [0, -(RE + HE), 0] };
    const NS = 2600; sp.stars = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) {
      const u = 2 * R() - 1, th = R() * TAU, s = Math.sqrt(1 - u * u);
      sp.stars.set([s * Math.cos(th), u, s * Math.sin(th), 0.1 + 0.8 * Math.pow(R(), 3)], i * 4);
    }
    const NP = 170000, ga = Math.PI * (3 - Math.sqrt(5));
    const P = new Float32Array(NP * 3), vals = new Float32Array(NP);
    const sd = (seed | 0) + 101;
    for (let i = 0; i < NP; i++) {
      const yy = 1 - 2 * (i + 0.5) / NP, r = Math.sqrt(1 - yy * yy), th = i * ga;
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      P[i * 3] = x; P[i * 3 + 1] = yy; P[i * 3 + 2] = z;
      const wx = fbm(x * 1.6 + 3.1, yy * 1.6 + 1.7, z * 1.6 - 2.3, sd + 50) - 0.5;
      vals[i] = fbm(x * 2.6 + wx * 1.4 + 11.3, yy * 2.6 - 4.1, z * 2.6 + wx + 7.7, sd) + (Math.abs(yy) > 0.9 ? 0.25 : 0);
    }
    const sample = []; for (let i = 0; i < NP; i += 37) sample.push(vals[i]);
    sample.sort((a, b) => a - b);
    const thr = sample[Math.floor(sample.length * 0.67)];
    const land = []; for (let i = 0; i < NP; i++) if (vals[i] > thr) land.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    sp.land = new Float32Array(land);
    const cnt = sp.land.length / 3;
    sp.bx = [0, 1, 2, 3].map(() => new Float32Array(cnt * 2));
    sp.bn = [0, 0, 0, 0];
    sp.grat = [];
    for (let la = -60; la <= 60; la += 20) { const l = [], a = la * Math.PI / 180; for (let k = 0; k <= 120; k++) { const o = k / 120 * TAU; l.push([Math.cos(a) * Math.cos(o), Math.sin(a), Math.cos(a) * Math.sin(o)]); } sp.grat.push(l); }
    for (let lo = 0; lo < 360; lo += 20) { const l = [], o = lo * Math.PI / 180; for (let k = -40; k <= 40; k++) { const a = k / 40 * 1.4; l.push([Math.cos(a) * Math.cos(o), Math.sin(a), Math.cos(a) * Math.sin(o)]); } sp.grat.push(l); }
    // pick an earth orientation that puts a coastline inside the orbit shot's horizon band
    const isLand = n => {
      const x = n[0], yy = n[1], z = n[2];
      const wx = fbm(x * 1.6 + 3.1, yy * 1.6 + 1.7, z * 1.6 - 2.3, sd + 50) - 0.5;
      return fbm(x * 2.6 + wx * 1.4 + 11.3, yy * 2.6 - 4.1, z * 2.6 + wx + 7.7, sd) > thr;
    };
    const az = 0.41, hd = nrm([-Math.sin(az), 0, Math.cos(az)]), kd = crs(Y, hd), smp = [];
    for (let a = 20; a <= 34; a += 3.5) for (let b = -36; b <= 36; b += 8) {
      const al = a * Math.PI / 180, be = b * Math.PI / 180;
      smp.push(add(scl(Y, Math.cos(al)), scl(add(scl(hd, Math.cos(be)), scl(kd, Math.sin(be))), Math.sin(al))));
    }
    const th0 = 52 * 0.006;
    let best = null, bs = Infinity;
    for (let i = 0; i < 120; i++) {
      const tl = mm(rym(R() * TAU), mm(rxm((R() - 0.5) * 2.4), rzm((R() - 0.5) * 1.2)));
      const inv = tr(mm(tl, rym(th0)));
      let cnt = 0, near = 0;
      smp.forEach((v, j) => { if (isLand(mv(inv, v))) { cnt++; if (j < 20) near++; } });
      const sc = Math.abs(cnt / smp.length - 0.45) + (near ? 0 : 0.2);
      if (sc < bs) { bs = sc; best = tl; }
    }
    sp.tilt = best;
    sp.th = 0;
    S.space = sp;
  }
  function drawSpace(S, st) {
    const sp = S.space;
    c.fillStyle = pal.fgS;
    const ss = sp.stars, ns = ss.length / 4;
    for (let pass = 0; pass < 3; pass++) {
      c.globalAlpha = [0.22, 0.45, 0.8][pass];
      const s = pass === 2 ? 1.6 : 1.1;
      for (let i = 0; i < ns; i++) {
        const b = ss[i * 4 + 3], bk = b < 0.25 ? 0 : b < 0.55 ? 1 : 2;
        if (bk !== pass) continue;
        const x0 = ss[i * 4], y0 = ss[i * 4 + 1], z0 = ss[i * 4 + 2];
        const z = x0 * FZ[0] + y0 * FZ[1] + z0 * FZ[2];
        if (z <= 0.01) continue;
        const sx = cx + fpx * (x0 * RX[0] + y0 * RX[1] + z0 * RX[2]) / z, sy = cy - fpx * (x0 * UY[0] + y0 * UY[1] + z0 * UY[2]) / z;
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        c.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    const Ce = sp.C, RE = sp.R, EC = sub(E, Ce), d = len(EC), uE = scl(EC, 1 / d), cosL = RE / d;
    const saved = planes; planes = mkPlanes(500);
    const Rm = mm(sp.tilt, rym(sp.th));
    const B = [RX, UY, FZ], Mb = mm(B, Rm), oc = mv(B, sub(Ce, E)), wv = mv(tr(Rm), uE);
    const hl = Math.abs(uE[1]) < 0.9 ? Y : X, e1 = nrm(crs(hl, uE)), e2 = crs(uE, e1);
    const ringCam = (Rr, n) => {
      const k = Rr * Rr / (d * d), cen = add(Ce, scl(EC, k)), rr = Rr * Math.sqrt(1 - k), out = [];
      for (let i = 0; i < n; i++) { const th = i / n * TAU; out.push(toC(mad(mad(cen, e1, Math.cos(th) * rr), e2, Math.sin(th) * rr))); }
      return out;
    };
    const limb = ringCam(RE, 360);
    const poly = clipPoly(limb);
    if (poly.length >= 3) {
      c.globalAlpha = 1; c.fillStyle = fillS(0.018);
      c.beginPath();
      poly.forEach((q, i) => { const sx = cx + fpx * q[0] / q[2], sy = cy - fpx * q[1] / q[2]; if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy); });
      c.closePath(); c.fill();
    }
    const camU = n => [oc[0] + RE * (Mb[0][0] * n[0] + Mb[0][1] * n[1] + Mb[0][2] * n[2]), oc[1] + RE * (Mb[1][0] * n[0] + Mb[1][1] * n[1] + Mb[1][2] * n[2]), oc[2] + RE * (Mb[2][0] * n[0] + Mb[2][1] * n[1] + Mb[2][2] * n[2])];
    c.strokeStyle = pal.fgS; c.lineWidth = 1; c.globalAlpha = 0.1;
    c.beginPath();
    for (const line of sp.grat) pathCam(line.map(n => (dot(n, wv) > cosL ? camU(n) : null)), false);
    c.stroke();
    const L = sp.land, cnt = L.length / 3, bx = sp.bx, bn = sp.bn;
    bn[0] = bn[1] = bn[2] = bn[3] = 0;
    const span = 1 - cosL;
    for (let i = 0; i < cnt; i++) {
      const nx = L[i * 3], ny = L[i * 3 + 1], nz = L[i * 3 + 2];
      const dv = nx * wv[0] + ny * wv[1] + nz * wv[2];
      if (dv <= cosL) continue;
      const z = oc[2] + RE * (Mb[2][0] * nx + Mb[2][1] * ny + Mb[2][2] * nz);
      if (z < 1000) continue;
      const sx = cx + fpx * (oc[0] + RE * (Mb[0][0] * nx + Mb[0][1] * ny + Mb[0][2] * nz)) / z;
      if (sx < -2 || sx > w + 2) continue;
      const sy = cy - fpx * (oc[1] + RE * (Mb[1][0] * nx + Mb[1][1] * ny + Mb[1][2] * nz)) / z;
      if (sy < -2 || sy > h + 2) continue;
      const mu = (dv - cosL) / span, k = mu < 0.025 ? 0 : mu < 0.08 ? 1 : mu < 0.22 ? 2 : 3;
      bx[k][bn[k] * 2] = sx; bx[k][bn[k] * 2 + 1] = sy; bn[k]++;
    }
    c.fillStyle = pal.fgS;
    const al = [0.14, 0.26, 0.42, 0.6];
    for (let k = 0; k < 4; k++) {
      c.globalAlpha = al[k];
      const a = bx[k], s = 1.4;
      for (let i = 0; i < bn[k]; i++) c.fillRect(a[i * 2] - s / 2, a[i * 2 + 1] - s / 2, s, s);
    }
    c.strokeStyle = pal.atmS;
    const glow = [[1.009, 16, 0.05], [1.0055, 9, 0.08], [1.003, 4.5, 0.15], [1.0012, 2, 0.35]];
    for (const [k, lw, a] of glow) { c.lineWidth = lw; c.globalAlpha = a; c.beginPath(); pathCam(ringCam(RE * k, 300), true); c.stroke(); }
    c.strokeStyle = pal.fgS; c.lineWidth = 1.1; c.globalAlpha = 0.8;
    c.beginPath(); pathCam(limb, true); c.stroke();
    if (st.s.orbit) {
      const oa = sstep(0.5, 3, st.lt) * 0.4;
      if (oa > 0.01) {
        const rO = RE + sp.H, vd = nrm([1, 0, 0.3]), pts = [];
        const occl = P => { const dir = sub(P, E), dd = dot(dir, dir), tc = dot(sub(Ce, E), dir) / dd; if (tc <= 0 || tc >= 1) return false; return len(sub(mad(E, dir, tc), Ce)) < RE; };
        for (let i = 0; i <= 600; i++) {
          const s = i / 300 - 1, ph = Math.sign(s) * Math.pow(Math.abs(s), 2.4) * Math.PI;
          const P = add(Ce, add(scl(Y, rO * Math.cos(ph)), scl(vd, rO * Math.sin(ph))));
          pts.push(occl(P) ? null : toC(P));
        }
        planes = mkPlanes(1);
        c.strokeStyle = pal.fgS; c.lineWidth = 1; c.globalAlpha = oa;
        c.setLineDash([3, 6]);
        c.beginPath(); pathCam(pts, false); c.stroke();
        c.setLineDash([]);
      }
    }
    planes = saved;
  }
  function drawHud(st) {
    const q = toC([0, 0, 0]);
    if (q[2] <= 0) return;
    const sx = cx + fpx * q[0] / q[2], sy = cy - fpx * q[1] / q[2], rp = 8 * fpx / q[2];
    const intro = reduced ? 0 : 1 - sstep(0, 1.6, st.lt);
    const b = Math.max(18, rp * 1.15) * (1 + 1.4 * intro), k = Math.max(6, b * 0.32);
    c.strokeStyle = pal.dimS; c.lineWidth = 1; c.globalAlpha = 0.75 * (reduced ? 1 : sstep(0, 0.8, st.lt));
    c.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = sx + dx * b, y = sy + dy * b;
      c.moveTo(x - dx * k, y); c.lineTo(x, y); c.lineTo(x, y - dy * k);
    }
    const g = b + 10, tk = 7;
    c.moveTo(sx - g - tk, sy); c.lineTo(sx - g, sy);
    c.moveTo(sx + g, sy); c.lineTo(sx + g + tk, sy);
    c.moveTo(sx, sy - g - tk); c.lineTo(sx, sy - g);
    c.moveTo(sx, sy + g); c.lineTo(sx, sy + g + tk);
    c.stroke();
  }

  // ---------------------------------------------------------------- scene 1: bedroom
  function buildBedroom(R) {
    const S = newScene({ L: [-0.45, 0.75, 0.5], fog: [3.2, 9, 0.5], near: 0.02 });
    const fl = box(S, -2.2, -0.1, -1.5, 2.2, 0, 2.0, { only: 'py', la: 0.5 }).py;
    for (let x = 0.16; x < 4.39; x += 0.16) dLine(fl, x, 0, x, 3.5, 0.18);
    for (let x = 0; x < 4.39; x += 0.16) { let y = R() * 1.4; while (y < 3.4) { dLine(fl, x, y, x + 0.16, y, 0.14, 20); y += 0.9 + R() * 1.3; } }
    const bw = box(S, -2.2, 0, 2.0, 2.2, 2.6, 2.1, { only: 'nz', la: 0.6 }).nz;
    dLine(bw, 0, 0.08, 4.4, 0.08, 0.4);
    dRect(bw, 0.3, 1.0, 1.2, 2.0, 0.85); dRect(bw, 0.335, 1.035, 1.165, 1.965, 0.6);
    dLine(bw, 0.75, 1.035, 0.75, 1.965, 0.6); dLine(bw, 0.335, 1.5, 1.165, 1.5, 0.6);
    dRect(bw, 0.26, 0.97, 1.24, 1.0, 0.7);
    dCirc(bw, 1.0, 1.78, 0.055, 0.75, 0, 28); dCirc(bw, 0.985, 1.795, 0.012, 0.3, 40, 10); dCirc(bw, 1.02, 1.76, 0.008, 0.3, 40, 8);
    let sx = 0.335; const sk = [[sx, 1.035]];
    while (sx < 1.165) { const hh = 1.075 + R() * 0.2, nx = Math.min(1.165, sx + 0.04 + R() * 0.07); sk.push([sx, hh], [nx, hh]); sx = nx; }
    sk.push([1.165, 1.035]); dec(bw, sk, false, 0.38, 20);
    for (let i = 0; i < 9; i++) { const x = 0.36 + R() * 0.78, y = 1.32 + R() * 0.6; if (Math.abs(x - 0.75) < 0.02 || Math.abs(y - 1.5) < 0.02) continue; dLine(bw, x - 0.006, y, x + 0.006, y, 0.35, 40); dLine(bw, x, y - 0.006, x, y + 0.006, 0.35, 40); }
    dRect(bw, 1.75, 1.15, 2.25, 1.85, 0.8); dRect(bw, 1.78, 1.18, 2.22, 1.82, 0.45);
    dCirc(bw, 2.08, 1.62, 0.07, 0.55, 0, 24);
    dec(bw, [[1.78, 1.3], [1.88, 1.45], [1.95, 1.38], [2.06, 1.55], [2.22, 1.34]], false, 0.55);
    for (let i = 0; i < 4; i++) dLine(bw, 1.82, 1.22 + i * 0.018, 1.88 + R() * 0.1, 1.22 + i * 0.018, 0.3, 30);
    dRect(bw, 3.58, 0.22, 3.66, 0.3, 0.6, 20); dLine(bw, 3.605, 0.25, 3.605, 0.27, 0.5, 40); dLine(bw, 3.635, 0.25, 3.635, 0.27, 0.5, 40);
    const lw = box(S, -2.3, 0, -1.5, -2.2, 2.6, 2.0, { only: 'px', la: 0.6 }).px;
    dLine(lw, 0, 0.08, 3.5, 0.08, 0.4);
    dRect(lw, 1.9, 1.25, 2.6, 1.75, 0.75); dRect(lw, 1.94, 1.29, 2.56, 1.71, 0.4);
    dec(lw, [[1.94, 1.4], [2.1, 1.6], [2.22, 1.48], [2.36, 1.66], [2.56, 1.45]], false, 0.45);
    dRect(lw, 0.46, 1.06, 0.54, 1.18, 0.5, 30);
    const rw = box(S, 2.2, 0, -1.5, 2.3, 2.6, 2.0, { only: 'nx', la: 0.6 }).nx;
    dLine(rw, 0, 0.08, 3.5, 0.08, 0.4);
    dRect(rw, 2.45, 0, 3.3, 2.05, 0.8); dRect(rw, 2.5, 0.0, 3.25, 2.0, 0.4); dCirc(rw, 2.58, 1.0, 0.025, 0.6, 20, 12);
    dRect(rw, 1.1, 1.2, 1.7, 1.75, 0.6); for (let i = 1; i < 4; i++) dLine(rw, 1.1 + i * 0.15, 1.2, 1.1 + i * 0.15, 1.75, 0.25, 30);
    box(S, -2.2, 2.6, -1.5, 2.2, 2.7, 2.0, { only: 'ny', la: 0.5 });
    const lamp = frustum(S, [0, 2.6, 0.6], [0, 2.54, 0.6], 0.26, 0.23, 28, { la: 0.8 });
    dCirc(lamp.c1, 0.23, 0.23, 0.16, 0.35, 20, 24);
    const rug = box(S, -0.55, 0, 0.15, 1.1, 0.008, 1.35, { la: 0.7 }).py;
    dRect(rug, 0.05, 0.05, 1.6, 1.15, 0.4); dRect(rug, 0.09, 0.09, 1.56, 1.11, 0.25);

    // bed
    for (const [x, z] of [[-2.12, 0.03], [-0.82, 0.03], [-2.12, 1.88], [-0.82, 1.88]]) box(S, x, 0, z, x + 0.04, 0.05, z + 0.04);
    const fr = box(S, -2.15, 0.05, 0, -0.75, 0.32, 1.95);
    dLine(fr.nz, 0.03, 0.2, 1.37, 0.2, 0.35, 20);
    const hb = box(S, -2.15, 0, 1.95, -0.75, 1.0, 2.0).nz;
    dRect(hb, 0.04, 0.4, 1.36, 0.96, 0.5, 20);
    for (let x = 0.18; x < 1.36; x += 0.14) dLine(hb, x, 0.4, x, 0.96, 0.3, 30);
    const mt = box(S, -2.12, 0.32, 0.03, -0.78, 0.5, 1.92);
    dLine(mt.nz, 0.0, 0.155, 1.34, 0.155, 0.35, 20); dLine(mt.px, 0, 0.155, 1.89, 0.155, 0.35, 20);
    const bl = box(S, -2.16, 0.5, 0, -0.74, 0.565, 1.3);
    dLine(bl.py, 0, 1.16, 1.42, 1.16, 0.6); dLine(bl.py, 0, 1.2, 1.42, 1.2, 0.3, 20);
    dec(bl.py, [[0.15, 0.25], [0.45, 0.4], [0.8, 0.32], [1.1, 0.5]], false, 0.28, 30);
    dec(bl.py, [[0.3, 0.75], [0.6, 0.68], [0.95, 0.85]], false, 0.28, 30);
    box(S, -2.16, 0.3, -0.012, -0.74, 0.565, 0);
    box(S, -0.74, 0.3, -0.012, -0.728, 0.565, 1.3);
    for (const x0 of [-2.02, -1.42]) { const p = box(S, x0, 0.5, 1.5, x0 + 0.52, 0.61, 1.88); dRect(p.py, 0.04, 0.04, 0.48, 0.34, 0.35, 20); }
    const ns = box(S, -0.7, 0, 1.6, -0.3, 0.5, 1.98).nz;
    dRect(ns, 0.02, 0.27, 0.38, 0.47, 0.6); dRect(ns, 0.02, 0.04, 0.38, 0.24, 0.6);
    dCirc(ns, 0.2, 0.37, 0.012, 0.6, 20, 10); dCirc(ns, 0.2, 0.14, 0.012, 0.6, 20, 10);
    frustum(S, [-0.5, 0.5, 1.8], [-0.5, 0.52, 1.8], 0.06, 0.055, 14);
    frustum(S, [-0.5, 0.52, 1.8], [-0.5, 0.66, 1.8], 0.008, 0.008, 6);
    frustum(S, [-0.5, 0.66, 1.8], [-0.5, 0.8, 1.8], 0.11, 0.075, 20);
    box(S, -0.68, 0.5, 1.64, -0.6, 0.508, 1.78);

    // desk
    box(S, 0.2, 0.72, 1.4, 1.6, 0.75, 2.0, { la: 0.95 });
    box(S, 0.2, 0, 1.42, 0.23, 0.72, 1.98); box(S, 1.57, 0, 1.42, 1.6, 0.72, 1.98);
    box(S, 0.23, 0.35, 1.94, 1.57, 0.72, 1.96, { la: 0.7 });
    const dr = box(S, 0.26, 0.6, 1.42, 0.62, 0.72, 1.9).nz; dLine(dr, 0.12, 0.07, 0.24, 0.07, 0.7, 20);

    // tower (under desk) — hero
    for (const [x, z] of [[1.16, 1.47], [1.31, 1.47], [1.16, 1.87], [1.31, 1.87]]) box(S, x, 0, z, x + 0.03, 0.03, z + 0.03);
    const tw = box(S, 1.15, 0.03, 1.45, 1.35, 0.48, 1.92, { la: 1, bv: 0.008 });
    const tf = tw.nz;
    dChamf(tf, 0.016, 0.016, 0.184, 0.434, 0.014, 0.7);
    dec(tf, [[0.016, 0.318], [0.07, 0.318], [0.078, 0.328], [0.184, 0.328]], false, 0.8);
    dCirc(tf, 0.158, 0.385, 0.018, 0.9, 0, 28); dCirc(tf, 0.158, 0.385, 0.012, 0.45, 40, 24);
    dArc(tf, 0.158, 0.385, 0.0058, Math.PI * 0.5 + 0.7, Math.PI * 2.5 - 0.7, 0.8, 60, 14); dLine(tf, 0.158, 0.383, 0.158, 0.394, 0.8, 60);
    led(tf, 0.04, 0.402, 0.0026, 'r', 'pow', 31, 1);
    led(tf, 0.04, 0.372, 0.0026, 't', 'act', 7, 1, true);
    dRect(tf, 0.0305, 0.396, 0.0495, 0.408, 0.45, 70); dRect(tf, 0.0305, 0.366, 0.0495, 0.378, 0.45, 70);
    dArc(tf, 0.07, 0.402, 0.003, Math.PI * 0.5 + 0.8, Math.PI * 2.5 - 0.8, 0.4, 130, 10); dLine(tf, 0.07, 0.402, 0.07, 0.406, 0.4, 130);
    dRect(tf, 0.066, 0.369, 0.074, 0.375, 0.4, 130);
    dRect(tf, 0.095, 0.397, 0.12, 0.407, 0.6, 50); dRect(tf, 0.095, 0.375, 0.12, 0.385, 0.6, 50);
    dec(tf, [[0.03, 0.04], [0.03, 0.262], [0.046, 0.278], [0.154, 0.278], [0.17, 0.262], [0.17, 0.04]], true, 0.5, 40);
    for (let i = 0; i < 7; i++) dRect(tf, 0.045, 0.05 + i * 0.0105, 0.155, 0.0545 + i * 0.0105, 0.55, 90);
    dec(tf, [[0.128, 0.17], [0.152, 0.17], [0.14, 0.2]], true, 0.6, 70); dLine(tf, 0.14, 0.178, 0.14, 0.186, 0.6, 130);
    for (const [x, y] of [[0.03, 0.3], [0.17, 0.3], [0.03, 0.045], [0.17, 0.045]]) dCirc(tf, x, y, 0.003, 0.6, 120, 8);
    for (let x = 0.03; x < 0.18; x += 0.02) dLine(tw.py, x, 0.05, x, 0.42, 0.25, 40);
    const ts = tw.nx;
    dRect(ts, 0.03, 0.04, 0.44, 0.41, 0.65, 20);
    for (const y of [0.13, 0.3]) { dCirc(ts, 0.37, y, 0.055, 0.5, 30, 28); dCirc(ts, 0.37, y, 0.015, 0.45, 50, 12); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; dLine(ts, 0.37 + Math.cos(a) * 0.017, y + Math.sin(a) * 0.017, 0.37 + Math.cos(a + 0.5) * 0.05, y + Math.sin(a + 0.5) * 0.05, 0.3, 60); } }
    dRect(ts, 0.06, 0.17, 0.3, 0.22, 0.45, 30); dRect(ts, 0.12, 0.27, 0.2, 0.35, 0.45, 30); dCirc(ts, 0.16, 0.31, 0.028, 0.35, 40, 16);
    dLine(ts, 0.03, 0.1, 0.3, 0.1, 0.4, 30);

    // desk items
    box(S, 0.66, 0.75, 1.7, 0.94, 0.762, 1.88);
    box(S, 0.78, 0.762, 1.83, 0.82, 0.95, 1.86);
    const scr = box(S, 0.45, 0.88, 1.76, 1.15, 1.28, 1.8, { la: 0.95 });
    scr.nz.sh += 0.03;
    dRect(scr.nz, 0.012, 0.02, 0.688, 0.388, 0.8);
    for (let y = 0.36; y > 0.05; y -= 0.022) { if (R() < 0.18) continue; const x0 = 0.035 + (R() < 0.35 ? 0.03 : 0) + (R() < 0.15 ? 0.03 : 0); dLine(scr.nz, x0, y, Math.min(0.66, x0 + 0.06 + R() * 0.38), y, 0.26, 40); }
    for (let x = 0.08; x < 0.66; x += 0.04) dLine(scr.pz, x, 0.25, x, 0.33, 0.25, 30);
    const kb = box(S, 0.55, 0.75, 1.48, 1.0, 0.768, 1.63).py;
    for (let r = 0; r < 5; r++) {
      const y = 0.012 + r * 0.026; let x = 0.012 + (r % 2) * 0.008;
      if (r === 0) { dRect(kb, 0.012, y, 0.08, y + 0.021, 0.35, 50); dRect(kb, 0.085, y, 0.31, y + 0.021, 0.35, 50); dRect(kb, 0.315, y, 0.438, y + 0.021, 0.35, 50); continue; }
      while (x + 0.024 < 0.44) { dRect(kb, x, y, x + 0.022, y + 0.021, 0.35, 50); x += 0.026; }
    }
    box(S, 1.04, 0.75, 1.47, 1.3, 0.752, 1.68, { la: 0.6 });
    const ms = box(S, 1.13, 0.752, 1.53, 1.19, 0.776, 1.63).py; dLine(ms, 0.03, 0.06, 0.03, 0.1, 0.5, 15);
    frustum(S, [0.33, 0.75, 1.62], [0.33, 0.85, 1.62], 0.04, 0.043, 16);
    lines(S, [[[0.288, 0.832, 1.62], [0.266, 0.826, 1.62], [0.256, 0.8, 1.62], [0.266, 0.774, 1.62], [0.288, 0.768, 1.62]]], 0.8);
    frustum(S, [1.45, 0.75, 1.86], [1.45, 0.765, 1.86], 0.07, 0.065, 18);
    frustum(S, [1.45, 0.765, 1.86], [1.4, 1.12, 1.8], 0.008, 0.008, 6);
    frustum(S, [1.4, 1.12, 1.8], [1.24, 1.17, 1.7], 0.008, 0.008, 6);
    frustum(S, [1.24, 1.15, 1.7], [1.22, 1.06, 1.68], 0.035, 0.085, 18);

    // shelf
    box(S, 0.3, 1.55, 1.78, 1.5, 1.58, 2.0);
    lines(S, [[[0.45, 1.42, 1.995], [0.45, 1.55, 1.995], [0.45, 1.55, 1.85]], [[1.35, 1.42, 1.995], [1.35, 1.55, 1.995], [1.35, 1.55, 1.85]]], 0.6);
    let bx = 0.34;
    while (bx < 1.2) {
      const bwd = 0.022 + R() * 0.028, bh = 0.15 + R() * 0.1, bd = 0.15 + R() * 0.05;
      const bk = box(S, bx, 1.58, 1.99 - bd, bx + bwd, 1.58 + bh, 1.99).nz;
      dLine(bk, 0, bh - 0.02, bwd, bh - 0.02, 0.45, 25); dLine(bk, 0, 0.02, bwd, 0.02, 0.45, 25);
      bx += bwd + 0.003 + (R() < 0.12 ? 0.05 : 0);
    }
    const spk = box(S, 1.3, 1.58, 1.84, 1.44, 1.72, 1.98).nz;
    dCirc(spk, 0.07, 0.06, 0.04, 0.6, 20, 20); dCirc(spk, 0.07, 0.115, 0.012, 0.5, 30, 12);

    // chair
    const RT = rotY(0.9), A = RT[0], C = RT[2], ch = [-0.08, 0, 1.0];
    const cp = (lx, ly, lz) => add(add(add(ch, scl(A, lx)), scl(Y, ly)), scl(C, lz));
    const base = frustum(S, cp(0, 0.008, 0), cp(0, 0.045, 0), 0.3, 0.28, 5, { ph: 0.25 });
    for (let i = 0; i < 5; i++) { const th = (i + 0.25) / 5 * TAU; dLine(base.c1, 0.28, 0.28, 0.28 + Math.cos(th) * 0.26, 0.28 + Math.sin(th) * 0.26, 0.5, 20); }
    frustum(S, cp(0, 0.045, 0), cp(0, 0.42, 0), 0.025, 0.025, 10);
    const seat = cuboid(S, cp(0, 0.445, 0), RT, 0.24, 0.025, 0.24);
    dRect(seat.py, 0.04, 0.04, 0.44, 0.44, 0.35, 20);
    const back = cuboid(S, cp(0, 0.82, -0.25), RT, 0.22, 0.24, 0.025);
    dRect(back.pz, 0.04, 0.04, 0.4, 0.44, 0.35, 20); dRect(back.nz, 0.04, 0.04, 0.4, 0.44, 0.35, 20);
    for (let k = 0; k < 3; k++) dLine(back.nz, 0.08, 0.14 + k * 0.03, 0.36, 0.14 + k * 0.03, 0.25, 40);
    cuboid(S, cp(0, 0.525, -0.255), RT, 0.03, 0.055, 0.012);
    for (const s of [-1, 1]) { cuboid(S, cp(s * 0.255, 0.66, 0), RT, 0.02, 0.015, 0.12); cuboid(S, cp(s * 0.255, 0.5575, 0), RT, 0.012, 0.0875, 0.012); }
    return S;
  }

  // ---------------------------------------------------------------- scene 2: data hall
  function server(f, y, hh, u, R) {
    dRect(f, 0.055, y + 0.002, 0.545, y + hh - 0.002, 0.7, 45);
    const rr = R();
    if (rr < 0.2) for (let x = 0.13; x < 0.5; x += 0.046) dLine(f, x, y + 0.006, x, y + hh - 0.006, 0.33, 160);
    else if (rr < 0.45) dLine(f, 0.13, y + hh * 0.5, 0.5, y + hh * 0.5, 0.25, 120);
    const ym = y + Math.min(hh * 0.5, 0.022);
    led(f, 0.072, ym, 0.0024, 'r', 'pow', (R() * 1e6) | 0, 0.5);
    led(f, 0.09, ym, 0.0024, 't', 'act', (R() * 1e6) | 0, 0.9);
    if (u >= 2 && R() < 0.5) led(f, 0.108, ym, 0.0024, 't', 'act', (R() * 1e6) | 0, 0.7);
  }
  function fillRange(f, R, y0, y1) {
    const U = 0.0445; let y = y0;
    for (;;) {
      const r = R(); let u = r < 0.42 ? 1 : r < 0.86 ? 2 : 4;
      if (y + u * U > y1) { if (y + U <= y1) u = 1; else break; }
      const hh = u * U;
      if (r < 0.1) dLine(f, 0.06, y + hh * 0.5, 0.54, y + hh * 0.5, 0.15, 30);
      else server(f, y, hh, u, R);
      y += hh;
    }
  }
  function heroServer(f, y0) {
    const y1 = y0 + 0.089;
    dRect(f, 0.052, y0 + 0.0015, 0.548, y1 - 0.0015, 0.95);
    dRect(f, 0.056, y0 + 0.005, 0.108, y1 - 0.005, 0.55, 40);
    dCirc(f, 0.082, y0 + 0.068, 0.0065, 0.8, 40, 18);
    dArc(f, 0.082, y0 + 0.068, 0.0032, Math.PI * 0.5 + 0.7, Math.PI * 2.5 - 0.7, 0.6, 90, 10); dLine(f, 0.082, y0 + 0.067, 0.082, y0 + 0.072, 0.6, 90);
    const L = [[0.072, 0.044, 0.0019, 'r', 'pow', 91, 1, false], [0.092, 0.044, 0.0019, 't', 'act', 7, 1, true], [0.072, 0.024, 0.0016, 't', 'act', 113, 0.8, false], [0.092, 0.024, 0.0016, 't', 'act', 8, 0.85, true]];
    for (const [x, y, r, col, pat, sd, g, hero] of L) { led(f, x, y0 + y, r, col, pat, sd, g, hero); dRect(f, x - r * 2.8, y0 + y - r * 1.8, x + r * 2.8, y0 + y + r * 1.8, 0.4, 80); dLine(f, x - 0.005, y0 + y - 0.0065, x + 0.005, y0 + y - 0.0065, 0.35, 120); }
    const bx0 = 0.115, bw = 0.1, by0 = y0 + 0.006, bh = (0.089 - 0.012) / 3;
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 3; iy++) {
      const x0 = bx0 + ix * bw, yb = by0 + iy * bh;
      dRect(f, x0 + 0.002, yb + 0.0015, x0 + bw - 0.002, yb + bh - 0.0015, 0.6, 40);
      dLine(f, x0 + 0.02, yb + bh * 0.5, x0 + bw - 0.012, yb + bh * 0.5, 0.3, 90);
      for (let k = 0; k < 4; k++) dLine(f, x0 + 0.04 + k * 0.01, yb + bh * 0.3, x0 + 0.04 + k * 0.01, yb + bh * 0.7, 0.2, 160);
      led(f, x0 + 0.009, yb + bh * 0.5, 0.0011, 't', 'act', 200 + ix * 3 + iy, 0.75);
    }
    for (let k = 0; k < 5; k++) dLine(f, 0.522 + k * 0.005, y0 + 0.01, 0.522 + k * 0.005, y1 - 0.01, 0.35, 60);
  }
  function rackFront(f, R, hero) {
    dChamf(f, 0.03, 0.03, 0.57, 1.97, 0.03, 0.85);
    dLine(f, 0.045, 0.06, 0.045, 1.94, 0.3, 30); dLine(f, 0.555, 0.06, 0.555, 1.94, 0.3, 30);
    dLine(f, 0.012, 0.085, 0.588, 0.085, 0.45, 20);
    dRect(f, 0.06, 1.885, 0.54, 1.96, 0.35, 30);
    for (let x = 0.09; x < 0.52; x += 0.03) dLine(f, x, 1.9, x, 1.945, 0.2, 80);
    if (hero) { fillRange(f, R, 0.1, 1.146); heroServer(f, 1.15); fillRange(f, R, 1.243, 1.86); }
    else fillRange(f, R, 0.1, 1.86);
  }
  function endPanel(f) { dRect(f, 0.03, 0.03, f.w - 0.03, f.h - 0.03, 0.5, 20); dRect(f, f.w * 0.35, 1.45, f.w * 0.65, 1.62, 0.5, 30); }
  function buildDC(R) {
    const S = newScene({ L: [0.3, 0.85, -0.4], fog: [3, 17, 0.04], near: 0.02 });
    const X0 = -4.8, Z0 = -3, Z1 = 30.6, H = 3.2;
    for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 14; iz++) {
      const x0 = X0 + ix * 2.4, z0 = Z0 + iz * 2.4;
      const f = box(S, x0, -0.1, z0, x0 + 2.4, 0, z0 + 2.4, { only: 'py', la: 0.42 }).py;
      dLine(f, 1.2, 0, 1.2, 2.4, 0.42); dLine(f, 0, 1.2, 2.4, 1.2, 0.42);
      for (let tx = 0; tx < 4; tx++) for (let tz = 0; tz < 4; tz++) {
        const wx = x0 + tx * 0.6;
        if (wx < -0.61 || wx > 0.01 || (iz * 4 + tz) % 2) continue;
        dRect(f, tx * 0.6 + 0.06, tz * 0.6 + 0.06, tx * 0.6 + 0.54, tz * 0.6 + 0.54, 0.22, 150);
        dHatch(f, tx * 0.6 + 0.08, tz * 0.6 + 0.08, tx * 0.6 + 0.52, tz * 0.6 + 0.52, 0.055, 0.12, 500);
      }
      const cl = box(S, x0, H, z0, x0 + 2.4, H + 0.1, z0 + 2.4, { only: 'ny', la: 0.22 }).ny;
      dLine(cl, 1.2, 0, 1.2, 2.4, 0.22); dLine(cl, 0, 1.2, 2.4, 1.2, 0.22);
    }
    for (let iz = 0; iz < 7; iz++) {
      const z0 = Z0 + iz * 4.8;
      for (const f of [box(S, X0 - 0.1, 0, z0, X0, H, z0 + 4.8, { only: 'px', la: 0.45 }).px, box(S, -X0, 0, z0, -X0 + 0.1, H, z0 + 4.8, { only: 'nx', la: 0.45 }).nx]) {
        dLine(f, 0, 0.12, 4.8, 0.12, 0.4); dLine(f, 0, 2.85, 4.8, 2.85, 0.3); dLine(f, 2.4, 0, 2.4, H, 0.25);
      }
    }
    for (let ix = 0; ix < 4; ix++) {
      const x0 = X0 + ix * 2.4, f = box(S, x0, 0, Z1, x0 + 2.4, H, Z1 + 0.1, { only: 'nz', la: 0.45 }).nz;
      dLine(f, 0, 0.12, 2.4, 0.12, 0.4);
      if (ix === 1) { dRect(f, 1.5, 0, 2.4, 2.2, 0.8); dRect(f, 1.9, 1.3, 2.25, 1.9, 0.5); }
      if (ix === 2) { dRect(f, 0, 0, 0.9, 2.2, 0.8); dRect(f, 0.15, 1.3, 0.5, 1.9, 0.5); }
    }
    const ex = box(S, -0.3, 2.4, Z1 - 0.08, 0.3, 2.56, Z1, { la: 0.8 });
    ex.nz.sh = 0.12; dec(ex.nz, [[0.12, 0.08], [0.42, 0.08]], false, 0.8); dec(ex.nz, [[0.36, 0.12], [0.42, 0.08], [0.36, 0.04]], false, 0.8);
    for (const z of [1, 7, 13, 19, 25]) { box(S, -4.8, 0, z, -4.4, H, z + 0.45, { la: 0.6 }); box(S, 4.4, 0, z, 4.8, H, z + 0.45, { la: 0.6 }); }
    const zs = [];
    for (let i = 0; i < 16; i++) zs.push(2 + 0.6 * i);
    for (let i = 0; i < 16; i++) zs.push(2 + 0.6 * 16 + 1.4 + 0.6 * i);
    zs.forEach((z0, i) => {
      const first = i === 0 || i === 16, last = i === 15 || i === 31;
      for (const side of [1, -1]) {
        const fk = side > 0 ? 'nx' : 'px';
        let only = fk; if (first) only += ' nz'; if (last) only += ' pz';
        const F = box(S, side > 0 ? 0.9 : -2.0, 0, z0, side > 0 ? 2.0 : -0.9, 2.0, z0 + 0.6, { only, la: 0.9, bv: 0.018 });
        rackFront(F[fk], R, side > 0 && i === 6);
        if (F.nz) endPanel(F.nz);
        if (F.pz) endPanel(F.pz);
      }
    });
    for (const zz of [2.0, 13.0]) for (let k = 0; k < 4; k++) {
      const z0 = zz + k * 2.4;
      for (const side of [1, -1]) {
        const xa = side > 0 ? 0.95 : -1.95, xb = side > 0 ? 1.95 : -0.95, sk = side > 0 ? 'nx' : 'px';
        const F = box(S, xa, 2.4, z0, xb, 2.48, z0 + 2.4, { only: sk + ' ny', la: 0.7 });
        for (let y = 0.15; y < 2.4; y += 0.3) dLine(F.ny, 0, y, 1.0, y, 0.4, 25);
        dLine(F.ny, 0.08, 0, 0.08, 2.4, 0.35, 25); dLine(F.ny, 0.92, 0, 0.92, 2.4, 0.35, 25);
        dLine(F[sk], 0, 0.04, 2.4, 0.04, 0.45, 20);
        lines(S, [[[xa + 0.03, 2.48, z0 + 0.2], [xa + 0.03, H, z0 + 0.2]], [[xb - 0.03, 2.48, z0 + 0.2], [xb - 0.03, H, z0 + 0.2]]], 0.4);
      }
    }
    for (let k = 0; k < 10; k++) {
      const z = 0.5 + 3 * k, F = box(S, -0.75, 3.06, z - 0.07, 0.75, 3.12, z + 0.07, { la: 0.8, only: 'ny nz pz px nx' });
      F.ny.sh = 0.2; dLine(F.ny, 0.05, 0.07, 1.45, 0.07, 0.5, 20);
    }
    for (let z = Z0; z < Z1; z += 3) lines(S, [[[0.5, 2.95, z], [0.5, 2.95, z + 3]], [[0.5, 2.99, z], [0.5, 2.99, z + 3]], [[-0.5, 2.95, z], [-0.5, 2.95, z + 3]], [[-0.5, 2.99, z], [-0.5, 2.99, z + 3]]], 0.45);
    return S;
  }

  // ---------------------------------------------------------------- scene 3: satellite
  function mli(f, R) {
    dRect(f, 0.04, 0.04, f.w - 0.04, f.h - 0.04, 0.5, 20);
    dLine(f, f.w * 0.5, 0.04, f.w * 0.5, f.h - 0.04, 0.25, 40);
    for (let k = 0; k < 7; k++) {
      const p = []; let x = 0.1 + R() * (f.w - 0.2), y = 0.1 + R() * (f.h - 0.2);
      for (let j = 0; j < 5; j++) { p.push([x, y]); x = clamp(x + (R() - 0.5) * 0.35, 0.06, f.w - 0.06); y = clamp(y + (R() - 0.5) * 0.35, 0.06, f.h - 0.06); }
      dec(f, p, false, 0.14, 70);
    }
  }
  function panelCells(f) {
    dRect(f, 0.04, 0.04, f.w - 0.04, f.h - 0.04, 0.75);
    for (let x = 0.5; x < f.w - 0.01; x += 0.5) dLine(f, x, 0.04, x, f.h - 0.04, 0.5, 25);
    for (let y = 0.55; y < f.h - 0.01; y += 0.55) dLine(f, 0.04, y, f.w - 0.04, y, 0.5, 25);
    for (let i = 1; i < 18; i++) if (i % 3) dLine(f, i * f.w / 18, 0.04, i * f.w / 18, f.h - 0.04, 0.16, 140);
    for (let i = 1; i < 12; i++) if (i % 3) dLine(f, 0.04, i * f.h / 12, f.w - 0.04, i * f.h / 12, 0.16, 140);
  }
  const bez = (p0, p1, p2, p3, n) => { const o = []; for (let i = 0; i <= n; i++) { const s = i / n, a = (1 - s) ** 3, b = 3 * s * (1 - s) ** 2, q = 3 * s * s * (1 - s), d = s ** 3; o.push([0, 1, 2].map(k => p0[k] * a + p1[k] * b + p2[k] * q + p3[k] * d)); } return o; };
  function buildSat(R, seed) {
    const S = newScene({ L: [0.65, 0.45, -0.6], fog: null, near: 0.03 });
    buildSpace(S, R, seed);
    const bus = box(S, -1, -1.1, -1, 1, 1.1, 1, { la: 0.95, bv: 0.06 });
    for (const k of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) mli(bus[k], R);
    const mod = box(S, -0.6, -0.4, -1.16, 0, 0.1, -1.0, { la: 1, bv: 0.014 });
    const m = mod.nz;
    dRect(m, 0.015, 0.015, 0.585, 0.485, 0.85);
    for (let y = 0.415; y < 0.476; y += 0.012) dLine(m, 0.03, y, 0.57, y, 0.45, 40);
    dRect(m, 0.05, 0.3, 0.42, 0.39, 0.6, 30);
    led(m, 0.09, 0.345, 0.0045, 'r', 'pow', 31, 1);
    led(m, 0.15, 0.345, 0.0045, 't', 'act', 7, 1, true);
    led(m, 0.21, 0.345, 0.0045, 't', 'act', 8, 1, true);
    led(m, 0.27, 0.345, 0.0045, 't', 'act', 57, 0.9);
    led(m, 0.33, 0.345, 0.0045, 'r', 'bea', 3, 1);
    for (const x of [0.09, 0.15, 0.21, 0.27, 0.33]) { dLine(m, x - 0.014, 0.317, x + 0.014, 0.317, 0.35, 90); dRect(m, x - 0.021, 0.345 - 0.011, x + 0.021, 0.345 + 0.011, 0.4, 90); }
    for (const x of [0.12, 0.27, 0.42]) {
      dCirc(m, x, 0.13, 0.045, 0.8, 30, 28); dCirc(m, x, 0.13, 0.031, 0.45, 60, 24);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; dCirc(m, x + Math.cos(a) * 0.016, 0.13 + Math.sin(a) * 0.016, 0.0035, 0.4, 120, 8); }
    }
    for (const [x, y] of [[0.035, 0.035], [0.565, 0.035], [0.035, 0.465], [0.565, 0.465]]) { dCirc(m, x, y, 0.009, 0.6, 60, 12); dLine(m, x - 0.005, y, x + 0.005, y, 0.5, 90); dLine(m, x, y - 0.005, x, y + 0.005, 0.5, 90); }
    for (let x = 0.47; x < 0.56; x += 0.012) dLine(m, x, 0.24, x, 0.38, 0.4, 50);
    for (const k of ['px', 'nx']) for (let y = 0.05; y < 0.5; y += 0.05) dLine(mod[k], 0.02, y, 0.14, y, 0.35, 40);
    for (let x = 0.03; x < 0.58; x += 0.03) dLine(mod.py, x, 0.02, x, 0.14, 0.35, 40);
    for (const x of [0.12, 0.27, 0.42]) { const X_ = -0.6 + x; lines(S, [bez([X_, -0.36, -1.165], [X_, -0.46, -1.32], [X_ + 0.1, -0.85, -1.2], [X_ + 0.15, -0.95, -1.002], 16)], 0.7, 20); }
    const stb = box(S, 0.35, 0.4, -1.22, 0.75, 0.8, -1.0);
    dRect(stb.nz, 0.03, 0.03, 0.37, 0.37, 0.5, 30);
    const baf = frustum(S, [0.55, 0.6, -1.22], [0.55, 0.6, -1.45], 0.08, 0.12, 18);
    dCirc(baf.c1, 0.12, 0.12, 0.07, 0.5, 30, 20); dCirc(baf.c1, 0.12, 0.12, 0.035, 0.4, 50, 14);
    const av = box(S, 0.25, -0.85, -1.08, 0.8, -0.45, -1.0);
    dRect(av.nz, 0.03, 0.03, 0.52, 0.37, 0.5, 30);
    for (let y = 0.08; y < 0.34; y += 0.04) dLine(av.nz, 0.06, y, 0.3, y, 0.3, 50);
    const AX = rotX(-1.0);
    for (const sg of [1, -1]) {
      frustum(S, [sg * 1.0, 0, 0], [sg * 1.75, 0, 0], 0.045, 0.045, 10);
      for (let i = 0; i < 2; i++) { const F = cuboid(S, [sg * (3.3 + i * 3.05), 0, 0], AX, 1.5, 0.03, 1.1, { la: 0.95 }); panelCells(F.py); panelCells(F.ny); }
      const tip = [sg * 1.75, 0, 0];
      lines(S, [[tip, mad([sg * 1.8, 0, 0], AX[2], 0.9)], [tip, mad([sg * 1.8, 0, 0], AX[2], -0.9)]], 0.8);
      lines(S, [[mad([sg * 4.8, 0, 0], AX[2], 0.6), mad([sg * 4.85, 0, 0], AX[2], 0.6)], [mad([sg * 4.8, 0, 0], AX[2], -0.6), mad([sg * 4.85, 0, 0], AX[2], -0.6)]], 0.8);
    }
    frustum(S, [0.35, 1.1, 0.25], [0.35, 1.55, 0.25], 0.04, 0.04, 10);
    const dd = nrm([0, 0.75, -0.66]), b0 = [0.35, 1.64, 0.25];
    lines(S, [[[0.35, 1.55, 0.25], b0]], 0.8);
    const D = frustum(S, b0, mad(b0, dd, 0.3), 0.12, 0.85, 28);
    const cap = D.c1;
    dCirc(cap, 0.85, 0.85, 0.28, 0.4, 30, 28); dCirc(cap, 0.85, 0.85, 0.56, 0.35, 30, 28);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; dLine(cap, 0.85 + Math.cos(a) * 0.12, 0.85 + Math.sin(a) * 0.12, 0.85 + Math.cos(a) * 0.83, 0.85 + Math.sin(a) * 0.83, 0.3, 30); }
    const focus = mad(mad(b0, dd, 0.3), dd, 0.45);
    lines(S, [0.5, 1.83, 3.16].map(a => [at(cap, 0.85 + Math.cos(a) * 0.82, 0.85 + Math.sin(a) * 0.82), focus]), 0.6);
    frustum(S, focus, mad(focus, dd, -0.1), 0.05, 0.035, 10);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) frustum(S, [sx * 0.75, -1.1, sz * 0.75], [sx * 0.75, -1.26, sz * 0.75], 0.05, 0.09, 10);
    frustum(S, [0, -1.1, 0], [0, -1.5, 0], 0.03, 0.03, 8);
    lines(S, [[[-0.8, 1.1, -0.8], [-0.8, 1.9, -0.8]], [[0.8, 1.1, 0.8], [0.8, 1.7, 0.8]]], 0.7);
    S.hero = [-0.39, -0.055, -1.16];
    return S;
  }

  // ---------------------------------------------------------------- shots
  function satShot(o) {
    return u => {
      const dist = Math.exp(lerp(Math.log(o.d0), Math.log(o.d1), u));
      const az = lerp(o.a0, o.a1, u), el = lerp(o.e0, o.e1, u);
      const D = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const t = lerp3(o.t0, o.t1, u);
      return { p: mad(t, D, dist), t };
    };
  }
  function buildShots(sat) {
    const sh = [
      { sc: 0, d: 8, p0: [-1.3, 1.6, -1.2], p1: [0.2, 1.0, -0.2], t0: [0.4, 0.75, 1.6], t1: [1.2, 0.36, 1.5], f0: 50, f1: 40, dr: 0.6 },
      { sc: 0, d: 6, p0: [0.45, 0.98, -0.5], p1: [0.62, 0.8, -0.1], t0: [1.24, 0.37, 1.45], t1: [1.24, 0.37, 1.45], f0: 6.5, f1: 4.4, dr: 1, hero: 1 },
      { sc: 1, d: 7, p0: [0.3, 1.65, -2.7], p1: [0.15, 1.58, 0.4], t0: [0, 1.3, 16], t1: [0.1, 1.2, 16], f0: 54, f1: 48, dr: 0.5 },
      { sc: 1, d: 5.5, p0: [-0.72, 0.32, 4.15], p1: [-0.66, 0.36, 4.7], t0: [0.9, 1.2, 5.95], t1: [0.9, 1.15, 5.95], f0: 50, f1: 44, r0: 0.03, r1: 0.035, dr: 0.6 },
      { sc: 1, d: 6, p0: [-0.84, 1.27, 5.25], p1: [-0.75, 1.255, 5.42], t0: [0.9, 1.194, 6.118], t1: [0.9, 1.194, 6.118], f0: 6, f1: 4.2, dr: 1, hero: 1 },
      { sc: 2, d: 6, fn: satShot({ d0: 3.6, d1: 5.2, a0: 0.25, a1: 0.25, e0: 0.12, e1: 0.13, t0: sat.hero, t1: [-0.33, -0.12, -1.16] }), f0: 3.4, f1: 7.5, r0: -0.02, r1: -0.02, dr: 1, hero: 1 },
      { sc: 2, d: 6.5, fn: satShot({ d0: 7, d1: 15, a0: 0.32, a1: 0.34, e0: 0.28, e1: 0.3, t0: [-0.3, -0.1, -1.1], t1: [0, 0.1, 0] }), f0: 34, f1: 42, r0: 0.04, r1: 0.06, dr: 0.5 },
      { sc: 2, d: 15, fn: satShot({ d0: 150, d1: 850, a0: 0.4, a1: 0.42, e0: 0.5, e1: 0.5, t0: [0, 0, 0], t1: [0, 0, 0] }), f0: 30, f1: 30, r0: 0.3, r1: 0.3, dr: 0, hud: 1, orbit: 1 }
    ];
    let acc = 0;
    for (const s of sh) { s.st = acc; acc += s.d; }
    for (let i = 0; i < sh.length; i++) {
      let a = i; while (a > 0 && sh[a - 1].sc === sh[i].sc) a--;
      let b = i; while (b < sh.length - 1 && sh[b + 1].sc === sh[i].sc) b++;
      sh[i].ss = sh[a].st; sh[i].se = sh[b].st + sh[b].d; sh[i].last = b === sh.length - 1;
    }
    total = acc;
    return sh;
  }
  function evalShot(tt) {
    for (const s of shots) if (tt < s.st + s.d) return { s, lt: tt - s.st, u: (tt - s.st) / s.d, tt };
    const s = shots[shots.length - 1];
    return { s, lt: s.d, u: 1, tt };
  }
  function camOf(s, u) {
    let p, tg;
    if (s.fn) { const r = s.fn(u); p = r.p; tg = r.t; } else { p = lerp3(s.p0, s.p1, u); tg = lerp3(s.t0, s.t1, u); }
    const fov = Math.exp(lerp(Math.log(s.f0), Math.log(s.f1), u));
    const roll = lerp(s.r0 || 0, s.r1 || 0, u);
    if (!reduced && s.dr) {
      const dist = len(sub(tg, p)), hv = dist * Math.tan(fov * Math.PI / 360) * s.dr * 0.02;
      const f = nrm(sub(tg, p)), r = nrm(crs(Y, f)), up = crs(f, r);
      const dx = (Math.sin(T * 0.37 + 1.1) * 0.6 + Math.sin(T * 0.91 + 0.3) * 0.4) * hv;
      const dy = (Math.sin(T * 0.29 + 2.0) * 0.6 + Math.sin(T * 0.73) * 0.4) * hv;
      tg = add(tg, add(scl(r, dx), scl(up, dy)));
    }
    return { p, t: tg, fov, roll };
  }

  // ---------------------------------------------------------------- frame
  function drawFrame() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = pal.bgS; c.fillRect(0, 0, w, h);
    const last = shots[shots.length - 1];
    const tt = reduced ? last.st + last.d * 0.45 : ((T % total) + total) % total;
    const st = evalShot(tt), s = st.s, S = scenes[s.sc];
    const act = s.hero ? 0.3 + 0.7 * st.u : 0.42;
    setCamera(camOf(s, st.u));
    planes = mkPlanes(S.near);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (S.space) { S.space.th = (reduced ? tt + earthT : tt) * 0.006; drawSpace(S, st); }
    c.strokeStyle = pal.fgS; c.lineWidth = 1;
    const list = [];
    walk(S.bsp, list);
    for (const o of list) for (const f of o.faces) drawFace(S, f, act);
    if (s.hud) drawHud(st);
    c.globalAlpha = 1;
    if (vign) { c.fillStyle = vign; c.fillRect(0, 0, w, h); }
    if (!reduced) {
      const fd = Math.max(0, 1 - (tt - s.ss) / 0.7, 1 - (s.se - tt) / (s.last ? 1.6 : 0.6), 1 - T / 1.2);
      if (fd > 0) { c.globalAlpha = clamp(fd, 0, 1); c.fillStyle = pal.bgS; c.fillRect(0, 0, w, h); }
    }
    c.globalAlpha = 1;
  }

  const resize = ctx => {
    if (!canvas) return;
    w = Math.max(1, ctx.width); h = Math.max(1, ctx.height); dpr = ctx.dpr || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = Math.hypot(w, h) * 0.5;
    vign = c.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
    vign.addColorStop(0, rgba(pal.bg, 0));
    vign.addColorStop(1, rgba(pal.bg, 0.72));
  };

  return {
    id: 'wire-relay',
    label: 'WIRE RELAY',
    version: '1.0.0',
    kind: 'canvas2d',
    looping: true,
    duration: 0,
    skippable: true,
    inputMode: 'start',
    managesChrome: false,
    honorsReducedMotion: true,

    mount(ctx) {
      reduced = !!(ctx.flags && ctx.flags.reducedMotion);
      pal = buildPalette(ctx.theme);
      sprites = { t: mkSprite(pal.teal), r: mkSprite(pal.red) };
      const seed = (ctx.seed | 0) || 1;
      scenes = [buildBedroom(rng(seed + 11)), buildDC(rng(seed + 23)), buildSat(rng(seed + 37), seed)];
      const br = rng(seed + 5);
      for (const S of scenes) S.bsp = bsp(S.objs, br);
      shots = buildShots(scenes[2]);
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      ctx.root.appendChild(canvas);
      c = canvas.getContext('2d');
      resize(ctx);
    },

    resize,

    update(dt, ctx) {
      reduced = !!(ctx && ctx.flags && ctx.flags.reducedMotion);
      const d = Math.min(Math.max(dt || 0, 0), 0.05);
      if (!reduced) T += d;
      earthT += d * (reduced ? 0.25 : 1);
    },

    render() {
      if (!c || !scenes) return;
      drawFrame();
    },

    dispose() {
      if (canvas) canvas.remove();
      if (sprites) { sprites.t.width = sprites.t.height = 0; sprites.r.width = sprites.r.height = 0; }
      canvas = null; c = null; sprites = null; scenes = null; shots = null; vign = null; pal = null;
      fillCache.clear(); ledBuf.length = 0;
    }
  };
}
