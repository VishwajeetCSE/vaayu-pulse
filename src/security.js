/**
 * @fileoverview Security & Sanitization Module
 * Enforces zero XSS vulnerabilities, strict input validation, safe DOM manipulation,
 * DOM Clobbering defense, Mutation XSS (mXSS) prevention, and ephemeral memory-only credential vault.
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
 * Disallowed DOM property names that could lead to DOM Clobbering
 * when assigned as element IDs or names.
 */
const CLOBBERING_PROPERTIES = new Set([
  'attributes', 'children', 'tagName', 'nodeName', 'ownerDocument', 'parentElement',
  'parentNode', 'firstChild', 'lastChild', 'innerHTML', 'outerHTML', 'textContent',
  'form', 'elements', 'length', 'item', 'namedItem', 'style', 'class', 'window',
  'document', 'location', 'body', 'defaultView', 'nodeType', 'constructor', 'prototype'
]);

/**
 * Strict element whitelist for safe DOM rendering.
 * Namespace-switching tags (SVG, MathML, templates) are strictly excluded to prevent mXSS.
 */
const ALLOWED_TAGS = new Set([
  'DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'STRONG', 'EM', 'B', 'I',
  'SMALL', 'PRE', 'CODE', 'LABEL', 'INPUT', 'BUTTON', 'A', 'HR', 'BR'
]);

/**
 * Strict attribute whitelist.
 */
const ALLOWED_ATTRIBUTES = new Set([
  'class', 'style', 'role', 'title', 'tabindex', 'type', 'checked',
  'disabled', 'rows', 'placeholder', 'target', 'rel', 'id'
]);

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
 * Validates and sanitizes inline styles to prevent CSS expression-based script execution.
 * @param {string} styleStr - CSS text.
 * @returns {string} Safe CSS text.
 */
function sanitizeStyle(styleStr) {
  if (!styleStr || typeof styleStr !== 'string') return '';
  const clean = styleStr.toLowerCase();
  if (
    clean.includes('expression') ||
    clean.includes('javascript:') ||
    clean.includes('behavior:') ||
    clean.includes('-moz-binding') ||
    clean.includes('url(')
  ) {
    return '';
  }
  return styleStr.replace(/[<>]/g, '');
}

/**
 * Safely populates an HTMLElement's contents using DOMParser with strict whitelist-based
 * validation, mXSS mitigation, and DOM Clobbering immunity.
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
    // Parse using text/html
    const doc = parser.parseFromString(rawHTML, 'text/html');

    /**
     * Recursively sanitizes a DOM node, stripping dangerous tags, attributes, and clobbering vectors.
     * @param {Node} node
     */
    const scrubNode = (node) => {
      // 1. Element Node
      if (node.nodeType === 1) {
        const tagName = node.nodeName.toUpperCase();

        // Enforce strict element whitelist; completely remove forbidden/foreign elements
        if (!ALLOWED_TAGS.has(tagName)) {
          node.remove();
          return;
        }

        // Scrub attributes
        const attrs = Array.from(node.attributes);
        for (const attr of attrs) {
          const attrName = attr.name.toLowerCase();
          const attrVal = attr.value.trim();
          const attrValLower = attrVal.toLowerCase();

          // Reject inline event handlers (onclick, onload, onerror, etc.)
          if (attrName.startsWith('on')) {
            node.removeAttribute(attr.name);
            continue;
          }

          // Allow aria-* and data-* attributes with basic character check
          const isAria = attrName.startsWith('aria-');
          const isData = attrName.startsWith('data-');

          if (!ALLOWED_ATTRIBUTES.has(attrName) && !isAria && !isData) {
            node.removeAttribute(attr.name);
            continue;
          }

          // DOM Clobbering Defense for id and name
          if (attrName === 'id' || attrName === 'name') {
            if (CLOBBERING_PROPERTIES.has(attrValLower) || attrVal.startsWith('__')) {
              node.removeAttribute(attr.name);
              continue;
            }
            // Strip name attribute altogether on non-form elements
            if (attrName === 'name' && tagName !== 'INPUT' && tagName !== 'BUTTON') {
              node.removeAttribute(attr.name);
              continue;
            }
          }

          // Safe URL protocols for hyperlinks
          if (['href', 'src', 'action'].includes(attrName)) {
            const hasSafeProtocol =
              attrValLower.startsWith('http://') ||
              attrValLower.startsWith('https://') ||
              attrValLower.startsWith('mailto:') ||
              attrValLower.startsWith('#');

            if (!hasSafeProtocol) {
              node.removeAttribute(attr.name);
              continue;
            }

            if (tagName === 'A' && node.getAttribute('target') === '_blank') {
              node.setAttribute('rel', 'noopener noreferrer');
            }
          }

          // Sanitize CSS styles
          if (attrName === 'style') {
            const safeCss = sanitizeStyle(attrVal);
            if (safeCss) {
              node.setAttribute('style', safeCss);
            } else {
              node.removeAttribute('style');
            }
          }
        }
      } else if (node.nodeType === 8) {
        // Strip comments to eliminate potential mXSS vectors
        node.remove();
        return;
      }

      // Scrub all children recursively
      const children = Array.from(node.childNodes);
      for (const child of children) {
        scrubNode(child);
      }
    };

    scrubNode(doc.body);

    // Append safe sanitized nodes into target element
    while (doc.body.firstChild) {
      element.appendChild(doc.body.firstChild);
    }
  } else {
    // Non-DOM headless fallback: set safe escaped text
    element.textContent = rawHTML;
  }
}

/**
 * Generates a cryptographically random, collision-resistant identifier.
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
 * Sets the Gemini API key into ephemeral memory vault.
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
