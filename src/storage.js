/**
 * @fileoverview Storage & Serialization Module
 * Provides local-first snapshot persistence, JSON import/export with schema validation,
 * and safe state hydration.
 * @module storage
 */

import { DEMO_DATASETS } from './constants.js';
import { sanitizeString, sanitizeNumber } from './security.js';

const SNAPSHOTS_STORAGE_KEY = 'civic_aqi_snapshots_v1';
const PREFERENCES_STORAGE_KEY = 'civic_aqi_prefs_v1';

/**
 * Retrieves all saved briefing snapshots from localStorage safely.
 * @returns {Array<Object>} List of snapshot objects.
 */
export function loadSnapshots() {
  if (typeof localStorage === 'undefined') {
    return [DEMO_DATASETS.baselineSnapshot];
  }

  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) {
      // Seed with default demo baseline snapshot
      const initial = [DEMO_DATASETS.baselineSnapshot];
      saveSnapshotsList(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [DEMO_DATASETS.baselineSnapshot];
  } catch {
    return [DEMO_DATASETS.baselineSnapshot];
  }
}

/**
 * Saves the full list of snapshots to localStorage.
 * @param {Array<Object>} snapshotsList - Snapshot array.
 */
export function saveSnapshotsList(snapshotsList) {
  if (typeof localStorage === 'undefined' || !Array.isArray(snapshotsList)) {
    return;
  }
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshotsList.slice(0, 20)));
  } catch (err) {
    console.warn('Failed to save snapshots to localStorage:', err);
  }
}

/**
 * Appends a new snapshot from the current briefing state.
 *
 * @param {Object} options
 * @param {string} options.title - Snapshot title.
 * @param {Array<Object>} options.stations - Station records.
 * @param {Object} options.summary - Summary statistics.
 * @returns {Object} Created snapshot.
 */
export function createSnapshot({ title, stations, summary }) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const cleanTitle = sanitizeString(title || `Briefing Snapshot (${timestamp})`, 80);

  const wards = (stations || []).map((s) => ({
    ward: s.ward,
    stationId: s.stationId,
    aqi: s.aqi,
    primaryPollutant: s.dominantPollutant,
    category: s.band.category,
    pm25: s.concentrations?.pm25,
    pm10: s.concentrations?.pm10,
    timestamp: s.timestamp
  }));

  const snapshot = {
    id: `snap-${Date.now()}`,
    title: cleanTitle,
    timestamp,
    avgAqi: summary?.averageAqi || 0,
    worstAqi: summary?.worstAqi || 0,
    category: summary?.overallCategory || 'Good',
    dataQualityScore: summary?.dataQualityScore || 100,
    wards
  };

  const list = loadSnapshots();
  list.unshift(snapshot);
  saveSnapshotsList(list);

  return snapshot;
}

/**
 * Deletes a snapshot by ID.
 * @param {string} snapshotId - ID to remove.
 * @returns {boolean} True if deleted.
 */
export function deleteSnapshot(snapshotId) {
  const list = loadSnapshots();
  const filtered = list.filter((s) => s.id !== snapshotId);
  if (filtered.length !== list.length) {
    saveSnapshotsList(filtered);
    return true;
  }
  return false;
}

/**
 * Exports current briefing payload as a downloadable JSON file.
 *
 * @param {Object} briefingData - Full briefing data object.
 * @param {string} [filename='civic-air-quality-briefing.json'] - File name.
 */
export function exportBriefingAsJSON(briefingData, filename = 'civic-air-quality-briefing.json') {
  if (typeof document === 'undefined') return;

  const exportPayload = {
    app: 'Civic Air Quality Briefing Studio',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    ...briefingData
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and normalizes an imported JSON briefing payload.
 *
 * @param {string} rawJson - JSON string to import.
 * @returns {{ valid: boolean, data: Object|null, error: string|null }}
 */
export function validateAndNormalizeImport(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, data: null, error: 'File is not a valid JSON object.' };
    }

    // Verify minimum required schema
    if (!Array.isArray(parsed.stations) && !Array.isArray(parsed.wards) && !Array.isArray(parsed.data)) {
      return {
        valid: false,
        data: null,
        error: 'Missing required array field (stations, wards, or data).'
      };
    }

    return { valid: true, data: parsed, error: null };
  } catch (err) {
    return { valid: false, data: null, error: `Invalid JSON syntax: ${err.message}` };
  }
}

/**
 * Saves UI preferences (e.g., dark mode, active tab).
 * @param {Object} prefs
 */
export function savePreferences(prefs) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage limit
  }
}

/**
 * Loads saved UI preferences.
 * @returns {Object}
 */
export function loadPreferences() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
