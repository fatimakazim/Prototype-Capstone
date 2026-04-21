/* ════════════════════════════════════════════════════════════════════
   INTRO HOLOGRAM SCENE CONTROLLER
   ──────────────────────────────────────────────────────────────────

   ROOT CAUSE OF AUTO-TRANSITION (found by reading hologram.js):
   hologram-video sets loop=true during scene load — even though
   model-scene is visible="false". Fixed by:
   1. setupVideo() runs 400ms after scene load so hologram-video
      init runs first, then we overwrite loop=false.
   2. 'ended' at currentTime=0 (error/CORS) is rejected.
   3. window.__introBooted flag blocks double-init.

   VALID TRIGGERS:
     1. Video plays fully to the end  (ended + currentTime ≥ 1s)
     2. User clicks #intro-skip-btn
     3. Space or Enter key
     4. VR triggerdown                (after 3s startup guard)
════════════════════════════════════════════════════════════════════ */
(function introSceneController () {
  'use strict';

  if (window.__introBooted) {
    console.warn('[intro] Already booted — skipping duplicate init.');
    return;
  }
  window.__introBooted = true;
  window._introComplete = false;

  const sceneEl = document.querySelector('a-scene');
  if (!sceneEl) return;

  const onSceneReady = () => {
    const introScene  = document.querySelector('#intro-hologram-scene');
    const modelScene  = document.querySelector('#model-scene');
    const fadePlane   = document.querySelector('#fade-plane');
    const holoVid     = document.querySelector('#holo-vid');
    const introCard   = document.querySelector('#intro-card');
    const skipOverlay = document.querySelector('#intro-skip-overlay');
    const skipBtn     = document.querySelector('#intro-skip-btn');

    if (!introScene || !modelScene || !fadePlane) {
      console.error('[intro] Critical elements missing — bypassing intro.');
      if (modelScene)  modelScene.setAttribute('visible', 'true');
      if (introCard)   introCard.classList.add('visible');
      if (skipOverlay) skipOverlay.classList.add('hidden');
      window._introComplete = true;
      return;
    }

    let transitioned  = false;
    let vrReady       = false;
    let endedHandler  = null;
    let playAttempted = false;

    const vrGuardTimer = setTimeout(() => { vrReady = true; }, 3000);

    function setupVideo () {
      if (!holoVid) return;
      holoVid.loop    = false;
      holoVid.muted   = true;
      holoVid.preload = 'auto';

      holoVid.addEventListener('error', () => {
        console.error('[intro] Video error — use skip button to continue.');
      }, { once: true });

      holoVid.addEventListener('playing', () => {
        holoVid.loop = false;
      }, { once: true });

      endedHandler = () => {
        if (holoVid.loop)              { holoVid.loop = false; return; }
        if (holoVid.currentTime < 1.0) { return; }
        triggerTransition('video-ended');
      };
      holoVid.addEventListener('ended', endedHandler);

      if (!playAttempted) {
        playAttempted = true;
        holoVid.play().then(() => {
          holoVid.loop = false;
        }).catch((err) => {
          console.warn('[intro] Autoplay blocked:', err.message);
          const retryPlay = () => {
            if (transitioned) return;
            holoVid.loop = false;
            holoVid.play().catch(() => {});
          };
          document.addEventListener('click',      retryPlay, { once: true });
          document.addEventListener('keydown',    retryPlay, { once: true });
          document.addEventListener('touchstart', retryPlay, { once: true });
        });
      }
    }
    setTimeout(setupVideo, 400);

    if (skipBtn) {
      skipBtn.addEventListener('mousedown', () => {
        if (holoVid && holoVid.muted) {
          holoVid.muted = false;
          holoVid.loop  = false;
          holoVid.play().catch(() => {});
        }
      }, { once: true });
    }

    function triggerTransition (source) {
      if (transitioned) return;
      transitioned = true;
      console.log('[intro] ✅ TRANSITION → source:', source);

      if (holoVid && endedHandler) {
        holoVid.removeEventListener('ended', endedHandler);
        endedHandler = null;
      }
      clearTimeout(vrGuardTimer);
      if (skipOverlay) skipOverlay.classList.add('hidden');

      if (holoVid) {
        holoVid.pause();
        holoVid.currentTime = 0;
        holoVid.loop  = true;
        holoVid.muted = false;
      }

      const FADE_MS = 700;
      fadePlane.setAttribute('animation__ifo',
        `property:material.opacity;from:0;to:1;dur:${FADE_MS};easing:linear`);

      setTimeout(() => {
        introScene.setAttribute('visible', 'false');
        modelScene.setAttribute('visible', 'true');

        if (introCard) setTimeout(() => introCard.classList.add('visible'), 200);
        window._introComplete = true;

        fadePlane.removeAttribute('animation__ifo');
        fadePlane.setAttribute('animation__ifi',
          `property:material.opacity;from:1;to:0;dur:${FADE_MS};easing:linear`);
        setTimeout(() => fadePlane.removeAttribute('animation__ifi'), FADE_MS + 80);
      }, FADE_MS + 60);
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', () => triggerTransition('skip-btn'));
    }

    const keyHandler = (e) => {
      if (transitioned) { window.removeEventListener('keydown', keyHandler); return; }
      if (e.code === 'Space' || e.code === 'Enter') {
        window.removeEventListener('keydown', keyHandler);
        triggerTransition('key-' + e.code);
      }
    };
    window.addEventListener('keydown', keyHandler);

    const vrHandler = () => {
      if (transitioned) { sceneEl.removeEventListener('triggerdown', vrHandler); return; }
      if (!vrReady) return;
      sceneEl.removeEventListener('triggerdown', vrHandler);
      triggerTransition('vr-triggerdown');
    };
    sceneEl.addEventListener('triggerdown', vrHandler);
  };

  if (sceneEl.hasLoaded) { onSceneReady(); }
  else { sceneEl.addEventListener('loaded', onSceneReady, { once: true }); }
})();


/* ════════════════════════════════════════════════════════════════════
   main.js — Reframing Partition Memories: Saidpur Village VR
   ────────────────────────────────────────────────────────────────
   v4 — 4-Beat Guided Tour Engine
   ─────────────────────────────────────────────────────────────────
   Key systems:

   1. narration-focus A-Frame component
      Visual pulsing ring + beam + light effect on focus anchor entities.

   2. FocusManager
      Activates / deactivates the focus effect on anchors.
      Called exclusively by NarrationController.

   3. NarrationController  ← FULLY REFACTORED IN v4
      6-state guided tour engine:
        IDLE → MOVING_TO_NEXT → ARRIVAL_PAUSE → PLAYING_BEAT
        → WAITING_FOR_USER (if user wanders) → COMPLETED
      Drives the polyhedron to glide between 4 focus points.
      Each beat: narrator moves → pauses on arrival → plays audio + subtitle.

   4. STORY_BEATS config
      Central array of 4 beats. Swap audio/text/positions here.
      Required audio IDs: #audio-beat-1 through #audio-beat-4
      Required focus entities: #focus-trees, #focus-temple,
                               #focus-pond, #focus-mosque

   5. NarratorSubtitle
      Unified 2D + VR subtitle system. Unchanged from v3.

   6. All original systems preserved:
      scene transitions, hotspot clicks, 360° scenes, village HTML overlay.

   ── HTML ADDITIONS NEEDED IN index.html ──────────────────────────
   In <a-assets>:
     <audio id="audio-beat-1" src="assets/audio/beat-landscape.mp3"  preload="auto" crossorigin="anonymous"></audio>
     <audio id="audio-beat-2" src="assets/audio/beat-heart.mp3"      preload="auto" crossorigin="anonymous"></audio>
     <audio id="audio-beat-3" src="assets/audio/beat-daily-life.mp3" preload="auto" crossorigin="anonymous"></audio>
     <audio id="audio-beat-4" src="assets/audio/beat-transition.mp3" preload="auto" crossorigin="anonymous"></audio>

   In #model-scene:
     <a-entity id="focus-trees"  position=" 0.18 1.52 -4.20" narration-focus></a-entity>
     <a-entity id="focus-temple" position=" 0.12 1.52 -4.05" narration-focus></a-entity>
     <a-entity id="focus-pond"   position=" 0.08 1.52 -3.90" narration-focus></a-entity>
     <a-entity id="focus-mosque" position="-0.05 1.52 -4.10" narration-focus></a-entity>

   ── CONSOLE DEBUG COMMANDS ────────────────────────────────────────
     NarrationController.forceStart()     // trigger from idle
     NarrationController.getState()       // current state string
     NarrationController.getBeatIndex()   // 0–3
     NarrationController.goToBeat(2)      // jump to specific beat
     NarrationController.pause()          // suspend (SOS / scene switch)
     NarrationController.resume()         // unsuspend
     FocusManager.activate('#focus-temple', '#ff9966', 1.6)
     FocusManager.deactivate()
════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════
     A-FRAME COMPONENT: narration-focus
     ──────────────────────────────────────────────────────────────────
     Place this component on invisible anchor entities in the HTML.
     FocusManager calls:
       el.setAttribute('narration-focus', 'active', true)   — activate
       el.setAttribute('narration-focus', 'active', false)  — deactivate

     Schema:
       active    {boolean} — whether the highlight is on
       color     {color}   — tint hex (default: #50ffcc)
       intensity {number}  — strength multiplier (default: 1.0)

     Effect:
       • Pulsing inner torus ring
       • Counter-phase outer torus ring
       • Vertical beam / column
       • Point light tinted to match color
  ══════════════════════════════════════════════════════════════════ */
  AFRAME.registerComponent('narration-focus', {
    schema: {
      active:    { type: 'boolean', default: false },
      color:     { type: 'color',   default: '#50ffcc' },
      intensity: { type: 'number',  default: 1.0 },
    },

    init () {
      this._group   = new THREE.Group();
      this._opacity = 0;
      this._target  = 0;
      this._time    = 0;

      const col = new THREE.Color(this.data.color);

      /* ── Inner ring ── */
      const innerGeo = new THREE.TorusGeometry(0.18, 0.006, 8, 64);
      const ringMat  = new THREE.MeshBasicMaterial({
        color:       col,
        transparent: true,
        opacity:     0,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });
      this._innerRing = new THREE.Mesh(innerGeo, ringMat);
      this._innerRing.rotation.x = -Math.PI / 2;
      this._group.add(this._innerRing);

      /* ── Outer ring ── */
      const outerGeo = new THREE.TorusGeometry(0.30, 0.004, 8, 64);
      const outerMat = ringMat.clone();
      this._outerRing = new THREE.Mesh(outerGeo, outerMat);
      this._outerRing.rotation.x = -Math.PI / 2;
      this._group.add(this._outerRing);

      /* ── Vertical beam ── */
      const beamGeo = new THREE.CylinderGeometry(0.006, 0.025, 1.2, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color:       col,
        transparent: true,
        opacity:     0,
        depthWrite:  false,
        side:        THREE.DoubleSide,
        blending:    THREE.AdditiveBlending,
      });
      this._beam = new THREE.Mesh(beamGeo, beamMat);
      this._beam.position.y = 0.6;
      this._group.add(this._beam);

      /* ── Point light ── */
      this._light = new THREE.PointLight(col, 0, 1.8, 2);
      this._group.add(this._light);

      this._mats = [ringMat, outerMat, beamMat];
      this.el.object3D.add(this._group);
    },

    update (oldData) {
      if (oldData.color !== this.data.color || oldData.intensity !== this.data.intensity) {
        const col = new THREE.Color(this.data.color);
        this._mats.forEach(m => m.color.set(col));
        this._light.color.set(col);
      }
      this._target = this.data.active ? 1 : 0;
    },

    tick (t, dt) {
      const dtSec = Math.min(dt * 0.001, 0.05);
      this._time  = t * 0.001;

      const fadeSpeed = this.data.active ? 2.5 : 1.8;
      this._opacity  += (this._target - this._opacity) * fadeSpeed * dtSec;
      const op        = Math.max(0, Math.min(1, this._opacity));
      const intens    = this.data.intensity;

      const innerPulse = 0.55 + 0.45 * Math.sin(this._time * 3.1);
      const outerPulse = 0.55 + 0.45 * Math.sin(this._time * 3.1 + Math.PI);

      this._innerRing.material.opacity = op * innerPulse * 0.85 * intens;
      this._outerRing.material.opacity = op * outerPulse * 0.55 * intens;

      const is = 1.0 + 0.08 * Math.sin(this._time * 2.4);
      const os = 1.0 + 0.06 * Math.sin(this._time * 2.4 + Math.PI);
      this._innerRing.scale.setScalar(is);
      this._outerRing.scale.setScalar(os);

      this._beam.material.opacity = op * (0.25 + 0.15 * Math.sin(this._time * 4.0)) * intens;
      this._light.intensity = op * 1.6 * intens * (0.7 + 0.3 * Math.sin(this._time * 3.1));
    },

    remove () {
      this.el.object3D.remove(this._group);
    },
  });


  /* ── Scene bootstrap ── */
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl.hasLoaded) { init(); }
  else { sceneEl.addEventListener('loaded', init, { once: true }); }

  function init () {

    const cameraRig  = document.querySelector('#camera-rig');
    const fadePlane  = document.querySelector('#fade-plane');
    const sceneLabel = document.querySelector('#scene-label');
    const introCard  = document.querySelector('#intro-card');
    const enterBtn   = document.querySelector('#enter-btn');
    const modelScene = document.querySelector('#model-scene');

    const scenes360 = {
      street: document.querySelector('#scene-street'),
      temple: document.querySelector('#scene-temple'),
      house:  document.querySelector('#scene-house'),
    };
    const streetVid = document.querySelector('#street-360-vid');

    let currentScene    = 'model';
    let isTransitioning = false;

    const sceneConfig = {
      street:    { label: 'Village Street — Saidpur',        camPos: '0 0 0', camRot: '0 0 0' },
      temple:    { label: 'Prem Mandir / Shahi Mosque',      camPos: '0 0 0', camRot: '0 0 0' },
      house:     { label: 'Abandoned Family Home — Saidpur', camPos: '0 0 0', camRot: '0 0 0' },
      htmlScene: { label: 'Before Partition — Oral History', camPos: '0 0 0', camRot: '0 0 0' },
    };
    const MODEL_CAM_POS = '0 0 0.5';
    const MODEL_CAM_ROT = '0 0 0';


    /* ════════════════════════════════════════════════════════════════
       FOCUS MANAGER
    ════════════════════════════════════════════════════════════════ */
    const FocusManager = (function () {
      let _activeEl = null;

      function activate (selector, color, intensity) {
        if (_activeEl) {
          _activeEl.setAttribute('narration-focus', 'active', false);
        }

        if (!selector) { _activeEl = null; return; }

        const el = document.querySelector(selector);
        if (!el) {
          console.warn('[FocusManager] Target not found:', selector);
          _activeEl = null;
          return;
        }

        if (!el.components['narration-focus']) {
          el.setAttribute('narration-focus', {
            active:    false,
            color:     color     || '#50ffcc',
            intensity: intensity || 1.0,
          });
        }

        el.setAttribute('narration-focus', 'color',     color     || '#50ffcc');
        el.setAttribute('narration-focus', 'intensity', intensity || 1.0);
        el.setAttribute('narration-focus', 'active',    true);

        _activeEl = el;
        console.log('[FocusManager] ✅ Activated focus on', selector);
      }

      function deactivate () {
        if (_activeEl) {
          _activeEl.setAttribute('narration-focus', 'active', false);
          _activeEl = null;
        }
      }

      return { activate, deactivate };
    })();

    window.FocusManager = FocusManager;


    /* ════════════════════════════════════════════════════════════════
       NARRATOR SUBTITLE SYSTEM (Unified 2D & VR)
       ────────────────────────────────────────────────────────────────
       Listens for 'narration-state-enter' / 'narration-state-exit'
       emitted by NarrationController._playBeat().
    ════════════════════════════════════════════════════════════════ */
    const narratorEl = document.querySelector('#polyhedron-narrator');

    const NarratorSubtitle = (function () {
      let el   = document.querySelector('#narrator-subtitle');
      let vrEl = document.querySelector('#vr-subtitle');

      if (!el) {
        el = document.createElement('div');
        el.id = 'narrator-subtitle';
        Object.assign(el.style, {
          position:       'fixed',
          bottom:         '80px',
          left:           '50%',
          transform:      'translateX(-50%)',
          zIndex:         '1200',
          maxWidth:       '620px',
          padding:        '12px 24px',
          background:     'rgba(0,8,12,0.82)',
          border:         '1px solid rgba(80,255,204,0.35)',
          color:          'rgba(240,232,213,0.95)',
          fontFamily:     '"IM Fell English", Georgia, serif',
          fontSize:       '16px',
          lineHeight:     '1.6',
          letterSpacing:  '0.03em',
          textAlign:      'center',
          textShadow:     '0 1px 8px rgba(0,0,0,0.9)',
          backdropFilter: 'blur(4px)',
          opacity:        '0',
          transition:     'opacity 0.5s ease',
          pointerEvents:  'none',
          borderRadius:   '2px',
        });
        document.body.appendChild(el);
      }

      if (narratorEl) {
        narratorEl.addEventListener('narration-state-enter', (evt) => {
          const { state } = evt.detail;
          if (!state.text) return;

          el.innerHTML = state.speakerLabel
            ? `<span style="color:rgba(80,255,204,0.85);font-family:'Inconsolata',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;display:block;margin-bottom:5px">${state.speakerLabel}</span>${state.text}`
            : state.text;
          el.style.opacity = '1';

          if (vrEl) {
            const displayMsg = state.speakerLabel
              ? `${state.speakerLabel}: ${state.text}`
              : state.text;
            vrEl.setAttribute('text', 'value', displayMsg);
            vrEl.setAttribute('visible', 'true');
            vrEl.setAttribute('animation',
              'property: components.text.material.uniforms.opacity.value; from: 0; to: 1; dur: 400; easing: linear');
          }
        });

        narratorEl.addEventListener('narration-state-exit', () => {
          el.style.opacity = '0';
          if (vrEl) {
            vrEl.setAttribute('animation',
              'property: components.text.material.uniforms.opacity.value; from: 1; to: 0; dur: 400; easing: linear');
            setTimeout(() => vrEl.setAttribute('visible', 'false'), 400);
          }
        });

        narratorEl.addEventListener('narration-complete', () => {
          el.style.opacity = '0';
          if (vrEl) vrEl.setAttribute('visible', 'false');
        });
      }

      return {
        show () { el.style.opacity = '1'; if (vrEl) vrEl.setAttribute('visible', 'true'); },
        hide () { el.style.opacity = '0'; if (vrEl) vrEl.setAttribute('visible', 'false'); },
      };
    })();


    /* ════════════════════════════════════════════════════════════════
       NARRATION ↔ FOCUS BRIDGE
       ────────────────────────────────────────────────────────────────
       Listens to narration-state-enter events and drives FocusManager.
       NarrationController also calls FocusManager directly, but this
       listener ensures the subtitle and focus always stay in sync.
    ════════════════════════════════════════════════════════════════ */
    if (narratorEl) {
      narratorEl.addEventListener('narration-state-enter', (evt) => {
        const state = evt.detail.state;
        if (state && state.focusTarget) {
          FocusManager.activate(
            state.focusTarget,
            state.highlightColor     || '#50ffcc',
            state.highlightIntensity || 1.0,
          );
        } else {
          FocusManager.deactivate();
        }
      });

      narratorEl.addEventListener('narration-state-exit', () => {
        FocusManager.deactivate();
      });

      narratorEl.addEventListener('narration-complete', () => {
        FocusManager.deactivate();
      });
    }


    /* ════════════════════════════════════════════════════════════════
       STORY BEATS CONFIG — 4-Beat Guided Tour
       ────────────────────────────────────────────────────────────────
       Central config. Swap audio, adjust focusPoint positions, or
       update subtitle text here — no logic changes needed elsewhere.

       focusPoint: World-space coords where the narrator glides to.
                   Adjust to match your actual scene layout.
                   (Model is at position="0 0.8 -4" scale="0.015")

       focusTarget: CSS selector for the <a-entity narration-focus>
                    anchor that must exist in #model-scene in HTML.

       audio:       CSS selector for <audio> in <a-assets>.
    ════════════════════════════════════════════════════════════════ */
    const STORY_BEATS = [
      {
        id:                 'landscape',
        title:              'Landscape — Orchards & Springs',
        audio:              '#audio-beat-1',
        subtitle:           'The land here remembers everything. The orchards, the springs, the scent of the earth before Partition.',
        speakerLabel:       'Memory',
        focusPoint:         { x:  0.18, y: 1.55, z: -4.20 },
        focusTarget:        '#focus-trees',
        highlightColor:     '#66ff99',
        highlightIntensity: 1.3,
      },
      {
        id:                 'heart',
        title:              'Heart — Temple & School',
        audio:              '#audio-beat-2',
        subtitle:           'The stairs of the temple have slabs with the names of Sikhs and Hindus who donated them. They all lived here together.',
        speakerLabel:       'Local Man 2',
        focusPoint:         { x:  0.12, y: 1.55, z: -4.05 },
        focusTarget:        '#focus-temple',
        highlightColor:     '#ff9966',
        highlightIntensity: 1.6,
      },
      {
        id:                 'daily-life',
        title:              'Daily Life — Water Mill',
        audio:              '#audio-beat-3',
        subtitle:           'Do you see that big banyan tree? There used to be a water-powered flour mill under it. Everyone from the village would go there.',
        speakerLabel:       'Local Man 2',
        focusPoint:         { x:  0.08, y: 1.52, z: -3.90 },
        focusTarget:        '#focus-pond',
        highlightColor:     '#66ccff',
        highlightIntensity: 1.4,
      },
      {
        id:                 'transition',
        title:              'Transition — Partition',
        audio:              '#audio-beat-4',
        subtitle:           'It was a beautiful mix of people. After the Hindus left, others moved into their houses. The village changed, but the walls remember.',
        speakerLabel:       'Local Man 1',
        focusPoint:         { x: -0.05, y: 1.55, z: -4.10 },
        focusTarget:        '#focus-mosque',
        highlightColor:     '#ffcc66',
        highlightIntensity: 1.2,
      },
    ];


    /* ════════════════════════════════════════════════════════════════
       NARRATION CONTROLLER  v4 — 4-Beat Guided Tour Engine
       ────────────────────────────────────────────────────────────────
       Full state machine:
         IDLE            → waiting for user to approach narrator
         MOVING_TO_NEXT  → narrator gliding toward next beat's focus point
         ARRIVAL_PAUSE   → ~2s silent pause after arrival before audio
         PLAYING_BEAT    → audio + subtitle + focus ring active
         WAITING_FOR_USER → user wandered too far; narrator pauses in place
         COMPLETED       → all beats done; hotspots unlocked

       Architecture:
         • This controller owns ALL story logic and state transitions.
         • polyhedron-narrator component owns visual movement + effects.
         • Controller drives movement via comp.activeFocusPoint / comp.isMoving.
         • comp.onArrivalCallback is called by the component on arrival.
         • Events are emitted on narratorEl so external UI can react.
         • SOS / scene transitions always work: pause() / resume() API.
    ════════════════════════════════════════════════════════════════ */
    const NarrationController = (function () {

      const STATES = Object.freeze({
        IDLE:             'IDLE',
        MOVING_TO_NEXT:   'MOVING_TO_NEXT',
        ARRIVAL_PAUSE:    'ARRIVAL_PAUSE',
        PLAYING_BEAT:     'PLAYING_BEAT',
        WAITING_FOR_USER: 'WAITING_FOR_USER',
        COMPLETED:        'COMPLETED',
      });

      /* ── Tunable constants ─────────────────────────────────────── */
      const PROXIMITY_TRIGGER_DIST = 2.2;   // metres — user must reach to start tour
      const WAIT_PROXIMITY_DIST    = 4.5;   // metres — beyond this, narrator waits
      const ARRIVAL_PAUSE_MS       = 2000;  // ms silent pause after arriving
      const POLL_INTERVAL_MS       = 300;   // proximity check interval (ms)

      /* ── Internal state ────────────────────────────────────────── */
      let _state              = STATES.IDLE;
      let _comp               = null;   // polyhedron-narrator component instance
      let _beatIndex          = -1;     // current beat (0-based), -1 = not started
      let _pollTimer          = null;
      let _arrivalTimer       = null;
      let _audioEl            = null;   // currently playing <audio> element
      let _audioEndCb         = null;   // bound 'ended' listener
      let _suspended          = false;  // true when paused by scene transition/SOS
      let _waitingBeforeState = null;   // state to resume after WAITING_FOR_USER

      /* ── Init: called by wireNarrator() once component is ready ── */
      function init (narratorComp) {
        if (_comp) {
          console.warn('[NarrationController] Already initialised.');
          return;
        }
        _comp      = narratorComp;
        _pollTimer = setInterval(_checkProximity, POLL_INTERVAL_MS);
        console.log('[NarrationController] Ready — IDLE, polling every 300ms.');
      }

      /* ── Proximity polling (IDLE only) ─────────────────────────── */
      function _checkProximity () {
        if (_state !== STATES.IDLE) {
          clearInterval(_pollTimer);
          _pollTimer = null;
          return;
        }
        if (currentScene !== 'model') return;

        const dist = _comp._camPos.distanceTo(_comp._worldPos);
        if (dist < PROXIMITY_TRIGGER_DIST) {
          clearInterval(_pollTimer);
          _pollTimer = null;
          _startTour();
        }
      }

      /* ── Kick off the tour from beat 0 ─────────────────────────── */
      function _startTour () {
        console.log('[NarrationController] 🎯 Proximity trigger — starting guided tour.');
        _beatIndex = 0;
        _moveToNextBeat();
      }

      /* ── Begin movement phase toward current beat's focus point ── */
      function _moveToNextBeat () {
        if (_beatIndex >= STORY_BEATS.length) {
          _complete();
          return;
        }

        const beat = STORY_BEATS[_beatIndex];
        _setState(STATES.MOVING_TO_NEXT);
        _emit('narrator-moving', { beatIndex: _beatIndex, beat });

        // Hand the target to the component — it lerps there each tick()
        _comp.activeFocusPoint.set(beat.focusPoint.x, beat.focusPoint.y, beat.focusPoint.z);
        _comp.isMoving          = true;
        _comp.onArrivalCallback = _onArrival;

        console.log(`[NarrationController] ▶ Moving to beat ${_beatIndex}: "${beat.title}"`);
      }

      /* ── Called by polyhedron-narrator component when it arrives ─ */
      function _onArrival () {
        if (_state !== STATES.MOVING_TO_NEXT) return;
        if (_suspended) return;

        _setState(STATES.ARRIVAL_PAUSE);
        _comp.isMoving = false;
        _emit('narrator-arrived', { beatIndex: _beatIndex });

        console.log(`[NarrationController] ⏸ Arrived at beat ${_beatIndex} — ${ARRIVAL_PAUSE_MS}ms pause.`);

        _arrivalTimer = setTimeout(() => {
          if (_suspended) return;
          _playBeat();
        }, ARRIVAL_PAUSE_MS);
      }

      /* ── Play current beat: audio + subtitle + focus ring ────────── */
      function _playBeat () {
        const beat = STORY_BEATS[_beatIndex];
        _setState(STATES.PLAYING_BEAT);
        _comp._isSpeaking = true;

        // Activate the landmark focus ring
        if (beat.focusTarget) {
          FocusManager.activate(beat.focusTarget, beat.highlightColor, beat.highlightIntensity);
        }

        // Emit beat-started for any external UI (e.g. SOS button visibility)
        _emit('beat-started', { beatIndex: _beatIndex, beat });

        // Drive NarratorSubtitle via the same narration-state-enter event
        // that the subtitle system already listens to — zero coupling change.
        if (narratorEl) {
          const customEvt = new CustomEvent('narration-state-enter', {
            detail: {
              id: beat.id,
              state: {
                text:               beat.subtitle,
                speakerLabel:       beat.speakerLabel,
                focusTarget:        beat.focusTarget,
                highlightColor:     beat.highlightColor,
                highlightIntensity: beat.highlightIntensity,
              },
            },
          });
          narratorEl.dispatchEvent(customEvt);
        }

        // Start audio via NarrationAudioManager (the same manager from v3)
        if (beat.audio) {
          _audioEl = document.querySelector(beat.audio);
          if (_audioEl) {
            NarrationAudioManager.play(_audioEl, 0.9, 300);

            _audioEndCb = () => _onBeatEnd();
            _audioEl.addEventListener('ended', _audioEndCb, { once: true });

            // Duration fallback: if 'ended' never fires, advance after audio
            // duration + 1s buffer (guards against CORS/silent failures)
            _audioEl.addEventListener('loadedmetadata', () => {
              if (_state !== STATES.PLAYING_BEAT) return;
              const fallbackMs = (_audioEl.duration || 10) * 1000 + 1000;
              const fallbackId = setTimeout(() => {
                if (_state === STATES.PLAYING_BEAT) {
                  console.warn('[NarrationController] "ended" fallback fired for beat', _beatIndex);
                  _onBeatEnd();
                }
              }, fallbackMs);
              _audioEl.addEventListener('ended', () => clearTimeout(fallbackId), { once: true });
            }, { once: true });

          } else {
            console.warn('[NarrationController] Audio element not found:', beat.audio);
            setTimeout(_onBeatEnd, 8000);
          }
        } else {
          // No audio — advance after 5s default
          setTimeout(_onBeatEnd, 5000);
        }

        console.log(`[NarrationController] 🔊 Playing beat ${_beatIndex}: "${beat.title}"`);
      }

      /* ── Beat finished — clean up, advance ──────────────────────── */
      function _onBeatEnd () {
        if (_state !== STATES.PLAYING_BEAT) return;
        if (_suspended) return;

        _removeAudioEndListener();
        FocusManager.deactivate();
        _comp._isSpeaking = false;
        _comp._isWaiting  = false;

        _emit('beat-ended', { beatIndex: _beatIndex, beat: STORY_BEATS[_beatIndex] });

        if (narratorEl) {
          narratorEl.dispatchEvent(new CustomEvent('narration-state-exit', {
            detail: { id: STORY_BEATS[_beatIndex].id },
          }));
        }

        console.log(`[NarrationController] ✅ Beat ${_beatIndex} ended.`);

        _beatIndex++;
        if (_beatIndex >= STORY_BEATS.length) {
          _complete();
        } else {
          _checkUserThenContinue();
        }
      }

      /* ── Check user is close enough before moving to next beat ──── */
      function _checkUserThenContinue () {
        const dist = _comp._camPos.distanceTo(_comp._worldPos);
        if (dist > WAIT_PROXIMITY_DIST) {
          _waitForUser(STATES.MOVING_TO_NEXT);
        } else {
          _moveToNextBeat();
        }
      }

      /* ── User too far — pause and wait ──────────────────────────── */
      function _waitForUser (resumeState) {
        if (_state === STATES.WAITING_FOR_USER) return;
        _waitingBeforeState = resumeState || STATES.MOVING_TO_NEXT;
        _setState(STATES.WAITING_FOR_USER);
        _comp.isMoving   = false;
        _comp._isWaiting = true;
        NarrationAudioManager.pause();
        _emit('narrator-waiting', { beatIndex: _beatIndex });
        console.log('[NarrationController] ⏳ Waiting for user to return...');

        const waitPoll = setInterval(() => {
          if (_state !== STATES.WAITING_FOR_USER) { clearInterval(waitPoll); return; }
          if (_suspended) return;
          const dist = _comp._camPos.distanceTo(_comp._worldPos);
          if (dist <= WAIT_PROXIMITY_DIST) {
            clearInterval(waitPoll);
            _resumeAfterWait();
          }
        }, 500);
      }

      /* ── User returned — resume from correct phase ──────────────── */
      function _resumeAfterWait () {
        console.log('[NarrationController] 👣 User returned — resuming.');
        _comp._isWaiting = false;
        const prev = _waitingBeforeState || STATES.MOVING_TO_NEXT;
        _waitingBeforeState = null;

        if (prev === STATES.PLAYING_BEAT) {
          _setState(STATES.PLAYING_BEAT);
          NarrationAudioManager.resume(0.9);
        } else {
          _moveToNextBeat();
        }
      }

      /* ── All beats done ─────────────────────────────────────────── */
      function _complete () {
        _setState(STATES.COMPLETED);
        _comp._isSpeaking = false;
        _comp.isMoving    = false;
        _comp._isWaiting  = false;
        FocusManager.deactivate();
        NarrationAudioManager.stop(800);

        _emit('narration-complete', {});
        if (narratorEl) {
          narratorEl.dispatchEvent(new CustomEvent('narration-complete', { detail: {} }));
        }

        console.log('[NarrationController] 🎉 Narration complete. Hotspots unlocked.');
      }

      /* ── Emit event on narratorEl (A-Frame style) ───────────────── */
      function _emit (eventName, detail) {
        if (narratorEl) narratorEl.emit(eventName, detail);
      }

      /* ── State transition ───────────────────────────────────────── */
      function _setState (newState) {
        console.log(`[NarrationController] ${_state} → ${newState}`);
        _state = newState;
      }

      /* ── Remove audio end listener safely ──────────────────────── */
      function _removeAudioEndListener () {
        if (_audioEl && _audioEndCb) {
          _audioEl.removeEventListener('ended', _audioEndCb);
          _audioEndCb = null;
        }
      }

      /* ── PUBLIC API ─────────────────────────────────────────────── */
      return {
        init,

        /** Current state string (one of STATES values) */
        getState () { return _state; },

        /** Current beat index (0–3), or -1 before start */
        getBeatIndex () { return _beatIndex; },

        /** STATES enum (for external comparisons) */
        STATES,

        /** Pause narration — called on scene transition or SOS */
        pause () {
          if (_suspended) return;
          _suspended = true;
          NarrationAudioManager.pause();
          _removeAudioEndListener();
          if (_arrivalTimer) { clearTimeout(_arrivalTimer); _arrivalTimer = null; }
          if (_comp) _comp.isMoving = false;
          console.log('[NarrationController] ⏸ Suspended.');
        },

        /** Resume narration */
        resume () {
          if (!_suspended) return;
          _suspended = false;
          console.log('[NarrationController] ▶ Resumed.');

          if      (_state === STATES.MOVING_TO_NEXT)  {
            _comp.isMoving = true;
            _comp.onArrivalCallback = _onArrival;
          }
          else if (_state === STATES.ARRIVAL_PAUSE)   {
            _arrivalTimer = setTimeout(() => { if (!_suspended) _playBeat(); }, ARRIVAL_PAUSE_MS);
          }
          else if (_state === STATES.PLAYING_BEAT)    {
            NarrationAudioManager.resume(0.9);
          }
          // WAITING_FOR_USER: wait-poll loop resumes naturally
        },

        /** Force-start from idle (testing / VR trigger button) */
        forceStart () {
          if (_state !== STATES.IDLE) {
            console.warn('[NarrationController] forceStart ignored — not idle.');
            return;
          }
          if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
          _startTour();
        },

        /** Jump directly to a beat by index (0–3) */
        goToBeat (index) {
          if (index < 0 || index >= STORY_BEATS.length) return;
          _removeAudioEndListener();
          if (_arrivalTimer) { clearTimeout(_arrivalTimer); _arrivalTimer = null; }
          FocusManager.deactivate();
          NarrationAudioManager.stop(200);
          if (_comp) { _comp._isSpeaking = false; _comp._isWaiting = false; }
          _beatIndex = index;
          _moveToNextBeat();
        },

        /** Read-only reference to story beats */
        get beats () { return STORY_BEATS; },
      };
    })();

    window.NarrationController = NarrationController;


    /* ════════════════════════════════════════════════════════════════
       WIRE NARRATOR — connects controller to component
       ────────────────────────────────────────────────────────────────
       Polls until the polyhedron-narrator A-Frame component is fully
       initialised, then calls NarrationController.init().
    ════════════════════════════════════════════════════════════════ */
    function wireNarrator () {
      if (!narratorEl) {
        console.warn('[wireNarrator] #polyhedron-narrator not found in DOM.');
        return;
      }

      const comp = narratorEl.components['polyhedron-narrator'];
      if (!comp) {
        setTimeout(wireNarrator, 100);
        return;
      }

      NarrationController.init(comp);
      console.log('[wireNarrator] ✅ NarrationController wired. Beats:', STORY_BEATS.length);
    }
    wireNarrator();


    /* ════════════════════════════════════════════════════════════════
       POLYHEDRON NARRATOR LABEL TRACKER
       ────────────────────────────────────────────────────────────────
       Projects the polyhedron's world position to screen space and
       positions the #ghost-hud element above it.
       Hides the HUD label once the tour has started.
    ════════════════════════════════════════════════════════════════ */
    (function polyLabelTracker () {
      const hudEl  = document.querySelector('#ghost-hud');
      const polyEl = document.querySelector('#polyhedron-narrator');
      const camEl  = document.querySelector('#main-camera');
      if (!hudEl || !polyEl || !camEl) return;

      const SHOW_DIST = 3.2;
      const Y_OFFSET  = -18;
      const _wPos     = new THREE.Vector3();
      const _ndc      = new THREE.Vector3();
      const _camWPos  = new THREE.Vector3();

      let _cam = null, _renderer = null;
      sceneEl.addEventListener('renderstart', () => {
        _cam      = camEl.getObject3D('camera');
        _renderer = sceneEl.renderer;
      }, { once: true });

      sceneEl.addEventListener('tick', () => {
        if (!_cam || !_renderer || currentScene !== 'model') {
          hudEl.classList.remove('visible'); return;
        }

        // Hide the "approach" label once the tour has started
        const ctrlState = window.NarrationController
          ? window.NarrationController.getState()
          : 'IDLE';
        if (ctrlState !== 'IDLE') {
          hudEl.classList.remove('visible'); return;
        }

        polyEl.object3D.getWorldPosition(_wPos);
        _wPos.y += 0.90;

        camEl.object3D.getWorldPosition(_camWPos);
        const dist = _wPos.distanceTo(_camWPos);

        if (dist > SHOW_DIST) {
          hudEl.classList.remove('visible'); return;
        }

        _ndc.copy(_wPos).project(_cam);
        if (_ndc.z > 1) { hudEl.classList.remove('visible'); return; }

        const cvs = _renderer.domElement;
        const sx  = ( _ndc.x + 1) * 0.5 * cvs.clientWidth;
        const sy  = (-_ndc.y + 1) * 0.5 * cvs.clientHeight + Y_OFFSET;
        hudEl.style.left = `${sx}px`;
        hudEl.style.top  = `${sy}px`;
        hudEl.classList.add('visible');
      });
    })();


    /* ════════════════════════════════════════════════════════════════
       HOLOGRAM LABEL TRACKER
    ════════════════════════════════════════════════════════════════ */
    (function holoLabelTracker () {
      const hudEl  = document.querySelector('#holo-hud');
      const holoEl = document.querySelector('#hotspot-holo');
      const camEl  = document.querySelector('#main-camera');
      if (!hudEl || !holoEl || !camEl) return;

      const SHOW_DIST = 3.5;
      const Y_OFFSET  = -22;
      const _wPos     = new THREE.Vector3();
      const _ndc      = new THREE.Vector3();
      const _camWPos  = new THREE.Vector3();

      let _cam = null, _renderer = null;
      sceneEl.addEventListener('renderstart', () => {
        _cam      = camEl.getObject3D('camera');
        _renderer = sceneEl.renderer;
      }, { once: true });

      sceneEl.addEventListener('tick', () => {
        if (!_cam || !_renderer || currentScene !== 'model') {
          hudEl.classList.remove('visible'); return;
        }
        holoEl.object3D.getWorldPosition(_wPos);
        _wPos.y += 0.62;

        camEl.object3D.getWorldPosition(_camWPos);
        if (_wPos.distanceTo(_camWPos) > SHOW_DIST) {
          hudEl.classList.remove('visible'); return;
        }

        _ndc.copy(_wPos).project(_cam);
        if (_ndc.z > 1) { hudEl.classList.remove('visible'); return; }

        const cvs = _renderer.domElement;
        const sx  = ( _ndc.x + 1) * 0.5 * cvs.clientWidth;
        const sy  = (-_ndc.y + 1) * 0.5 * cvs.clientHeight + Y_OFFSET;
        hudEl.style.left = `${sx}px`;
        hudEl.style.top  = `${sy}px`;
        hudEl.classList.add('visible');
      });
    })();


    /* ════════════════════════════════════════════════════════════════
       SCENE NAVIGATION — hotspot clicks
    ════════════════════════════════════════════════════════════════ */
    sceneEl.addEventListener('click', (e) => {
      const target = e.detail && e.detail.intersection && e.detail.intersection.object
        ? closestWithClass(e.detail.intersection.object.el, 'model-hotspot')
          || closestWithAttr(e.detail.intersection.object.el, 'data-scene')
        : null;
      if (!target) return;

      const sceneName = target.dataset.scene;
      if (!sceneName) return;
      if (sceneName === currentScene) return;
      if (isTransitioning) return;

      if (sceneName === 'htmlScene') {
        const vc = document.querySelector('#village-partition-overlay');
        if (vc) vc.classList.add('visible');
        return;
      }

      transitionTo(sceneName);
    });

    function transitionTo (sceneName) {
      if (isTransitioning) return;
      isTransitioning = true;

      // Pause narration when leaving model scene
      if (currentScene === 'model' && sceneName !== 'model') {
        NarrationController.pause();
      }

      fadeOut(() => {
        if (modelScene) modelScene.setAttribute('visible', 'false');
        hide360All();

        if (sceneName === 'model') {
          if (modelScene) modelScene.setAttribute('visible', 'true');
          if (cameraRig) {
            cameraRig.setAttribute('position', MODEL_CAM_POS);
            cameraRig.setAttribute('rotation', MODEL_CAM_ROT);
          }
          // Resume narration when returning to model scene
          NarrationController.resume();
        } else {
          const sc = scenes360[sceneName];
          if (sc) sc.setAttribute('visible', 'true');
          if (sceneName === 'street' && streetVid) streetVid.play().catch(() => {});
          if (cameraRig) {
            const cfg = sceneConfig[sceneName];
            if (cfg) {
              cameraRig.setAttribute('position', cfg.camPos);
              cameraRig.setAttribute('rotation', cfg.camRot);
            }
          }
        }

        currentScene    = sceneName;
        isTransitioning = false;

        fadeIn(() => {
          const cfg = sceneConfig[sceneName] || { label: 'Saidpur Village' };
          showSceneLabel(cfg.label || '');
        });
      });
    }

    /* Back-navigation in 360 scenes */
    sceneEl.addEventListener('click', (e) => {
      const target = e.detail && e.detail.intersection && e.detail.intersection.object
        ? closestWithAttr(e.detail.intersection.object.el, 'data-nav')
        : null;
      if (!target) return;
      if (target.dataset.nav === 'back') transitionTo('model');
    });

    function hide360All () {
      Object.values(scenes360).forEach(s => {
        if (!s) return;
        s.setAttribute('visible', 'false');
        s.querySelectorAll('a-sound').forEach(snd => {
          if (snd.components.sound) snd.components.sound.pauseSound();
        });
      });
      closeAllPanels();
    }


    /* ════════════════════════════════════════════════════════════════
       STORY PANELS
    ════════════════════════════════════════════════════════════════ */
    function openStoryPanel (sceneKey, type, assetSelector) {
      if (sceneKey === 'model') return;
      const panel = document.querySelector(`#${type}-panel-${sceneKey}`);
      if (!panel) return;
      panel.setAttribute('visible', 'true');
      if (type === 'video' && assetSelector) {
        const v = document.querySelector(assetSelector);
        if (v) v.play().catch(() => {});
      }
    }
    function pausePanelVideo (panel) {
      const av = panel.querySelector('a-video');
      if (!av) return;
      const src = av.getAttribute('src');
      if (src) { const r = document.querySelector(src); if (r) r.pause(); }
    }
    function closeAllPanels () {
      ['street','temple','house'].forEach(k => {
        ['video','photo'].forEach(t => {
          const p = document.querySelector(`#${t}-panel-${k}`);
          if (p) { p.setAttribute('visible', 'false'); pausePanelVideo(p); }
        });
      });
    }


    /* ════════════════════════════════════════════════════════════════
       FADE HELPERS
    ════════════════════════════════════════════════════════════════ */
    const FADE_MS = 600;
    function fadeOut (cb) {
      fadePlane.setAttribute('animation__fo', `property:material.opacity;from:0;to:1;dur:${FADE_MS};easing:linear`);
      setTimeout(cb, FADE_MS + 60);
    }
    function fadeIn (cb) {
      fadePlane.removeAttribute('animation__fo');
      fadePlane.setAttribute('animation__fi', `property:material.opacity;from:1;to:0;dur:${FADE_MS};easing:linear`);
      setTimeout(() => { fadePlane.removeAttribute('animation__fi'); if (cb) cb(); }, FADE_MS + 60);
    }


    /* ════════════════════════════════════════════════════════════════
       SCENE LABEL HUD
    ════════════════════════════════════════════════════════════════ */
    let labelTimer = null;
    function showSceneLabel (text) {
      if (!sceneLabel) return;
      if (labelTimer) clearTimeout(labelTimer);
      sceneLabel.textContent = text;
      sceneLabel.classList.add('visible');
      labelTimer = setTimeout(() => sceneLabel.classList.remove('visible'), 3500);
    }
    setTimeout(() => {
      if (window._introComplete) showSceneLabel('Architectural Model — Saidpur Village');
    }, 2500);


    /* ════════════════════════════════════════════════════════════════
       VILLAGE PARTITION HTML SCENE MODULE
    ════════════════════════════════════════════════════════════════ */
    const villageScene = (function () {
      const overlay    = document.querySelector('#village-partition-overlay');
      const vpScene    = document.querySelector('#vp-scene');
      const playBtn    = document.querySelector('#vp-play-btn');
      const subtitleEl = document.querySelector('#vp-subtitles');
      const progFill   = document.querySelector('#vp-prog-fill');
      const timeEl     = document.querySelector('#vp-time');
      const audioEl    = document.querySelector('#vp-interview-audio');
      const titleCard  = document.querySelector('#vp-title-card');
      const speakerEls = {
        'vp-speaker-interviewer': document.querySelector('#vp-speaker-interviewer'),
        'vp-speaker-man1':        document.querySelector('#vp-speaker-man1'),
        'vp-speaker-man2':        document.querySelector('#vp-speaker-man2'),
      };

      const returnBtn = document.querySelector('#vp-return-btn');
      if (returnBtn) {
        returnBtn.addEventListener('click', () => {
          if (overlay) overlay.classList.remove('visible');
        });
      }

      return {};
    })();


    /* ── Loading / intro ── */
    setTimeout(() => {
      const ls = document.querySelector('#loading-screen');
      if (ls) ls.classList.add('hidden');
    }, 1200);

    if (enterBtn) enterBtn.addEventListener('click', () => {
      introCard.classList.remove('visible');
      const ambient = document.querySelector('#ambient-model');
      if (ambient && ambient.play) ambient.play().catch(() => {});
    });


    /* ── White material override on architectural model ── */
    const archGlb = document.querySelector('#arch-glb');
    if (archGlb) {
      archGlb.addEventListener('model-loaded', (e) => {
        e.detail.model.traverse((node) => {
          if (!node.isMesh) return;
          const orig = node.material;
          node.material = new THREE.MeshStandardMaterial({
            color:             0xf0ece4,
            roughness:         0.6,
            metalness:         0.0,
            emissiveMap:       orig ? orig.emissiveMap : null,
            emissive:          new THREE.Color(0),
            emissiveIntensity: 0,
          });
          node.castShadow    = true;
          node.receiveShadow = true;
        });
        const box  = new THREE.Box3().setFromObject(e.detail.model);
        const size = box.getSize(new THREE.Vector3());
        console.log(`✅ Model: X=${size.x.toFixed(3)} Y=${size.y.toFixed(3)} Z=${size.z.toFixed(3)}`);
      });
      archGlb.addEventListener('model-error', (e) => console.error('❌ Model failed:', e.detail));
    }

  } // end init()


  /* ── TREE-WALK HELPERS ── */
  function closestWithAttr (el, attr) {
    let n = el;
    while (n && n.tagName !== 'A-SCENE') {
      if (n.hasAttribute && n.hasAttribute(attr)) return n;
      n = n.parentEl || n.parentElement;
    }
    return null;
  }
  function closestWithClass (el, cls) {
    let n = el;
    while (n && n.classList && n.tagName !== 'A-SCENE') {
      if (n.classList.contains(cls)) return n;
      n = n.parentEl || n.parentElement;
    }
    return null;
  }

})();