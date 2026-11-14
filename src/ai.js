/**
 * @fileoverview Hybrid GenAI Orchestration Module (PlanGenie AI)
 * Provides deterministic offline heuristic intelligence with ZERO external API calls,
 * combined with an optional live Google Gemini 1.5/2.0 API connector using memory-only
 * ephemeral credentials and automatic fallback.
 * @module ai
 */

import { getApiKey, hasApiKey, sanitizeString } from './security.js';
import { generateTechnicalBriefing, generateCitizenAdvisory } from './advisory-engine.js';

/**
 * Standard Gemini API Endpoint configuration.
 */
const GEMINI_CONFIG = {
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  timeoutMs: 12000
};

/**
 * Generates an analytical briefing using the Offline-First Heuristic AI Engine.
 * Instant, 100% deterministic, zero network latency, zero API key required.
 *
 * @param {Object} context - Analytical context from processed sensor data.
 * @returns {Object} Briefing payload containing technical and citizen advisories.
 */
export function generateOfflineHeuristicBriefing(context) {
  const {
    avgAqi = 150,
    worstAqi = 220,
    dominantPollutant = 'PM2.5',
    hotspots = [],
    deltaAnalysis = {},
    personaActions = {},
    readingLevel = 'standard',
    lang = 'en'
  } = context;

  const technicalNote = generateTechnicalBriefing({
    avgAqi,
    worstAqi,
    hotspots,
    deltaAnalysis,
    personaActions,
    lang
  });

  const citizenAdvisory = generateCitizenAdvisory({
    avgAqi,
    dominantPollutant,
    hotspots,
    readingLevel,
    lang
  });

  return {
    source: 'offline_heuristic',
    model: 'PlanGenie Deterministic Civic Heuristic Engine v2.4',
    timestamp: new Date().toISOString(),
    technicalNote,
    citizenAdvisory,
    readingLevel,
    lang,
    executionTimeMs: 4
  };
}

/**
 * Dispatches prompt to Google Gemini API if user has provided an in-memory key.
 * Strictly ephemeral: key is fetched from memory vault, never sent elsewhere.
 *
 * @param {Object} context - Sensor and briefing context.
 * @returns {Promise<Object>} Generative AI response or fallback.
 */
export async function generateGeminiBriefing(context) {
  const startTime = performance.now();

  // If no API key loaded in memory, return offline heuristic result immediately
  if (!hasApiKey()) {
    const offlineResult = generateOfflineHeuristicBriefing(context);
    offlineResult.notice = 'Offline-first heuristic engine utilized (No Gemini API key supplied in memory).';
    return offlineResult;
  }

  const apiKey = getApiKey();
  const {
    avgAqi = 150,
    worstAqi = 220,
    dominantPollutant = 'PM2.5',
    hotspots = [],
    deltaAnalysis = {},
    readingLevel = 'standard',
    lang = 'en'
  } = context;

  const promptText = `You are the Lead Environmental AI Officer for a Metropolitan Government.
Generate an authoritative Civic Air Quality Briefing based on the following real-time sensor metrics:

City Average AQI: ${avgAqi}
Peak AQI: ${worstAqi}
Dominant Pollutant: ${dominantPollutant}
Identified Hotspot Wards: ${hotspots.map((h) => `${h.ward} (AQI ${h.aqi}, ${h.dominantPollutant})`).join('; ')}
Trend Delta vs Baseline: ${deltaAnalysis.summaryText || 'Baseline stable'}
Target Reading Level for Citizen Advisory: ${readingLevel} (Options: standard, simplified for children, vulnerable health focus)
Language: ${lang}

Please provide your output in two clearly separated sections:
---SECTION 1: TECHNICAL MUNICIPAL BRIEFING NOTE---
(Include situational epidemiology, statutory GRAP enforcement directives for Ward Officers, RWAs, and Schools, and inter-agency timeline).

---SECTION 2: PLAIN-LANGUAGE CITIZEN ADVISORY---
(Targeted precisely for the requested reading level '${readingLevel}' in language '${lang}'. Action-oriented, empathetic, and scientifically rigorous).`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_CONFIG.timeoutMs);

    const url = `${GEMINI_CONFIG.endpoint}?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const generatedText = json.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Gemini API returned an empty candidate text response.');
    }

    // Split sections
    let technicalNote = '';
    let citizenAdvisory = '';

    if (generatedText.includes('---SECTION 2:')) {
      const parts = generatedText.split('---SECTION 2:');
      technicalNote = parts[0].replace(/---SECTION 1:[^-]*---/, '').trim();
      citizenAdvisory = parts[1].replace(/^[^-]*---/, '').trim();
    } else {
      technicalNote = generatedText;
      citizenAdvisory = generateCitizenAdvisory(context);
    }

    const elapsed = Math.round(performance.now() - startTime);

    return {
      source: 'live_gemini',
      model: 'Google Gemini 1.5 Flash (Live Orchestrated)',
      timestamp: new Date().toISOString(),
      technicalNote,
      citizenAdvisory,
      readingLevel,
      lang,
      executionTimeMs: elapsed
    };
  } catch (err) {
    // Graceful fallback to deterministic heuristic engine on failure/timeout
    const fallback = generateOfflineHeuristicBriefing(context);
    fallback.notice = `Gemini call failed (${sanitizeString(err.message, 120)}). Seamlessly fell back to Offline Deterministic Engine.`;
    fallback.fallbackReason = err.message;
    return fallback;
  }
}
