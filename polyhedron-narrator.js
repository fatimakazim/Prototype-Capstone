/**
* polyhedron-narrator.js
* ══════════════════════════════════════════════════════════════════════════════
* A-Frame component: Polyhedron Narrator  (v4 — Guided Tour Edition)
* ──────────────────────────────────────────────────────────────────────────────
*
* Inspired by Dürer's Melencolia I — a faceted polyhedron as memory container,
* data artifact, and post-human narrator. "The memory is speaking through geometry."
*
* ── WHAT CHANGED IN v4 ────────────────────────────────────────────────────────
*
*   NEW: Spatial movement system in tick().
*     The component now smoothly lerps its world position toward
*     this.activeFocusPoint when this.isMoving === true.
*     On arrival (distance < ARRIVAL_THRESHOLD), it calls
*     this.onArrivalCallback() once, then clears it.
*     NarrationController in main.js sets these three properties:
*       comp.activeFocusPoint   — THREE.Vector3 target world position
*       comp.isMoving           — true while gliding to focus point
*       comp.onArrivalCallback  — called once on arrival (then cleared)
*
*   NEW: _isWaiting visual state.
*     When NarrationController enters WAITING_FOR_USER, it sets
*     comp._isWaiting = true. The component lerps into a softer,
*     slower visual rhythm to signal "paused, waiting for you".
*
*   NEW: _isMovingLerp visual influence.
*     While the narrator is travelling, rings spin faster, emissive
*     ramps up, particles accelerate — communicating intentional movement.
*
*   UNCHANGED from v3:
*     NarrationAudioManager, NarrationStateEngine (kept for compatibility),
*     all GLSL shaders, all geometry builders, all visual constants.
*     The component still NEVER touches audio directly.
*
* ── MOVEMENT TUNING ──────────────────────────────────────────────────────────
*   MOVE_LERP_SPEED    (0.018) — position lerp alpha; lower = smoother glide
*   ARRIVAL_THRESHOLD  (0.08)  — metres from target to count as "arrived"
*
* ── ALL OTHER TWEAK REFERENCES (unchanged) ───────────────────────────────────
*   POLY_RADIUS             (0.28)   — polyhedron base size
*   FLOAT_AMP               (0.018)  — vertical bob amplitude
*   FLOAT_HZ                (0.55)   — float cycles per second
*   ROT_SPEED_IDLE          (0.12)   — slow rotation speed (rad/s base)
*   ROT_SPEED_NEAR          (0.32)   — fast rotation when user is close
*   ROT_SPEED_SPEAKING      (0.55)   — fast rotation when actively narrating
*   TRIGGER_DIST            (2.2)    — proximity distance that fires the trigger
*   FADE_START_DIST         (3.5)    — distance at which glow begins
*   PULSE_INTERVAL          (4.5)    — seconds between energy pulses
*   PARTICLE_COUNT          (80)     — ambient particle count (keep ≤ 120 for VR)
*   COLOR_PRIMARY           #50ffcc  — main cyan holographic tint
*   EMISSIVE_IDLE           (0.6)    — emissive intensity at rest
*   EMISSIVE_NEAR           (1.8)    — emissive intensity when user is close
*   EMISSIVE_SPEAKING       (2.8)    — emissive intensity when narrating
* ──────────────────────────────────────────────────────────────────────────────
*/


/* ══════════════════════════════════════════════════════════════════════════════
  NARRATION AUDIO MANAGER  (global singleton)
  ──────────────────────────────────────────────────────────────────────────────
  Prevents overlapping audio across ALL narrator instances in the scene.
  Cross-fades between clips with configurable duration.


  IMPORTANT: This manager NEVER starts audio on its own. It only responds to
  explicit .play() calls from NarrationController. No autoplay. No proximity.


  Usage (called by NarrationController only):
    NarrationAudioManager.play(audioElement, volume, fadeDuration)
    NarrationAudioManager.stop(fadeDuration)
    NarrationAudioManager.pause()
    NarrationAudioManager.resume(volume)
    NarrationAudioManager.isPlaying()
══════════════════════════════════════════════════════════════════════════════ */
window.NarrationAudioManager = (function () {
 let _current     = null;   // currently playing HTMLAudioElement
 let _fadeTimer   = null;   // rAF handle for active fade
 let _playing     = false;
 let _pendingPlay = null;   // { audioEl, volume, fadeDuration } — queued if play() was blocked


 function _clearFade () {
   if (_fadeTimer) { cancelAnimationFrame(_fadeTimer); _fadeTimer = null; }
 }


 function _fadeIn (el, targetVol, durationMs) {
   const startTime = performance.now();
   const startVol  = parseFloat(el.volume) || 0;
   _clearFade();
   function step (now) {
     const t = Math.min((now - startTime) / durationMs, 1);
     el.volume = startVol + (targetVol - startVol) * t;
     if (t < 1) _fadeTimer = requestAnimationFrame(step);
   }
   _fadeTimer = requestAnimationFrame(step);
 }


 function _fadeOut (el, durationMs, cb) {
   const startTime = performance.now();
   const startVol  = parseFloat(el.volume) || 0;
   function step (now) {
     const t = Math.min((now - startTime) / durationMs, 1);
     el.volume = startVol * (1 - t);
     if (t < 1) {
       requestAnimationFrame(step);
     } else {
       el.pause();
       el.volume = 0;
       if (cb) cb();
     }
   }
   requestAnimationFrame(step);
 }


 /**
  * Called when a user gesture fires after a blocked play().
  * Retries the pending audio immediately.
  */
 function _retryOnUserGesture () {
   if (!_pendingPlay) return;
   const { audioEl, volume, fadeDuration } = _pendingPlay;
   _pendingPlay = null;
   console.log('[NarrationAudioManager] Retrying blocked audio after user gesture.');
   _playImmediately(audioEl, volume, fadeDuration);
 }


 /**
  * Internal: attempt to play audioEl right now, queue for retry if blocked.
  */
 function _playImmediately (audioEl, vol, fadeDuration) {
   if (!audioEl) return;
   _clearFade();


   if (_current && _current !== audioEl && !_current.paused) {
     const prev = _current;
     _fadeOut(prev, fadeDuration, () => { prev.currentTime = 0; });
   }


   _current             = audioEl;
   _current.volume      = 0;
   _current.currentTime = 0;
   _current.loop        = false;


   const p = _current.play();
   if (p) {
     p.catch((err) => {
       console.warn('[NarrationAudioManager] play() blocked:', err.message);
       // Queue for retry on the next user gesture (works for VR laser-pointer clicks too)
       if (!_pendingPlay) {
         _pendingPlay = { audioEl, volume: vol, fadeDuration };
         document.addEventListener('click',      _retryOnUserGesture, { once: true });
         document.addEventListener('touchstart', _retryOnUserGesture, { once: true });
         // Also listen to A-Frame scene clicks so VR controller selections count
         const scene = document.querySelector('a-scene');
         if (scene) scene.addEventListener('click',       _retryOnUserGesture, { once: true });
         if (scene) scene.addEventListener('triggerdown', _retryOnUserGesture, { once: true }); // VR trigger press as user gesture
       }
     });
   }


   _playing = true;
   _fadeIn(_current, vol, fadeDuration);
 }


 return {
   /**
    * Play a new clip.
    * If another clip is playing it is cross-faded out first.
    * If the browser blocks autoplay, the clip is queued and retried
    * automatically on the next user gesture (click / touch / VR select).
    * @param {HTMLAudioElement} audioEl
    * @param {number}  vol          — target volume 0–1   (default 0.9)
    * @param {number}  fadeDuration — ms for fade-in       (default 400)
    */
   play (audioEl, vol = 0.9, fadeDuration = 400) {
     if (!audioEl) return;


     /* ── Resume AudioContext first (required for WebXR) ── */
     const ctx = (typeof THREE !== 'undefined' && THREE.AudioContext && THREE.AudioContext.getContext)
       ? THREE.AudioContext.getContext() : null;


     if (ctx && ctx.state === 'suspended') {
       ctx.resume()
         .then(() => _playImmediately(audioEl, vol, fadeDuration))
         .catch(()  => _playImmediately(audioEl, vol, fadeDuration));
     } else {
       _playImmediately(audioEl, vol, fadeDuration);
     }
   },


   /**
    * Stop the current clip with a fade-out.
    * Also cancels any pending (blocked) play.
    * @param {number} fadeDuration — ms (default 600)
    */
   stop (fadeDuration = 600) {
     _pendingPlay = null;
     _clearFade();
     if (_current && !_current.paused) {
       _fadeOut(_current, fadeDuration, () => {
         if (_current) { _current.currentTime = 0; }
         _playing = false;
       });
     } else {
       _playing = false;
     }
   },


   /** Pause immediately (preserves position for resume). */
   pause () {
     _pendingPlay = null;
     _clearFade();
     if (_current && !_current.paused) _current.pause();
     _playing = false;
   },


   /** Resume the current clip with optional volume. */
   resume (vol) {
     if (!_current) return;
     if (vol !== undefined) _current.volume = vol;
     const p = _current.play();
     if (p) p.catch(() => {});
     _playing = true;
   },


   isPlaying ()    { return _playing && !!_current && !_current.paused; },
   currentAudio () { return _current; },


   /**
    * Manually retry any pending (blocked) audio — call this from a VR
    * button click handler to ensure the AudioContext is unlocked.
    */
   retryPending () { _retryOnUserGesture(); },
 };
})();




/* ══════════════════════════════════════════════════════════════════════════════
  NARRATION STATE ENGINE
  ──────────────────────────────────────────────────────────────────────────────
  Kept from v3 for full backwards compatibility.
  In v4 this class is NOT used by the main tour flow — NarrationController
  owns all sequencing directly. It remains available for any legacy code
  or custom extensions that reference it.


  Each state describes:
    id          — unique string key
    audioSrc    — CSS selector for the <audio> asset OR null
    text        — subtitle string (or null)
    focusTarget — CSS selector for the focus anchor entity (or null)
    highlightColor     — hex tint for focus effect
    highlightIntensity — effect strength multiplier
    duration    — how long to hold this state in ms
                  (0 = hold until audio ends, then advance)
    onEnter     — optional callback(narratorComp)
    onExit      — optional callback(narratorComp)


  Engine emits custom events on the narrator entity:
    'narration-state-enter'  { id, state }
    'narration-state-exit'   { id, state }
    'narration-complete'     {}
══════════════════════════════════════════════════════════════════════════════ */
class NarrationStateEngine {
 constructor (states = [], options = {}) {
   this.states      = states;
   this.loop        = options.loop        !== undefined ? options.loop        : false;
   this.autoAdvance = options.autoAdvance !== undefined ? options.autoAdvance : true;


   this._comp           = null;
   this._index          = -1;
   this._timer          = null;
   this._audioEndCb     = null;
   this._currentAudioEl = null;
   this._running        = false;
 }


 start (narratorComp) {
   this._comp    = narratorComp;
   this._running = true;
   this._index   = -1;
   this._advance();
 }


 stop () {
   this._running = false;
   this._clearTimer();
   this._removeAudioEndListener();
   NarrationAudioManager.stop(400);
 }


 pause () {
   this._clearTimer();
   NarrationAudioManager.pause();
 }


 resume () {
   const state = this.states[this._index];
   if (!state) return;
   NarrationAudioManager.resume();
   if (state.duration > 0 && this.autoAdvance) {
     this._timer = setTimeout(() => this._advance(), state.duration);
   }
 }


 goTo (idOrIndex) {
   this._clearTimer();
   this._removeAudioEndListener();
   const idx = typeof idOrIndex === 'number'
     ? idOrIndex
     : this.states.findIndex(s => s.id === idOrIndex);
   if (idx < 0 || idx >= this.states.length) return;
   this._index = idx - 1;
   this._advance();
 }


 currentStateId () {
   const s = this.states[this._index];
   return s ? s.id : null;
 }


 isRunning () {
   return this._running;
 }


 _advance () {
   if (!this._running) return;
   this._clearTimer();
   this._removeAudioEndListener();


   const prev = this.states[this._index];
   if (prev) this._exitState(prev);


   this._index++;


   if (this._index >= this.states.length) {
     if (this.loop) {
       this._index = 0;
     } else {
       this._running = false;
       if (this._comp) {
         this._comp._isSpeaking = false;
         this._comp.el.emit('narration-complete', {});
       }
       return;
     }
   }


   const state = this.states[this._index];
   this._enterState(state);
 }


 _enterState (state) {
   if (!this._comp) return;
   const comp = this._comp;


   comp._isSpeaking = true;
   comp.el.emit('narration-state-enter', { id: state.id, state });


   if (state.audioSrc) {
     const audioEl = document.querySelector(state.audioSrc);
     if (audioEl) {
       NarrationAudioManager.play(audioEl, comp.data.volume, 300);


       if (state.duration === 0 && this.autoAdvance) {
         this._audioEndCb     = () => this._advance();
         this._currentAudioEl = audioEl;
         audioEl.addEventListener('ended', this._audioEndCb, { once: true });


         audioEl.addEventListener('loadedmetadata', () => {
           if (!this._running) return;
           const fallbackMs = (audioEl.duration || 8) * 1000 + 800;
           const fallbackId = setTimeout(() => {
             if (this._running && this._index >= 0 &&
                 this.states[this._index] === state) {
               console.warn('[StateEngine] "ended" did not fire for', state.id, '— using duration fallback');
               this._advance();
             }
           }, fallbackMs);
           audioEl.addEventListener('ended', () => clearTimeout(fallbackId), { once: true });
         }, { once: true });
       }
     } else {
       console.warn('[StateEngine] Audio element not found:', state.audioSrc);
       if (state.duration > 0 && this.autoAdvance) {
         this._timer = setTimeout(() => this._advance(), state.duration);
       }
     }
   } else {
     if (state.duration > 0 && this.autoAdvance) {
       this._timer = setTimeout(() => this._advance(), state.duration);
     }
   }


   if (typeof state.onEnter === 'function') state.onEnter(comp);
 }


 _exitState (state) {
   if (!this._comp) return;
   this._comp.el.emit('narration-state-exit', { id: state.id, state });
   if (typeof state.onExit === 'function') state.onExit(this._comp);
 }


 _clearTimer () {
   if (this._timer) { clearTimeout(this._timer); this._timer = null; }
 }


 _removeAudioEndListener () {
   if (this._currentAudioEl && this._audioEndCb) {
     this._currentAudioEl.removeEventListener('ended', this._audioEndCb);
     this._currentAudioEl = null;
     this._audioEndCb     = null;
   }
 }
}


window.NarrationStateEngine = NarrationStateEngine;




/* ══════════════════════════════════════════════════════════════════════════════
  GLSL: POLYHEDRON VERTEX SHADER
  — Breathing scale + slight vertex-level noise displacement
  — Computes Fresnel for edge glow
  — Speaking state amplifies breathe and shimmer
══════════════════════════════════════════════════════════════════════════════ */
const POLY_VERT = `
 uniform float uTime;
 uniform float uProximity;   // 0 = far, 1 = near
 uniform float uPulse;       // 0→1 energy burst
 uniform float uSpeaking;    // 0→1 active narration state


 varying vec3  vNormal;
 varying vec3  vViewDir;
 varying float vFresnel;
 varying float vBrightness;


 float hash(vec3 p) {
   p = fract(p * vec3(127.1, 311.7, 74.7));
   p += dot(p, p.yzx + 19.19);
   return fract((p.x + p.y) * p.z);
 }


 void main() {
   vec3 pos = position;


   float breatheAmt = 0.018 + uProximity * 0.028 + uPulse * 0.045 + uSpeaking * 0.038;
   float breathe = sin(uTime * 1.55) * breatheAmt;
   pos *= 1.0 + breathe;


   float shimmerBase = 0.007 * (1.0 + uProximity * 1.5 + uSpeaking * 1.2);
   float shimmer = hash(pos * 3.7 + uTime * 0.6) * shimmerBase;
   pos += normal * shimmer;


   vec4 worldPos   = modelMatrix * vec4(pos, 1.0);
   vec4 mvPos      = viewMatrix * worldPos;
   vViewDir        = normalize(-mvPos.xyz);
   vNormal         = normalize(normalMatrix * normal);
   vFresnel        = pow(1.0 - abs(dot(vViewDir, vNormal)), 2.8);


   float speedMult = 1.0 + uSpeaking * 1.8;
   vBrightness = 0.7 + 0.3 * sin(pos.y * 8.0 + uTime * 2.2 * speedMult + hash(pos) * 6.28);


   gl_Position = projectionMatrix * mvPos;
 }
`;


/* ══════════════════════════════════════════════════════════════════════════════
  GLSL: POLYHEDRON FRAGMENT SHADER
  — Fresnel edge glow + emissive pulse + inner shimmer
  — Speaking state boosts all intensities
══════════════════════════════════════════════════════════════════════════════ */
const POLY_FRAG = `
 uniform vec3  uColor;
 uniform float uEmissive;
 uniform float uOpacity;
 uniform float uPulse;
 uniform float uProximity;
 uniform float uSpeaking;


 varying vec3  vNormal;
 varying vec3  vViewDir;
 varying float vFresnel;
 varying float vBrightness;


 void main() {
   vec3 col = uColor * (0.55 + vBrightness * 0.25 + uSpeaking * 0.18);


   float fresnelStr = 0.45 + uProximity * 0.35 + uPulse * 0.4 + uSpeaking * 0.55;
   col += uColor * vFresnel * fresnelStr * 1.8;


   col += uColor * (uEmissive + uPulse * 1.2 + uSpeaking * 0.8) * 0.4;


   float facet = abs(dot(vViewDir, vNormal));
   col *= 0.6 + facet * 0.55;


   float alpha = uOpacity * (0.42 + vFresnel * 0.45 + uPulse * 0.12 + uSpeaking * 0.10);
   alpha = clamp(alpha, 0.0, 0.92);


   gl_FragColor = vec4(col, alpha);
 }
`;


/* ══════════════════════════════════════════════════════════════════════════════
  GLSL: PARTICLE VERTEX SHADER — drifting ambient motes
══════════════════════════════════════════════════════════════════════════════ */
const PARTICLE_VERT = `
 uniform float uTime;
 uniform float uProximity;
 uniform float uSpeaking;
 attribute float aSpeed;
 attribute float aPhase;
 attribute float aRadius;
 varying float vAlpha;


 void main() {
   vec3 pos = position;


   float speedMult = 1.0 + uSpeaking * 1.4;
   float t = uTime * aSpeed * speedMult + aPhase;
   pos.x += sin(t * 1.1) * aRadius * 0.18;
   pos.y += cos(t * 0.7 + aPhase) * aRadius * 0.12;
   pos.z += sin(t * 0.9 + aPhase * 1.3) * aRadius * 0.15;


   float twinkleSpeed = 2.5 + uSpeaking * 2.0;
   vAlpha = 0.3 + 0.5 * (sin(uTime * aSpeed * twinkleSpeed + aPhase) * 0.5 + 0.5);
   vAlpha *= (0.5 + uProximity * 0.5) * (1.0 + uSpeaking * 0.4);


   vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
   float sizeMult = 1.0 + uSpeaking * 0.5;
   gl_PointSize = clamp((1.8 + aRadius * 0.8) * sizeMult * (180.0 / -mvPos.z), 1.0, 6.5);
   gl_Position  = projectionMatrix * mvPos;
 }
`;


/* ══════════════════════════════════════════════════════════════════════════════
  GLSL: PARTICLE FRAGMENT SHADER — soft circular glow dots
══════════════════════════════════════════════════════════════════════════════ */
const PARTICLE_FRAG = `
 uniform vec3 uColor;
 varying float vAlpha;


 void main() {
   vec2  uv   = gl_PointCoord - 0.5;
   float dist = length(uv);
   if (dist > 0.5) discard;
   float a = smoothstep(0.5, 0.1, dist) * vAlpha;
   gl_FragColor = vec4(uColor * 1.4, a);
 }
`;




/* ══════════════════════════════════════════════════════════════════════════════
  COMPONENT REGISTRATION
══════════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('polyhedron-narrator', {
 schema: {
   color:         { type: 'color',   default: '#50ffcc'              },
   /* audioSrc kept for HTML attribute backwards compatibility.
      The component itself NEVER plays audio — NarrationController does. */
   audioSrc:      { type: 'string',  default: '#audio-ghost-narrator' },
   triggerDist:   { type: 'number',  default: 2.2   },
   fadeStartDist: { type: 'number',  default: 3.5   },
   volume:        { type: 'number',  default: 0.9   },
   clickToPlay:   { type: 'boolean', default: true  },
   animSpeed:     { type: 'number',  default: 1.0   },
   floatOffset:   { type: 'number',  default: 0.0   },
   highlightId:   { type: 'string',  default: ''    },
 },


 // ── Visual intensity constants ───────────────────────────────────────────────
 POLY_RADIUS:        0.28,
 FLOAT_AMP:          0.018,
 FLOAT_HZ:           0.55,
 ROT_SPEED_IDLE:     0.12,
 ROT_SPEED_NEAR:     0.32,
 ROT_SPEED_SPEAKING: 0.55,
 PARTICLE_COUNT:     80,
 EMISSIVE_IDLE:      0.60,
 EMISSIVE_NEAR:      1.80,
 EMISSIVE_SPEAKING:  2.80,
 PULSE_INTERVAL:     4.5,
 RING_CONFIGS: [
   { radius: 0.52, tube: 0.007, speed: 0.28,  tilt: 0.40,         phase: 0.0         },
   { radius: 0.68, tube: 0.005, speed: -0.18, tilt: 1.05,         phase: Math.PI/3   },
   { radius: 0.85, tube: 0.004, speed: 0.14,  tilt: Math.PI/2.2,  phase: Math.PI*0.7 },
 ],


 // ── Movement constants (NEW in v4) ──────────────────────────────────────────
 MOVE_LERP_SPEED:   0.018,   // position lerp alpha per frame — lower = smoother
 ARRIVAL_THRESHOLD: 0.08,    // metres — distance to target counted as "arrived"


 init () {
   this._proximity    = 0.0;
   this._pulse        = 0.0;
   this._nextPulse    = this.PULSE_INTERVAL;
   this._col          = new THREE.Color(this.data.color);


   // _isSpeaking: set TRUE by NarrationController._playBeat(),
   //              set FALSE by NarrationController when beat ends.
   //              Drives visual acceleration only — NOT audio.
   this._isSpeaking   = false;
   this._speakingLerp = 0.0;


   // NEW in v4: waiting and moving visual lerp targets
   this._isWaiting    = false;   // set by NarrationController
   this._waitingLerp  = 0.0;
   this._isMovingLerp = 0.0;


   this._camPos   = new THREE.Vector3();
   this._worldPos = new THREE.Vector3();


   this._rotX = 0;
   this._rotY = 0;
   this._rotZ = 0;


   this._group = new THREE.Group();
   this.el.setObject3D('narrator', this._group);


   // Build all visual subsystems
   this._buildPolyhedron();
   this._buildRings();
   this._rings = [];
   this._buildParticles();
   // NOTE: _buildAudio() intentionally NOT called.
   // Audio is managed exclusively by NarrationController + NarrationAudioManager.


   if (this.data.clickToPlay) {
     this.el.classList.add('clickable');
     this.el.addEventListener('click', () => this._handleClick());
   }


   // stateEngine set by NarrationController after wiring (v3 compat).
   this.stateEngine = null;


   // NEW in v4: movement system state
   // NarrationController sets these to drive spatial movement.
   this.activeFocusPoint   = new THREE.Vector3();  // target world position
   this.isMoving           = false;                // true while gliding
   this.onArrivalCallback  = null;                 // called once on arrival
   this._arrivalFired      = false;                // prevent double-fire guard
   this._entityWorldPos    = new THREE.Vector3();  // scratch for world position


   // Cache ghost light — looked up once here so tick() never touches the DOM.
   this._ghostLight     = null;
   this._ghostLightObj  = null;
   this.el.sceneEl.addEventListener('loaded', () => {
     this._ghostLight = this.el.sceneEl.querySelector('#ghost-light');
     if (this._ghostLight) {
       this._ghostLightObj = this._ghostLight.getObject3D('light') || null;
     }
   }, { once: true });
 },


 /* ══════════════════════════════════════════════════════════════════════════
    POLYHEDRON — IcosahedronGeometry (detail=1) → 80-face faceted form
 ══════════════════════════════════════════════════════════════════════════ */
 _buildPolyhedron () {
   const geo = new THREE.IcosahedronGeometry(this.POLY_RADIUS, 1);
   geo.computeVertexNormals();


   this._polyUniforms = {
     uTime:      { value: 0 },
     uColor:     { value: this._col.clone() },
     uEmissive:  { value: this.EMISSIVE_IDLE },
     uOpacity:   { value: 0.72 },
     uProximity: { value: 0 },
     uPulse:     { value: 0 },
     uSpeaking:  { value: 0 },
   };


   const mat = new THREE.ShaderMaterial({
     uniforms:       this._polyUniforms,
     vertexShader:   POLY_VERT,
     fragmentShader: POLY_FRAG,
     transparent:    true,
     side:           THREE.DoubleSide,
     depthWrite:     false,
     blending:       THREE.AdditiveBlending,
   });


   this._poly = new THREE.Mesh(geo, mat);
   this._group.add(this._poly);


   const wireGeo = new THREE.IcosahedronGeometry(this.POLY_RADIUS * 1.003, 1);
   this._wireMat = new THREE.MeshBasicMaterial({
     color:       this.data.color,
     wireframe:   true,
     transparent: true,
     opacity:     0.12,
     blending:    THREE.AdditiveBlending,
     depthWrite:  false,
   });
   this._wire = new THREE.Mesh(wireGeo, this._wireMat);
   this._group.add(this._wire);
 },


 /* ══════════════════════════════════════════════════════════════════════════
    ORBITING RINGS
 ══════════════════════════════════════════════════════════════════════════ */
 _buildRings () {
   this._rings = [];


   this.RING_CONFIGS.forEach((cfg) => {
     const geo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 8, 64);
     const mat = new THREE.MeshBasicMaterial({
       color:       this.data.color,
       transparent: true,
       opacity:     0.0,
       blending:    THREE.AdditiveBlending,
       depthWrite:  false,
     });


     const ring = new THREE.Mesh(geo, mat);
     ring.rotation.x = Math.PI / 2 + cfg.tilt;
     ring.rotation.y = cfg.phase;


     const pivot = new THREE.Group();
     pivot.add(ring);
     pivot.userData.speed = cfg.speed;
     pivot.userData.ring  = ring;
     pivot.userData.mat   = mat;


     this._group.add(pivot);
     this._rings.push(pivot);
   });
 },


 /* ══════════════════════════════════════════════════════════════════════════
    PARTICLE FIELD
 ══════════════════════════════════════════════════════════════════════════ */
 _buildParticles () {
   const N = this.PARTICLE_COUNT;
   const positions = new Float32Array(N * 3);
   const speeds    = new Float32Array(N);
   const phases    = new Float32Array(N);
   const radii     = new Float32Array(N);


   for (let i = 0; i < N; i++) {
     const phi   = Math.acos(2 * Math.random() - 1);
     const theta = Math.random() * Math.PI * 2;
     const r     = 0.50 + Math.random() * 0.60;


     positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
     positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
     positions[i * 3 + 2] = r * Math.cos(phi);


     speeds[i] = 0.18 + Math.random() * 0.35;
     phases[i] = Math.random() * Math.PI * 2;
     radii[i]  = 0.3  + Math.random() * 0.7;
   }


   const geo = new THREE.BufferGeometry();
   geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
   geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds,    1));
   geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases,    1));
   geo.setAttribute('aRadius',  new THREE.BufferAttribute(radii,     1));


   this._particleUniforms = {
     uTime:      { value: 0 },
     uColor:     { value: this._col.clone() },
     uProximity: { value: 0 },
     uSpeaking:  { value: 0 },
   };


   const mat = new THREE.ShaderMaterial({
     uniforms:       this._particleUniforms,
     vertexShader:   PARTICLE_VERT,
     fragmentShader: PARTICLE_FRAG,
     transparent:    true,
     depthWrite:     false,
     blending:       THREE.AdditiveBlending,
   });
   mat.extensions = { drawBuffers: true };


   this._particles = new THREE.Points(geo, mat);
   this._group.add(this._particles);
 },


 /* ══════════════════════════════════════════════════════════════════════════
    CLICK HANDLER
    Clicking pauses/resumes when a tour is running.
    Does NOT re-trigger from idle — that is NarrationController's job.
 ══════════════════════════════════════════════════════════════════════════ */
 _handleClick () {
   if (this.stateEngine && this.stateEngine.isRunning()) {
     this.stateEngine.pause();
     return;
   }
   if (this.stateEngine && this.stateEngine._index >= 0) {
     this.stateEngine.resume();
   }
 },


 /* ══════════════════════════════════════════════════════════════════════════
    PUBLIC PAUSE / RESUME API (called by main.js scene transitions)
 ══════════════════════════════════════════════════════════════════════════ */
 pauseNarrator () {
   this._isSpeaking = false;
   if (this.stateEngine) this.stateEngine.pause();
   else NarrationAudioManager.pause();
 },


 resumeNarrator () {
   if (this.stateEngine) this.stateEngine.resume();
   else NarrationAudioManager.resume();
 },


 // Legacy aliases
 pauseGhost  () { this.pauseNarrator(); },
 resumeGhost () { this.resumeNarrator(); },
 listenTo    () { /* no-op for geometric narrator */ },


 /* ══════════════════════════════════════════════════════════════════════════
    TICK — visual animation + spatial movement (v4)
    ────────────────────────────────────────────────────────────────────────
    Section 0 is NEW: smooth lerp movement toward activeFocusPoint.
    Sections 1–10 are identical to v3, with three additions:
      • _isMovingLerp influences rotation speed, emissive, ring opacity
      • _waitingLerp  softens those same values when user is far away
      • Ghost light gets a travel boost from _isMovingLerp


    CRITICAL: tick() does NOT start audio, does NOT own proximity-to-trigger.
    NarrationController in main.js owns all story logic.
 ══════════════════════════════════════════════════════════════════════════ */
 tick (t, dt) {
   const time  = (t * 0.001) * this.data.animSpeed + this.data.floatOffset;
   const dtSec = Math.min(dt * 0.001, 0.05);


   // ── 0. SPATIAL MOVEMENT (NEW in v4) ──────────────────────────────────────
   //    Smoothly lerps entity position toward activeFocusPoint.
   //    When close enough, snaps to target and fires onArrivalCallback once.
   //    NarrationController sets isMoving/activeFocusPoint/onArrivalCallback.
   if (this.isMoving) {
     this.el.object3D.getWorldPosition(this._entityWorldPos);
     const target       = this.activeFocusPoint;
     const distToTarget = this._entityWorldPos.distanceTo(target);


     if (distToTarget > this.ARRIVAL_THRESHOLD) {
       // Ease alpha scales with distance: glides fast in the middle,
       // decelerates as it approaches — no snapping, no jitter.
       const alpha = Math.min(this.MOVE_LERP_SPEED * (1 + (distToTarget - 0.5) * 0.4), 0.06);
       const p     = this.el.object3D.position;
       p.x += (target.x - p.x) * alpha;
       p.y += (target.y - p.y) * alpha;
       p.z += (target.z - p.z) * alpha;


     } else {
       // Arrived — snap exactly and fire callback
       this.el.object3D.position.set(target.x, target.y, target.z);
       this.isMoving = false;


       if (!this._arrivalFired && typeof this.onArrivalCallback === 'function') {
         this._arrivalFired = true;
         const cb = this.onArrivalCallback;
         this.onArrivalCallback = null;
         // Defer one tick so the snapped position renders before callback runs
         setTimeout(() => {
           this._arrivalFired = false;
           cb();
         }, 16);
       }
     }
   }


   // ── 1. Proximity — VISUAL ONLY, no audio ─────────────────────────────────
   //    _camPos and _worldPos are also read by NarrationController externally.
   const camera = this.el.sceneEl.camera;
   if (!camera) return;


   camera.getWorldPosition(this._camPos);
   this.el.object3D.getWorldPosition(this._worldPos);
   const dist = this._camPos.distanceTo(this._worldPos);


   const proxTarget = dist < this.data.triggerDist
     ? 1.0
     : dist < this.data.fadeStartDist
       ? 1.0 - (dist - this.data.triggerDist) / (this.data.fadeStartDist - this.data.triggerDist)
       : 0.0;


   this._proximity += (proxTarget - this._proximity) * 0.05;


   // ── 2. Lerp targets (speaking, moving, waiting) ───────────────────────────
   this._speakingLerp  += ((this._isSpeaking ? 1.0 : 0.0) - this._speakingLerp)  * 0.04;
   this._isMovingLerp  += ((this.isMoving    ? 1.0 : 0.0) - this._isMovingLerp)  * 0.05;
   this._waitingLerp   += ((this._isWaiting  ? 1.0 : 0.0) - this._waitingLerp)   * 0.03;


   // ── 3. Energy pulse ───────────────────────────────────────────────────────
   this._nextPulse -= dtSec;
   if (this._nextPulse <= 0) {
     this._pulse     = 1.0;
     this._nextPulse = this.PULSE_INTERVAL + (Math.random() - 0.5) * 1.5;
   }
   this._pulse += (0 - this._pulse) * 0.12;


   // ── 4. Polyhedron rotation ────────────────────────────────────────────────
   //    Travel boost: faster while moving; gentle slowdown while waiting.
   const rotSpeed =
     this.ROT_SPEED_IDLE
     + this._proximity    * (this.ROT_SPEED_NEAR     - this.ROT_SPEED_IDLE)
     + this._speakingLerp * (this.ROT_SPEED_SPEAKING - this.ROT_SPEED_NEAR)
     + this._isMovingLerp * 0.22
     - this._waitingLerp  * 0.08
     + this._pulse * 0.1;


   this._rotX += dtSec * rotSpeed * 0.53;
   this._rotY += dtSec * rotSpeed * 1.00;
   this._rotZ += dtSec * rotSpeed * 0.31;


   this._poly.rotation.set(this._rotX, this._rotY, this._rotZ);
   this._wire.rotation.set(this._rotX, this._rotY, this._rotZ);


   // ── 5. Float animation ────────────────────────────────────────────────────
   const floatY = Math.sin(time * this.FLOAT_HZ * Math.PI * 2) * this.FLOAT_AMP
                + this._speakingLerp * Math.sin(time * this.FLOAT_HZ * Math.PI * 2 * 2.1) * 0.008;
   this._group.position.y = floatY;
   this._group.position.x = Math.sin(time * this.FLOAT_HZ * Math.PI * 2 * 0.37) * 0.006;


   // ── 6. Shader uniforms ────────────────────────────────────────────────────
   //    Travel: emissive ramps up while moving.
   //    Waiting: emissive softens to a calm, patient glow.
   const emissive =
     this.EMISSIVE_IDLE
     + this._proximity    * (this.EMISSIVE_NEAR     - this.EMISSIVE_IDLE)
     + this._speakingLerp * (this.EMISSIVE_SPEAKING - this.EMISSIVE_NEAR)
     + this._isMovingLerp * 0.6
     - this._waitingLerp  * (this.EMISSIVE_NEAR - this.EMISSIVE_IDLE) * 0.6
     + this._pulse * 1.0;


   this._polyUniforms.uTime.value      = time;
   this._polyUniforms.uProximity.value = this._proximity;
   this._polyUniforms.uPulse.value     = this._pulse;
   this._polyUniforms.uEmissive.value  = emissive;
   this._polyUniforms.uSpeaking.value  = this._speakingLerp;
   this._polyUniforms.uOpacity.value   = 0.55
     + this._proximity    * 0.25
     + this._pulse        * 0.10
     + this._speakingLerp * 0.12
     + this._isMovingLerp * 0.08;


   this._wireMat.opacity = 0.12
     + this._proximity    * 0.22
     + this._pulse        * 0.18
     + this._speakingLerp * 0.28
     + this._isMovingLerp * 0.10;


   // ── 7. Orbiting rings ─────────────────────────────────────────────────────
   //    Rings brighten and spin faster during travel; dim while waiting.
   const ringTargetOpacity = 0.35
     + this._proximity    * 0.45
     + this._speakingLerp * 0.35
     + this._isMovingLerp * 0.25
     + this._pulse        * 0.2
     - this._waitingLerp  * 0.15;


   this._rings.forEach((pivot, i) => {
     const ringSpeed = pivot.userData.speed
       * (1.0 + this._proximity * 0.5 + this._speakingLerp * 0.8 + this._isMovingLerp * 0.6);
     pivot.rotation.y += dtSec * ringSpeed;


     const mat = pivot.userData.mat;
     mat.opacity += (ringTargetOpacity * (0.7 + i * 0.15) - mat.opacity) * 0.06;


     const pScale = 1.0 + this._pulse * 0.06 * (i + 1) + this._speakingLerp * 0.04 * (i + 1);
     pivot.userData.ring.scale.setScalar(pScale);
   });


   // ── 8. Particle field ─────────────────────────────────────────────────────
   this._particleUniforms.uTime.value      = time;
   this._particleUniforms.uProximity.value = this._proximity;
   this._particleUniforms.uSpeaking.value  = this._speakingLerp;


   this._particles.rotation.y += dtSec * (0.06 + this._speakingLerp * 0.08 + this._isMovingLerp * 0.04);
   this._particles.rotation.x += dtSec * (0.025 + this._speakingLerp * 0.03);


   // ── 9. Scale pulse ────────────────────────────────────────────────────────
   const pulsePop = 1.0 + this._pulse * 0.06 + this._speakingLerp * 0.03;
   this._poly.scale.setScalar(pulsePop);
   this._wire.scale.setScalar(pulsePop);


   // ── 10. Ghost light sync ──────────────────────────────────────────────────
   // Use cached _ghostLightObj (set in init) — never touches the DOM in tick.
   if (this._ghostLightObj) {
     this._ghostLightObj.intensity =
       0.20
       + this._proximity    * 0.55
       + this._speakingLerp * 0.80
       + this._isMovingLerp * 0.30
       + this._pulse        * 0.35;
   }
 },


 remove () {
   if (this.stateEngine) this.stateEngine.stop();
   this.el.removeObject3D('narrator');
 },
});




/* ══════════════════════════════════════════════════════════════════════════════
  SECONDARY COMPONENT: polyhedron-narrator-indicator
  ── Three concentric ground rings that ripple outward, signalling "come closer"
══════════════════════════════════════════════════════════════════════════════ */
AFRAME.registerComponent('polyhedron-narrator-indicator', {
 schema: {
   color:  { type: 'color',  default: '#50ffcc' },
   radius: { type: 'number', default: 0.22       },
 },


 init () {
   this._rings = [];
   this._group = new THREE.Group();


   const col = new THREE.Color(this.data.color);


   [1.0, 1.6, 2.3].forEach((mult, i) => {
     const geo = new THREE.TorusGeometry(this.data.radius * mult, 0.005, 8, 64);
     const mat = new THREE.MeshBasicMaterial({
       color:       col,
       transparent: true,
       opacity:     0.0,
       depthWrite:  false,
       blending:    THREE.AdditiveBlending,
     });


     const ring = new THREE.Mesh(geo, mat);
     ring.rotation.x     = -Math.PI / 2;
     ring.userData.phase = i * (Math.PI * 2 / 3);


     this._rings.push(ring);
     this._group.add(ring);
   });


   this.el.setObject3D('indicator', this._group);
 },


 tick (t) {
   const time = t * 0.001;
   this._rings.forEach((ring) => {
     const wave = Math.sin(time * 1.8 + ring.userData.phase) * 0.5 + 0.5;
     ring.material.opacity = wave * 0.35;
     const s = 1.0 + wave * 0.06;
     ring.scale.set(s, s, s);
   });
 },


 remove () {
   this.el.removeObject3D('indicator');
 },
});