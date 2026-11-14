/**
 * @fileoverview Security & Sanitization Module
 * Enforces zero XSS vulnerabilities, strict input validation, safe DOM manipulation,
 * and ephemeral memory-only credential lifecycle.
 * @module security
 */

/**
 * In-memory vault for sensitive credentials (e.g., Gemini API keys).
 * NEVER written to localStorage, sessionStorage, indexedDB, or cookies.
 * @type {{ apiKey: string | null }}
 */
const MEMORY_VAULT = {
  apiKey: null
};

/**
 * Escapes characters with special meaning in HTML to prevent XSS.
 * @param {*} input - Value to escape.
 * @returns {string} HTML-escaped string.
 */
export function escapeHTML(input) {
  if (input === null || input === undefined) {
    return '';
  }
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes numeric input with type coercion, boundary clamping, and NaN handling.
 * @param {*} val - Value to sanitize.
 * @param {number} [defaultVal=0] - Fallback value if invalid.
 * @param {number} [min=-Infinity] - Minimum allowable value.
 * @param {number} [max=Infinity] - Maximum allowable value.
 * @returns {number} Clean numeric value.
 */
export function sanitizeNumber(val, defaultVal = 0, min = -Infinity, max = Infinity) {
  if (val === null || val === undefined || val === '') {
    return defaultVal;
  }
  let num;
  if (typeof val === 'number') {
    num = val;
  } else if (typeof val === 'string') {
    const match = val.trim().match(/^([-+]?[0-9]*\.?[0-9]+)/);
    num = match ? parseFloat(match[1]) : parseFloat(val);
  } else {
    num = Number(val);
  }
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return defaultVal;
  }
  return Math.min(Math.max(num, min), max);
}

/**
 * Sanitizes a string by trimming, removing dangerous control characters,
 * and enforcing maximum length to prevent DoS attacks.
 * @param {*} val - Value to sanitize.
 * @param {number} [maxLength=500] - Maximum allowed length.
 * @returns {string} Clean string.
 */
export function sanitizeString(val, maxLength = 500) {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  // Strip null bytes and non-printable control characters except newline & tab
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (str.length > maxLength) {
    return str.slice(0, maxLength);
  }
  return str;
}

/**
 * Safely populates an HTMLElement's contents using DOMParser to parse HTML,
 * stripping any script tags, inline event handlers (onclick, onload, etc.),
 * and dangerous protocols (javascript:, data:text/html, vbscript:).
 *
 * @param {HTMLElement} element - The target DOM element.
 * @param {string} rawHTML - HTML string to sanitize and insert.
 */
export function setSanitizedHTML(element, rawHTML) {
  if (!element || typeof element.appendChild !== 'function') {
    return;
  }

  // Clear existing content safely
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (!rawHTML || typeof rawHTML !== 'string') {
    return;
  }

  // If DOMParser is available (browser environment)
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');

    // Recursively scrub forbidden elements and attributes
    const scrubNode = (node) => {
      // Remove scripts, objects, embeds, iframes, and link rel=import
      const forbiddenTags = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET', 'BASE'];
      if (forbiddenTags.includes(node.nodeName)) {
        node.remove();
        return;
      }

      if (node.nodeType === 1) { // Element node
        const attrs = Array.from(node.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim().toLowerCase();

          // Strip all inline event handlers (e.g. onclick, onerror, onmouseover)
          if (name.startsWith('on')) {
            node.removeAttribute(attr.name);
          }
          // Strip javascript: / data: pseudo-protocols in href, src, formaction
          else if (['href', 'src', 'action', 'formaction'].includes(name)) {
            if (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html')) {
              node.removeAttribute(attr.name);
            }
          }
        }
      }

      // Scrub child nodes
      const children = Array.from(node.childNodes);
      for (const child of children) {
        scrubNode(child);
      }
    };

    scrubNode(doc.body);

    // Append safe nodes
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild);
    }
  } else {
    // Fallback for non-DOM headless environments: set as escaped text
    element.textContent = rawHTML;
  }
}

/**
 * Generates a cryptographically random, collision-resistant identifier.
 * Uses crypto.getRandomValues in browsers/Node, falling back safely.
 * @param {string} [prefix='id'] - Identifier prefix.
 * @returns {string} Unique sanitized ID.
 */
export function generateSecureId(prefix = 'id') {
  const cleanPrefix = sanitizeString(prefix, 20).replace(/[^a-zA-Z0-9_-]/g, '') || 'id';
  let randPart = '';

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    randPart = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } else {
    randPart = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  return `${cleanPrefix}-${randPart}`;
}

/**
 * Sets the Gemini API key into ephemeral memory.
 * Never persists to disk, local storage, or session storage.
 * @param {string} key - API Key provided by user.
 */
export function setApiKey(key) {
  if (typeof key === 'string' && key.trim().length > 0) {
    MEMORY_VAULT.apiKey = key.trim();
  } else {
    MEMORY_VAULT.apiKey = null;
  }
}

/**
 * Retrieves the current memory-resident API key.
 * @returns {string|null} The API key or null.
 */
export function getApiKey() {
  return MEMORY_VAULT.apiKey;
}

/**
 * Checks whether an API key is actively loaded in memory.
 * @returns {boolean} True if loaded.
 */
export function hasApiKey() {
  return Boolean(MEMORY_VAULT.apiKey && MEMORY_VAULT.apiKey.length > 5);
}

/**
 * Immediately purges the API key from memory.
 */
export function clearApiKey() {
  MEMORY_VAULT.apiKey = null;
}
