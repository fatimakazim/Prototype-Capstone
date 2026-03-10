/**
 * narrative-hotspot.js
 * ─────────────────────────────────────────────────────────────
 * Floating information panel that can be attached to any entity.
 * Shows title, body text, year, and optional population figure.
 * Always faces the camera (billboard behaviour).
 *
 * USAGE:
 *   <a-entity narrative-hotspot="title: Ram Kund;
 *                                 body: A Hindu pilgrimage tank;
 *                                 year: 1947;
 *                                 population: 4700000">
 *   </a-entity>
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('narrative-hotspot', {
  schema: {
    title:      { type: 'string', default: 'Location'  },
    body:       { type: 'string', default: '[PLACEHOLDER: Add description]' },
    year:       { type: 'number', default: 0    },
    population: { type: 'number', default: 0    },
    accentColor:{ type: 'string', default: '#d4a843' },
    width:      { type: 'number', default: 2.4  },
    visible:    { type: 'boolean', default: true }
  },

  init: function () {
    this._build();
    this.el.setAttribute('look-at', '#main-camera');
    // Entrance pop animation
    this.el.setAttribute('animation__enter',
      'property: scale; from: 0.01 0.01 0.01; to: 1 1 1; dur: 400; easing: easeOutBack');
  },

  _build: function () {
    const d = this.data;
    const w = d.width;
    const h = d.population > 0 ? 1.5 : 1.2;

    // ── Background ──
    const bg = document.createElement('a-plane');
    bg.setAttribute('width',  w);
    bg.setAttribute('height', h);
    bg.setAttribute('material', 'color: #04040a; opacity: 0.92; transparent: true; side: double');
    this.el.appendChild(bg);

    // ── Top accent bar ──
    const bar = document.createElement('a-box');
    bar.setAttribute('position', `0 ${h/2 - 0.04} 0.01`);
    bar.setAttribute('width',  w);
    bar.setAttribute('height', '0.055');
    bar.setAttribute('depth',  '0.005');
    bar.setAttribute('material', `color: ${d.accentColor}; emissive: ${d.accentColor}; emissiveIntensity: 0.6`);
    this.el.appendChild(bar);

    // ── Year label (if provided) ──
    if (d.year > 0) {
      const yearEl = document.createElement('a-text');
      yearEl.setAttribute('value', String(d.year));
      yearEl.setAttribute('position', `${-(w/2 - 0.15)} ${h/2 - 0.2} 0.02`);
      yearEl.setAttribute('color', d.accentColor);
      yearEl.setAttribute('width', w * 0.9);
      yearEl.setAttribute('font', 'mozillavr');
      yearEl.setAttribute('align', 'left');
      this.el.appendChild(yearEl);
    }

    // ── Title ──
    const titleEl = document.createElement('a-text');
    titleEl.setAttribute('value', d.title);
    titleEl.setAttribute('position', `${-(w/2 - 0.15)} ${d.year > 0 ? h/2 - 0.38 : h/2 - 0.25} 0.02`);
    titleEl.setAttribute('color', '#e8dcc8');
    titleEl.setAttribute('width', w * 0.92);
    titleEl.setAttribute('font', 'mozillavr');
    titleEl.setAttribute('align', 'left');
    this.el.appendChild(titleEl);

    // ── Body ──
    const bodyEl = document.createElement('a-text');
    bodyEl.setAttribute('value', d.body);
    bodyEl.setAttribute('position', `${-(w/2 - 0.15)} ${d.year > 0 ? h/2 - 0.7 : h/2 - 0.55} 0.02`);
    bodyEl.setAttribute('color', '#9a8e7a');
    bodyEl.setAttribute('width', w * 0.88);
    bodyEl.setAttribute('font', 'mozillavr');
    bodyEl.setAttribute('align', 'left');
    this.el.appendChild(bodyEl);

    // ── Population stat (if provided) ──
    if (d.population > 0) {
      const popEl = document.createElement('a-text');
      const formatted = d.population.toLocaleString();
      popEl.setAttribute('value', `Displaced: ${formatted}`);
      popEl.setAttribute('position', `${-(w/2 - 0.15)} ${-(h/2 - 0.3)} 0.02`);
      popEl.setAttribute('color', '#c0392b');
      popEl.setAttribute('width', w * 0.88);
      popEl.setAttribute('font', 'mozillavr');
      popEl.setAttribute('align', 'left');
      this.el.appendChild(popEl);
    }
  }
});
