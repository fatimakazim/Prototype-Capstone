// /**
//  * hologram.js — Saidpur Village VR · Holographic Hotspot System
//  * ==============================================================
//  * Load via <script src="hologram.js"> BEFORE <a-scene>.
//  *
//  * Registers one primary A-Frame component:
//  *
//  *   hologram-video
//  *     Large holographic display driven by a live <video> texture.
//  *     GLSL ShaderMaterial with: scanlines, chromatic aberration,
//  *     rim glow, vertex wobble, flicker, edge bloom, vignette.
//  *     Surrounded by chrome orbital rings, a conical projection
//  *     beam, and an orbiting particle field. Audio is played from
//  *     a CSS <audio> element so it works outside of A-Frame's
//  *     positional audio system and avoids autoplay blocks.
//  *     A radial-gradient CSS div overlays the canvas for a 2-D
//  *     glow bloom that extends past the mesh edges.
//  */

// /* ─────────────────────────────────────────────────────────────────────────
//    GLSL SHADERS
//    ───────────────────────────────────────────────────────────────────────── */
// const HOLO_VERT = /* glsl */`
//   varying vec2  vUv;
//   varying vec3  vNormal;
//   varying vec3  vWorldPos;
//   varying vec3  vViewDir;
//   uniform float uTime;
//   uniform float uWobble;

//   void main () {
//     vUv     = uv;
//     vNormal = normalize(normalMatrix * normal);

//     /* ripple vertices along normal — hologram shimmer */
//     vec3 p  = position + normal
//               * sin(uTime * 1.9 + position.y * 9.0 + position.x * 4.0)
//               * uWobble;

//     vec4 world = modelMatrix * vec4(p, 1.0);
//     vWorldPos  = world.xyz;
//     vViewDir   = normalize(cameraPosition - world.xyz);
//     gl_Position = projectionMatrix * viewMatrix * world;
//   }
// `;

// const HOLO_FRAG = /* glsl */`
//   precision highp float;

//   uniform sampler2D uTex;
//   uniform float     uTime;
//   uniform vec3      uColor;
//   uniform float     uOpacity;
//   uniform float     uScanDensity;
//   uniform float     uScanAmt;
//   uniform float     uScanSpeed;
//   uniform float     uFlicker;
//   uniform float     uFlickerHz;
//   uniform float     uAberration;
//   uniform float     uGlowEdge;
//   uniform float     uVignette;
//   uniform float     uRimPow;
//   uniform int       uHasVideo;

//   varying vec2  vUv;
//   varying vec3  vNormal;
//   varying vec3  vViewDir;

//   float hash (float n) { return fract(sin(n) * 43758.5453); }

//   float scanlines (float y) {
//     float line = sin((y + uTime * uScanSpeed) * uScanDensity * 6.28318);
//     return 1.0 - uScanAmt * (line * 0.5 + 0.5);
//   }

//   float edgeMask (vec2 uv) {
//     float r = uGlowEdge;
//     vec2  d = smoothstep(vec2(0.0), vec2(r), uv)
//             * (1.0 - smoothstep(vec2(1.0 - r), vec2(1.0), uv));
//     return d.x * d.y;
//   }

//   float vigAmt (vec2 uv) {
//     vec2 c = uv - 0.5;
//     return 1.0 - uVignette * dot(c, c) * 4.0;
//   }

//   vec3 holoGrid (vec2 uv) {
//     float gx    = step(0.955, fract(uv.x * 16.0));
//     float gy    = step(0.955, fract(uv.y * 10.0));
//     float grid  = max(gx, gy);
//     float sweep = smoothstep(0.0, 0.08,
//                     fract(uv.x * 0.28 - uv.y * 0.18 + uTime * 0.14));
//     return uColor * (0.08 + 0.72 * grid + 0.28 * sweep);
//   }

//   void main () {
//     /* chromatic aberration */
//     float ab = uAberration;
//     vec4 cR  = texture2D(uTex, vUv + vec2( ab,  ab * 0.45));
//     vec4 cG  = texture2D(uTex, vUv);
//     vec4 cB  = texture2D(uTex, vUv + vec2(-ab, -ab * 0.45));
//     vec3 vid = vec3(cR.r, cG.g, cB.b);

//     vec3 base = (uHasVideo == 1) ? vid : holoGrid(vUv);

//     /* tint */
//     vec3 holo = mix(base, uColor * base, 0.55);
//     holo += uColor * 0.04;

//     /* rim glow */
//     float rim = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
//     holo += uColor * pow(rim, uRimPow) * 0.65;

//     /* scanlines */
//     holo *= scanlines(vUv.y);

//     /* flicker */
//     holo *= 1.0 - uFlicker * hash(floor(uTime * uFlickerHz) + 0.51);

//     /* edge glow fringe */
//     float mask = edgeMask(vUv);
//     holo += uColor * (1.0 - mask) * 0.40;

//     /* vignette */
//     holo *= vigAmt(vUv);

//     float alpha = cG.a * mask * uOpacity;
//     alpha = max(alpha, (1.0 - mask) * 0.14 * uOpacity);

//     gl_FragColor = vec4(holo, alpha);
//   }
// `;

// /* ─────────────────────────────────────────────────────────────────────────
//    Helpers
//    ───────────────────────────────────────────────────────────────────────── */
// function buildHoloMat (col, tex) {
//   return new THREE.ShaderMaterial({
//     uniforms: {
//       uTex:         { value: tex || new THREE.Texture() },
//       uTime:        { value: 0 },
//       uColor:       { value: col },
//       uOpacity:     { value: 0.94 },
//       uScanDensity: { value: 55 },
//       uScanAmt:     { value: 0.28 },
//       uScanSpeed:   { value: 0.20 },
//       uFlicker:     { value: 0.07 },
//       uFlickerHz:   { value: 3.5 },
//       uAberration:  { value: 0.007 },
//       uGlowEdge:    { value: 0.065 },
//       uVignette:    { value: 0.40 },
//       uRimPow:      { value: 1.9 },
//       uWobble:      { value: 0.0016 },
//       uHasVideo:    { value: tex ? 1 : 0 },
//     },
//     vertexShader:   HOLO_VERT,
//     fragmentShader: HOLO_FRAG,
//     transparent:    true,
//     side:           THREE.DoubleSide,
//     depthWrite:     false,
//     blending:       THREE.AdditiveBlending,
//   });
// }

// function buildRing (rx, ry, segs, col, opacity) {
//   const pts = [];
//   for (let i = 0; i <= segs; i++) {
//     const a = (i / segs) * Math.PI * 2;
//     pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0));
//   }
//   const geo = new THREE.BufferGeometry().setFromPoints(pts);
//   const mat = new THREE.LineBasicMaterial({
//     color: col, transparent: true, opacity,
//     blending: THREE.AdditiveBlending, depthWrite: false,
//   });
//   return new THREE.Line(geo, mat);
// }

// /* ─────────────────────────────────────────────────────────────────────────
//    COMPONENT: hologram-video
//    ───────────────────────────────────────────────────────────────────────── */
// AFRAME.registerComponent('hologram-video', {
//   schema: {
//     videoSrc: { type: 'string',  default: '' },   /* CSS selector */
//     audioSrc: { type: 'string',  default: '' },   /* CSS selector */
//     color:    { type: 'color',   default: '#50ffcc' },
//     width:    { type: 'number',  default: 1.8 },
//     height:   { type: 'number',  default: 1.0 },
//     volume:   { type: 'number',  default: 0.9 },
//     autoplay: { type: 'boolean', default: true  },
//   },

//   init () {
//     this._t      = 0;
//     this._rings  = [];
//     this._parts  = [];
//     this._bloom  = null;

//     const d   = this.data;
//     const col = new THREE.Color(d.color);
//     const hi  = col.clone().multiplyScalar(1.7);

//     /* ── Video texture ── */
//     let tex = null;
//     this._vidEl = null;
//     if (d.videoSrc) {
//       const v = document.querySelector(d.videoSrc);
//       if (v && v.tagName === 'VIDEO') {
//         tex = new THREE.VideoTexture(v);
//         tex.minFilter = THREE.LinearFilter;
//         tex.magFilter = THREE.LinearFilter;
//         tex.format    = THREE.RGBAFormat;
//         this._vidEl   = v;
//         this._vidTex  = tex;
//         if (d.autoplay) {
//           v.loop  = true;
//           v.muted = false;
//           v.volume = d.volume;
//           v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
//         }
//       }
//     }

//     /* ── Main screen ── */
//     this._mat    = buildHoloMat(col, tex);
//     const segs   = 14;
//     this._screen = new THREE.Mesh(
//       new THREE.PlaneGeometry(d.width, d.height, segs, segs),
//       this._mat
//     );
//     this.el.object3D.add(this._screen);

//     /* ── Corner brackets ── */
//     const bw = d.width * 0.14, bh = d.height * 0.16;
//     const hw = d.width  / 2 + 0.03;
//     const hh = d.height / 2 + 0.03;
//     [[-hw,hh],[hw,hh],[-hw,-hh],[hw,-hh]].forEach(([cx,cy]) => {
//       const sx = cx < 0 ? 1 : -1;
//       const sy = cy < 0 ? 1 : -1;
//       const pts = [
//         new THREE.Vector3(cx + sx * bw, cy, 0),
//         new THREE.Vector3(cx, cy, 0),
//         new THREE.Vector3(cx, cy + sy * bh, 0),
//       ];
//       const g = new THREE.BufferGeometry().setFromPoints(pts);
//       const m = new THREE.LineBasicMaterial({
//         color: hi, transparent: true, opacity: 0.9,
//         blending: THREE.AdditiveBlending, depthWrite: false,
//       });
//       this.el.object3D.add(new THREE.Line(g, m));
//     });

//     /* outer frame */
//     const frameE = new THREE.EdgesGeometry(
//       new THREE.BoxGeometry(d.width + 0.06, d.height + 0.06, 0.005)
//     );
//     const frameM = new THREE.LineBasicMaterial({
//       color: hi, transparent: true, opacity: 0.40,
//       blending: THREE.AdditiveBlending, depthWrite: false,
//     });
//     this.el.object3D.add(new THREE.LineSegments(frameE, frameM));

//     /* ── Orbital rings ── */
//     const ringDefs = [
//       { rx: d.width * 0.62, ry: d.height * 0.60, tiltX: 0,   tiltZ: 0,   speed:  0.38,  op: 0.55 },
//       { rx: d.width * 0.75, ry: d.height * 0.30, tiltX: 28,  tiltZ: 0,   speed: -0.24,  op: 0.38 },
//       { rx: d.width * 0.88, ry: d.height * 0.18, tiltX: 58,  tiltZ: 15,  speed:  0.16,  op: 0.24 },
//       { rx: d.width * 0.52, ry: d.height * 0.68, tiltX:-38,  tiltZ: -8,  speed: -0.44,  op: 0.20 },
//     ];
//     ringDefs.forEach(def => {
//       const r = buildRing(def.rx, def.ry, 96, hi, def.op);
//       r.rotation.x = THREE.MathUtils.degToRad(def.tiltX);
//       r.rotation.z = THREE.MathUtils.degToRad(def.tiltZ);
//       this.el.object3D.add(r);
//       this._rings.push({ mesh: r, speed: def.speed });
//     });

//     /* ── Projection beam (below) ── */
//     const bGeo = new THREE.CylinderGeometry(0.012, d.width * 0.52, d.height * 0.90, 16, 1, true);
//     const bMat = new THREE.MeshBasicMaterial({
//       color: col, transparent: true, opacity: 0.09,
//       side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
//     });
//     this._beam = new THREE.Mesh(bGeo, bMat);
//     this._beam.position.y = -(d.height / 2 + d.height * 0.45);
//     this.el.object3D.add(this._beam);

//     const b2Geo = new THREE.CylinderGeometry(0.006, d.width * 0.20, d.height * 1.0, 12, 1, true);
//     const b2Mat = new THREE.MeshBasicMaterial({
//       color: hi, transparent: true, opacity: 0.16,
//       side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
//     });
//     this._beam2 = new THREE.Mesh(b2Geo, b2Mat);
//     this._beam2.position.y = -(d.height / 2 + d.height * 0.50);
//     this.el.object3D.add(this._beam2);

//     /* emitter disc at beam top */
//     const discGeo = new THREE.RingGeometry(0.01, d.width * 0.10, 32);
//     const discMat = new THREE.MeshBasicMaterial({
//       color: hi, transparent: true, opacity: 0.60,
//       blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
//     });
//     const disc = new THREE.Mesh(discGeo, discMat);
//     disc.rotation.x = -Math.PI / 2;
//     disc.position.y = -(d.height / 2 + 0.012);
//     this.el.object3D.add(disc);
//     this._disc = disc;

//     /* ── Particles ── */
//     const pCount = 72;
//     const pGeo   = new THREE.PlaneGeometry(0.020, 0.020);
//     for (let i = 0; i < pCount; i++) {
//       const pMat = new THREE.MeshBasicMaterial({
//         color: hi, transparent: true, opacity: 0,
//         blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
//       });
//       const p = new THREE.Mesh(pGeo, pMat);
//       const angle = (i / pCount) * Math.PI * 2;
//       const rad   = d.width * 0.52 + Math.random() * d.width * 0.40;
//       p.position.set(
//         Math.cos(angle) * rad,
//         (Math.random() - 0.5) * d.height * 1.3,
//         (Math.random() - 0.5) * 0.15
//       );
//       p._ang  = angle;
//       p._rad  = rad;
//       p._bY   = p.position.y;
//       p._ph   = Math.random() * Math.PI * 2;
//       p._os   = (Math.random() > 0.5 ? 1 : -1) * (0.10 + Math.random() * 0.25);
//       p._bs   = 0.35 + Math.random() * 0.75;
//       this.el.object3D.add(p);
//       this._parts.push(p);
//     }

//     /* ── Audio ── */
//     this._audio = null;
//     if (d.audioSrc) {
//       const a = document.querySelector(d.audioSrc);
//       if (a) {
//         this._audio = a;
//         a.loop   = true;
//         a.volume = d.volume;
//         if (d.autoplay) a.play().catch(() => {});
//       }
//     }

//     /* ── CSS bloom div ── */
//     const bloom = document.createElement('div');
//     Object.assign(bloom.style, {
//       position:      'fixed',
//       pointerEvents: 'none',
//       zIndex:        '449',
//       borderRadius:  '50%',
//       background:    `radial-gradient(ellipse at center,
//                         ${d.color}28 0%,
//                         ${d.color}12 40%,
//                         transparent 70%)`,
//       transform:     'translate(-50%,-50%)',
//       width:  '0px', height: '0px',
//       opacity: '0',
//       transition: 'opacity 0.5s ease',
//     });
//     document.body.appendChild(bloom);
//     this._bloom = bloom;

//     /* scratch vectors for projection */
//     this._wPos = new THREE.Vector3();
//     this._ndc  = new THREE.Vector3();
//   },

//   /* ── tick ── */
//   tick (time, dt) {
//     const dts  = dt / 1000;
//     this._t   += dts;
//     const T    = this._t;

//     if (this._mat) this._mat.uniforms.uTime.value = T;
//     if (this._vidTex) this._vidTex.needsUpdate = true;

//     /* rings */
//     this._rings.forEach(r => { r.mesh.rotation.z += r.speed * dts; });

//     /* beams breathe */
//     if (this._beam)  this._beam.material.opacity  = 0.06 + 0.06 * Math.sin(T * 1.1);
//     if (this._beam2) this._beam2.material.opacity = 0.12 + 0.10 * Math.sin(T * 2.3 + 1.2);
//     if (this._disc)  this._disc.material.opacity  = 0.45 + 0.30 * Math.sin(T * 3.1);

//     /* screen float */
//     if (this._screen) this._screen.position.y = Math.sin(T * 0.75) * 0.030;

//     /* particles */
//     this._parts.forEach(p => {
//       p._ang        += p._os * dts;
//       p.position.x   = Math.cos(p._ang) * p._rad;
//       p.position.z   = Math.sin(p._ang) * p._rad * 0.22;
//       p.position.y   = p._bY + Math.sin(T * p._bs + p._ph) * 0.07;
//       p.material.opacity = (0.20 + 0.70 * (0.5 + 0.5 * Math.sin(T * 2.6 + p._ph))) * 0.80;
//     });

//     /* CSS bloom */
//     this._projectBloom();
//   },

//   _projectBloom () {
//     const scene = this.el.sceneEl;
//     if (!scene || !scene.renderer || !scene.camera) return;
//     this.el.object3D.getWorldPosition(this._wPos);
//     this._ndc.copy(this._wPos).project(scene.camera);
//     if (this._ndc.z > 1) { this._bloom.style.opacity = '0'; return; }
//     const cvs = scene.renderer.domElement;
//     const sx  = ( this._ndc.x + 1) * 0.5 * cvs.clientWidth;
//     const sy  = (-this._ndc.y + 1) * 0.5 * cvs.clientHeight;
//     const d   = this.data;
//     /* approximate projected screen size */
//     const dist  = scene.camera.position.distanceTo(this._wPos);
//     const fovRad = THREE.MathUtils.degToRad(scene.camera.fov || 80);
//     const projH = (d.height / dist) * cvs.clientHeight / (2 * Math.tan(fovRad * 0.5));
//     const projW = projH * (d.width / d.height);
//     Object.assign(this._bloom.style, {
//       left: `${sx}px`, top: `${sy}px`,
//       width:  `${projW * 3.2}px`,
//       height: `${projH * 3.2}px`,
//       opacity: '1',
//     });
//   },

//   /* public — called by main.js on scene exit */
//   pauseHolo () {
//     if (this._vidEl) this._vidEl.pause();
//     if (this._audio) this._audio.pause();
//     if (this._bloom) this._bloom.style.opacity = '0';
//   },

//   resumeHolo () {
//     if (this._vidEl) this._vidEl.play().catch(() => {});
//     if (this._audio) this._audio.play().catch(() => {});
//   },

//   remove () {
//     this.pauseHolo();
//     if (this._mat)    this._mat.dispose();
//     if (this._vidTex) this._vidTex.dispose();
//     if (this._bloom && this._bloom.parentNode)
//       this._bloom.parentNode.removeChild(this._bloom);
//     this._parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
//     this._rings.forEach(r => { r.mesh.geometry.dispose(); r.mesh.material.dispose(); });
//   },
// });

// console.log('[hologram.js] hologram-video registered');