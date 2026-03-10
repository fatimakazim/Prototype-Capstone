/**
 * snap-turn.js
 * ─────────────────────────────────────────────────────────────
 * Right thumbstick snap-turn for comfort rotation on Quest 2.
 * Rotates the #camera-rig in fixed increments (default 45°)
 * with a cooldown to prevent continuous spinning.
 *
 * USAGE (on #camera-rig):
 *   snap-turn="angle: 45"
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('snap-turn', {
  schema: {
    angle:    { type: 'number',  default: 45  },   // degrees per snap
    cooldown: { type: 'number',  default: 400 }    // ms before next snap allowed
  },

  init: function () {
    this.onCooldown = false;

    // Wait for right-hand controller to initialise
    this._bindController();
  },

  _bindController: function () {
    const rightHand = document.querySelector('#right-hand');
    if (!rightHand) {
      setTimeout(() => this._bindController(), 200);
      return;
    }

    rightHand.addEventListener('thumbstickmoved', (evt) => {
      if (this.onCooldown) return;

      const x = evt.detail.x;
      // Only snap when stick is pushed strongly left or right (> 0.7)
      if (Math.abs(x) < 0.7) return;

      const direction = x > 0 ? 1 : -1;
      const rig = this.el;
      const rotation = rig.getAttribute('rotation');

      rig.setAttribute('rotation', {
        x: rotation.x,
        y: rotation.y + (direction * this.data.angle),
        z: rotation.z
      });

      // Start cooldown to prevent continuous spinning
      this.onCooldown = true;
      setTimeout(() => { this.onCooldown = false; }, this.data.cooldown);
    });
  }
});
