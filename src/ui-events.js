/**
 * @fileoverview UI Event Handlers & DOM Cache Module
 * Provides centralized, debounced, accessible DOM element bindings
 * and event delegation with robust null-safety and memory leak prevention.
 * @module ui-events
 */

import { appEventRegistry } from './cache.js';

/**
 * Creates a debounced version of a callback function.
 *
 * @param {Function} fn - Function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Caches frequently queried DOM elements.
 * @returns {Object} Dictionary of DOM elements.
 */
export function getDOMElements() {
  return {
    // Ingestion controls
    rawInput: document.getElementById('raw-input'),
    btnIngest: document.getElementById('btn-ingest'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    sampleDataSelect: document.getElementById('sample-data-select'),

    // Containers
    kpiContainer: document.getElementById('kpi-container'),
    dataTableContainer: document.getElementById('data-table-container'),
    deltaContainer: document.getElementById('delta-container'),
    personaContainer: document.getElementById('persona-container'),
    advisoryContainer: document.getElementById('advisory-container'),

    // Navigation and tabs
    mainNavTabs: document.getElementById('main-nav-tabs'),
    personaTabs: document.getElementById('persona-tabs'),
    advisoryTrackTabs: document.getElementById('advisory-track-tabs'),

    // Advisory Studio Controls
    readingLevelSelect: document.getElementById('reading-level-select'),
    langSelect: document.getElementById('language-select'),
    btnGenerateBriefing: document.getElementById('btn-generate-briefing'),
    btnSaveSnapshot: document.getElementById('btn-save-snapshot'),
    baselineSnapshotSelect: document.getElementById('baseline-snapshot-select'),
    btnExportJson: document.getElementById('btn-export-json'),

    // API Key & Modal
    btnOpenApiKeyModal: document.getElementById('btn-open-apikey-modal'),
    apiKeyModal: document.getElementById('apikey-modal'),
    apiKeyInput: document.getElementById('apikey-input'),
    btnSaveApiKey: document.getElementById('btn-save-apikey'),
    btnClearApiKey: document.getElementById('btn-clear-apikey'),
    btnCloseApiKeyModal: document.getElementById('btn-close-apikey-modal'),
    apiKeyStatusBadge: document.getElementById('apikey-status-badge'),

    // General
    themeToggleBtn: document.getElementById('theme-toggle-btn')
  };
}

/**
 * Attaches file drop-zone listeners for drag-and-drop ingestion
 * registered via appEventRegistry for leak-free teardowns.
 *
 * @param {HTMLElement} dropZone - Drop area element.
 * @param {Function} onFileRead - Callback receiving file contents string.
 */
export function setupDropZone(dropZone, onFileRead) {
  if (!dropZone || typeof onFileRead !== 'function') return;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      readFile(files[0], onFileRead);
    }
  };

  appEventRegistry.add(dropZone, 'dragover', handleDragOver);
  appEventRegistry.add(dropZone, 'dragleave', handleDragLeave);
  appEventRegistry.add(dropZone, 'drop', handleDrop);
}

/**
 * Reads a single file as UTF-8 text safely.
 *
 * @param {File} file - Browser File object.
 * @param {Function} callback - Callback receiving text.
 */
export function readFile(file, callback) {
  if (!file || typeof callback !== 'function') return;

  // Enforce max file size of 5 MB to prevent browser freeze
  if (file.size > 5 * 1024 * 1024) {
    alert('File size exceeds 5 MB limit.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      callback(text, file.name);
    }
  };
  reader.onerror = () => {
    alert('Failed to read selected file.');
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * Copies text to the system clipboard with user feedback.
 *
 * @param {string} text - Text to copy.
 * @param {HTMLElement} button - Trigger button for visual feedback.
 */
export async function copyToClipboard(text, button = null) {
  if (!text) return;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    if (button) {
      const origText = button.textContent;
      button.textContent = '✅ Copied!';
      setTimeout(() => {
        button.textContent = origText;
      }, 2000);
    }
  } catch (err) {
    console.error('Clipboard copy failed:', err);
  }
}
