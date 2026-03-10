/**
 * thumbstick-locomotion.js
 * ─────────────────────────────────────────────────────────────
 * Custom A-Frame component for smooth thumbstick walking on Quest 2.
 *
 * USAGE (on #camera-rig):
 *   thumbstick-locomotion="speed: 2.5; deadzone: 0.2; vrOnly: true"
 *
 * HOW IT WORKS:
 *   Reads thumbstickmoved events from #left-hand controller.
 *   Each tick(), combines camera Y-rotation with rig Y-rotation
 *   to produce movement relative to where the player is looking.
 *   Only modifies rig position.x / position.z — never Y (no flying).
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('thumbstick-locomotion', {
  schema: {
    speed:    { type: 'number',  default: 2.5  },  // units per second
    deadzone: { type: 'number',  default: 0.2  },  // ignore stick drift below this
    vrOnly:   { type: 'boolean', default: true }   // only activate inside VR headset
  },

  init: function () {
    this.axisX    = 0;
    this.axisY    = 0;
    this.isVRMode = false;

    // Track VR entry / exit via scene events
    this.el.sceneEl.addEventListener('enter-vr', () => { this.isVRMode = true; });
    this.el.sceneEl.addEventListener('exit-vr',  () => {
      this.isVRMode = false;
      this.axisX = 0;  // Reset axes on exit to prevent phantom movement
      this.axisY = 0;
    });

    // Bind the handler once so removeEventListener works correctly
    this.onThumbstickMoved = this.onThumbstickMoved.bind(this);

    // Controllers are attached asynchronously — poll until ready
    this._bindController();
  },

  // ── Poll for #left-hand, then attach listener ──────────────
  _bindController: function () {
    const leftHand = document.querySelector('#left-hand');
    if (!leftHand) {
      // Retry after 200ms — controller entity may not exist yet at init time
      setTimeout(() => this._bindController(), 200);
      return;
    }
    leftHand.addEventListener('thumbstickmoved', this.onThumbstickMoved);
  },

  // ── Called every time the left thumbstick moves ─────────────
  onThumbstickMoved: function (evt) {
    const x = evt.detail.x;  // left / right  (-1 to +1)
    const y = evt.detail.y;  // forward / back (-1 = forward, +1 = backward)

    // Apply deadzone — eliminates hardware drift on Quest 2 thumbsticks
    this.axisX = Math.abs(x) > this.data.deadzone ? x : 0;
    this.axisY = Math.abs(y) > this.data.deadzone ? y : 0;
  },

  // ── Called every frame ──────────────────────────────────────
  tick: function (time, delta) {
    // Guard: skip in desktop mode if vrOnly is true
    if (this.data.vrOnly && !this.isVRMode) return;
    // Skip if stick is at rest
    if (this.axisX === 0 && this.axisY === 0) return;

    const dt     = delta / 1000;  // ms → seconds
    const rig    = this.el;       // this component lives on #camera-rig
    const camera = document.querySelector('#main-camera');
    if (!camera) return;

    // Combine rig rotation with camera look rotation
    // so movement is always relative to the direction the player faces
    const camRotY   = camera.object3D.rotation.y;
    const rigRotY   = rig.object3D.rotation.y;
    const totalRotY = camRotY + rigRotY;

    // Project stick axes onto horizontal plane:
    // axisY > 0 = stick pulled backward → negate for forward = -Z
    const moveX =  Math.sin(totalRotY) * (-this.axisY) + Math.cos(totalRotY) * (this.axisX);
    const moveZ =  Math.cos(totalRotY) * (-this.axisY) - Math.sin(totalRotY) * (this.axisX);

    // Apply movement to the rig (never to the camera entity itself)
    const pos = rig.object3D.position;
    pos.x += moveX * this.data.speed * dt;
    pos.z += moveZ * this.data.speed * dt;
    // Note: pos.y is intentionally NOT modified (no vertical movement)
  },

  // ── Cleanup ─────────────────────────────────────────────────
  remove: function () {
    const leftHand = document.querySelector('#left-hand');
    if (leftHand) {
      leftHand.removeEventListener('thumbstickmoved', this.onThumbstickMoved);
    }
  }
});
