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
        setTimeout(() => {
  if (window.NarrationController) {
    window.NarrationController.startTour();
  }
}, 1800); 

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
      street:        document.querySelector('#scene-street'),
      temple:        document.querySelector('#scene-temple'),
      house:         document.querySelector('#scene-house'),
      margalla:      document.querySelector('#scene-margalla'),
      banyan:        document.querySelector('#scene-banyan'),
      mosque:        document.querySelector('#scene-mosque'),
      restaurant:    document.querySelector('#scene-restaurant'),
      shops:         document.querySelector('#scene-shops'),
      neighbourhood: document.querySelector('#scene-neighbourhood'),
      field:         document.querySelector('#scene-field'),
      handicraft:    document.querySelector('#scene-handicraft'),
      villageedge:   document.querySelector('#scene-villageedge'),
      oldstreets:    document.querySelector('#scene-oldstreets'),
    };
    const streetVid = document.querySelector('#street-360-vid');

    let currentScene    = 'model';
    let isTransitioning = false;

    const sceneConfig = {
      street:        { label: 'Village Street — Saidpur',                camPos: '0 0 0', camRot: '0 0 0' },
      temple:        { label: 'Prem Mandir / Shahi Mosque',              camPos: '0 0 0', camRot: '0 0 0' },
      house:         { label: 'Abandoned Family Home — Saidpur',         camPos: '0 0 0', camRot: '0 0 0' },
      htmlScene:     { label: 'Before Partition — Oral History',         camPos: '0 0 0', camRot: '0 0 0' },
      margalla:      { label: 'Margalla Hills Viewpoint — Saidpur',      camPos: '0 0 0', camRot: '0 0 0' },
      banyan:        { label: 'Banyan Tree — Saidpur',                   camPos: '0 0 0', camRot: '0 0 0' },
      mosque:        { label: 'Mosque — Saidpur',                        camPos: '0 0 0', camRot: '0 0 0' },
      restaurant:    { label: 'Restaurant — Saidpur',                    camPos: '0 0 0', camRot: '0 0 0' },
      shops:         { label: 'Shops — Saidpur',                         camPos: '0 0 0', camRot: '0 0 0' },
      neighbourhood: { label: 'Neighbourhood — Saidpur',                 camPos: '0 0 0', camRot: '0 0 0' },
      field:         { label: 'Field — Saidpur',                         camPos: '0 0 0', camRot: '0 0 0' },
      handicraft:    { label: 'Handicraft Area — Saidpur',               camPos: '0 0 0', camRot: '0 0 0' },
      villageedge:   { label: 'Village Edge — Saidpur',                  camPos: '0 0 0', camRot: '0 0 0' },
      oldstreets:    { label: 'Old Residential Streets — Saidpur',       camPos: '0 0 0', camRot: '0 0 0' },
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
       TOUR STOPS CONFIG — 10-Stop Guided Tour
       ────────────────────────────────────────────────────────────────
       focusPoint coords match the real hotspot world positions from
       index.html, so the narrator travels the full extent of the model.
       Route is designed for maximum diagonal travel:
         SW shops → NW margalla → NE village-edge → SE field
       Y is raised to 1.55 so the narrator floats visibly above the model.
       The focus anchor entities in index.html must match these positions.
    ════════════════════════════════════════════════════════════════ */
    const TOUR_STOPS = [
      {
        // START near the narrator's spawn point (position="2 1.25 -5")
        // First move: glide to the south-west Shops corner
        id:                 'stop-1',
        title:              'Shops — Village Market',
        target:             '#focus-shops',
        audio:              '#audio-stop-1',
        subtitle:           'Every village begins with its market. Here spices, cloth and gossip moved freely — across faiths, across streets.',
        speakerLabel:       'Memory',
        highlightColor:     '#ddccff',
        highlightIntensity: 1.3,
        pauseAfterArrival:  800,
        focusPoint:         { x: -0.80, y: 1.55, z: -3.35 },  // matches #hotspot-shops
      },
      {
        // Long diagonal: SW → NW (Margalla Hills viewpoint)
        id:                 'stop-2',
        title:              'Margalla Hills — The Viewpoint',
        target:             '#focus-margalla',
        audio:              '#audio-stop-2',
        subtitle:           'From this hill you could see all of Saidpur. The orchards, the springs — the Margalla Hills have witnessed everything.',
        speakerLabel:       'Memory',
        highlightColor:     '#b8ffb0',
        highlightIntensity: 1.4,
        pauseAfterArrival:  800,
        focusPoint:         { x: -0.90, y: 1.55, z: -4.80 },  // matches #hotspot-margalla
      },
      {
        // NW → central-west Handicraft area
        id:                 'stop-3',
        title:              'Handicraft Area',
        target:             '#focus-handicraft',
        audio:              '#audio-stop-3',
        subtitle:           'The craftsmen of Saidpur were known across the region. Their work outlasted the families who commissioned it.',
        speakerLabel:       'Local Man 1',
        highlightColor:     '#ffddaa',
        highlightIntensity: 1.2,
        pauseAfterArrival:  800,
        focusPoint:         { x: -0.95, y: 1.55, z: -4.55 },  // matches #hotspot-handicraft
      },
      {
        // West → central Mosque
        id:                 'stop-4',
        title:              'The Mosque',
        target:             '#focus-mosque-hs',
        audio:              '#audio-stop-4',
        subtitle:           'It was a beautiful mix of people. After the Hindus left, others moved into their houses. The village changed, but the walls remember.',
        speakerLabel:       'Local Man 1',
        highlightColor:     '#ffe0a0',
        highlightIntensity: 1.5,
        pauseAfterArrival:  800,
        focusPoint:         { x: -0.55, y: 1.55, z: -4.10 },  // matches #hotspot-mosque
      },
      {
        // Centre → Temple (short, contextual)
        id:                 'stop-5',
        title:              'The Temple Courtyard',
        target:             '#focus-temple',
        audio:              '#audio-stop-5',
        subtitle:           'The stairs of the temple have slabs with the names of Sikhs and Hindus who donated them. They all lived here together.',
        speakerLabel:       'Local Man 2',
        highlightColor:     '#9ee8ff',
        highlightIntensity: 1.6,
        pauseAfterArrival:  800,
        focusPoint:         { x:  0.12, y: 1.55, z: -4.05 },  // matches #hotspot-temple
      },
      {
        // Long diagonal: centre → far NE Village Edge
        id:                 'stop-6',
        title:              'Village Edge — The Perimeter',
        target:             '#focus-villageedge',
        audio:              '#audio-stop-6',
        subtitle:           'At the edge of the village the fields begin. In 1947 many families walked out through here, believing they would return within weeks.',
        speakerLabel:       'Local Man 1',
        highlightColor:     '#ffc8e8',
        highlightIntensity: 1.3,
        pauseAfterArrival:  900,
        focusPoint:         { x:  1.05, y: 1.55, z: -4.90 },  // matches #hotspot-villageedge
      },
      {
        // NE → east Neighbourhood
        id:                 'stop-7',
        title:              'The Neighbourhood',
        target:             '#focus-neighbourhood',
        audio:              '#audio-stop-7',
        subtitle:           'Muslim, Hindu, Sikh families lived side by side in these lanes. They did not call themselves by religion — they called each other by name.',
        speakerLabel:       'Memory',
        highlightColor:     '#aaddff',
        highlightIntensity: 1.4,
        pauseAfterArrival:  800,
        focusPoint:         { x:  1.00, y: 1.55, z: -4.10 },  // matches #hotspot-neighbourhood
      },
      {
        // East → Banyan Tree (north-east quadrant)
        id:                 'stop-8',
        title:              'The Banyan Tree',
        target:             '#focus-banyan',
        audio:              '#audio-stop-8',
        subtitle:           'Do you see that big banyan tree? There used to be a water-powered flour mill under it. Everyone from the village would go there.',
        speakerLabel:       'Local Man 2',
        highlightColor:     '#88dd66',
        highlightIntensity: 1.4,
        pauseAfterArrival:  800,
        focusPoint:         { x:  0.75, y: 1.55, z: -4.70 },  // matches #hotspot-banyan
      },
      {
        // Long diagonal: NE → SE Old Streets
        id:                 'stop-9',
        title:              'Old Residential Streets',
        target:             '#focus-oldstreets',
        audio:              '#audio-stop-9',
        subtitle:           'These walls still hold the handprints of the families who plastered them. Different hands now, but the same clay.',
        speakerLabel:       'Local Man 1',
        highlightColor:     '#ffeecc',
        highlightIntensity: 1.2,
        pauseAfterArrival:  800,
        focusPoint:         { x:  0.60, y: 1.55, z: -3.20 },  // matches #hotspot-oldstreets
      },
      {
        // SE → far south Field — final stop, maximum south extent
        id:                 'stop-10',
        title:              'The Fields — End of Tour',
        target:             '#focus-field',
        audio:              '#audio-stop-10',
        subtitle:           'Memory is not the past. It is the present, still waiting to be acknowledged. Thank you for walking through Saidpur with us.',
        speakerLabel:       'Memory',
        highlightColor:     '#ccff88',
        highlightIntensity: 1.8,
        pauseAfterArrival:  1200,
        focusPoint:         { x:  0.10, y: 1.55, z: -3.00 },  // matches #hotspot-field
      },
    ];


    /* ════════════════════════════════════════════════════════════════
       NARRATION CONTROLLER  (v5 — 10-Stop Tour Engine)
       ────────────────────────────────────────────────────────────────
       MUST live inside init() so narratorEl is in scope.
       5-state machine. Fully automated — startTour() begins the loop.
       States: IDLE → MOVING → ARRIVED → PLAYING_AUDIO → COMPLETED
    ════════════════════════════════════════════════════════════════ */
    const NarrationController = (function () {

      const STATES = Object.freeze({
        IDLE:          'IDLE',
        MOVING:        'MOVING',
        ARRIVED:       'ARRIVED',
        PLAYING_AUDIO: 'PLAYING_AUDIO',
        COMPLETED:     'COMPLETED',
      });

      let _state         = STATES.IDLE;
      let _comp          = null;
      let _stopIndex     = -1;
      let _suspended     = false;
      let _arrivalTimer  = null;
      let _audioEl       = null;
      let _audioEndCb    = null;
      let _fallbackTimer = null;

      function _stop () { return TOUR_STOPS[_stopIndex]; }

      function _setState (next) {
        console.log(`[TourEngine] ${_state} → ${next}  (stop ${_stopIndex})`);
        _state = next;
      }

      /* narratorEl is in scope from init() — this is why NarrationController
         MUST be defined inside init(), not at the outer IIFE level. */
      function _emit (name, detail) {
        if (narratorEl) narratorEl.emit(name, detail || {});
      }

      function _clearAudio () {
        if (_audioEl && _audioEndCb) {
          _audioEl.removeEventListener('ended', _audioEndCb);
          _audioEndCb = null;
        }
        if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }
        _audioEl = null;
      }

      function _clearArrivalTimer () {
        if (_arrivalTimer) { clearTimeout(_arrivalTimer); _arrivalTimer = null; }
      }

      /* ── Phase 1: move narrator to stop position ─────────────────── */
      function _moveToStop (index) {
        _stopIndex = index;
        if (_stopIndex >= TOUR_STOPS.length) { _complete(); return; }

        const stop = _stop();
        _setState(STATES.MOVING);
        _emit('narrator-moving', { stopIndex: _stopIndex, stop });

        if (stop.target && !document.querySelector(stop.target)) {
          console.warn(`[TourEngine] Focus target "${stop.target}" not found — continuing.`);
        }

        _comp.activeFocusPoint.set(stop.focusPoint.x, stop.focusPoint.y, stop.focusPoint.z);
        _comp.isMoving          = true;
        _comp.onArrivalCallback = _onArrival;

        console.log(`[TourEngine] ▶ Moving → stop ${_stopIndex}: "${stop.title}"`);
      }

      /* ── Phase 2: silent pause after arrival ─────────────────────── */
      function _onArrival () {
        if (_state !== STATES.MOVING) return;
        if (_suspended) return;

        _setState(STATES.ARRIVED);
        _comp.isMoving = false;
        _emit('narrator-arrived', { stopIndex: _stopIndex });

        const pauseMs = (_stop().pauseAfterArrival != null) ? _stop().pauseAfterArrival : 800;
        console.log(`[TourEngine] ⏸ Arrived at stop ${_stopIndex} — pause ${pauseMs}ms.`);

        _arrivalTimer = setTimeout(() => {
          if (_suspended) return;
          _playAudio();
        }, pauseMs);
      }

      /* ── Phase 3: play audio + subtitle, then wait for end ───────── */
      function _playAudio () {
        const stop = _stop();
        _setState(STATES.PLAYING_AUDIO);
        _comp._isSpeaking = true;

        if (stop.target) {
          FocusManager.activate(stop.target, stop.highlightColor, stop.highlightIntensity);
        }

        if (narratorEl) {
          narratorEl.dispatchEvent(new CustomEvent('narration-state-enter', {
            detail: {
              id: stop.id,
              state: {
                text:               stop.subtitle,
                speakerLabel:       stop.speakerLabel       || '',
                focusTarget:        stop.target             || null,
                highlightColor:     stop.highlightColor     || '#50ffcc',
                highlightIntensity: stop.highlightIntensity || 1.0,
              },
            },
          }));
        }

        _emit('stop-started', { stopIndex: _stopIndex, stop });

        if (!stop.audio) {
          console.log(`[TourEngine] 🔇 Stop ${_stopIndex} has no audio — advancing in 5 s.`);
          _fallbackTimer = setTimeout(_onAudioEnd, 5000);
          return;
        }

        _audioEl = document.querySelector(stop.audio);

        if (!_audioEl) {
          console.warn(`[TourEngine] Audio "${stop.audio}" not found — advancing in 5 s.`);
          _fallbackTimer = setTimeout(_onAudioEnd, 5000);
          return;
        }

        NarrationAudioManager.play(_audioEl, 0.9, 300);
        console.log(`[TourEngine] 🔊 Stop ${_stopIndex}: "${stop.title}" — playing audio.`);

        /* Primary listener — fires _onAudioEnd when audio finishes naturally */
        _audioEndCb = () => _onAudioEnd();
        _audioEl.addEventListener('ended', _audioEndCb, { once: true });

        /* Hard fallback — set immediately, before waiting for metadata.
           If audio has a known duration, we refine the timeout once metadata
           loads. If metadata never loads (missing file / CORS), the hard
           fallback of 8 s still fires and the tour continues.           */
        _fallbackTimer = setTimeout(() => {
          if (_state === STATES.PLAYING_AUDIO) {
            console.warn(`[TourEngine] Hard fallback fired for stop ${_stopIndex} — no audio or ended never received.`);
            _onAudioEnd();
          }
        }, 8000);

        /* Refine the fallback once we know the real duration */
        _audioEl.addEventListener('loadedmetadata', () => {
          if (_state !== STATES.PLAYING_AUDIO) return;
          if (_audioEl.duration && isFinite(_audioEl.duration)) {
            if (_fallbackTimer) { clearTimeout(_fallbackTimer); _fallbackTimer = null; }
            _fallbackTimer = setTimeout(() => {
              if (_state === STATES.PLAYING_AUDIO) {
                console.warn(`[TourEngine] Duration fallback fired for stop ${_stopIndex}.`);
                _onAudioEnd();
              }
            }, _audioEl.duration * 1000 + 1500);
          }
        }, { once: true });
      }

      /* ── Phase 4: advance to next stop ──────────────────────────── */
      function _onAudioEnd () {
        if (_state !== STATES.PLAYING_AUDIO) return;
        if (_suspended) return;

        _clearAudio();
        FocusManager.deactivate();
        _comp._isSpeaking = false;

        if (narratorEl) {
          narratorEl.dispatchEvent(new CustomEvent('narration-state-exit', {
            detail: { id: _stop().id },
          }));
        }
        _emit('stop-ended', { stopIndex: _stopIndex, stop: _stop() });
        console.log(`[TourEngine] ✅ Stop ${_stopIndex} ended.`);

        const next = _stopIndex + 1;
        if (next >= TOUR_STOPS.length) {
          _complete();
        } else {
          setTimeout(() => { if (!_suspended) _moveToStop(next); }, 300);
        }
      }

      /* ── Tour complete ───────────────────────────────────────────── */
      function _complete () {
        _setState(STATES.COMPLETED);
        _comp._isSpeaking = false;
        _comp.isMoving    = false;
        _comp._isWaiting  = false;
        FocusManager.deactivate();
        NarrationAudioManager.stop(800);
        if (narratorEl) {
          narratorEl.dispatchEvent(new CustomEvent('narration-complete', { detail: {} }));
        }
        _emit('narration-complete', {});
        console.log('[TourEngine] 🎉 Tour complete. Hotspots unlocked.');
      }

      function init (narratorComp) {
        if (_comp) { console.warn('[TourEngine] Already initialised.'); return; }
        _comp = narratorComp;
        console.log('[TourEngine] Ready — IDLE. Call startTour() to begin.');
      }

      return {
        init,
        STATES,

        startTour () {
          if (_state !== STATES.IDLE) {
            console.warn('[TourEngine] startTour() ignored — not IDLE (state:', _state, ')');
            return;
          }
          if (!_comp) { console.error('[TourEngine] startTour() — component not wired.'); return; }
          console.log('[TourEngine] 🚀 startTour() called — beginning 10-stop tour.');
          _moveToStop(0);
        },

        pause () {
          if (_suspended) return;
          _suspended = true;
          NarrationAudioManager.pause();
          _clearAudio();
          _clearArrivalTimer();
          if (_comp) { _comp.isMoving = false; }
          console.log('[TourEngine] ⏸ Paused.');
        },

        resume () {
          if (!_suspended) return;
          _suspended = false;
          console.log('[TourEngine] ▶ Resumed from state:', _state);
          switch (_state) {
            case STATES.MOVING:
              _comp.isMoving = true;
              _comp.onArrivalCallback = _onArrival;
              break;
            case STATES.ARRIVED:
              _arrivalTimer = setTimeout(() => { if (!_suspended) _playAudio(); }, _stop().pauseAfterArrival || 800);
              break;
            case STATES.PLAYING_AUDIO:
              NarrationAudioManager.resume(0.9);
              break;
          }
        },

        goToStop (index) {
          if (index < 0 || index >= TOUR_STOPS.length) {
            console.warn('[TourEngine] goToStop: index out of range:', index); return;
          }
          _clearAudio(); _clearArrivalTimer();
          FocusManager.deactivate(); NarrationAudioManager.stop(200);
          if (_comp) { _comp._isSpeaking = false; _comp._isWaiting = false; }
          _state = STATES.IDLE;
          _moveToStop(index);
        },

        forceStart ()    { this.startTour(); },
        goToBeat (i)     { this.goToStop(i); },
        getBeatIndex ()  { return _stopIndex; },
        getState ()      { return _state; },
        getStopIndex ()  { return _stopIndex; },
        get stops ()     { return TOUR_STOPS; },
        get beats ()     { return TOUR_STOPS; },
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
      console.log('[wireNarrator] ✅ NarrationController wired. Stops:', TOUR_STOPS.length);
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
  
 // Play the specific 360 video for the entered scene
const vidId = sceneName === 'street' ? '#street-360-vid'
            : sceneName === 'temple' ? '#temple-360-vid'
            : `#${sceneName}-360`;

const activeVid = document.querySelector(vidId);
if (activeVid && activeVid.tagName === 'VIDEO') {
  activeVid.muted = true;          // ← REQUIRED for autoplay in VR/browsers
  activeVid.currentTime = 0;       // ← restart from beginning
  activeVid.loop = true;           // ← keep looping the 360
  const playPromise = activeVid.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn('[VR] Video autoplay blocked for', vidId, err.message);
      // Fallback: try again on next user interaction
      const retry = () => { activeVid.play().catch(() => {}); };
      document.addEventListener('click',      retry, { once: true });
      document.addEventListener('touchstart', retry, { once: true });
    });
  }
}

  // ADDED: Resume A-Frame sounds (like the Temple audio) upon re-entry
  if (sc) {
    sc.querySelectorAll('a-sound').forEach(snd => {
      if (snd.components.sound) snd.components.sound.playSound();
    });
  }

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
  
  // Pause ALL 360 videos so audio stops and performance is saved
  const allVideoIds = [
    '#street-360-vid', '#temple-360-vid', '#margalla-360', '#banyan-360', '#mosque-360',
    '#restaurant-360', '#shops-360', '#neighbourhood-360', '#field-360',
    '#handicraft-360', '#villageedge-360', '#oldstreets-360'
  ];
  
  allVideoIds.forEach(id => {
    const vid = document.querySelector(id);
    if (vid && vid.pause) {
      vid.pause();
    }
  });
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
      ['street','temple','house','margalla','banyan','mosque','restaurant','shops','neighbourhood','field','handicraft','villageedge','oldstreets'].forEach(k => {
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
    
    // ADDED: Pause the interview audio and reset it to the beginning
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0; 
    }
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