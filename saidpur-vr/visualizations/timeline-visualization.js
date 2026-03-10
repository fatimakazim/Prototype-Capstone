/**
 * timeline-visualization.js
 * ─────────────────────────────────────────────────────────────
 * STUB — Helper utilities for the D3 timeline in timeline-visualization.html.
 * The main renderTimeline() function lives inline in the HTML for simplicity.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Map event type to a display colour.
 * @param {string} type  'partition' | 'violence' | 'political' | 'saidpur'
 * @returns {string}     CSS colour string
 */
function eventTypeColor(type) {
  const map = {
    partition: '#c0392b',  // Partition red
    violence:  '#c0643c',  // Violence amber
    political: '#d4a843',  // Political gold
    saidpur:   '#6090d0'   // Saidpur blue
  };
  return map[type] || '#9a8e7a';
}

/**
 * Format a year range or single year for display.
 * @param {number} year
 * @returns {string}
 */
function formatYear(year) {
  return year.toString();
}

/**
 * Group events by decade for zoomed-out view.
 * @param {Array} events
 * @returns {Object}  Keys are decade strings ('1940s'), values are event arrays
 */
function groupByDecade(events) {
  return events.reduce((acc, evt) => {
    const decade = Math.floor(evt.year / 10) * 10 + 's';
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(evt);
    return acc;
  }, {});
}

if (typeof module !== 'undefined') {
  module.exports = { eventTypeColor, formatYear, groupByDecade };
}
