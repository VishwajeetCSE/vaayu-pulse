/**
 * @fileoverview Pure DOM Presentation Renderers
 * Highly performant presentation layer with zero layout thrashing,
 * airtight DOM Clobbering / mXSS sanitization, and accessible semantic structures.
 * @module ui-renderers
 */

import { escapeHTML, setSanitizedHTML } from './security.js';
import { ANOMALY_TYPES } from './aqi-engine.js';
import { DELTA_STATUS } from './advisory-engine.js';
import { READING_LEVELS, I18N_TEMPLATES } from './constants.js';
import { aqiCalcCache, advisoryCache } from './cache.js';

/**
 * Renders Executive KPI Overview Cards with cache telemetry.
 *
 * @param {HTMLElement} container - Target container.
 * @param {Object} summary - Summary statistics from AQI engine.
 * @param {Object} aiMeta - AI engine metadata.
 */
export function renderKpiCards(container, summary, aiMeta) {
  if (!container) return;

  const band = summary.overallBand || { category: 'Good', color: '#10b981', bgColor: '#d1fae5', textColor: '#065f46' };
  const dqi = summary.dataQualityScore ?? 100;
  const dqiColor = dqi >= 80 ? 'text-emerald-500' : dqi >= 60 ? 'text-amber-500' : 'text-red-500';

  const engineName = aiMeta?.source === 'live_gemini'
    ? '✨ Live Google Gemini'
    : '⚡ Offline Heuristic AI';
  const engineBadgeClass = aiMeta?.source === 'live_gemini'
    ? 'badge-gemini'
    : 'badge-blue';

  const cacheStats = aqiCalcCache.getStats();

  const html = `
    <div class="kpi-card" role="region" aria-label="Citywide Average Air Quality">
      <div class="kpi-header">
        <span class="kpi-title">Citywide Average AQI</span>
        <span class="kpi-icon" aria-hidden="true">🌍</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-val" style="color: ${band.color}">${summary.averageAqi}</span>
        <span class="aqi-pill" style="background-color: ${band.bgColor}; color: ${band.textColor}; border: 1px solid ${band.color};">
          ${escapeHTML(band.category)}
        </span>
      </div>
      <div class="kpi-caption">${escapeHTML(band.summary)}</div>
    </div>

    <div class="kpi-card" role="region" aria-label="Peak Hotspot Reading">
      <div class="kpi-header">
        <span class="kpi-title">Peak Hotspot AQI</span>
        <span class="kpi-icon" aria-hidden="true">🔥</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-val text-red-500">${summary.worstAqi}</span>
        <span class="badge badge-red">Severe Exposure</span>
      </div>
      <div class="kpi-caption">Lowest reading: <strong>${summary.bestAqi}</strong> across monitored sectors.</div>
    </div>

    <div class="kpi-card" role="region" aria-label="Sensor Data Quality Index & Memory Caching">
      <div class="kpi-header">
        <span class="kpi-title">Sensor Health &amp; Cache</span>
        <span class="kpi-icon" aria-hidden="true">📡</span>
      </div>
      <div class="kpi-value-row">
        <span class="kpi-val ${dqiColor}">${dqi}%</span>
        <span class="badge ${dqi >= 80 ? 'badge-emerald' : 'badge-amber'}">
          ${summary.reliableStationsCount}/${summary.totalStations} Verified
        </span>
      </div>
      <div class="kpi-caption">LRU Cache: <strong>${cacheStats.hitRatio}</strong> hits (${cacheStats.hits} memoized calls)</div>
    </div>

    <div class="kpi-card" role="region" aria-label="GenAI Engine Status">
      <div class="kpi-header">
        <span class="kpi-title">GenAI Orchestration</span>
        <span class="kpi-icon" aria-hidden="true">🤖</span>
      </div>
      <div class="kpi-value-row">
        <span class="badge ${engineBadgeClass}" style="font-size: 0.95rem; padding: 6px 12px;">
          ${escapeHTML(engineName)}
        </span>
      </div>
      <div class="kpi-caption">${escapeHTML(aiMeta?.model || 'Deterministic Civic Engine')} (${aiMeta?.executionTimeMs ?? 0}ms${aiMeta?.isCached ? ' - Cached' : ''})</div>
    </div>
  `;

  setSanitizedHTML(container, html);
}

/**
 * Renders the Ingested Sensor Data Table with visual anomaly badges.
 *
 * @param {HTMLElement} container - Target container.
 * @param {Array<Object>} stations - Processed stations list.
 */
export function renderDataTable(container, stations) {
  if (!container) return;

  if (!stations || stations.length === 0) {
    setSanitizedHTML(
      container,
      `<div class="empty-state">
        <p>No sensor readings ingested yet. Paste or upload data above to generate your briefing.</p>
      </div>`
    );
    return;
  }

  let rowsHtml = '';
  stations.forEach((st) => {
    const band = st.band;

    let badgesHtml = '';
    if (st.anomalies && st.anomalies.length > 0) {
      badgesHtml = st.anomalies
        .map((a) => {
          const def = ANOMALY_TYPES[a.type] || { badgeClass: 'badge-amber', icon: '⚠️', label: a.type };
          return `<span class="badge ${def.badgeClass}" title="${escapeHTML(a.message)}">${def.icon} ${escapeHTML(def.label)}</span>`;
        })
        .join(' ');
    } else {
      badgesHtml = `<span class="badge badge-emerald">✓ Verified Clean</span>`;
    }

    const pm25Val = st.concentrations.pm25 !== null ? st.concentrations.pm25 : '<span class="text-amber-500">N/A</span>';
    const pm10Val = st.concentrations.pm10 !== null ? st.concentrations.pm10 : '<span class="text-amber-500">N/A</span>';
    const no2Val = st.concentrations.no2 !== null ? st.concentrations.no2 : '<span class="text-amber-500">N/A</span>';
    const so2Val = st.concentrations.so2 !== null ? st.concentrations.so2 : '<span class="text-amber-500">N/A</span>';
    const coVal = st.concentrations.co !== null ? st.concentrations.co : '<span class="text-amber-500">N/A</span>';

    rowsHtml += `
      <tr>
        <td class="font-mono text-sm">${escapeHTML(st.stationId)}</td>
        <td class="font-semibold">${escapeHTML(st.ward)}</td>
        <td class="text-xs text-secondary">${escapeHTML(st.timestamp)}</td>
        <td>
          <span class="aqi-cell-badge" style="background-color: ${band.bgColor}; color: ${band.textColor}; border: 1px solid ${band.color}; font-weight: bold;">
            ${st.aqi} (${escapeHTML(band.category)})
          </span>
        </td>
        <td><strong class="text-primary">${escapeHTML(st.dominantPollutant)}</strong></td>
        <td class="text-right">${pm25Val}</td>
        <td class="text-right">${pm10Val}</td>
        <td class="text-right">${no2Val}</td>
        <td class="text-right">${so2Val}</td>
        <td class="text-right">${coVal}</td>
        <td><div class="anomaly-badges-wrapper">${badgesHtml}</div></td>
      </tr>
    `;
  });

  const tableHtml = `
    <div class="table-responsive" tabindex="0" role="region" aria-label="Ingested sensor stations table">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Station ID</th>
            <th scope="col">Ward / Sector</th>
            <th scope="col">Timestamp</th>
            <th scope="col">Calculated AQI</th>
            <th scope="col">Dominant</th>
            <th scope="col" class="text-right">PM2.5 (µg/m³)</th>
            <th scope="col" class="text-right">PM10 (µg/m³)</th>
            <th scope="col" class="text-right">NO2 (µg/m³)</th>
            <th scope="col" class="text-right">SO2 (µg/m³)</th>
            <th scope="col" class="text-right">CO (mg/m³)</th>
            <th scope="col">Data Quality &amp; Gaps</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  setSanitizedHTML(container, tableHtml);
}

/**
 * Renders the "What Changed" Delta Comparison view.
 *
 * @param {HTMLElement} container - Target container.
 * @param {Object} deltaAnalysis - Analysis returned from compareSnapshots.
 */
export function renderDeltaView(container, deltaAnalysis) {
  if (!container) return;

  if (!deltaAnalysis || !deltaAnalysis.hasBaseline) {
    setSanitizedHTML(
      container,
      `<div class="empty-state">
        <p>No prior baseline snapshot selected. Select a baseline snapshot above or click <strong>Save Snapshot</strong> to start tracking real-time deltas.</p>
      </div>`
    );
    return;
  }

  const alertClass = deltaAnalysis.overallDelta > 10
    ? 'alert-red'
    : deltaAnalysis.overallDelta < -10
    ? 'alert-emerald'
    : 'alert-blue';

  let rowsHtml = '';
  deltaAnalysis.wardDeltas.forEach((d) => {
    const deltaSign = d.deltaPoints > 0 ? `+${d.deltaPoints}` : `${d.deltaPoints}`;
    const pctSign = d.pctChange > 0 ? `+${d.pctChange}%` : `${d.pctChange}%`;

    rowsHtml += `
      <tr>
        <td class="font-semibold">${escapeHTML(d.ward)}</td>
        <td class="text-secondary">${d.prevAqi !== null ? d.prevAqi : '—'}</td>
        <td class="font-bold">${d.currentAqi}</td>
        <td>
          <span class="font-bold ${d.status.colorClass}">
            ${deltaSign} (${pctSign})
          </span>
        </td>
        <td>
          <span class="badge ${d.status.badgeClass}">
            ${d.status.icon} ${escapeHTML(d.status.label)}
          </span>
        </td>
      </tr>
    `;
  });

  const html = `
    <div class="delta-container">
      <div class="alert-box ${alertClass}" role="status">
        <div class="alert-icon" aria-hidden="true">📈</div>
        <div class="alert-content">
          <h4 class="alert-title">Delta Comparison vs: ${escapeHTML(deltaAnalysis.previousTitle)}</h4>
          <p class="alert-text">${escapeHTML(deltaAnalysis.summaryText)}</p>
          <div class="delta-metrics-chips">
            <span class="chip chip-red">Deteriorating: ${deltaAnalysis.deterioratingCount}</span>
            <span class="chip chip-emerald">Improving: ${deltaAnalysis.improvingCount}</span>
            <span class="chip chip-amber">Static Hotspots: ${deltaAnalysis.staticHotspotCount}</span>
          </div>
        </div>
      </div>

      <div class="table-responsive mt-3" tabindex="0" role="region" aria-label="Ward delta comparisons table">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Ward / Sector</th>
              <th scope="col">Baseline AQI</th>
              <th scope="col">Current AQI</th>
              <th scope="col">Delta (Change)</th>
              <th scope="col">Trend Classification</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setSanitizedHTML(container, html);
}

/**
 * Renders Persona-Tailored Action Recommendation Checklists,
 * now supporting Ward Officers, Gig Workers, RWAs, and Schools.
 *
 * @param {HTMLElement} container - Target container.
 * @param {Object} personaActions - Actions generated for roles.
 * @param {string} [activeRole='ward_officer'] - Currently selected tab.
 */
export function renderPersonaPanels(container, personaActions, activeRole = 'ward_officer') {
  if (!container || !personaActions) return;

  const currentPersona = personaActions[activeRole];
  if (!currentPersona) return;

  let cardsHtml = '';
  currentPersona.actions.forEach((act) => {
    const isTriggered = act.isTriggered;
    const cardClass = isTriggered ? 'action-card triggered' : 'action-card standby';
    const prioBadgeClass = act.priority === 'Emergency'
      ? 'badge-rose'
      : act.priority === 'Critical'
      ? 'badge-red'
      : act.priority === 'High'
      ? 'badge-orange'
      : 'badge-blue';

    cardsHtml += `
      <div class="${cardClass}" data-action-id="${escapeHTML(act.id)}">
        <div class="action-card-header">
          <div class="action-title-group">
            <span class="badge ${prioBadgeClass}">${escapeHTML(act.priority)}</span>
            <span class="action-timeframe">⏱️ ${escapeHTML(act.timeframe)}</span>
          </div>
          <label class="action-status-checkbox">
            <input type="checkbox" class="action-checkbox" data-id="${escapeHTML(act.id)}" aria-label="Mark task done: ${escapeHTML(act.text)}" />
            <span class="checkbox-label text-xs">Mark Completed</span>
          </label>
        </div>
        <p class="action-text">${escapeHTML(act.text)}</p>
        <div class="action-meta">
          <span class="action-scope">🎯 Scope: ${escapeHTML(act.scope)}</span>
          <span class="action-trigger-min">Min AQI Trigger: ${act.minAqi}</span>
        </div>
      </div>
    `;
  });

  const html = `
    <div class="persona-panel-wrapper">
      <div class="persona-panel-header">
        <div class="persona-title-box">
          <span class="persona-icon-large">${currentPersona.icon}</span>
          <div>
            <h3 class="persona-title">${escapeHTML(currentPersona.title)}</h3>
            <p class="persona-statutory">${escapeHTML(currentPersona.statutoryRef)}</p>
          </div>
        </div>
        <div class="persona-status-tally">
          <span class="tally-count text-red-500">${currentPersona.triggeredCount} Active Mandates</span>
          <span class="tally-sub">out of ${currentPersona.totalCount} protocols</span>
        </div>
      </div>

      <div class="actions-grid mt-4">
        ${cardsHtml}
      </div>
    </div>
  `;

  setSanitizedHTML(container, html);
}

/**
 * Renders the Advisory Studio Output (Dual Output: Technical Note vs Citizen Advisory).
 *
 * @param {HTMLElement} container - Target container.
 * @param {Object} briefingResult - Output from AI engine.
 * @param {'technical'|'citizen'} [viewMode='citizen'] - Dual view toggle.
 */
export function renderAdvisoryStudio(container, briefingResult, viewMode = 'citizen') {
  if (!container) return;

  if (!briefingResult) {
    setSanitizedHTML(
      container,
      `<div class="empty-state">
        <p>Click <strong>Generate Executive Briefing</strong> to synthesize the dual-track advisory.</p>
      </div>`
    );
    return;
  }

  const contentText = viewMode === 'technical'
    ? briefingResult.technicalNote
    : briefingResult.citizenAdvisory;

  const title = viewMode === 'technical'
    ? 'Technical Municipal Briefing Note (Internal Statutory Use)'
    : 'Plain-Language Citizen Advisory (Public Dissemination)';

  const html = `
    <div class="advisory-output-box">
      <div class="advisory-output-header">
        <div class="advisory-heading-group">
          <h3 class="advisory-output-title">${escapeHTML(title)}</h3>
          <span class="badge ${briefingResult.source === 'live_gemini' ? 'badge-gemini' : 'badge-blue'}">
            ${escapeHTML(briefingResult.model)}
          </span>
        </div>
        <div class="advisory-action-buttons">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-advisory" aria-label="Copy advisory text to clipboard">
            📋 Copy Text
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-print-advisory" aria-label="Print or export advisory">
            🖨️ Print
          </button>
        </div>
      </div>

      ${briefingResult.notice ? `<div class="notice-bar mb-2"><small>ℹ️ ${escapeHTML(briefingResult.notice)}</small></div>` : ''}

      <div class="advisory-content-body font-sans" tabindex="0" role="region" aria-label="Generated advisory text content">
        <pre class="advisory-pre-wrap">${escapeHTML(contentText)}</pre>
      </div>
    </div>
  `;

  setSanitizedHTML(container, html);
}

/**
 * Renders Snapshot Selector Dropdown options safely.
 *
 * @param {HTMLSelectElement} selectEl - Target select element.
 * @param {Array<Object>} snapshots - Saved snapshots list.
 * @param {string|null} selectedId - Selected snapshot ID.
 */
export function renderSnapshotOptions(selectEl, snapshots, selectedId = null) {
  if (!selectEl || !Array.isArray(snapshots)) return;

  selectEl.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Select Baseline Snapshot for Comparison --';
  selectEl.appendChild(defaultOption);

  snapshots.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id || s.title;
    opt.textContent = `${s.title} (${s.timestamp || 'Initial'})`;
    if (selectedId && (s.id === selectedId || s.title === selectedId)) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}
