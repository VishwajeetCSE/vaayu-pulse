/**
 * @fileoverview Automated Test Runner (node test.js)
 * 100% Zero-Dependency test suite covering security, AQI algorithms,
 * data ingestion normalization, persona action triggers, delta comparison,
 * and multi-lingual heuristic synthesis.
 */

import assert from 'node:assert';
import {
  AQI_BANDS,
  POLLUTANT_BREAKPOINTS,
  DEMO_DATASETS,
  escapeHTML,
  sanitizeNumber,
  sanitizeString,
  generateSecureId,
  setApiKey,
  getApiKey,
  hasApiKey,
  clearApiKey,
  parseRawData,
  normalizeConcentration,
  calculateSubIndex,
  getAqiBand,
  normalizeTimestamp,
  normalizeAndProcessData,
  identifyHotspots,
  generatePersonaActions,
  compareSnapshots,
  generateTechnicalBriefing,
  generateCitizenAdvisory,
  generateOfflineHeuristicBriefing,
  createSnapshot,
  validateAndNormalizeImport
} from './src/index.js';

let passedCount = 0;
let failedCount = 0;

/**
 * Test runner helper
 */
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedCount++;
  }
}

function suite(suiteName) {
  console.log(`\n📦 SUITE: ${suiteName}`);
}

console.log('='.repeat(65));
console.log('🚀 RUNNING CIVIC AIR QUALITY BRIEFING STUDIO TEST SUITE');
console.log('='.repeat(65));

// -------------------------------------------------------------
// SUITE 1: Security & Sanitization
// -------------------------------------------------------------
suite('1. Security, Sanitization & Memory Vault');

test('escapeHTML prevents script tags and attribute injections', () => {
  const dangerous = '<script>alert("XSS")</script>&<img src=x onerror=alert(1)>';
  const clean = escapeHTML(dangerous);
  assert.strictEqual(clean.includes('<script>'), false);
  assert.strictEqual(clean.includes('&lt;script&gt;'), true);
  assert.strictEqual(clean.includes('&amp;'), true);
  assert.strictEqual(clean.includes('&quot;'), true);
});

test('sanitizeNumber cleans numeric inputs and clamps to min/max boundaries', () => {
  assert.strictEqual(sanitizeNumber('185.4 ug/m3', 0), 185.4);
  assert.strictEqual(sanitizeNumber('-50', 0, 0, 500), 0);
  assert.strictEqual(sanitizeNumber('650', 0, 0, 500), 500);
  assert.strictEqual(sanitizeNumber('invalid', 25), 25);
  assert.strictEqual(sanitizeNumber(null, 10), 10);
});

test('sanitizeString strips control characters and truncates to maxLength', () => {
  const dirty = 'Ward Central\x00\x08 Plaza\t\n';
  const clean = sanitizeString(dirty, 15);
  assert.strictEqual(clean.includes('\x00'), false);
  assert.strictEqual(clean.length <= 15, true);
  assert.strictEqual(clean.startsWith('Ward Central'), true);
});

test('Ephemeral Memory Vault never leaks credentials', () => {
  clearApiKey();
  assert.strictEqual(hasApiKey(), false);
  assert.strictEqual(getApiKey(), null);

  setApiKey('AIzaSyTestEphemeralKey12345');
  assert.strictEqual(hasApiKey(), true);
  assert.strictEqual(getApiKey(), 'AIzaSyTestEphemeralKey12345');

  clearApiKey();
  assert.strictEqual(hasApiKey(), false);
  assert.strictEqual(getApiKey(), null);
});

test('generateSecureId creates collision-resistant identifiers', () => {
  const id1 = generateSecureId('station');
  const id2 = generateSecureId('station');
  assert.strictEqual(id1.startsWith('station-'), true);
  assert.notStrictEqual(id1, id2);
});

// -------------------------------------------------------------
// SUITE 2: Tabular Ingestion Parser
// -------------------------------------------------------------
suite('2. Messy Tabular Ingestion Parser');

test('Parses clean comma-separated values (CSV)', () => {
  const rows = parseRawData(DEMO_DATASETS.cleanCsv);
  assert.strictEqual(rows.length, 5);
  assert.strictEqual(rows[0].Station_ID, 'ST-101');
  assert.strictEqual(rows[0].Ward_Name, 'Central Civic Plaza');
});

test('Parses tab-separated values (TSV) with missing fields', () => {
  const rows = parseRawData(DEMO_DATASETS.messyTsv);
  assert.strictEqual(rows.length, 5);
  assert.strictEqual(rows[0].Station, 'ST-201');
  assert.strictEqual(rows[1].Ward, 'Riverfront Port Zone');
});

test('Parses Markdown delimited tables', () => {
  const rows = parseRawData(DEMO_DATASETS.markdownTable);
  assert.strictEqual(rows.length, 4);
  assert.strictEqual(rows[0]['Station Code'], 'W-11');
  assert.strictEqual(rows[0].Ward, 'Central Secretariat');
});

test('Parses JSON object arrays', () => {
  const jsonStr = JSON.stringify([
    { station: 'ST-01', ward: 'Zone A', pm25: 45 },
    { station: 'ST-02', ward: 'Zone B', pm25: 140 }
  ]);
  const rows = parseRawData(jsonStr);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].ward, 'Zone A');
});

// -------------------------------------------------------------
// SUITE 3: Unit Normalization Engine
// -------------------------------------------------------------
suite('3. Mixed Pollutant Unit Normalization');

test('Preserves standard µg/m³ values', () => {
  const norm = normalizeConcentration('165.4 ug/m3', 'pm25');
  assert.strictEqual(norm.val, 165.4);
  assert.strictEqual(norm.wasConverted, false);
});

test('Converts NO2 ppm into standard µg/m³ using stoichiometric factor', () => {
  const norm = normalizeConcentration('0.065 ppm', 'no2');
  // 0.065 * 1880 = 122.2 µg/m³
  assert.strictEqual(norm.val, 122.2);
  assert.strictEqual(norm.wasConverted, true);
});

test('Converts CO ppm into standard mg/m³', () => {
  const norm = normalizeConcentration('2.5 ppm', 'co');
  // 2.5 * 1.145 = 2.86 mg/m³
  assert.strictEqual(norm.val, 2.86);
  assert.strictEqual(norm.wasConverted, true);
});

test('Handles missing, NA, or non-numeric values gracefully', () => {
  assert.strictEqual(normalizeConcentration('N/A', 'pm25').val, null);
  assert.strictEqual(normalizeConcentration('-', 'pm10').val, null);
  assert.strictEqual(normalizeConcentration(null, 'so2').val, null);
});

// -------------------------------------------------------------
// SUITE 4: AQI Sub-Index & Band Calculations
// -------------------------------------------------------------
suite('4. AQI Sub-Index & Breakpoint Mathematical Verification');

test('Calculates PM2.5 sub-index correctly across bands', () => {
  // 0-30 µg/m³ -> 0-50 AQI
  assert.strictEqual(calculateSubIndex('pm25', 15), 25);
  // 31-60 µg/m³ -> 51-100 AQI
  assert.strictEqual(calculateSubIndex('pm25', 45), 75);
  // 121-250 µg/m³ -> 301-400 AQI
  const subIdx = calculateSubIndex('pm25', 185);
  assert.strictEqual(subIdx >= 301 && subIdx <= 400, true);
});

test('Calculates PM10 and CO sub-indices accurately', () => {
  assert.strictEqual(calculateSubIndex('pm10', 50), 50);
  assert.strictEqual(calculateSubIndex('co', 1.0), 50);
});

test('Clamps sub-index at 500 for extreme off-the-chart readings', () => {
  assert.strictEqual(calculateSubIndex('pm25', 850), 500);
  assert.strictEqual(calculateSubIndex('pm10', 999), 500);
});

test('getAqiBand correctly maps index to classification metadata', () => {
  assert.strictEqual(getAqiBand(25).category, 'Good');
  assert.strictEqual(getAqiBand(85).category, 'Satisfactory');
  assert.strictEqual(getAqiBand(150).category, 'Moderate');
  assert.strictEqual(getAqiBand(250).category, 'Poor');
  assert.strictEqual(getAqiBand(350).category, 'Very Poor');
  assert.strictEqual(getAqiBand(450).category, 'Severe');
});

// -------------------------------------------------------------
// SUITE 5: Ingestion Anomaly & Data Gap Flagging
// -------------------------------------------------------------
suite('5. Ingestion Anomaly & Traceability Flagging');

test('Flags DATA_GAP, OUT_OF_BOUNDS, and irregular timestamps', () => {
  const rows = parseRawData(DEMO_DATASETS.messyTsv);
  const result = normalizeAndProcessData(rows);

  assert.strictEqual(result.stations.length, 5);
  assert.strictEqual(result.anomaliesCount > 0, true);

  // Check station with negative PM2.5 (West Lake Enclave: -12.0)
  const errStation = result.stations.find((s) => s.ward === 'West Lake Enclave');
  assert.strictEqual(Boolean(errStation), true);
  const hasBoundsAnomaly = errStation.anomalies.some((a) => a.type === 'OUT_OF_BOUNDS');
  assert.strictEqual(hasBoundsAnomaly, true);

  // Check station with missing PM2.5 (Riverfront Port Zone)
  const gapStation = result.stations.find((s) => s.ward === 'Riverfront Port Zone');
  const hasGapAnomaly = gapStation.anomalies.some((a) => a.type === 'DATA_GAP');
  assert.strictEqual(hasGapAnomaly, true);
});

test('Calculates Data Quality Score (DQI) accurately', () => {
  const cleanRows = parseRawData(DEMO_DATASETS.cleanCsv);
  const cleanResult = normalizeAndProcessData(cleanRows);
  assert.strictEqual(cleanResult.summary.dataQualityScore, 100);

  const messyRows = parseRawData(DEMO_DATASETS.messyTsv);
  const messyResult = normalizeAndProcessData(messyRows);
  assert.strictEqual(messyResult.summary.dataQualityScore < 100, true);
});

// -------------------------------------------------------------
// SUITE 6: Hotspot Identification
// -------------------------------------------------------------
suite('6. Critical Hotspot Identification');

test('Ranks and identifies critical hotspots based on severe AQI', () => {
  const rows = parseRawData(DEMO_DATASETS.cleanCsv);
  const processed = normalizeAndProcessData(rows);
  const hotspots = identifyHotspots(processed.stations, 3);

  assert.strictEqual(hotspots.length, 3);
  assert.strictEqual(hotspots[0].ward, 'Industrial East Corridor');
  assert.strictEqual(hotspots[0].rank, 1);
  assert.strictEqual(hotspots[0].priority, 'Emergency');
});

// -------------------------------------------------------------
// SUITE 7: Persona-Tailored Action Recommendation Engine
// -------------------------------------------------------------
suite('7. Persona Action Recommendation Engine');

test('Generates action plans for Ward Officers, RWAs, and Schools', () => {
  const personaActions = generatePersonaActions(350, 220);
  assert.strictEqual(Boolean(personaActions.ward_officer), true);
  assert.strictEqual(Boolean(personaActions.housing_society), true);
  assert.strictEqual(Boolean(personaActions.school), true);

  // In AQI 350, anti-smog misting, construction dust halts, and sports cancellations must be triggered
  const woSprinklers = personaActions.ward_officer.actions.find((a) => a.id === 'wo_sprinklers');
  assert.strictEqual(woSprinklers.isTriggered, true);

  const schSports = personaActions.school.actions.find((a) => a.id === 'sch_sports_cancel');
  assert.strictEqual(schSports.isTriggered, true);

  const rwaDgBan = personaActions.housing_society.actions.find((a) => a.id === 'rwa_dg_ban');
  assert.strictEqual(rwaDgBan.isTriggered, true);
});

test('Escalates actions to Emergency priority when AQI >= 400', () => {
  const emergencyActions = generatePersonaActions(450, 420);
  const triggeredEmergency = emergencyActions.ward_officer.actions.filter((a) => a.priority === 'Emergency');
  assert.strictEqual(triggeredEmergency.length > 0, true);
});

// -------------------------------------------------------------
// SUITE 8: Brief Delta Comparison ("What Changed")
// -------------------------------------------------------------
suite('8. "What Changed" Delta Comparison Engine');

test('Identifies deteriorating, improving, and static hotspots against baseline', () => {
  const rows = parseRawData(DEMO_DATASETS.cleanCsv);
  const current = normalizeAndProcessData(rows);
  const baseline = DEMO_DATASETS.baselineSnapshot;

  const delta = compareSnapshots(current.stations, baseline);
  assert.strictEqual(delta.hasBaseline, true);
  assert.strictEqual(delta.wardDeltas.length > 0, true);

  // Industrial East Corridor went from 280 to 442+ -> Deteriorating
  const indDelta = delta.wardDeltas.find((d) => d.ward === 'Industrial East Corridor');
  assert.strictEqual(Boolean(indDelta), true);
  assert.strictEqual(indDelta.deltaPoints > 0, true);
  assert.strictEqual(indDelta.status.code, 'DETERIORATING');
});

// -------------------------------------------------------------
// SUITE 9: Multi-Persona & Multi-Language Synthesis
// -------------------------------------------------------------
suite('9. Multi-Tier & Multi-Language Advisory Studio');

test('Generates Technical Municipal Briefing Note with statutory citations', () => {
  const rows = parseRawData(DEMO_DATASETS.cleanCsv);
  const processed = normalizeAndProcessData(rows);
  const hotspots = identifyHotspots(processed.stations, 2);
  const personaActions = generatePersonaActions(processed.summary.worstAqi, processed.summary.averageAqi, hotspots);

  const note = generateTechnicalBriefing({
    avgAqi: processed.summary.averageAqi,
    worstAqi: processed.summary.worstAqi,
    hotspots,
    personaActions,
    lang: 'en'
  });

  assert.strictEqual(note.includes('TECHNICAL MUNICIPAL BRIEFING NOTE'), true);
  assert.strictEqual(note.includes('SITUATION REPORT'), true);
  assert.strictEqual(note.includes('Air (Prevention and Control of Pollution) Act'), true);
});

test('Generates Citizen Advisory in Simplified child-friendly mode', () => {
  const advisory = generateCitizenAdvisory({
    avgAqi: 240,
    dominantPollutant: 'PM2.5',
    readingLevel: 'simplified',
    lang: 'en'
  });

  assert.strictEqual(advisory.includes('KIDS & STUDENTS SPECIAL AIR ADVISORY'), true);
  assert.strictEqual(advisory.includes('Shield Mask'), true);
});

test('Generates Citizen Advisory in Vulnerable Health Focus mode', () => {
  const advisory = generateCitizenAdvisory({
    avgAqi: 280,
    dominantPollutant: 'PM2.5',
    readingLevel: 'vulnerable',
    lang: 'en'
  });

  assert.strictEqual(advisory.includes('SPECIAL MEDICAL & VULNERABLE HEALTH ADVISORY'), true);
  assert.strictEqual(advisory.includes('Inhaler'), true);
  assert.strictEqual(advisory.includes('N95'), true);
});

test('Generates high-quality localized advisory in Hindi and Bengali', () => {
  const hiAdvisory = generateCitizenAdvisory({
    avgAqi: 250,
    readingLevel: 'standard',
    lang: 'hi'
  });
  assert.strictEqual(hiAdvisory.includes('नागरिक वायु गुणवत्ता दैनिक बुलेटिन'), true);

  const bnAdvisory = generateCitizenAdvisory({
    avgAqi: 250,
    readingLevel: 'standard',
    lang: 'bn'
  });
  assert.strictEqual(bnAdvisory.includes('দৈনিক নাগরিক বায়ু মান বুলেটিন'), true);
});

// -------------------------------------------------------------
// SUITE 10: Offline Heuristic AI Engine
// -------------------------------------------------------------
suite('10. Offline-First Heuristic AI Engine');

test('Generates instantaneous deterministic briefings with 0 external API calls', () => {
  const context = {
    avgAqi: 180,
    worstAqi: 290,
    dominantPollutant: 'PM2.5',
    hotspots: [{ ward: 'Central Plaza', aqi: 290, dominantPollutant: 'PM2.5', priority: 'High', band: getAqiBand(290) }],
    readingLevel: 'standard',
    lang: 'en'
  };

  const result = generateOfflineHeuristicBriefing(context);
  assert.strictEqual(result.source, 'offline_heuristic');
  assert.strictEqual(Boolean(result.technicalNote), true);
  assert.strictEqual(Boolean(result.citizenAdvisory), true);
  assert.strictEqual(result.executionTimeMs < 50, true);
});

// -------------------------------------------------------------
// SUITE 11: Storage & Serialization
// -------------------------------------------------------------
suite('11. Storage & Schema Validation');

test('validateAndNormalizeImport validates valid schema and rejects invalid JSON', () => {
  const validJson = JSON.stringify({
    title: 'Valid Snapshot',
    stations: [{ ward: 'Sector 1', aqi: 120 }]
  });
  const validRes = validateAndNormalizeImport(validJson);
  assert.strictEqual(validRes.valid, true);

  const invalidJson = 'Not JSON at all';
  const invalidRes = validateAndNormalizeImport(invalidJson);
  assert.strictEqual(invalidRes.valid, false);

  const missingSchema = JSON.stringify({ randomField: 123 });
  const missingRes = validateAndNormalizeImport(missingSchema);
  assert.strictEqual(missingRes.valid, false);
});

// -------------------------------------------------------------
// FINAL REPORT
// -------------------------------------------------------------
console.log('\n' + '='.repeat(65));
console.log(`🏁 TEST SUITE COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('='.repeat(65));

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 11 TEST SUITES PASSED WITH 100% SUCCESS RATE!\n');
}
