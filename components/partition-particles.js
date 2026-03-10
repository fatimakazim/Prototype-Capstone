/**
 * partition-particles.js
 * ─────────────────────────────────────────────────────────────
 * Three.js particle system representing the 14M displaced people.
 * Blue particles drift West (Muslim migration to Pakistan).
 * Amber particles drift East (Hindu/Sikh migration to India).
 * Each particle ≈ 140 people. Total: 100,000 particles.
 *
 * USAGE (on any A-Frame entity):
 *   <a-entity partition-particles position="0 0 0"></a-entity>
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('partition-particles', {
  schema: {
    count:  { type: 'number', default: 80000 },  // reduce if performance issues
    spread: { type: 'number', default: 18    },  // horizontal spread in metres
    height: { type: 'number', default: 0.4   }   // max height above ground
  },

  init: function () {
    const { count, spread, height } = this.data;

    const geometry  = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    this._velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const isMuslim = Math.random() > 0.5;

      // Start position — scattered across "the subcontinent"
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (spread * 0.7);

      // Velocity — Muslims drift West, Hindus/Sikhs drift East
      this._velocities[i * 3]     = isMuslim ? -(0.008 + Math.random() * 0.016) : (0.008 + Math.random() * 0.016);
      this._velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
      this._velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.006;

      // Colour: blue for Muslim westward, amber for Hindu/Sikh eastward
      if (isMuslim) {
        colors[i * 3]     = 0.37;  // R
        colors[i * 3 + 1] = 0.56;  // G
        colors[i * 3 + 2] = 0.82;  // B
      } else {
        colors[i * 3]     = 0.76;
        colors[i * 3 + 1] = 0.39;
        colors[i * 3 + 2] = 0.24;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const material = new THREE.PointsMaterial({
      size:          0.04,
      vertexColors:  true,
      transparent:   true,
      opacity:       0.65,
      blending:      THREE.AdditiveBlending,
      depthWrite:    false,
      sizeAttenuation: true
    });

    this._points = new THREE.Points(geometry, material);
    this.el.object3D.add(this._points);
  },

  tick: function (time, delta) {
    const pos  = this._points.geometry.attributes.position.array;
    const vel  = this._velocities;
    const half = this.data.spread / 2;

    for (let i = 0; i < pos.length; i += 3) {
      pos[i]     += vel[i];
      pos[i + 1] += vel[i + 1];
      pos[i + 2] += vel[i + 2];

      // Wrap particles that cross the far edge — they re-enter from the other side
      if (pos[i] >  half) pos[i] = -half + Math.random() * 0.5;
      if (pos[i] < -half) pos[i] =  half - Math.random() * 0.5;

      // Keep particles near ground
      if (pos[i + 1] < 0)                    pos[i + 1] = 0;
      if (pos[i + 1] > this.data.height * 2) pos[i + 1] = this.data.height;
    }

    this._points.geometry.attributes.position.needsUpdate = true;
  },

  remove: function () {
    this.el.object3D.remove(this._points);
    this._points.geometry.dispose();
    this._points.material.dispose();
  }
});
