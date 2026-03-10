/**
 * main-map-table.js
 * ─────────────────────────────────────────────────────────────
 * Controls the map table scene:
 *  - Hotspot click → teleport to village scene (or within scene)
 *  - Hover → update info panel
 *  - Fade-to-black transition system
 * ─────────────────────────────────────────────────────────────
 */
document.addEventListener('DOMContentLoaded', () => {

  const scene      = document.querySelector('a-scene');
  const cameraRig  = document.querySelector('#camera-rig');
  const fadePlane  = document.querySelector('#fade-plane');
  const dustBurst  = document.querySelector('#dust-burst');
  const infoLabel  = document.querySelector('#info-label');
  const infoDesc   = document.querySelector('#info-desc');
  const hotspots   = document.querySelectorAll('.map-hotspot');

  // ── Hotspot interactions ─────────────────────────────────
  hotspots.forEach(hotspot => {
    // Click: teleport to village scene at the target position/rotation
    hotspot.addEventListener('click', function () {
      const label = this.getAttribute('data-label') || 'Village';
      console.log(`🗺 Hotspot clicked: ${label}`);
      teleportToVillage(this);
    });

    // Hover enter: update info panel
    hotspot.addEventListener('mouseenter', function () {
      const label = this.getAttribute('data-label') || '';
      const desc  = this.getAttribute('data-description') || '';
      if (infoLabel) infoLabel.setAttribute('value', label);
      if (infoDesc)  infoDesc.setAttribute('value', desc + '\n\nClick to enter →');
    });

    // Hover leave: restore default text
    hotspot.addEventListener('mouseleave', function () {
      if (infoLabel) infoLabel.setAttribute('value', 'Select a location');
      if (infoDesc)  infoDesc.setAttribute('value', 'Point at a glowing marker\non the map to learn more.\n\nClick to teleport there.');
    });
  });

  // ── Teleport to village scene ─────────────────────────────
  // Stores the target position in sessionStorage so the village
  // scene can read it on load and place the camera correctly.
  function teleportToVillage(hotspotEl) {
    const targetPos = hotspotEl.getAttribute('data-target-position') || '0 0 3';
    const targetRot = hotspotEl.getAttribute('data-target-rotation') || '0 0 0';
    const label     = hotspotEl.getAttribute('data-label') || 'Village';

    // Store spawn point for village scene to read
    try {
      sessionStorage.setItem('spawnPosition', targetPos);
      sessionStorage.setItem('spawnRotation', targetRot);
      sessionStorage.setItem('spawnLabel',    label);
    } catch(e) { /* sessionStorage may be blocked in some contexts */ }

    // Fade to black, then navigate
    fadePlane.setAttribute('animation__fadein',
      'property: material.opacity; from: 0; to: 1; dur: 800; easing: linear');

    setTimeout(() => {
      window.location.href = 'saidpur-village-scene.html';
    }, 900);
  }

});
