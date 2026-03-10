/**
 * proximity-trigger.js
 * ─────────────────────────────────────────────────────────────
 * Triggers audio testimony and a floating narrative panel when
 * the player walks within `radius` units of an entity.
 *
 * USAGE (on a building / hotspot entity):
 *   proximity-trigger="audio: ../assets/audio/testimony.mp3;
 *                       radius: 5;
 *                       label: Ram Kund — 1947;
 *                       description: The tank was abandoned overnight."
 *
 * REQUIRES: Howler.js loaded (optional — falls back to Web Audio API)
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('proximity-trigger', {
  schema: {
    audio:       { type: 'string'  },               // path to .mp3 testimony
    radius:      { type: 'number', default: 5    },  // trigger distance (metres)
    label:       { type: 'string', default: ''   },  // panel title
    description: { type: 'string', default: ''   },  // panel body text
    once:        { type: 'boolean', default: true }  // fire once or repeat
  },

  init: function () {
    this.triggered  = false;
    this.panelEl    = null;
    this.audioEl    = null;

    // Resolve camera reference lazily (camera may not exist yet)
    this._camera = null;
  },

  // ── Called every frame ──────────────────────────────────────
  tick: function () {
    // One-shot guard
    if (this.data.once && this.triggered) return;

    // Lazy-resolve camera
    if (!this._camera) {
      this._camera = document.querySelector('#main-camera');
      if (!this._camera) return;
    }

    // Distance check
    const camPos   = new THREE.Vector3();
    const buildPos = new THREE.Vector3();
    this._camera.object3D.getWorldPosition(camPos);
    this.el.object3D.getWorldPosition(buildPos);

    const dist = camPos.distanceTo(buildPos);

    if (dist < this.data.radius) {
      this.triggered = true;
      this._activate();
    }
  },

  // ── Trigger audio + panel ────────────────────────────────────
  _activate: function () {
    console.log(`📍 Proximity trigger fired: ${this.data.label}`);

    // ── Play audio ──
    if (this.data.audio) {
      // PREFERRED: use Howler.js if available
      if (typeof Howl !== 'undefined') {
        this.sound = new Howl({ src: [this.data.audio], volume: 0 });
        this.sound.fade(0, 0.9, 1000);
        this.sound.play();
      } else {
        // Fallback: native HTML5 Audio
        this.audioEl = new Audio(this.data.audio);
        this.audioEl.volume = 0;
        this.audioEl.play().catch(() => {
          console.warn('Audio autoplay blocked — user interaction required first.');
        });
        // Fade in manually
        let vol = 0;
        const fadeIn = setInterval(() => {
          if (!this.audioEl) { clearInterval(fadeIn); return; }
          vol = Math.min(vol + 0.05, 0.9);
          this.audioEl.volume = vol;
          if (vol >= 0.9) clearInterval(fadeIn);
        }, 80);
      }
    }

    // ── Spawn floating info panel above building ──
    if (this.data.label) {
      this._spawnPanel();
    }
  },

  // ── Create a floating A-Frame panel above the entity ────────
  _spawnPanel: function () {
    if (this.panelEl) return; // already spawned

    const panel = document.createElement('a-entity');
    panel.setAttribute('position', '0 3.5 0');

    // Background plane
    const bg = document.createElement('a-plane');
    bg.setAttribute('width', '2.4');
    bg.setAttribute('height', '1.2');
    bg.setAttribute('material', 'color: #04040a; opacity: 0.9; transparent: true; side: double');

    // Accent top bar
    const bar = document.createElement('a-box');
    bar.setAttribute('position', '0 0.55 0.01');
    bar.setAttribute('width', '2.4');
    bar.setAttribute('height', '0.055');
    bar.setAttribute('depth', '0.01');
    bar.setAttribute('material', 'color: #d4a843; emissive: #d4a843; emissiveIntensity: 0.6');

    // Label
    const title = document.createElement('a-text');
    title.setAttribute('value', this.data.label);
    title.setAttribute('position', '-1.05 0.3 0.02');
    title.setAttribute('color', '#d4a843');
    title.setAttribute('width', '2.2');
    title.setAttribute('font', 'mozillavr');
    title.setAttribute('align', 'left');

    // Description
    const desc = document.createElement('a-text');
    desc.setAttribute('value', this.data.description || '[PLACEHOLDER: Add real building description]');
    desc.setAttribute('position', '-1.05 -0.05 0.02');
    desc.setAttribute('color', '#9a8e7a');
    desc.setAttribute('width', '2.1');
    desc.setAttribute('font', 'mozillavr');
    desc.setAttribute('align', 'left');

    bg.appendChild(bar);
    bg.appendChild(title);
    bg.appendChild(desc);
    panel.appendChild(bg);

    // Billboard — always face camera
    panel.setAttribute('look-at', '#main-camera');

    // Entrance animation
    panel.setAttribute('animation',
      'property: scale; from: 0.01 0.01 0.01; to: 1 1 1; dur: 500; easing: easeOutBack');

    this.el.appendChild(panel);
    this.panelEl = panel;
  },

  // ── Cleanup ─────────────────────────────────────────────────
  remove: function () {
    if (this.sound)   this.sound.stop();
    if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
    if (this.panelEl) this.panelEl.parentNode.removeChild(this.panelEl);
  }
});
