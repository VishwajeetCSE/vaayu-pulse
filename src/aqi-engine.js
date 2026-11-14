/**
 * @fileoverview Civic AQI Engine & Ingestion Normalizer
 * Ingests messy multi-format sensor data (CSV, TSV, Markdown tables, JSON),
 * converts mixed units, flags anomalies and data gaps with visual tags,
 * and calculates rigorous CPCB/EPA aligned AQI sub-indices and hotspot metrics
 * backed by an LRU memoization cache.
 * @module aqi-engine
 */

import { AQI_BANDS, POLLUTANT_BREAKPOINTS, UNIT_CONVERSIONS } from './constants.js';
import { sanitizeString, sanitizeNumber } from './security.js';
import { aqiCalcCache } from './cache.js';

/**
 * Standard column aliases for heuristic header mapping.
 */
const COLUMN_ALIASES = {
  stationId: ['station', 'station_id', 'station id', 'station code', 'station_code', 'code', 'sensor', 'sensor_id', 'id'],
  ward: ['ward', 'ward_name', 'ward name', 'location', 'area', 'zone', 'neighborhood', 'district', 'site'],
  timestamp: ['timestamp', 'time', 'date', 'recorded_at', 'recorded at', 'observation time', 'datetime', 'created_at'],
  pm25: ['pm2.5', 'pm25', 'pm_25', 'pm 2.5', 'pm2_5', 'fine particulate', 'particulate 2.5'],
  pm10: ['pm10', 'pm_10', 'pm 10', 'respirable particulate', 'particulate 10'],
  no2: ['no2', 'nitrogen dioxide', 'nitrogen_dioxide', 'no_2'],
  so2: ['so2', 'sulfur dioxide', 'sulfur_dioxide', 'so_2'],
  co: ['co', 'carbon monoxide', 'carbon_monoxide'],
  o3: ['o3', 'ozone'],
  unit: ['unit', 'units', 'unit_note', 'unit note', 'metric']
};

/**
 * Anomaly codes with severity and display metadata.
 */
export const ANOMALY_TYPES = Object.freeze({
  DATA_GAP: { code: 'DATA_GAP', label: 'Missing Reading', badgeClass: 'badge-amber', icon: '⚠️' },
  OUT_OF_BOUNDS: { code: 'OUT_OF_BOUNDS', label: 'Out of Physical Bounds', badgeClass: 'badge-red', icon: '⛔' },
  MIXED_UNITS_NORMALIZED: { code: 'MIXED_UNITS_NORMALIZED', label: 'Unit Normalized', badgeClass: 'badge-blue', icon: '🔄' },
  STALE_TIMESTAMP: { code: 'STALE_TIMESTAMP', label: 'Irregular Timestamp', badgeClass: 'badge-orange', icon: '🕒' },
  SENSOR_UNRELIABLE: { code: 'SENSOR_UNRELIABLE', label: 'Unreliable Sensor', badgeClass: 'badge-purple', icon: '🚨' }
});

/**
 * Parses raw text input into structured records.
 * Automatically detects JSON, Markdown tables, TSV, or CSV.
 *
 * @param {string} rawInput - Raw text from paste or file upload.
 * @returns {Array<Object>} Extracted raw rows.
 */
export function parseRawData(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return [];
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    return [];
  }

  // 1. Check for JSON format
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.stations)) return parsed.stations;
        if (Array.isArray(parsed.readings)) return parsed.readings;
        if (Array.isArray(parsed.wards)) return parsed.wards;
        return [parsed];
      }
    } catch {
      // Fall through to tabular parsing if JSON parsing fails
    }
  }

  // 2. Tabular parsing (Markdown table, TSV, or CSV)
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return [];
  }

  // Check if it is a markdown table
  const isMarkdown = lines[0].includes('|');
  let delimiter = ',';

  if (isMarkdown) {
    delimiter = '|';
  } else {
    // Detect delimiter from first non-empty line
    const headerLine = lines[0];
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;

    if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) {
      delimiter = '\t';
    } else if (semicolonCount > commaCount && semicolonCount > 0) {
      delimiter = ';';
    } else {
      delimiter = ',';
    }
  }

  const cleanSplit = (line, delim) => {
    if (delim === '|') {
      // Split on pipe and remove leading/trailing empties
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length > 0 && parts[0] === '') parts.shift();
      if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
      return parts;
    }

    // Standard CSV/TSV splitter with quotation support
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const rawHeaders = cleanSplit(lines[0], delimiter);
  // Ignore markdown separator row like |:---|:---|
  let dataStartIndex = 1;
  if (isMarkdown && lines.length > 1 && /^[|:\-\s]+$/.test(lines[1])) {
    dataStartIndex = 2;
  }

  const rows = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines or markdown separator lines
    if (!line || (isMarkdown && /^[|:\-\s]+$/.test(line))) {
      continue;
    }
    const cols = cleanSplit(line, delimiter);
    const rowObj = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const header = rawHeaders[c] || `col_${c}`;
      rowObj[header] = cols[c] !== undefined ? cols[c] : '';
    }
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Maps raw object keys to canonical property names based on aliases.
 * @param {Object} rawRow - Raw key-value object.
 * @returns {Object} Canonical mapping.
 */
function mapCanonicalFields(rawRow) {
  const result = {
    stationId: '',
    ward: '',
    timestamp: '',
    pm25: null,
    pm10: null,
    no2: null,
    so2: null,
    co: null,
    o3: null,
    unit: '',
    raw: rawRow
  };

  const keys = Object.keys(rawRow);
  const matchedKeys = new Set();

  for (const [canonicalField, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const key of keys) {
      if (matchedKeys.has(key)) continue;
      const normalizedKey = key.toLowerCase().replace(/[\s_.-]/g, '');

      const isMatch = aliases.some((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[\s_.-]/g, '');
        return normalizedKey === cleanAlias || normalizedKey.includes(cleanAlias);
      });

      if (isMatch) {
        result[canonicalField] = rawRow[key];
        matchedKeys.add(key);
        break;
      }
    }
  }

  return result;
}

/**
 * Extracts numeric value and unit from messy field with LRU caching.
 *
 * @param {*} value - The input value.
 * @param {string} pollutant - The pollutant key (pm25, pm10, no2, so2, co, o3).
 * @param {string} [defaultUnit='ug/m3'] - Default unit if not specified.
 * @returns {{ val: number|null, wasConverted: boolean, rawUnit: string }}
 */
export function normalizeConcentration(value, pollutant, defaultUnit = 'ug/m3') {
  if (value === null || value === undefined || value === '') {
    return { val: null, wasConverted: false, rawUnit: '' };
  }

  const cacheKey = `norm_${pollutant}_${String(value).trim()}_${defaultUnit}`;
  const cached = aqiCalcCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const strVal = String(value).trim().toLowerCase();
  if (strVal === 'na' || strVal === 'n/a' || strVal === 'null' || strVal === '-' || strVal === 'nan') {
    const res = { val: null, wasConverted: false, rawUnit: '' };
    aqiCalcCache.set(cacheKey, res);
    return res;
  }

  // Extract number and unit
  const match = strVal.match(/^([-+]?[0-9]*\.?[0-9]+)\s*([a-zµ/3³]*)$/i);
  let num = null;
  let unit = defaultUnit.toLowerCase();

  if (match) {
    num = parseFloat(match[1]);
    if (match[2]) {
      unit = match[2];
    }
  } else {
    const extractedNum = parseFloat(strVal.replace(/[^\d.-]/g, ''));
    if (!Number.isNaN(extractedNum)) {
      num = extractedNum;
    }
  }

  if (num === null || Number.isNaN(num)) {
    const res = { val: null, wasConverted: false, rawUnit: '' };
    aqiCalcCache.set(cacheKey, res);
    return res;
  }

  let wasConverted = false;
  let normalizedVal = num;

  const isPpm = unit.includes('ppm');
  const isPpb = unit.includes('ppb');
  const isMg = unit.includes('mg');

  if (pollutant === 'co') {
    if (isPpm) {
      normalizedVal = num * UNIT_CONVERSIONS.co.ppmToMgM3;
      wasConverted = true;
    } else if (unit.includes('ug') || unit.includes('µg')) {
      normalizedVal = num / 1000;
      wasConverted = true;
    }
  } else {
    if (isPpm) {
      const conv = UNIT_CONVERSIONS[pollutant]?.ppmToUgM3;
      if (conv) {
        normalizedVal = num * conv;
        wasConverted = true;
      }
    } else if (isPpb) {
      const conv = UNIT_CONVERSIONS[pollutant]?.ppbToUgM3;
      if (conv) {
        normalizedVal = num * conv;
        wasConverted = true;
      }
    } else if (isMg) {
      normalizedVal = num * 1000;
      wasConverted = true;
    }
  }

  const finalResult = {
    val: Math.round(normalizedVal * 100) / 100,
    wasConverted,
    rawUnit: unit
  };

  aqiCalcCache.set(cacheKey, finalResult);
  return finalResult;
}

/**
 * Calculates AQI sub-index for a specific pollutant concentration with LRU memoization.
 *
 * @param {string} pollutant - Pollutant key ('pm25', 'pm10', 'no2', 'so2', 'co', 'o3').
 * @param {number|null} concentration - Normalized concentration.
 * @returns {number|null} Sub-index between 0 and 500 or null.
 */
export function calculateSubIndex(pollutant, concentration) {
  if (concentration === null || concentration === undefined || concentration < 0 || Number.isNaN(concentration)) {
    return null;
  }

  const cacheKey = `subidx_${pollutant}_${concentration}`;
  const cached = aqiCalcCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const breakpoints = POLLUTANT_BREAKPOINTS[pollutant];
  if (!breakpoints) {
    return null;
  }

  // Upper boundary clamp
  const highest = breakpoints[breakpoints.length - 1];
  if (concentration >= highest.bpHi) {
    aqiCalcCache.set(cacheKey, 500);
    return 500;
  }

  for (const bp of breakpoints) {
    if (concentration >= bp.bpLo && concentration <= bp.bpHi) {
      const subAqi = ((bp.aqiHi - bp.aqiLo) / (bp.bpHi - bp.bpLo)) * (concentration - bp.bpLo) + bp.aqiLo;
      const res = Math.round(subAqi);
      aqiCalcCache.set(cacheKey, res);
      return res;
    }
  }

  const fallbackVal = Math.round(highest.aqiHi);
  aqiCalcCache.set(cacheKey, fallbackVal);
  return fallbackVal;
}

/**
 * Returns the AQI classification band for a given AQI score.
 * @param {number} aqi - Numeric AQI value.
 * @returns {Object} AQI band metadata.
 */
export function getAqiBand(aqi) {
  const cleanAqi = Math.max(0, Math.min(Math.round(aqi || 0), 500));
  for (const band of AQI_BANDS) {
    if (cleanAqi >= band.min && cleanAqi <= band.max) {
      return band;
    }
  }
  return AQI_BANDS[AQI_BANDS.length - 1];
}

/**
 * Normalizes timestamp string into standard ISO-like civic date-time.
 * Flags unparseable or stale timestamps.
 *
 * @param {*} rawTime - Raw timestamp input.
 * @returns {{ formattedTime: string, isStaleOrInvalid: boolean }}
 */
export function normalizeTimestamp(rawTime) {
  if (!rawTime || String(rawTime).trim().length === 0) {
    const now = new Date();
    return {
      formattedTime: now.toISOString().replace('T', ' ').slice(0, 19),
      isStaleOrInvalid: true
    };
  }

  const str = String(rawTime).trim();
  const parsedDate = new Date(str);

  if (!Number.isNaN(parsedDate.getTime())) {
    const iso = parsedDate.toISOString().replace('T', ' ').slice(0, 19);
    return { formattedTime: iso, isStaleOrInvalid: false };
  }

  // Handle DD/MM/YYYY or DD-Mon-YY formats
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?))?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    const timePart = dmyMatch[4] || '08:00:00';
    return {
      formattedTime: `${year}-${month}-${day} ${timePart}`,
      isStaleOrInvalid: false
    };
  }

  return {
    formattedTime: sanitizeString(str, 30),
    isStaleOrInvalid: true
  };
}

/**
 * Normalizes, flags gaps and anomalies, and calculates AQI for each station row.
 *
 * @param {Array<Object>} rawRows - Array of parsed objects.
 * @returns {{ stations: Array<Object>, summary: Object, anomaliesCount: number }}
 */
export function normalizeAndProcessData(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      stations: [],
      summary: {
        totalStations: 0,
        averageAqi: 0,
        worstAqi: 0,
        bestAqi: 0,
        overallCategory: 'Good',
        dataQualityScore: 100
      },
      anomaliesCount: 0
    };
  }

  const stations = [];
  let totalAnomalies = 0;
  let reliableStationsCount = 0;

  rawRows.forEach((row, index) => {
    const mapped = mapCanonicalFields(row);
    const stationId = sanitizeString(mapped.stationId || `ST-${100 + index + 1}`, 30);
    const ward = sanitizeString(mapped.ward || `Ward ${index + 1}`, 60);
    const timeMeta = normalizeTimestamp(mapped.timestamp);

    const anomalies = [];

    if (timeMeta.isStaleOrInvalid) {
      anomalies.push({
        type: ANOMALY_TYPES.STALE_TIMESTAMP.code,
        message: 'Irregular/unparseable observation timestamp'
      });
    }

    const pollutants = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];
    const concentrations = {};
    const subIndices = {};
    let unitConvertedFlag = false;

    for (const p of pollutants) {
      const rawVal = mapped[p];
      const norm = normalizeConcentration(rawVal, p, mapped.unit || 'ug/m3');

      if (norm.wasConverted) {
        unitConvertedFlag = true;
      }

      if (norm.val === null) {
        if (p === 'pm25' || p === 'pm10') {
          anomalies.push({
            type: ANOMALY_TYPES.DATA_GAP.code,
            message: `Missing critical reading for ${p.toUpperCase()}`
          });
        }
        concentrations[p] = null;
        subIndices[p] = null;
      } else {
        let isOutOfBounds = false;
        if (norm.val < 0) {
          isOutOfBounds = true;
        } else if (p === 'pm25' && norm.val > 1000) {
          isOutOfBounds = true;
        } else if (p === 'pm10' && norm.val > 1500) {
          isOutOfBounds = true;
        } else if (p === 'no2' && norm.val > 1200) {
          isOutOfBounds = true;
        } else if (p === 'so2' && norm.val > 2500) {
          isOutOfBounds = true;
        } else if (p === 'co' && norm.val > 60) {
          isOutOfBounds = true;
        }

        if (isOutOfBounds) {
          anomalies.push({
            type: ANOMALY_TYPES.OUT_OF_BOUNDS.code,
            message: `Out of physical bounds for ${p.toUpperCase()}: ${norm.val}`
          });
          concentrations[p] = null;
          subIndices[p] = null;
        } else {
          concentrations[p] = norm.val;
          subIndices[p] = calculateSubIndex(p, norm.val);
        }
      }
    }

    if (unitConvertedFlag) {
      anomalies.push({
        type: ANOMALY_TYPES.MIXED_UNITS_NORMALIZED.code,
        message: 'Mixed pollutant units were converted and normalized'
      });
    }

    const validSubIndices = Object.entries(subIndices).filter(([_, val]) => typeof val === 'number');

    let aqi = 0;
    let dominantPollutant = 'PM2.5';

    if (validSubIndices.length > 0) {
      validSubIndices.sort((a, b) => b[1] - a[1]);
      dominantPollutant = validSubIndices[0][0].toUpperCase();
      aqi = validSubIndices[0][1];
    } else {
      anomalies.push({
        type: ANOMALY_TYPES.SENSOR_UNRELIABLE.code,
        message: 'No valid pollutant sub-indices could be computed'
      });
      aqi = 0;
    }

    const isUnreliable = anomalies.some(
      (a) => a.type === ANOMALY_TYPES.SENSOR_UNRELIABLE.code || a.type === ANOMALY_TYPES.OUT_OF_BOUNDS.code
    ) || anomalies.length >= 2;

    if (isUnreliable) {
      if (!anomalies.some((a) => a.type === ANOMALY_TYPES.SENSOR_UNRELIABLE.code)) {
        anomalies.push({
          type: ANOMALY_TYPES.SENSOR_UNRELIABLE.code,
          message: 'Multiple data anomalies flag this sensor as low-confidence'
        });
      }
    } else {
      reliableStationsCount++;
    }

    totalAnomalies += anomalies.length;

    const band = getAqiBand(aqi);

    stations.push({
      stationId,
      ward,
      timestamp: timeMeta.formattedTime,
      aqi,
      band,
      dominantPollutant,
      concentrations,
      subIndices,
      anomalies,
      isReliable: !isUnreliable
    });
  });

  stations.sort((a, b) => b.aqi - a.aqi);

  const validAqiList = stations.filter((s) => s.aqi > 0).map((s) => s.aqi);
  const avgAqi = validAqiList.length > 0 ? Math.round(validAqiList.reduce((acc, v) => acc + v, 0) / validAqiList.length) : 0;
  const worstAqi = validAqiList.length > 0 ? Math.max(...validAqiList) : 0;
  const bestAqi = validAqiList.length > 0 ? Math.min(...validAqiList) : 0;

  const dataQualityScore = stations.length > 0
    ? Math.round((reliableStationsCount / stations.length) * 100)
    : 100;

  return {
    stations,
    summary: {
      totalStations: stations.length,
      averageAqi: avgAqi,
      worstAqi,
      bestAqi,
      overallCategory: getAqiBand(avgAqi).category,
      overallBand: getAqiBand(avgAqi),
      dataQualityScore,
      reliableStationsCount
    },
    anomaliesCount: totalAnomalies
  };
}

/**
 * Extracts top critical hotspots from processed station data.
 * @param {Array<Object>} stations - Array of processed station objects.
 * @param {number} [topN=3] - Number of top hotspots to return.
 * @returns {Array<Object>} Hotspot objects with intervention urgency.
 */
export function identifyHotspots(stations, topN = 3) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return [];
  }

  const candidates = [...stations].sort((a, b) => b.aqi - a.aqi);
  const hotspots = candidates.slice(0, topN).map((st, index) => {
    let priority = 'Moderate';
    if (st.aqi >= 401) priority = 'Emergency';
    else if (st.aqi >= 301) priority = 'Critical';
    else if (st.aqi >= 201) priority = 'High';

    return {
      rank: index + 1,
      stationId: st.stationId,
      ward: st.ward,
      aqi: st.aqi,
      band: st.band,
      dominantPollutant: st.dominantPollutant,
      priority,
      isReliable: st.isReliable,
      anomalies: st.anomalies
    };
  });

  return hotspots;
}
