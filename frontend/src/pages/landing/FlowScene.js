// The 3D world behind the landing page: one restaurant on a street in a small town, at dusk.
// Each page section is a camera stop, and each stop plays one part of the product
// flow as a small looping animation:
//   1 onboarding → 2 website → 3 online order → 4 delivery → 5 dine-in KOT
// Everything is built from primitives and canvas textures, so there are no asset files to host.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V3 = THREE.Vector3;

// One camera stop per page section: position, look-at point, and how far the
// scene is pushed sideways (fraction of the screen) to leave room for the text.
const STOPS = [
  { pos: [29, 15.5, 34], look: [5.6, 0.2, 1.5], shift: 0.3 },      // 0 overview
  { pos: [2.2, 5.6, 21.5], look: [2.2, 2.3, 0], shift: -0.21 },    // 1 onboarding
  { pos: [8.4, 3.9, 11.8], look: [5.2, 2.9, 1.6], shift: 0.2 },    // 2 website
  { pos: [14.5, 8.5, 30], look: [7.2, 3.0, 0.5], shift: -0.21 },   // 3 online order
  { pos: [8.5, 8.5, 24], look: [8.5, 1.2, 3.2], shift: 0.21 },     // 4 delivery
  { pos: [-7.4, 5.6, 14.2], look: [-7.4, 1.5, -0.4], shift: -0.2 }, // 5 dine-in KOT
  { pos: [2.5, 13, 42], look: [2.5, 2, 0], shift: 0 },             // 6 plans
];

// Loop length (seconds) of each stop's animation.
const PERIOD = [0, 11, 10, 8, 12, 11, 0];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// 0 → 1 shortly after `a`, back to 0 just before `b`
const span = (t, a, b) => Math.min(smooth(a, a + 0.45, t), 1 - smooth(b - 0.4, b, t));
const backOut = (t) => {
  const k = clamp01(t) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
};
const bezier = (out, a, c, b, t) => {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z
  );
};

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const canvasTexture = (c) => {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};
const SANS = 'Inter, system-ui, sans-serif';
const SERIF = 'Fraunces, Georgia, "Times New Roman", serif';

export function createFlowScene(canvas, { reducedMotion = false, onReady, onPhase } = {}) {
  const isSmall = window.innerWidth < 768;
  const lowPower = isSmall || (navigator.hardwareConcurrency || 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: lowPower, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2b5266, 0.0065);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);

  // ───────────────────────── small textures ─────────────────────────
  const glow = (() => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return canvasTexture(c);
  })();
  const ringTex = (() => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
    return canvasTexture(c);
  })();

  // ───────────────────────── materials ─────────────────────────
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });
  const lightMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
  const M = {
    wall: std(0xe6d8bf, { roughness: 0.9 }),
    wallTrim: std(0x1c5a60, { roughness: 0.6 }),
    wallDeep: std(0xc9b99c, { roughness: 0.9 }),
    roof: std(0x16323a, { roughness: 0.55, metalness: 0.2 }),
    room: std(0x2a5a63),
    roomSide: std(0x234e57),
    counter: std(0x173f46, { roughness: 0.5, metalness: 0.15 }),
    customer: std(0x66739f, { roughness: 0.85 }),
    ground: std(0x2a5a50, { roughness: 1 }),
    plaza: std(0x9c9079, { roughness: 0.85 }),
    floor: std(0x94704c, { roughness: 0.6 }),
    road: std(0x1a242a, { roughness: 0.65 }),
    rock: std(0x21363d, { roughness: 1 }),
    gold: std(0xd9a441, { roughness: 0.32, metalness: 0.75 }),
    cream: std(0xf1e6cf, { roughness: 0.7 }),
    wood: std(0x7a5232),
    trunk: std(0x5d4630),
    leaf: std(0x1f7a5c, { roughness: 0.7 }),
    dark: std(0x14252b),
    pave: std(0x6b675b, { roughness: 0.9 }),
    city1: std(0x3a5563, { roughness: 0.9 }),
    city2: std(0x4a6068, { roughness: 0.9 }),
    city3: std(0x2f4856, { roughness: 0.9 }),
    cloth1: std(0x2c6468, { roughness: 0.85 }),
    cloth2: std(0x7d3838, { roughness: 0.85 }),
    cloth3: std(0xe4dcc8, { roughness: 0.85 }),
    cloth4: std(0x262d33, { roughness: 0.85 }),
    cloth5: std(0x9a7b4f, { roughness: 0.85 }),
    navy: std(0x2c4263, { roughness: 0.85 }),
    hair: std(0x2a211c, { roughness: 0.9 }),
    shoe: std(0x191a1c, { roughness: 0.6 }),
    helmet: std(0x1d272d, { roughness: 0.25, metalness: 0.3 }),
    skin: std(0xe6b18a, { roughness: 0.8 }),
    teal: std(0x22b3a5, { roughness: 0.4, metalness: 0.3 }),
    wine: std(0x9c4a36, { roughness: 0.8 }),
    house: std(0xd6c2a1, { roughness: 0.9 }),
    steel: std(0xa9bcc0, { roughness: 0.3, metalness: 0.7 }),
    white: std(0xffffff, { roughness: 0.6 }),
    warm: lightMat(1.3, 0.92, 0.48),
    warmSoft: lightMat(0.95, 0.8, 0.55),
    goldLine: lightMat(1.2, 0.84, 0.32),
    tealLine: lightMat(0.18, 1.0, 0.92),
    red: lightMat(1.5, 0.3, 0.22),
    win: lightMat(0.05, 0.11, 0.13), // restaurant windows; colour follows the "lights on" value
  };

  const world = new THREE.Group();
  scene.add(world);

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = world) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 14) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent);
  const ball = (r, mat, x, y, z, parent) => add(new THREE.SphereGeometry(r, 14, 12), mat, x, y, z, parent);
  const glowing = (mesh) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  };
  const group = (x, y, z, parent = world) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const halo = (x, y, z, size, color, opacity = 0.6, parent = world) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    parent.add(s);
    return s;
  };
  const pulseRing = (x, y, z, color, parent = world) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTex, color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false,
      toneMapped: false,
    }));
    s.position.set(x, y, z);
    s.renderOrder = 15;
    parent.add(s);
    return s;
  };
  const setPulse = (s, k, size) => {
    const on = k > 0 && k < 1;
    s.visible = on;
    if (!on) return;
    s.scale.setScalar(size * (0.25 + k * 0.75));
    s.material.opacity = (1 - k) * 0.9;
  };

  // Text bubbles that pop up over the scene to say what just happened.
  const redraws = [];
  const makeLabel = (text, { accent = '#f0be5f', h = 0.62, parent = world } = {}) => {
    const c = makeCanvas(8, 8);
    const tex = canvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: new THREE.Color(1.12, 1.12, 1.12), transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    }));
    sprite.renderOrder = 20;
    sprite.visible = false;
    const draw = () => {
      const ctx = c.getContext('2d');
      const font = `600 46px ${SANS}`;
      ctx.font = font;
      const tw = ctx.measureText(text).width;
      c.width = Math.ceil(tw + 126);
      c.height = 96;
      rr(ctx, 3, 3, c.width - 6, 90, 45);
      ctx.fillStyle = 'rgba(9,24,33,0.94)';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(46, 48, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = font;
      ctx.fillStyle = '#fffaf0';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 74, 51);
      tex.dispose();
      tex.needsUpdate = true;
      sprite.userData.w = (h * c.width) / c.height;
    };
    draw();
    redraws.push(draw);
    sprite.userData.h = h;
    parent.add(sprite);
    return sprite;
  };
  const showLabel = (s, k) => {
    const v = clamp01(k);
    s.visible = v > 0.01;
    if (!s.visible) return;
    const e = 0.72 + 0.28 * backOut(v);
    s.material.opacity = Math.min(1, v * 1.6);
    s.scale.set(s.userData.w * e, s.userData.h * e, 1);
  };
  const GREEN = '#4ade9f';
  const TEAL = '#5eead4';

  // ───────────────────────── sky ─────────────────────────
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x13264a) },
        horizon: { value: new THREE.Color(0xec9e72) },
        mid: { value: new THREE.Color(0x315f88) },
        bottom: { value: new THREE.Color(0x2b5266) },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 horizon;
        void main(){
          float h = vDir.y;
          vec3 c = mix(mid, top, smoothstep(0.06, 0.5, h));
          c = mix(horizon, c, smoothstep(-0.02, 0.13, h));
          c = mix(bottom, c, smoothstep(0.0, 0.05, h));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  ));
  halo(-95, 7, -120, 38, 0xffb070, 0.5, scene).material.fog = false;
  halo(-95, 7, -120, 11, 0xfff0d0, 0.85, scene).material.fog = false;
  {
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(0.25 + Math.random() * 0.75);
      pos[i * 3] = 150 * Math.sin(v) * Math.cos(u);
      pos[i * 3 + 1] = 150 * Math.cos(v);
      pos[i * 3 + 2] = 150 * Math.sin(v) * Math.sin(u);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xdfeeff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false, depthWrite: false,
    })));
  }
  // ───────────────────────── the town ─────────────────────────
  // The street is part of a town: the land runs to the horizon, with neighbours along the road
  // and a skyline behind. CX / CZ mark the middle of the stretch where the story happens.
  const CX = 2.5;
  const CZ = 1.5;
  {
    const land = add(new THREE.CircleGeometry(600, 72), M.ground, CX, 0, CZ);
    land.rotation.x = -Math.PI / 2;
    land.castShadow = false;
  }

  // road along the front
  const ROAD_Z = 6.2;
  box(600, 0.02, 1.9, M.road, CX, 0.011, ROAD_Z).castShadow = false;
  // pavements either side, a paved forecourt strip in front of the buildings, and a side street
  for (const z of [ROAD_Z - 1.4, ROAD_Z + 1.4]) box(600, 0.02, 0.9, M.pave, CX, 0.004, z).castShadow = false;
  box(600, 0.02, 3.4, M.pave, CX, 0.002, 3.1).castShadow = false;
  const SIDE_X = 21.6;
  box(1.9, 0.02, 600, M.road, SIDE_X, 0.0105, CZ).castShadow = false;
  {
    const count = 260;
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.012, 0.07), M.warmSoft, count);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(-148 + i * 1.16, 0.024, ROAD_Z);
      o.updateMatrix();
      dashes.setMatrixAt(i, o.matrix);
    }
    world.add(dashes);
  }
  box(8.5, 0.02, 3.6, M.plaza, 0.6, 0.012, 3.4).castShadow = false;
  box(3.2, 0.02, 3.6, M.plaza, 14.7, 0.012, 3.3).castShadow = false;

  // Neighbours along the street and a skyline behind: plain blocks with a scatter of lit windows.
  {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const mats = [M.city1, M.city2, M.city3];
    const lit = [];
    const block = (x, z, w, h, d) => {
      const m = box(w, h, d, mats[(rnd() * 3) | 0], x, h / 2, z);
      m.castShadow = z > -6;
      box(w + 0.3, 0.16, d + 0.3, M.roof, x, h + 0.08, z).castShadow = false;
      const cols = Math.max(2, Math.floor(w / 1.15));
      const rows = Math.max(1, Math.floor((h - 1.4) / 1.05));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() < 0.68) continue;
          lit.push([x - w / 2 + (c + 0.5) * (w / cols), 1.5 + r * 1.05, z + d / 2 + 0.02, rnd()]);
        }
      }
    };
    // same side of the street as the restaurant (the side street cuts through at SIDE_X)
    for (const [x, w, h] of [[-18.2, 7, 4.4], [-27.2, 8, 5.4], [-37.5, 9, 4.2]]) block(x, -0.9, w, h, 4.8);
    for (const [x, w, h] of [[27.4, 7, 5.0], [36.4, 8, 7.2], [46.6, 9, 4.8], [57.5, 9, 6.4], [69, 10, 5.4], [82, 11, 7.0]]) block(x, -0.9, w, h, 4.8);
    // three rows behind, taller towards the back
    for (const [z, hMin, hMax] of [[-16, 3.4, 5.4], [-27, 4.6, 8.4], [-42, 6, 13]]) {
      let x = -44 + rnd() * 4;
      while (x < 105) {
        const w = 5 + rnd() * 5;
        if (Math.abs(x + w / 2 - SIDE_X) > w / 2 + 1.6) block(x + w / 2, z, w, hMin + rnd() * (hMax - hMin), 6 + rnd() * 3);
        x += w + 0.8 + rnd() * 2.2;
      }
    }
    const panes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.52, 0.04), new THREE.MeshBasicMaterial({ toneMapped: false }), lit.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    lit.forEach(([x, y, z, k], i) => {
      o.position.set(x, y, z);
      o.updateMatrix();
      panes.setMatrixAt(i, o.matrix);
      panes.setColorAt(i, k < 0.1 ? c.setRGB(0.3, 0.5, 0.58) : c.setRGB(0.62 + k * 0.3, 0.4 + k * 0.18, 0.16 + k * 0.08));
    });
    world.add(panes);
  }

  // ───────────────────────── the restaurant ─────────────────────────
  const R = { w: 6, h: 3.6, d: 4, z: -0.5 };
  const RF = R.z + R.d / 2; // front face z
  const plot = box(R.w + 0.8, 0.1, R.d + 0.8, M.cream, 0, 0.05, R.z);
  plot.castShadow = false;

  const bodyG = group(0, 0, R.z);
  box(R.w, R.h, R.d, M.wall, 0, R.h / 2, 0, bodyG);
  box(R.w + 0.12, 0.07, R.d + 0.12, M.wallTrim, 0, 1.95, 0, bodyG);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.18, R.h, 0.18, M.wallTrim, sx * (R.w / 2), R.h / 2, sz * (R.d / 2), bodyG);
  for (let i = 0; i < 4; i++) glowing(box(0.8, 0.9, 0.06, M.win, -2.1 + i * 1.4, 2.75, R.d / 2 + 0.01, bodyG));
  for (let i = 0; i < 2; i++) glowing(box(0.06, 0.9, 0.9, M.win, R.w / 2 + 0.01, 2.75, -0.8 + i * 1.6, bodyG));

  const roofG = group(0, 0, R.z);
  box(R.w + 0.6, 0.22, R.d + 0.6, M.roof, 0, R.h + 0.11, 0, roofG);
  box(1.6, 0.5, 1.2, M.wallDeep, -1.8, R.h + 0.47, -0.9, roofG);
  cyl(0.16, 0.16, 0.7, M.steel, 1.9, R.h + 0.55, -1.1, roofG);
  for (const x of [-2.1, 2.1]) cyl(0.035, 0.035, 0.55, M.gold, x, R.h + 0.48, R.d / 2 - 0.15, roofG, 6);

  // rooftop name sign
  const signTex = (() => {
    const c = makeCanvas(1024, 150);
    const draw = () => {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 1024, 150);
      ctx.font = `600 84px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
      ctx.fillStyle = '#ffe2a6';
      ctx.fillText('YOUR RESTAURANT', 512, 80);
    };
    draw();
    const tex = canvasTexture(c);
    redraws.push(() => { draw(); tex.needsUpdate = true; });
    return tex;
  })();
  box(5.6, 0.98, 0.1, M.roof, 0, R.h + 0.85, R.d / 2 - 0.22, roofG);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 0.76),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, color: new THREE.Color(0, 0, 0), side: THREE.DoubleSide })
  );
  sign.position.set(0, R.h + 0.85, R.d / 2 - 0.15);
  roofG.add(sign);
  const signGlow = halo(0, R.h + 0.85, R.d / 2 + 0.2, 6.5, 0xffc266, 0, roofG);

  // shop front: door, windows, awning, menu board. Pops out of the wall as one piece.
  const frontG = group(0, 1, RF);
  glowing(box(1.2, 1.6, 0.06, M.win, 0, -0.2, 0.03, frontG));
  box(0.05, 1.6, 0.08, M.wallTrim, 0, -0.2, 0.05, frontG);
  for (const x of [-1.95, 1.95]) glowing(box(1.7, 1.2, 0.06, M.win, x, 0, 0.03, frontG));
  const awning = box(R.w + 0.2, 0.07, 1.15, M.roof, 0, 0.98, 0.5, frontG);
  awning.rotation.x = 0.3;
  for (let i = 0; i < 6; i++) box(0.5, 0.075, 1.16, M.cream, -2.75 + i * 1.1, 0.98, 0.5, frontG).rotation.x = 0.3;
  box(2.0, 0.12, 0.9, M.cream, 0, -0.94, 0.45, frontG);
  for (const x of [-2.75, 2.75]) {
    cyl(0.2, 0.15, 0.4, M.cream, x, -0.8, 0.7, frontG);
    ball(0.3, M.leaf, x, -0.4, 0.7, frontG);
  }
  {
    const c = makeCanvas(160, 240);
    const draw = () => {
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0f2f35';
      ctx.fillRect(0, 0, 160, 240);
      ctx.fillStyle = '#f3d595';
      ctx.font = `700 40px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillText('MENU', 80, 56);
      ctx.fillStyle = 'rgba(246,239,225,0.75)';
      for (let i = 0; i < 5; i++) ctx.fillRect(24, 88 + i * 28, 112 - (i % 2) * 30, 7);
    };
    draw();
    const tex = canvasTexture(c);
    redraws.push(() => { draw(); tex.needsUpdate = true; });
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.95, 0.05),
      [M.wood, M.wood, M.wood, M.wood, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xb8b8b8 }), M.wood]
    );
    board.position.set(1.15, -0.5, 1.55);
    board.rotation.x = -0.2;
    board.castShadow = true;
    frontG.add(board);
  }
  const frontGlow = halo(0, 1.1, RF + 0.9, 5.5, 0xffb95e, 0);

  // ───────────────────────── dining room + kitchen (open, doll-house style) ─────────────────────────
  const DX = -8;
  const dining = group(DX, 0, 0);
  box(8.7, 0.12, 6.7, M.floor, 0, 0.06, 0, dining);
  box(8.7, 3.2, 0.16, M.room, 0, 1.6, -3.3, dining);
  box(0.16, 3.2, 6.7, M.roomSide, -4.3, 1.6, 0, dining);
  box(8.8, 0.07, 0.24, M.gold, 0, 3.23, -3.3, dining);
  box(0.24, 0.07, 6.8, M.gold, -4.3, 3.23, 0, dining);
  glowing(box(8.4, 0.03, 0.05, M.goldLine, 0, 0.13, 3.2, dining));

  const FY = 0.12; // floor height inside the room
  // People are plain low-poly figures with real proportions (legs, torso, arms, neck, head), no
  // faces. The origin is at the feet, or on the floor under the seat; they face +z.
  const figure = (topMat, { legMat = M.cloth4, seated = false, arms = 'down', hat = null, parent = world } = {}) => {
    const g = new THREE.Group();
    parent.add(g);
    const hip = seated ? 0.385 : 0.6;
    for (const sx of [-1, 1]) {
      const x = sx * 0.075;
      if (seated) {
        cyl(0.058, 0.052, 0.34, legMat, x, hip, 0.15, g, 8).rotation.x = Math.PI / 2;
        cyl(0.048, 0.042, 0.37, legMat, x, 0.2, 0.32, g, 8);
        box(0.085, 0.05, 0.17, M.shoe, x, 0.025, 0.35, g);
      } else {
        cyl(0.058, 0.044, hip, legMat, x, hip / 2, 0, g, 8);
        box(0.085, 0.05, 0.17, M.shoe, x, 0.025, 0.03, g);
      }
    }
    cyl(0.15, 0.115, 0.42, topMat, 0, hip + 0.2, 0, g, 12).scale.z = 0.62;
    const shoulder = hip + 0.38;
    for (const sx of [-1, 1]) {
      const x = sx * 0.185;
      cyl(0.042, 0.038, 0.25, topMat, x, shoulder - 0.125, 0, g, 8);
      if (arms === 'fwd') {
        cyl(0.036, 0.032, 0.24, topMat, x, shoulder - 0.25, 0.12, g, 8).rotation.x = Math.PI / 2;
        ball(0.036, M.skin, x, shoulder - 0.25, 0.26, g);
      } else {
        cyl(0.036, 0.032, 0.24, topMat, x, shoulder - 0.37, 0, g, 8);
        ball(0.036, M.skin, x, shoulder - 0.52, 0, g);
      }
    }
    cyl(0.038, 0.044, 0.07, M.skin, 0, shoulder + 0.06, 0, g, 8);
    const headY = shoulder + 0.175;
    ball(0.085, M.skin, 0, headY, 0, g).scale.set(0.92, 1.12, 1);
    if (hat === 'helmet') {
      ball(0.112, M.helmet, 0, headY + 0.015, -0.005, g);
    } else {
      const hair = add(new THREE.SphereGeometry(0.092, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, 0, headY + 0.012, -0.012, g);
      hair.scale.set(0.95, 1.12, 1.05);
      if (hat === 'chef') {
        cyl(0.082, 0.078, 0.16, M.white, 0, headY + 0.16, 0, g, 12);
        cyl(0.098, 0.088, 0.05, M.white, 0, headY + 0.26, 0, g, 12);
      }
    }
    return g;
  };
  const table = (x, z, tops) => {
    const g = group(x, FY, z, dining);
    cyl(0.46, 0.46, 0.04, M.cream, 0, 0.6, 0, g, 24);
    cyl(0.035, 0.035, 0.58, M.dark, 0, 0.3, 0, g, 8);
    cyl(0.24, 0.26, 0.03, M.dark, 0, 0.015, 0, g, 16);
    [-1, 1].forEach((sx, i) => {
      // a chair, with its guest sitting on it, facing the table
      const seat = group(sx * 0.8, 0, 0, g);
      seat.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      box(0.36, 0.04, 0.36, M.wood, 0, 0.31, 0, seat);
      box(0.36, 0.44, 0.035, M.wood, 0, 0.55, -0.175, seat);
      for (const lx of [-0.15, 0.15]) for (const lz of [-0.15, 0.15]) box(0.03, 0.3, 0.03, M.wood, lx, 0.15, lz, seat);
      figure(tops[i], { seated: true, arms: 'fwd', legMat: i ? M.cloth4 : M.navy, parent: seat });
    });
    // pendant lamp
    cyl(0.008, 0.008, 0.9, M.dark, 0, 2.65, 0, g, 4).castShadow = false;
    glowing(ball(0.11, M.warm, 0, 2.15, 0, g));
    halo(0, 2.15, 0, 1.5, 0xffc266, 0.22, g);
    return g;
  };
  const TABLE = new V3(1.7, 0, 1.35);
  table(TABLE.x, TABLE.z, [M.cloth1, M.cloth2]);
  table(-2.3, 1.55, [M.cloth5, M.cloth3]);

  // QR stand on the guest's table
  const qr = (() => {
    const c = makeCanvas(126, 126);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 126, 126);
    ctx.fillStyle = '#041a1e';
    for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) if (Math.random() > 0.5) ctx.fillRect(12 + x * 6, 12 + y * 6, 6, 6);
    for (const [fx, fy] of [[12, 12], [78, 12], [12, 78]]) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx - 2, fy - 2, 40, 40);
      ctx.fillStyle = '#041a1e';
      ctx.fillRect(fx, fy, 36, 36);
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx + 6, fy + 6, 24, 24);
      ctx.fillStyle = '#041a1e';
      ctx.fillRect(fx + 12, fy + 12, 12, 12);
    }
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.02),
      new THREE.MeshBasicMaterial({ map: canvasTexture(c), toneMapped: false })
    );
    m.position.set(TABLE.x, FY + 0.76, TABLE.z + 0.12);
    m.rotation.x = -0.25;
    dining.add(m);
    return m;
  })();
  const qrRing = pulseRing(TABLE.x, FY + 0.8, TABLE.z + 0.15, 0x5eead4, dining);

  // kitchen along the back wall
  box(5.0, 0.95, 0.75, M.counter, -1.3, FY + 0.475, -2.1, dining);
  box(5.1, 0.06, 0.85, M.cream, -1.3, FY + 0.98, -2.1, dining);
  box(1.5, 0.4, 0.8, M.steel, -3.3, 2.5, -2.85, dining);
  cyl(0.24, 0.22, 0.26, M.steel, -3.3, FY + 1.14, -2.1, dining);
  glowing(cyl(0.3, 0.3, 0.02, M.red, -3.3, FY + 1.012, -2.1, dining));
  const steam = [0, 1, 2].map(() => halo(-3.3, 1.6, -2.1, 0.5, 0xdff6f6, 0, dining));
  const chef = figure(M.white, { arms: 'fwd', hat: 'chef', parent: dining });
  chef.position.set(-2.4, FY, -2.75);
  const PASS = new V3(0.7, FY + 1.03, -2.1); // where finished plates are put for the waiter

  // kitchen display screen
  const kdsCanvas = makeCanvas(800, 450);
  const kdsTex = canvasTexture(kdsCanvas);
  box(3.5, 2.0, 0.08, M.gold, 0.1, 2.25, -3.21, dining);
  const KDS = new V3(0.1, 2.25, -3.14);
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.36, 1.89), new THREE.MeshBasicMaterial({ map: kdsTex, toneMapped: false }));
    m.position.copy(KDS);
    dining.add(m);
  }
  let kdsState = -1;
  const drawKds = (state, force) => {
    if (state === kdsState && !force) return;
    kdsState = state;
    const ctx = kdsCanvas.getContext('2d');
    ctx.fillStyle = '#041a1e';
    ctx.fillRect(0, 0, 800, 450);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e3b25b';
    ctx.font = `700 26px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillText('KITCHEN DISPLAY', 24, 44);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const tickets = [
      { title: 'KOT #21 · Table 4', items: ['2 × Paneer Tikka', '1 × Butter Naan', '1 × Sweet Lassi'], state },
      { title: 'KOT #20 · Table 2', items: ['1 × Veg Biryani', '2 × Raita'], state: 2 },
      { title: 'KOT #19 · Table 7', items: ['3 × Masala Dosa', '3 × Filter Coffee'], state: 3 },
    ];
    const tone = [null, ['#e3b25b', 'NEW'], ['#2dd4bf', 'PREPARING'], ['#34d399', 'READY']];
    tickets.forEach((t, i) => {
      const x = 20 + i * 258;
      rr(ctx, x, 66, 244, 364, 16);
      if (!t.state) {
        ctx.setLineDash([10, 9]);
        ctx.strokeStyle = 'rgba(169,196,196,0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(169,196,196,0.6)';
        ctx.font = `500 22px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for order…', x + 122, 256);
        ctx.textAlign = 'left';
        return;
      }
      ctx.fillStyle = '#0a3238';
      ctx.fill();
      const [color, word] = tone[t.state];
      rr(ctx, x, 66, 244, 64, 16);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillRect(x, 100, 244, 30);
      ctx.fillStyle = '#041a1e';
      ctx.font = `700 23px ${SANS}`;
      ctx.fillText(t.title, x + 14, 107);
      ctx.fillStyle = '#f6efe1';
      ctx.font = `500 22px ${SANS}`;
      t.items.forEach((line, k) => ctx.fillText(line, x + 14, 176 + k * 40));
      rr(ctx, x + 14, 368, 216, 46, 23);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = `700 21px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(word, x + 122, 399);
      ctx.textAlign = 'left';
    });
    kdsTex.needsUpdate = true;
  };
  drawKds(2);
  redraws.push(() => drawKds(kdsState, true));

  // billing counter
  const CASH = new V3(3.3, 0, -2.3);
  box(1.4, 0.95, 0.75, M.counter, CASH.x, FY + 0.475, CASH.z, dining);
  box(1.5, 0.06, 0.85, M.cream, CASH.x, FY + 0.98, CASH.z, dining);
  box(0.5, 0.36, 0.04, M.dark, CASH.x - 0.2, FY + 1.32, CASH.z, dining).rotation.x = -0.25;
  glowing(box(0.44, 0.3, 0.02, M.tealLine, CASH.x - 0.2, FY + 1.32, CASH.z + 0.03, dining)).rotation.x = -0.25;
  box(0.26, 0.16, 0.26, M.dark, CASH.x + 0.4, FY + 1.09, CASH.z + 0.1, dining);
  const receipt = glowing(box(0.18, 1, 0.01, M.white, CASH.x + 0.4, FY + 1.17, CASH.z + 0.1, dining));
  const cashier = figure(M.navy, { parent: dining });
  cashier.position.set(CASH.x, FY, CASH.z - 0.6);

  // moving pieces of the dine-in story
  const waiter = figure(M.cloth3, { arms: 'fwd', parent: dining });
  box(0.25, 0.38, 0.02, M.cloth4, 0, 0.56, 0.075, waiter); // long black apron
  const WAITER_AT_TABLE = new V3(TABLE.x, FY, TABLE.z - 0.95);
  const WAITER_AT_PASS = new V3(PASS.x, FY, PASS.z + 0.85);
  const plate = group(0, 0, 0, dining);
  cyl(0.22, 0.2, 0.03, M.cream, 0, 0, 0, plate, 20);
  add(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, 0, 0.015, 0, plate);
  ball(0.03, M.gold, 0, 0.2, 0, plate);
  const kot = (() => {
    const c = makeCanvas(128, 176);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f2b2e';
    ctx.fillRect(0, 0, 128, 176);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 6, 116, 164);
    ctx.fillStyle = '#f08a1c';
    ctx.fillRect(6, 6, 116, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KOT', 64, 43);
    ctx.fillStyle = '#0f2b2e';
    for (let i = 0; i < 4; i++) ctx.fillRect(20, 74 + i * 22, 88 - (i % 2) * 26, 8);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.63),
      new THREE.MeshBasicMaterial({ map: canvasTexture(c), toneMapped: false, side: THREE.DoubleSide })
    );
    dining.add(m);
    return m;
  })();
  const kotGlow = halo(0, 0, 0, 1.6, 0xffc266, 0, dining);
  const lblTable = makeLabel('Order taken at the table', { accent: TEAL, h: 0.5, parent: dining });
  lblTable.position.set(TABLE.x - 0.4, 0.62, 3.0);
  const lblKot = makeLabel('KOT on the kitchen screen', { h: 0.5, parent: dining });
  lblKot.position.set(KDS.x, 3.85, -2.6);
  const lblReady = makeLabel('Ready to serve', { accent: GREEN, h: 0.5, parent: dining });
  lblReady.position.set(KDS.x, 3.85, -2.6);
  const lblBill = makeLabel('Bill printed and paid', { accent: GREEN, h: 0.5, parent: dining });
  lblBill.position.set(CASH.x - 0.6, 0.62, 3.0);

  // ───────────────────────── the screen that floats beside the restaurant ─────────────────────────
  const device = group(5.9, 3.0, 2.7);
  device.rotation.y = -0.12;
  box(3.86, 2.76, 0.1, M.gold, 0, 0, -0.03, device);
  box(3.74, 2.64, 0.12, M.dark, 0, 0, 0, device);
  cyl(0.05, 0.05, 1.5, M.gold, 0, -2.1, -0.05, device, 8);
  cyl(0.7, 0.8, 0.1, M.gold, 0, -2.9, -0.05, device, 24);
  const devCanvas = makeCanvas(1024, 704);
  const devTex = canvasTexture(devCanvas);
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.56, 2.45), new THREE.MeshBasicMaterial({ map: devTex, toneMapped: false, color: 0xdedede }));
    m.position.z = 0.065;
    device.add(m);
  }
  const deviceRings = [pulseRing(0, 0, 0.2, 0x4ade9f, device), pulseRing(0, 0, 0.2, 0x4ade9f, device)];
  const lblLive = makeLabel('Website is live', { accent: GREEN, h: 0.56, parent: device });
  lblLive.position.set(0, 1.95, 0.3);
  let devKey = '';
  const drawDevice = (mode, stage, force) => {
    const key = mode + stage;
    if (key === devKey && !force) return;
    devKey = key;
    const ctx = devCanvas.getContext('2d');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (mode === 'onboard') {
      const g = ctx.createLinearGradient(0, 0, 0, 704);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#fff6e4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 704);
      ctx.fillStyle = '#0f2b2e';
      ctx.font = `500 58px ${SERIF}`;
      ctx.fillText('Set up your restaurant', 64, 104);
      ctx.fillStyle = '#5f7d80';
      ctx.font = `500 28px ${SANS}`;
      ctx.fillText('One step at a time', 66, 150);
      const rows = ['Create your account', 'Restaurant details', 'Location & delivery area', 'Add your menu'];
      rows.forEach((label, i) => {
        const y = 240 + i * 104;
        const done = i < stage;
        const current = i === stage;
        if (current) {
          rr(ctx, 44, y - 46, 936, 92, 22);
          ctx.fillStyle = 'rgba(224,168,58,0.22)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(104, y, 30, 0, Math.PI * 2);
        if (done) {
          ctx.fillStyle = '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(90, y + 1);
          ctx.lineTo(100, y + 12);
          ctx.lineTo(119, y - 10);
          ctx.stroke();
        } else {
          ctx.strokeStyle = current ? '#d9951f' : '#c3d2d3';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.fillStyle = done ? '#0f2b2e' : current ? '#96640c' : '#9fb3b4';
        ctx.font = `600 40px ${SANS}`;
        ctx.fillText(label, 164, y + 14);
      });
      rr(ctx, 64, 640, 896, 14, 7);
      ctx.fillStyle = '#ece3cf';
      ctx.fill();
      if (stage > 0) {
        rr(ctx, 64, 640, 896 * (stage / 4), 14, 7);
        ctx.fillStyle = '#10b981';
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#f7f1e3';
      ctx.fillRect(0, 0, 1024, 704);
      // browser bar
      ctx.fillStyle = '#0b2f34';
      ctx.fillRect(0, 0, 1024, 72);
      ['#e86a5c', '#e3b25b', '#34d399'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(36 + i * 30, 36, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      rr(ctx, 140, 16, stage === 3 ? 700 : 850, 40, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.fillStyle = '#dcebea';
      ctx.font = `500 23px ${SANS}`;
      ctx.fillText('hotel.jattamkommerce.com/restaurant/your-name', 162, 44);
      if (stage === 3) {
        rr(ctx, 862, 16, 138, 40, 20);
        ctx.fillStyle = '#34d399';
        ctx.fill();
        ctx.fillStyle = '#04261c';
        ctx.font = `800 22px ${SANS}`;
        ctx.fillText('● LIVE', 890, 44);
      }
      if (stage === 0) {
        ctx.fillStyle = '#0b2f34';
        ctx.font = `500 50px ${SERIF}`;
        ctx.fillText('Choose your website design', 60, 156);
        ['#c69238', '#0f6f74', '#8a2f3d'].forEach((color, i) => {
          const x = 60 + i * 312;
          rr(ctx, x, 210, 280, 400, 22);
          ctx.fillStyle = '#fff';
          ctx.fill();
          if (i === 1) {
            ctx.strokeStyle = '#e3b25b';
            ctx.lineWidth = 9;
            ctx.stroke();
          }
          rr(ctx, x + 16, 226, 248, 150, 14);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#d9d2c2';
          for (let k = 0; k < 4; k++) {
            rr(ctx, x + 16, 404 + k * 40, 248 - (k % 2) * 80, 16, 8);
            ctx.fill();
          }
          if (i === 1) {
            ctx.fillStyle = '#e3b25b';
            ctx.beginPath();
            ctx.arc(x + 250, 236, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#041a1e';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x + 238, 237);
            ctx.lineTo(x + 247, 247);
            ctx.lineTo(x + 263, 227);
            ctx.stroke();
          }
        });
      } else {
        // site header + banner
        ctx.fillStyle = '#0f6f74';
        ctx.beginPath();
        ctx.arc(74, 122, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b2f34';
        ctx.font = `600 36px ${SERIF}`;
        ctx.fillText('Your Restaurant', 116, 135);
        ctx.fillStyle = '#b9b09c';
        for (let i = 0; i < 3; i++) {
          rr(ctx, 700 + i * 100, 112, 76, 18, 9);
          ctx.fill();
        }
        const g = ctx.createLinearGradient(40, 0, 984, 0);
        g.addColorStop(0, '#0b2f34');
        g.addColorStop(1, '#14777c');
        rr(ctx, 40, 172, 944, 220, 26);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = '#f6efe1';
        ctx.font = `500 62px ${SERIF}`;
        ctx.fillText('Order online', 84, 278);
        rr(ctx, 84, 310, 220, 54, 27);
        ctx.fillStyle = '#e3b25b';
        ctx.fill();
        ctx.fillStyle = '#1a1204';
        ctx.font = `700 25px ${SANS}`;
        ctx.fillText('View the menu', 108, 346);
        ctx.fillStyle = 'rgba(227,178,91,0.9)';
        ctx.beginPath();
        ctx.arc(820, 282, 82, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f6efe1';
        ctx.beginPath();
        ctx.arc(820, 282, 58, 0, Math.PI * 2);
        ctx.fill();
        if (stage >= 2) {
          ['#e8a23d', '#c8553d', '#7fb069'].forEach((color, i) => {
            const x = 40 + i * 320;
            rr(ctx, x, 416, 304, 176, 22);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x + 70, 504, 46, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cfc7b4';
            rr(ctx, x + 136, 452, 140, 18, 9);
            ctx.fill();
            rr(ctx, x + 136, 486, 96, 14, 7);
            ctx.fill();
            rr(ctx, x + 136, 522, 104, 40, 20);
            ctx.fillStyle = '#e3b25b';
            ctx.fill();
            ctx.fillStyle = '#1a1204';
            ctx.font = `700 22px ${SANS}`;
            ctx.fillText('Add  +', x + 158, 550);
          });
        }
        ctx.fillStyle = stage === 3 ? '#1f9d6b' : '#e9e2d0';
        ctx.fillRect(0, 618, 1024, 86);
        if (stage === 3) {
          ctx.fillStyle = '#fff';
          ctx.font = `700 34px ${SANS}`;
          ctx.fillText('✓  Published. Customers can order now.', 60, 673);
        } else {
          ctx.fillStyle = '#7d7666';
          ctx.font = `600 30px ${SANS}`;
          ctx.fillText('Draft', 60, 672);
          rr(ctx, 720, 634, 250, 54, 27);
          ctx.fillStyle = '#0f6f74';
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `700 26px ${SANS}`;
          ctx.fillText('Publish website', 752, 670);
        }
      }
    }
    devTex.needsUpdate = true;
  };
  drawDevice('site', 3);
  redraws.push(() => drawDevice(devKey.replace(/\d$/, ''), Number(devKey.slice(-1)), true));
  const deviceGlow = halo(0, 0, 0.5, 6.5, 0x5eead4, 0.1, device);

  const lblReadyToGo = makeLabel('Restaurant is set up', { h: 0.7 });
  lblReadyToGo.position.set(0, 5.6, RF);
  const lblNewOrder = makeLabel('New order received', { h: 1.05 });
  lblNewOrder.position.set(0, 5.9, RF);
  const orderRings = [pulseRing(0, 3.2, RF + 0.4, 0xffc45e), pulseRing(0, 3.2, RF + 0.4, 0xffc45e)];
  const lblRider = makeLabel('Rider assigned', { h: 0.95 });
  lblRider.position.set(2.6, 2.9, RF + 2.2);

  // ───────────────────────── customer's house ─────────────────────────
  const HX = 15.5;
  const house = group(HX, 0, -0.5);
  box(3.6, 2.4, 3.4, M.house, 0, 1.2, 0, house);
  {
    const roof = add(new THREE.ConeGeometry(3.0, 1.5, 4), M.wine, 0, 3.15, 0, house);
    roof.rotation.y = Math.PI / 4;
  }
  box(0.4, 0.9, 0.4, M.wine, 1.0, 3.1, -0.6, house);
  box(0.75, 1.3, 0.06, M.wood, -0.7, 0.65, 1.71, house);
  glowing(box(0.9, 0.8, 0.06, M.warm, 0.75, 1.3, 1.71, house));
  glowing(box(0.06, 0.8, 0.9, M.warm, -1.81, 1.3, 0.2, house));
  box(1.2, 0.1, 0.6, M.cream, -0.7, 0.05, 2.0, house);
  halo(0.75, 1.3, 2.3, 3.2, 0xffb95e, 0.14, house);
  const customer = figure(M.customer, { arms: 'fwd', legMat: M.navy });
  customer.position.set(HX - 1.9, 0, 2.6);
  customer.rotation.y = -0.5;
  const phone = glowing(box(0.09, 0.16, 0.015, M.tealLine, 0.185, 0.8, 0.27, customer));
  phone.rotation.x = -0.5;
  const phoneGlow = halo(0.185, 0.8, 0.33, 0.9, 0x5eead4, 0.3, customer);
  const lblOrdered = makeLabel('Orders on your website', { accent: TEAL, h: 1.0 });
  lblOrdered.position.set(HX - 1.9, 2.6, 2.9);
  const lblDelivered = makeLabel('Delivered', { accent: GREEN, h: 1.0 });
  lblDelivered.position.set(HX - 0.6, 2.7, 2.6);
  const pin = group(HX, 5.0, -0.5);
  pin.scale.setScalar(0.62);
  ball(0.42, M.gold, 0, 0.5, 0, pin);
  add(new THREE.ConeGeometry(0.34, 0.75, 16), M.gold, 0, -0.05, 0, pin).rotation.x = Math.PI;
  ball(0.16, M.dark, 0, 0.5, 0.3, pin);
  halo(0, 0.4, 0, 3, 0xffc266, 0.25, pin);

  // the order travelling from the customer to the restaurant
  const ORDER_FROM = new V3(HX - 1.75, 1.2, 2.8);
  const ORDER_VIA = new V3(7.6, 10.5, 2.4);
  const ORDER_TO = new V3(0, 3.2, RF + 0.4);
  const orderMat = lightMat(1.9, 1.25, 0.45);
  const orb = glowing(ball(0.3, orderMat, 0, 0, 0));
  const orbGlow = halo(0, 0, 0, 3.0, 0xffc266, 0.65);
  const orbTrail = Array.from({ length: 9 }, (_, i) => glowing(ball(0.17 - i * 0.014, orderMat, 0, 0, 0)));

  // ───────────────────────── delivery ─────────────────────────
  const route = new THREE.CatmullRomCurve3([
    new V3(2.4, 0, RF + 1.9),
    new V3(3.4, 0, 5.4),
    new V3(5.6, 0, ROAD_Z),
    new V3(10.6, 0, ROAD_Z),
    new V3(12.8, 0, 5.4),
    new V3(HX - 1.0, 0, 3.7),
  ], false, 'catmullrom', 0.35);
  const ROUTE_DOTS = 34;
  const routeDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), ROUTE_DOTS);
  {
    const o = new THREE.Object3D();
    const p = new V3();
    for (let i = 0; i < ROUTE_DOTS; i++) {
      route.getPointAt(i / (ROUTE_DOTS - 1), p);
      o.position.set(p.x, 0.07, p.z);
      o.updateMatrix();
      routeDots.setMatrixAt(i, o.matrix);
      routeDots.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    world.add(routeDots);
  }
  const scooter = group(0, 0, 0);
  {
    const s = group(0, 0, 0, scooter);
    s.scale.setScalar(1.55);
    box(0.62, 0.1, 0.2, M.teal, 0, 0.2, 0, s);
    box(0.1, 0.42, 0.2, M.teal, 0.3, 0.4, 0, s).rotation.z = -0.25;
    box(0.04, 0.04, 0.42, M.dark, 0.36, 0.62, 0, s);
    box(0.3, 0.07, 0.2, M.dark, -0.12, 0.34, 0, s);
    box(0.3, 0.28, 0.28, M.gold, -0.36, 0.5, 0, s);
    const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14);
    wheelGeo.rotateX(Math.PI / 2);
    add(wheelGeo, M.dark, 0.34, 0.11, 0, s);
    add(wheelGeo, M.dark, -0.3, 0.11, 0, s);
    const rider = figure(M.cloth3, { seated: true, arms: 'fwd', hat: 'helmet', parent: s });
    rider.scale.setScalar(0.74);
    rider.position.set(-0.1, 0.13, 0);
    rider.rotation.y = Math.PI / 2;
    glowing(ball(0.045, M.warm, 0.4, 0.5, 0, s));
    glowing(ball(0.03, M.red, -0.52, 0.42, 0, s));
    halo(0.55, 0.45, 0, 1.2, 0xffe0a0, 0.35, s);
  }
  const headlight = new THREE.PointLight(0xffd9a0, 3, 6, 2);
  headlight.position.set(1.1, 0.6, 0);
  scooter.add(headlight);
  const parcel = box(0.34, 0.3, 0.34, M.cream, 0, 0, 0);
  box(0.36, 0.06, 0.08, M.gold, 0, 0, 0, parcel);
  const DOORSTEP = new V3(HX - 0.7, 0.26, 1.55);
  const lblTracking = makeLabel('Customer tracks it live', { accent: TEAL, h: 0.95 });

  // ───────────────────────── palms, lamps, fireflies ─────────────────────────
  const leafGeo = new THREE.ConeGeometry(0.17, 1.7, 4);
  leafGeo.translate(0, 0.85, 0);
  leafGeo.scale(1, 1, 0.28);
  const palms = [];
  const palm = (x, z, h, lean) => {
    const g = group(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(lean * 0.15, h * 0.6, 0), new V3(lean, h, 0));
    add(new THREE.TubeGeometry(curve, 10, 0.09, 6), M.trunk, 0, 0, 0, g);
    const crown = group(lean, h, 0, g);
    for (let i = 0; i < 9; i++) {
      const pivot = group(0, 0, 0, crown);
      pivot.rotation.y = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
      add(leafGeo, M.leaf, 0, 0, 0, pivot).rotation.z = -(Math.PI / 2 + 0.2 + Math.random() * 0.45);
    }
    palms.push({ crown, phase: Math.random() * 6 });
  };
  palm(-13.4, -3.6, 3.8, 0.5);
  // open land beyond the last neighbour on the left
  for (const [x, z, h] of [[-47, -5, 4.2], [-55, -15, 3.6], [-63, -4, 3.9], [-52, -27, 4.4], [-72, -12, 3.5], [-66, -30, 4.1], [-82, -22, 3.8]]) palm(x, z, h, 0.5);
  palm(4.6, -4.6, 4.3, 0.6);
  palm(9.6, -3.6, 3.5, 0.45);
  palm(11.9, -2.9, 4.0, 0.55);
  palm(19.0, -2.6, 3.6, 0.5);
  palm(18.6, 3.4, 3.2, 0.4);
  palm(9.4, 2.3, 3.0, 0.4);
  for (let i = 0; i < 6; i++) {
    const x = -12.5 + i * 6.1;
    cyl(0.03, 0.045, 2.6, M.dark, x, 1.3, -5.6, world, 6);
    glowing(ball(0.13, M.warm, x, 2.65, -5.6));
    halo(x, 2.65, -5.6, 2.6, 0xffc266, 0.4);
  }
  for (let i = 0; i < 44; i++) {
    const x = -59.25 + i * 2.75;
    glowing(ball(0.07, M.warm, x, 0.1, 8.1));
    halo(x, 0.14, 8.1, 0.8, 0xffc266, 0.3);
  }

  const FLY = lowPower ? 90 : 200;
  const flyPos = new Float32Array(FLY * 3);
  const flySeed = new Float32Array(FLY * 3);
  for (let i = 0; i < FLY; i++) {
    flyPos[i * 3] = CX + (Math.random() - 0.5) * 40;
    flyPos[i * 3 + 1] = Math.random() * 11;
    flyPos[i * 3 + 2] = CZ + (Math.random() - 0.5) * 20;
    flySeed[i * 3] = Math.random() * 6.28;
    flySeed[i * 3 + 1] = 0.12 + Math.random() * 0.3;
    flySeed[i * 3 + 2] = 0.3 + Math.random() * 0.8;
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  world.add(new THREE.Points(flyGeo, new THREE.PointsMaterial({
    map: glow, color: new THREE.Color(1.8, 1.3, 0.6), size: 0.16, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));

  // ───────────────────────── lights ─────────────────────────
  scene.add(new THREE.HemisphereLight(0xa9c8f0, 0x36504c, 1.45));
  const moonLight = new THREE.DirectionalLight(0xffb880, 2.7);
  moonLight.position.set(CX - 15, 11, 14);
  moonLight.target.position.set(CX, 0, 0);
  scene.add(moonLight.target);
  moonLight.castShadow = !lowPower;
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -22, right: 22, top: 16, bottom: -16, near: 1, far: 60 });
  moonLight.shadow.bias = -0.0005;
  moonLight.shadow.normalBias = 0.04;
  scene.add(moonLight);
  const rimLight = new THREE.DirectionalLight(0x4fd1c5, 0.9);
  rimLight.position.set(18, 6, -12);
  scene.add(rimLight);
  const point = (color, power, range, x, y, z) => {
    const l = new THREE.PointLight(color, power, range, 2);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  };
  const frontLight = point(0xffb866, 9, 12, 0, 1.6, RF + 2.2);
  point(0xffb866, 5, 9, HX - 0.6, 1.6, 2.6);
  const roomLights = [point(0xffc27a, 9, 11, DX + 1.2, 2.7, 0.8), point(0xffc27a, 7, 10, DX - 2.2, 2.7, -0.6)];
  
  // ───────────────────────── post-processing ─────────────────────────
  let composer = null;
  if (!lowPower) {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.2, 0.5, 1.08));
    composer.addPass(new OutputPass());
  }

  // ───────────────────────── state ─────────────────────────
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let width = 1;
  let height = 1;
  let raf = 0;
  let disposed = false;
  let ready = false;
  let elapsed = 0;
  let active = 0;
  let stopTime = 0;
  let lastPhaseKey = '';
  let shiftNow = STOPS[0].shift;
  let liftNow = 0;
  let followX = 0;
  let scooterHeading = 0;
  // how "built" each part of the restaurant is (0 = not there yet, 1 = finished)
  const built = { body: 1, roof: 1, front: 1, dining: 1, lights: 1 };
  const clock = new THREE.Clock();
  const lookNow = new V3(...STOPS[0].look);
  const wantPos = new V3();
  const wantLook = new V3();
  const tmpA = new V3();
  const tmpB = new V3();
  const tmpC = new V3();
  const tmpColor = new THREE.Color();
  const WIN_OFF = new THREE.Color(0.05, 0.11, 0.13);
  const WIN_ON = new THREE.Color(1.08, 0.62, 0.2);
  const DOT_OFF = new THREE.Color(0.1, 0.24, 0.26);
  const DOT_ON = new THREE.Color(0.3, 1.6, 1.4);
  const UP = new V3(0, 1, 0);
  const scooterPos = new V3();

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const sampleStops = (t) => {
    const max = STOPS.length - 1;
    const c = Math.min(max, Math.max(0, t));
    const i = Math.min(max - 1, Math.floor(c));
    const f = smooth(0.14, 0.86, c - i);
    const a = STOPS[i];
    const b = STOPS[i + 1];
    wantPos.set(...a.pos).lerp(tmpA.set(...b.pos), f);
    wantLook.set(...a.look).lerp(tmpA.set(...b.look), f);
    return a.shift + (b.shift - a.shift) * f;
  };

  // ── 1 · onboarding: the checklist fills in and the restaurant builds itself ──
  const playOnboarding = (on, t) => {
    const target = on
      ? { body: t > 1.3 ? 1 : 0, roof: t > 2.5 ? 1 : 0, front: t > 3.6 ? 1 : 0, dining: t > 5.2 ? 1 : 0, lights: t > 7.2 ? 1 : 0 }
      : null;
    return { target, ticks: on ? (t > 1.2) + (t > 3.2) + (t > 5.0) + (t > 7.0) : 4, label: on ? span(t, 7.6, 10.6) : 0 };
  };

  // ── 4 · delivery: the rider goes out, drops the parcel, comes back ──
  const playDelivery = (on, t, dt, say) => {
    const out = on ? smooth(1.5, 6, t) : 0;
    const u = on && t > 7 ? 1 - smooth(8, 11.5, t) : out;
    route.getPointAt(clamp01(u), scooterPos);
    route.getTangentAt(clamp01(u), tmpA);
    const forward = !(on && t > 7.4);
    const heading = Math.atan2(forward ? -tmpA.z : tmpA.z, forward ? tmpA.x : -tmpA.x);
    let d = heading - scooterHeading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    scooterHeading += d * Math.min(1, dt * 7);
    scooter.position.copy(scooterPos);
    scooter.rotation.y = scooterHeading;
    const lit = on && t < 11.4 ? out : 0;
    routeDots.visible = on;
    scooter.visible = active !== 1 && active !== 2;
    for (let i = 0; i < ROUTE_DOTS; i++) {
      const k = clamp01((lit * (ROUTE_DOTS - 1) - i) * 0.6 + 0.5);
      routeDots.setColorAt(i, tmpColor.copy(DOT_OFF).lerp(DOT_ON, lit > 0 ? k : 0));
    }
    routeDots.instanceColor.needsUpdate = true;
    // parcel hops from the scooter to the doorstep
    const drop = on ? smooth(6.0, 6.8, t) : 0;
    parcel.visible = on && t > 6 && t < 11.2;
    if (parcel.visible) {
      tmpA.copy(scooterPos).setY(0.95);
      tmpB.copy(tmpA).lerp(DOORSTEP, 0.5).setY(2.2);
      bezier(parcel.position, tmpA, tmpB, DOORSTEP, drop);
    }
    showLabel(lblRider, on && say ? span(t, 0.2, 2.0) : 0);
    showLabel(lblDelivered, on && say ? span(t, 6.7, 9.8) : 0);
    showLabel(lblTracking, on && say ? span(t, 2.2, 5.7) : 0);
    lblTracking.position.set(scooterPos.x, 2.6, scooterPos.z);
    const bounce = on ? Math.max(0, Math.sin(clamp01((t - 6.4) / 1.4) * Math.PI * 3)) * (1 - clamp01((t - 6.4) / 1.4)) : 0;
    pin.position.y = 5.0 + Math.sin(elapsed * 1.6) * 0.14 + bounce * 0.9;
    pin.rotation.y = elapsed * 0.8;
    return t < 1.5 ? 0 : t < 6 ? 1 : 2;
  };

  // ── 3 · online order: flies from the customer's phone to the restaurant ──
  const playOrder = (on, t, say) => {
    const f = on ? smooth(2.0, 4.6, t) : 0;
    const flying = on && t > 2 && t < 4.75;
    orb.visible = flying;
    orbGlow.visible = flying;
    if (flying) {
      bezier(orb.position, ORDER_FROM, ORDER_VIA, ORDER_TO, f);
      orbGlow.position.copy(orb.position);
    }
    orbTrail.forEach((m, i) => {
      const ft = f - (i + 1) * 0.022;
      m.visible = flying && ft > 0;
      if (m.visible) bezier(m.position, ORDER_FROM, ORDER_VIA, ORDER_TO, ft);
    });
    const tap = on ? span(t, 0.2, 2.3) : 0;
    phoneGlow.material.opacity = 0.25 + tap * 0.55 + Math.sin(elapsed * 6) * 0.08 * tap;
    phone.scale.setScalar(1 + tap * 0.5);
    showLabel(lblOrdered, say ? tap : 0);
    showLabel(lblNewOrder, on && say ? span(t, 4.6, 7.7) : 0);
    setPulse(orderRings[0], on ? (t - 4.6) / 1.3 : 0, 6);
    setPulse(orderRings[1], on ? (t - 5.5) / 1.3 : 0, 6);
    return t < 2 ? 0 : t < 4.6 ? 1 : 2;
  };

  // ── 5 · dine-in: table order → KOT → kitchen screen → served → bill ──
  const playKot = (on, t, say) => {
    if (!on) t = 0;
    showLabel(lblTable, on && say ? span(t, 0.2, 1.9) : 0);
    setPulse(qrRing, on ? (t - 0.2) / 1.2 : 0, 1.6);
    qr.scale.setScalar(1 + (on ? span(t, 0.2, 1.6) * 0.35 : 0));
    // KOT slip flies to the kitchen screen
    const fly = smooth(1.6, 3.2, t);
    kot.visible = on && t > 1.5 && t < 3.25;
    kotGlow.visible = kot.visible;
    if (kot.visible) {
      tmpA.set(TABLE.x, 1.1, TABLE.z);
      tmpB.set(1.1, 4.3, -0.6);
      bezier(kot.position, tmpA, tmpB, KDS, fly);
      kot.rotation.set(-0.3 + fly * 0.3, fly * Math.PI * 2, Math.sin(t * 9) * 0.12);
      kot.scale.setScalar(1.7 - fly * 0.8);
      kotGlow.position.copy(kot.position);
      kotGlow.material.opacity = 0.5;
    }
    drawKds(!on ? 2 : t < 3.2 ? 0 : t < 3.9 ? 1 : t < 5.6 ? 2 : 3);
    showLabel(lblKot, on && say ? span(t, 3.2, 5.4) : 0);
    showLabel(lblReady, on && say ? span(t, 5.6, 7.3) : 0);
    // chef cooks
    const cooking = on ? span(t, 3.6, 5.7) : 0.35;
    chef.position.y = FY + Math.abs(Math.sin(elapsed * 5)) * 0.012 * cooking;
    chef.rotation.y = Math.sin(elapsed * 2.2) * 0.14 * cooking - 0.2;
    steam.forEach((s, i) => {
      const k = (elapsed * 0.5 + i / 3) % 1;
      s.position.y = 1.5 + k * 1.1;
      s.material.opacity = Math.sin(k * Math.PI) * 0.3 * cooking;
      s.scale.setScalar(0.4 + k * 0.6);
    });
    // waiter: table → pass, then carries the plate back
    const toPass = smooth(1.7, 3.2, t);
    const toTable = smooth(6.0, 7.7, t);
    const w = toPass - toTable;
    waiter.position.copy(WAITER_AT_TABLE).lerp(WAITER_AT_PASS, w);
    waiter.position.y = FY + Math.abs(Math.sin(t * 9)) * 0.018 * (toPass > 0 && toPass < 1 || (toTable > 0 && toTable < 1) ? 1 : 0);
    waiter.rotation.y = toTable > 0 && toTable < 1 ? 0 : toPass > 0 && w > 0.02 ? Math.PI : 0;
    plate.visible = on && t >= 5.6;
    if (plate.visible) {
      if (t < 6.0) plate.position.copy(PASS);
      else if (toTable < 1) plate.position.set(waiter.position.x, FY + 0.79, waiter.position.z + 0.3);
      else plate.position.set(TABLE.x, FY + 0.63, TABLE.z - 0.1);
      plate.scale.setScalar(t < 6 ? backOut((t - 5.6) / 0.4) : 1);
    }
    // bill
    const print = on ? smooth(7.9, 8.8, t) * (1 - smooth(10.5, 10.9, t)) : 0;
    receipt.visible = print > 0.01;
    receipt.scale.y = Math.max(0.001, print * 0.5);
    receipt.position.y = FY + 1.17 + print * 0.25;
    showLabel(lblBill, on && say ? span(t, 8.5, 10.7) : 0);
    cashier.rotation.y = on && t > 7.8 ? Math.sin(elapsed * 2.5) * 0.12 : 0;
    return t < 1.6 ? 0 : t < 3.4 ? 1 : t < 7.8 ? 2 : 3;
  };

  const frame = () => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    if (!reducedMotion) elapsed += dt;
    const intro = reducedMotion ? 1 : smooth(0.2, 3.0, clock.elapsedTime);

    // which stop are we at, and how long have we been there
    const nearest = Math.min(STOPS.length - 1, Math.max(0, Math.round(progress)));
    if (nearest !== active) {
      active = nearest;
      stopTime = 0;
    }
    stopTime += reducedMotion ? 0 : dt;
    const period = PERIOD[active] || 1;
    // with reduced motion every stop simply shows its finished picture
    const t = reducedMotion ? period * 0.86 : stopTime % period;
    const overview = active === 0 || active === 6;

    // 1 · onboarding
    const ob = playOnboarding(active === 1, t);
    const k = 1 - Math.exp(-dt * 4.2);
    for (const key in built) built[key] += ((ob.target ? ob.target[key] : 1) - built[key]) * (reducedMotion ? 1 : k);
    if (reducedMotion) for (const key in built) built[key] = 1;
    bodyG.scale.y = Math.max(0.001, built.body);
    bodyG.visible = built.body > 0.005;
    roofG.visible = built.roof > 0.01;
    roofG.position.y = (1 - built.roof) * 7;
    frontG.visible = built.front > 0.01;
    frontG.scale.setScalar(Math.max(0.001, backOut(built.front)));
    dining.visible = built.dining > 0.01;
    dining.scale.setScalar(Math.max(0.001, backOut(built.dining)));
    const lights = built.lights * (0.25 + 0.75 * intro);
    M.win.color.copy(WIN_OFF).lerp(WIN_ON, lights);
    sign.material.color.setRGB(0.35 + 1.25 * lights, 0.32 + 1.0 * lights, 0.26 + 0.55 * lights);
    signGlow.material.opacity = 0.2 * lights * built.roof;
    frontGlow.material.opacity = 0.14 * lights * built.front;
    frontLight.intensity = 6 * lights * built.front;
    roomLights[0].intensity = 20 * built.dining;
    roomLights[1].intensity = 15 * built.dining;
    plot.material = active === 1 && built.body < 0.5 ? M.goldLine : M.cream;
    showLabel(lblReadyToGo, ob.label);

    // 2 · website
    let phase = -1;
    if (active === 1) {
      drawDevice('onboard', ob.ticks);
      phase = t < 1.2 ? 0 : t < 5.0 ? 1 : t < 7.0 ? 2 : 3;
    } else if (active === 2) {
      const stage = t < 2.6 ? 0 : t < 4.2 ? 1 : t < 5.8 ? 2 : 3;
      drawDevice('site', stage);
      phase = t < 2.6 ? 0 : t < 5.8 ? 1 : 2;
    } else {
      drawDevice('site', 3);
    }
    const publish = active === 2 ? t : -1;
    showLabel(lblLive, active === 2 ? span(t, 6.0, 9.7) : 0);
    setPulse(deviceRings[0], publish >= 0 ? (publish - 5.8) / 1.4 : 0, 8);
    setPulse(deviceRings[1], publish >= 0 ? (publish - 6.7) / 1.4 : 0, 8);
    device.position.y = 3.0 + Math.sin(elapsed * 1.1) * 0.07;
    device.scale.setScalar(1 + (active === 2 ? Math.sin(clamp01((t - 5.8) / 0.6) * Math.PI) * 0.06 : 0));
    deviceGlow.material.opacity = 0.1 + (active === 2 ? smooth(5.8, 6.4, t) * 0.12 : 0);

    // 3, 4, 5 · on the overview they all run together, each on its own clock
    const p3 = playOrder(active === 3 || overview, overview ? elapsed % PERIOD[3] : t, !overview);
    const p4 = playDelivery(active === 4 || overview, overview ? (elapsed + 4) % PERIOD[4] : t, dt, !overview);
    const p5 = playKot(active === 5 || overview, overview ? (elapsed + 2) % PERIOD[5] : t, !overview);
    if (active === 3) phase = p3;
    if (active === 4) phase = p4;
    if (active === 5) phase = p5;
    const phaseKey = `${active}:${phase}`;
    if (phaseKey !== lastPhaseKey) {
      lastPhaseKey = phaseKey;
      if (onPhase) onPhase(active, phase);
    }

    // camera
    const shift = sampleStops(progress);
    const near4 = clamp01(1 - Math.abs(progress - 4) * 1.3);
    followX += ((scooterPos.x - 8.5) * 0.22 * near4 - followX) * (1 - Math.exp(-dt * 2.2));
    wantPos.x += followX;
    wantLook.x += followX;
    // step back on tall, narrow screens so the scene still fits
    const narrow = Math.max(0, 1.3 - camera.aspect);
    if (narrow > 0) wantPos.sub(wantLook).multiplyScalar(1 + narrow * 1.1).add(wantLook);
    if (intro < 1) {
      const outK = 1 - intro;
      wantPos.x += outK * 8;
      wantPos.y += outK * 6;
      wantPos.z += outK * 10;
    }
    tmpC.copy(wantLook).sub(wantPos).cross(UP).normalize();
    wantPos.addScaledVector(tmpC, pointerX * 0.8);
    wantPos.y += pointerY * 0.45;

    const ease = reducedMotion || !ready ? 1 : 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(wantPos, ease);
    lookNow.lerp(wantLook, ease);
    camera.lookAt(lookNow);
    const portrait = camera.aspect < 1.1;
    shiftNow += ((portrait ? 0 : shift) - shiftNow) * ease;
    // on phones the text sits at the bottom, so lift the scene into the top half
    // (on the first screen the text is on top, so there the scene drops into the lower part)
    liftNow += ((!portrait || active === 6 ? 0 : active === 0 ? -0.3 : 0.17) - liftNow) * ease;
    camera.setViewOffset(width, height, -shiftNow * width, liftNow * height, width, height);

    // ambient life
    for (const p of palms) p.crown.rotation.z = Math.sin(elapsed * 0.9 + p.phase) * 0.05;
    for (let i = 0; i < FLY; i++) {
      const j = i * 3;
      flyPos[j + 1] += flySeed[j + 1] * dt * (reducedMotion ? 0 : 1);
      flyPos[j] += Math.sin(elapsed * flySeed[j + 2] + flySeed[j]) * dt * 0.25;
      if (flyPos[j + 1] > 11.5) flyPos[j + 1] = 0.2;
    }
    flyGeo.attributes.position.needsUpdate = true;

    if (composer) composer.render();
    else renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  };

  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !disposed) {
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  sampleStops(0);
  camera.position.copy(wantPos);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  // text on the in-scene screens and labels is drawn again once the web fonts have loaded
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!disposed) redraws.forEach((draw) => draw());
    });
  }
  raf = requestAnimationFrame(frame);

  return {
    setProgress(t) { progress = t; },
    setPointer(x, y) { pointerX = x; pointerY = y; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      if (composer) composer.dispose();
      renderer.dispose();
    },
  };
}
