/**
 * historical-overlay.js
 * ─────────────────────────────────────────────────────────────
 * Reveals an archival photograph overlaid on a building surface
 * when the player presses the right-hand grip button.
 *
 * USAGE (on an <a-plane> in front of or attached to a building):
 *   historical-overlay="historicalSrc: #archive-ram-kund;
 *                        label: Ram Kund — circa 1940"
 *
 * HOW IT WORKS:
 *   Sets the plane's material src to the archival image.
 *   Animates opacity from 0 → 0.85 on grip press.
 *   Grip press again fades it back out (toggle).
 * ─────────────────────────────────────────────────────────────
 */
AFRAME.registerComponent('historical-overlay', {
  schema: {
    historicalSrc: { type: 'string'  },                   // asset id or URL
    label:         { type: 'string', default: 'Archive' }, // caption text
    opacity:       { type: 'number', default: 0.85 }
  },

  init: function () {
    this.showing = false;
    this.captionEl = null;

    // Set the image source on the plane material
    if (this.data.historicalSrc) {
      this.el.setAttribute('material', `src: ${this.data.historicalSrc}; transparent: true; opacity: 0; shader: flat`);
    }

    // Create caption element (hidden initially)
    this._buildCaption();

    // Bind grip toggle — attach once right-hand controller is ready
    this._boundToggle = this.toggle.bind(this);
    this._bindController();
  },

  _bindController: function () {
    const rightHand = document.querySelector('#right-hand');
    if (!rightHand) {
      setTimeout(() => this._bindController(), 200);
      return;
    }
    rightHand.addEventListener('gripdown', this._boundToggle);
  },

  // ── Build floating caption label ────────────────────────────
  _buildCaption: function () {
    const caption = document.createElement('a-text');
    caption.setAttribute('value', `📷 ${this.data.label}`);
    caption.setAttribute('position', '0 -0.6 0.01');
    caption.setAttribute('color', '#d4a843');
    caption.setAttribute('width', '2.5');
    caption.setAttribute('align', 'center');
    caption.setAttribute('font', 'mozillavr');
    caption.setAttribute('visible', 'false');
    this.el.appendChild(caption);
    this.captionEl = caption;
  },

  // ── Toggle overlay on/off ────────────────────────────────────
  toggle: function () {
    this.showing = !this.showing;
    const targetOpacity = this.showing ? this.data.opacity : 0;

    // Animate opacity
    this.el.removeAttribute('animation__overlay');
    this.el.setAttribute('animation__overlay',
      `property: material.opacity; to: ${targetOpacity}; dur: 600; easing: easeInOutSine`);

    // Show/hide caption
    if (this.captionEl) {
      this.captionEl.setAttribute('visible', this.showing);
    }

    if (this.showing) {
      console.log(`🖼 Historical overlay visible: ${this.data.label}`);
    }
  },

  // ── Cleanup ─────────────────────────────────────────────────
  remove: function () {
    const rightHand = document.querySelector('#right-hand');
    if (rightHand && this._boundToggle) {
      rightHand.removeEventListener('gripdown', this._boundToggle);
    }
  }
});
