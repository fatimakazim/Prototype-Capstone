/**
 * migration-map.js
 * ─────────────────────────────────────────────────────────────
 * STUB — Helper functions used by migration-map.html.
 * The main rendering logic lives inline in the HTML file.
 * This module exports utilities for reuse and testing.
 *
 * FUTURE: Integrate Deck.gl for GPU-accelerated arc layers.
 * See architecture notes in the project README.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Format large numbers with commas and M/k suffixes.
 * @param  {number} n
 * @returns {string}
 */
function formatPopulation(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(0) + 'k';
  return String(n);
}

/**
 * Convert geographic coordinates to SVG pixel coordinates.
 * Uses a simple linear projection over the subcontinent bounding box.
 *
 * REPLACE: Use d3.geoMercator() with real GeoJSON for accurate positioning.
 *
 * @param {number} lat  Latitude  (approx range: 8–37 for South Asia)
 * @param {number} lng  Longitude (approx range: 62–98 for South Asia)
 * @param {number} svgW SVG canvas width in pixels
 * @param {number} svgH SVG canvas height in pixels
 * @returns {{ x: number, y: number }}
 */
function geoToSVG(lat, lng, svgW = 900, svgH = 560) {
  const lngMin = 62, lngMax = 98;
  const latMin = 6,  latMax = 38;

  const x = ((lng - lngMin) / (lngMax - lngMin)) * svgW;
  // SVG y increases downward; latitude increases upward
  const y = svgH - ((lat - latMin) / (latMax - latMin)) * svgH;

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Build a quadratic bezier arc path string for D3.
 * @param {number} x1  Start X
 * @param {number} y1  Start Y
 * @param {number} x2  End X
 * @param {number} y2  End Y
 * @param {number} arc Height of arc above the chord midpoint
 * @returns {string}  SVG path d attribute
 */
function buildArcPath(x1, y1, x2, y2, arc = 60) {
  const midX = (x1 + x2) / 2;
  const midY = Math.min(y1, y2) - Math.abs(arc);
  return `M ${x1},${y1} Q ${midX},${midY} ${x2},${y2}`;
}

// Export for use in HTML inline scripts or Node testing
if (typeof module !== 'undefined') {
  module.exports = { formatPopulation, geoToSVG, buildArcPath };
}
