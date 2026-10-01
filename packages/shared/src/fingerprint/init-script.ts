/**
 * Exposure — browser fingerprint detection init script (plan §4).
 *
 * This script is injected BEFORE any page script runs:
 *   - Playwright (nightly scanner):        page.addInitScript(FINGERPRINT_INIT_SCRIPT)
 *   - Cloudflare Browser Run (live scans): the same string via the
 *     @cloudflare/playwright fork — identical bytes on both paths.
 *
 * It wraps fingerprinting-prone APIs and records every call on
 * `window.__exposureFpEvents` as a JSON-serializable event. It must stay a
 * self-contained ES5 string: no imports, no references to module scope.
 *
 * Phase 0 ships the channel contract and the canvas wrapper as the reference
 * implementation; WebGL, AudioContext and font enumeration wrappers land in
 * Phase 1 with the rest of the capture work.
 */

export const FINGERPRINT_EVENT_BUFFER = '__exposureFpEvents';

/** Shape of one buffered event (as produced inside the page). */
export interface RawFingerprintEvent {
  api: string;
  family: 'canvas' | 'webgl' | 'audio' | 'fonts' | 'other';
  ts: number;
}

export const FINGERPRINT_INIT_SCRIPT = `
(function () {
  'use strict';
  if (window.__exposureFpInstalled) return;
  window.__exposureFpInstalled = true;
  var buffer = (window.__exposureFpEvents = []);

  function record(api, family) {
    try {
      buffer.push({ api: api, family: family, ts: Date.now() });
    } catch (e) {
      /* never break the page we are measuring */
    }
  }

  // --- canvas ---------------------------------------------------------------
  if (typeof HTMLCanvasElement !== 'undefined') {
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    if (origToDataURL) {
      HTMLCanvasElement.prototype.toDataURL = function () {
        record('canvas.toDataURL', 'canvas');
        return origToDataURL.apply(this, arguments);
      };
    }
    var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    if (origGetImageData) {
      CanvasRenderingContext2D.prototype.getImageData = function () {
        record('canvas.getImageData', 'canvas');
        return origGetImageData.apply(this, arguments);
      };
    }
  }

  // WebGL, AudioContext and font enumeration wrappers: Phase 1.
})();
`;
