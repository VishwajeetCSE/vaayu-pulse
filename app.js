/**
 * @fileoverview Main Application Controller (app.js)
 * Clean Google Material 3 UI orchestrator coordinating application state,
 * 1-click dataset loaders, interactive action cards, toast alerts, and GenAI synthesis.
 */

import {
  DEMO_DATASETS,
  parseRawData,
  normalizeAndProcessData,
  identifyHotspots,
  generatePersonaActions,
  compareSnapshots,
  generateOfflineHeuristicBriefing,
  generateGeminiBriefing,
  loadSnapshots,
  createSnapshot,
  exportBriefingAsJSON,
  savePreferences,
  loadPreferences,
  setApiKey,
  hasApiKey,
  clearApiKey,
  escapeHTML,
  setSanitizedHTML,
  getDOMElements,
  setupDropZone,
  readFile,
  copyToClipboard,
  setupAccessibleTabs,
  announceToScreenReader,
  trapFocus,
  releaseFocus,
  renderKpiCards,
  renderDataTable,
  renderDeltaView,
  renderPersonaPanels,
  renderAdvisoryStudio,
  renderSnapshotOptions
} from './src/index.js';

/**
 * Application State Container
 */
const state = {
  rawText: DEMO_DATASETS.cleanCsv,
  processedData: null,
  hotspots: [],
  personaActions: null,
  activePersonaRole: 'ward_officer',
  deltaAnalysis: null,
  snapshots: [],
  selectedBaselineId: '',
  briefingResult: null,
  activeTrackView: 'citizen',
  readingLevel: 'standard',
  language: 'en',
  aiMeta: { source: 'offline_heuristic', model: 'PlanGenie Deterministic Engine', executionTimeMs: 0 }
};

/**
 * Displays a lightweight, non-blocking toast notification.
 * @param {string} message
 * @param {string} [icon='🍃']
 * @param {number} [duration=3000]
 */
function showToast(message, icon = '🍃', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  setSanitizedHTML(toast, `<span aria-hidden="true">${escapeHTML(icon)}</span> <span>${escapeHTML(message)}</span>`);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Downloads a sample CSV test file directly to the user's machine.
 */
function downloadSampleFile() {
  const blob = new Blob([DEMO_DATASETS.cleanCsv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample-city-air-quality.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Sample CSV file downloaded! Drag it into the drop zone.', '📥');
}

/**
 * Executes full data pipeline: parsing, normalization, hotspot identification,
 * persona action triggers, delta comparison, and GenAI synthesis.
 */
async function processCurrentData() {
  const dom = getDOMElements();
  announceToScreenReader('Processing air quality data and calculating civic advisories...');

  // 1. Ingestion & Normalization
  const rawRows = parseRawData(state.rawText);
  state.processedData = normalizeAndProcessData(rawRows);
  state.hotspots = identifyHotspots(state.processedData.stations, 3);

  // 2. Persona Action Catalog
  const maxAqi = state.processedData.summary.worstAqi;
  const avgAqi = state.processedData.summary.averageAqi;
  state.personaActions = generatePersonaActions(maxAqi, avgAqi, state.hotspots);

  // 3. Snapshot Delta Analysis
  const activeBaseline = state.snapshots.find(
    (s) => (s.id && s.id === state.selectedBaselineId) || (s.title && s.title === state.selectedBaselineId)
  ) || state.snapshots[0] || null;

  state.deltaAnalysis = compareSnapshots(state.processedData.stations, activeBaseline);

  // 4. GenAI Synthesis (Hybrid Orchestration)
  const aiContext = {
    avgAqi,
    worstAqi: maxAqi,
    dominantPollutant: state.hotspots[0]?.dominantPollutant || 'PM2.5',
    hotspots: state.hotspots,
    deltaAnalysis: state.deltaAnalysis,
    personaActions: state.personaActions,
    readingLevel: state.readingLevel,
    lang: state.language
  };

  if (hasApiKey()) {
    try {
      state.briefingResult = await generateGeminiBriefing(aiContext);
    } catch {
      state.briefingResult = generateOfflineHeuristicBriefing(aiContext);
    }
  } else {
    state.briefingResult = generateOfflineHeuristicBriefing(aiContext);
  }

  state.aiMeta = {
    source: state.briefingResult.source,
    model: state.briefingResult.model,
    executionTimeMs: state.briefingResult.executionTimeMs,
    isCached: state.briefingResult.isCached
  };

  // 5. Render All Components
  renderAllViews();
  announceToScreenReader(`Briefing updated. City average AQI: ${avgAqi} (${state.processedData.summary.overallCategory}).`);
}

/**
 * Re-renders all UI views from state.
 */
function renderAllViews() {
  const dom = getDOMElements();
  if (!state.processedData) return;

  renderKpiCards(dom.kpiContainer, state.processedData.summary, state.aiMeta);
  renderDataTable(dom.dataTableContainer, state.processedData.stations);
  renderDeltaView(dom.deltaContainer, state.deltaAnalysis);
  renderPersonaPanels(dom.personaContainer, state.personaActions, state.activePersonaRole);
  renderAdvisoryStudio(dom.advisoryContainer, state.briefingResult, state.activeTrackView);
  renderSnapshotOptions(dom.baselineSnapshotSelect, state.snapshots, state.selectedBaselineId);
  updateApiKeyBadge();
}

/**
 * Updates visual status badge for ephemeral API key state.
 */
function updateApiKeyBadge() {
  const dom = getDOMElements();
  if (!dom.apiKeyStatusBadge) return;

  if (hasApiKey()) {
    setSanitizedHTML(dom.apiKeyStatusBadge, '<span class="dot-indicator dot-green"></span> <span>✨ Gemini Live (RAM)</span>');
    dom.apiKeyStatusBadge.className = 'btn-chip btn-chip-blue cursor-pointer';
  } else {
    setSanitizedHTML(dom.apiKeyStatusBadge, '<span class="dot-indicator dot-green"></span> <span>⚡ Offline AI Active</span>');
    dom.apiKeyStatusBadge.className = 'btn-chip btn-chip-blue cursor-pointer';
  }
}

/**
 * Initializes listeners, accessible tabs, and default data.
 */
function initializeApp() {
  const dom = getDOMElements();

  // Load preferences
  const prefs = loadPreferences();
  if (prefs.theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.body.classList.add('dark-theme');
  }

  // Load snapshots
  state.snapshots = loadSnapshots();
  if (state.snapshots.length > 0) {
    state.selectedBaselineId = state.snapshots[0].id || state.snapshots[0].title;
  }

  // Setup accessible main tabs
  if (dom.mainNavTabs) {
    setupAccessibleTabs(dom.mainNavTabs, (tabId) => {
      announceToScreenReader(`Switched to tab: ${tabId.replace('tab-', '')}`);
    });
  }

  // Setup accessible persona tabs
  if (dom.personaTabs) {
    setupAccessibleTabs(dom.personaTabs, (tabId) => {
      const roleMap = {
        'tab-ward-officer': 'ward_officer',
        'tab-gig-worker': 'gig_worker',
        'tab-housing-society': 'housing_society',
        'tab-school': 'school'
      };
      state.activePersonaRole = roleMap[tabId] || 'ward_officer';
      renderPersonaPanels(dom.personaContainer, state.personaActions, state.activePersonaRole);
    });
  }

  // Setup accessible advisory track tabs (Dual Track)
  if (dom.advisoryTrackTabs) {
    setupAccessibleTabs(dom.advisoryTrackTabs, (tabId) => {
      state.activeTrackView = tabId === 'tab-technical-track' ? 'technical' : 'citizen';
      renderAdvisoryStudio(dom.advisoryContainer, state.briefingResult, state.activeTrackView);
    });
  }

  // Quick 1-Click Preset Buttons Bar
  const presetChips = document.querySelectorAll('.preset-chip');
  presetChips.forEach((chip) => {
    chip.addEventListener('click', (e) => {
      presetChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const presetKey = chip.getAttribute('data-preset');
      if (DEMO_DATASETS[presetKey]) {
        state.rawText = DEMO_DATASETS[presetKey];
        if (dom.rawInput) dom.rawInput.value = state.rawText;
        processCurrentData();
        showToast(`Loaded ${chip.textContent.trim()} dataset!`, '⚡');
      }
    });
  });

  // Download Sample CSV Button
  const btnDownloadSample = document.getElementById('btn-download-sample');
  if (btnDownloadSample) {
    btnDownloadSample.addEventListener('click', downloadSampleFile);
  }

  // Drag and drop ingestion setup
  setupDropZone(dom.dropZone, (fileContent, fileName) => {
    state.rawText = fileContent;
    if (dom.rawInput) dom.rawInput.value = fileContent;
    processCurrentData();
    showToast(`Ingested file: ${fileName || 'Dataset'}`, '📁');
  });

  // File input change
  if (dom.fileInput) {
    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        readFile(file, (content, name) => {
          state.rawText = content;
          if (dom.rawInput) dom.rawInput.value = content;
          processCurrentData();
          showToast(`Loaded ${name}`, '📁');
        });
      }
    });
  }

  // Process Ingestion Button
  if (dom.btnIngest) {
    dom.btnIngest.addEventListener('click', () => {
      if (dom.rawInput) state.rawText = dom.rawInput.value;
      processCurrentData();
      showToast('Sensor readings analyzed and normalized!', '🚀');
    });
  }

  // Generate Briefing Button
  if (dom.btnGenerateBriefing) {
    dom.btnGenerateBriefing.addEventListener('click', () => {
      processCurrentData();
      showToast('Advisory regenerated with latest metrics!', '✨');
    });
  }

  // Reading Level Select
  if (dom.readingLevelSelect) {
    dom.readingLevelSelect.addEventListener('change', (e) => {
      state.readingLevel = e.target.value;
      processCurrentData();
      showToast(`Advisory updated for: ${e.target.options[e.target.selectedIndex].text}`, '🎯');
    });
  }

  // Language Select
  if (dom.langSelect) {
    dom.langSelect.addEventListener('change', (e) => {
      state.language = e.target.value;
      processCurrentData();
      showToast(`Translated to ${e.target.options[e.target.selectedIndex].text}`, '🌐');
    });
  }

  // Baseline Snapshot Select for Delta Comparison
  if (dom.baselineSnapshotSelect) {
    dom.baselineSnapshotSelect.addEventListener('change', (e) => {
      state.selectedBaselineId = e.target.value;
      const activeBaseline = state.snapshots.find(
        (s) => (s.id && s.id === state.selectedBaselineId) || (s.title && s.title === state.selectedBaselineId)
      ) || null;
      state.deltaAnalysis = compareSnapshots(state.processedData?.stations || [], activeBaseline);
      renderDeltaView(dom.deltaContainer, state.deltaAnalysis);
      showToast('Baseline comparison updated!', '📊');
    });
  }

  // Save Snapshot Button (Clean inline modal/toast, no ugly prompt)
  if (dom.btnSaveSnapshot) {
    dom.btnSaveSnapshot.addEventListener('click', () => {
      if (!state.processedData) return;
      const title = `Snapshot at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const snap = createSnapshot({
        title,
        stations: state.processedData.stations,
        summary: state.processedData.summary
      });
      state.snapshots = loadSnapshots();
      state.selectedBaselineId = snap.id;
      renderSnapshotOptions(dom.baselineSnapshotSelect, state.snapshots, state.selectedBaselineId);
      announceToScreenReader(`Snapshot '${snap.title}' saved.`);
      showToast(`Snapshot '${title}' saved & set as baseline!`, '📸');
    });
  }

  // Export JSON Button
  if (dom.btnExportJson) {
    dom.btnExportJson.addEventListener('click', () => {
      if (!state.processedData) return;
      exportBriefingAsJSON({
        summary: state.processedData.summary,
        stations: state.processedData.stations,
        hotspots: state.hotspots,
        deltaAnalysis: state.deltaAnalysis,
        personaActions: state.personaActions,
        briefing: state.briefingResult
      });
      announceToScreenReader('Briefing exported as JSON.');
      showToast('Briefing exported as JSON file!', '💾');
    });
  }

  // Bulletproof Modal Functions
  const openApiKeyModal = () => {
    if (dom.apiKeyModal) {
      dom.apiKeyModal.removeAttribute('hidden');
      dom.apiKeyModal.style.setProperty('display', 'flex', 'important');
      trapFocus(dom.apiKeyModal, dom.apiKeyInput);
    }
  };

  const closeApiKeyModal = () => {
    if (dom.apiKeyModal) {
      dom.apiKeyModal.setAttribute('hidden', 'true');
      dom.apiKeyModal.style.setProperty('display', 'none', 'important');
      releaseFocus();
    }
  };

  if (dom.btnOpenApiKeyModal) {
    dom.btnOpenApiKeyModal.addEventListener('click', openApiKeyModal);
  }
  if (dom.apiKeyStatusBadge) {
    dom.apiKeyStatusBadge.addEventListener('click', openApiKeyModal);
  }

  if (dom.btnCloseApiKeyModal) {
    dom.btnCloseApiKeyModal.addEventListener('click', closeApiKeyModal);
  }

  // Click outside backdrop to close
  if (dom.apiKeyModal) {
    dom.apiKeyModal.addEventListener('click', (e) => {
      if (e.target === dom.apiKeyModal) {
        closeApiKeyModal();
      }
    });
  }

  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.apiKeyModal && dom.apiKeyModal.style.display !== 'none') {
      closeApiKeyModal();
    }
  });

  const handleSaveApiKey = () => {
    const key = dom.apiKeyInput?.value?.trim();
    if (key) {
      setApiKey(key);
      showToast('Gemini API key loaded into ephemeral memory!', '✨');
    }
    closeApiKeyModal();
    updateApiKeyBadge();
    processCurrentData();
  };

  if (dom.btnSaveApiKey) {
    dom.btnSaveApiKey.addEventListener('click', handleSaveApiKey);
  }

  if (dom.apiKeyInput) {
    dom.apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveApiKey();
      }
    });
  }

  if (dom.btnClearApiKey) {
    dom.btnClearApiKey.addEventListener('click', () => {
      clearApiKey();
      if (dom.apiKeyInput) dom.apiKeyInput.value = '';
      showToast('Gemini API key purged from memory.', '🧹');
      updateApiKeyBadge();
      closeApiKeyModal();
      processCurrentData();
    });
  }

  // Theme Toggle Button
  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      document.documentElement.classList.toggle('dark-theme');
      dom.themeToggleBtn.setAttribute('aria-pressed', String(isDark));
      savePreferences({ theme: isDark ? 'dark' : 'light' });
      showToast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`, '🌓');
    });
  }

  // Global delegation for Copy, Print, and Task Checkboxes
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('#btn-copy-advisory');
    if (copyBtn && state.briefingResult) {
      const text = state.activeTrackView === 'technical'
        ? state.briefingResult.technicalNote
        : state.briefingResult.citizenAdvisory;
      copyToClipboard(text, copyBtn);
      showToast('Advisory text copied to clipboard!', '📋');
    }

    const printBtn = e.target.closest('#btn-print-advisory');
    if (printBtn) {
      window.print();
    }

    // Interactive Checklist Toggle
    const chk = e.target.closest('.action-checkbox');
    if (chk) {
      const card = chk.closest('.action-card');
      if (card) {
        card.classList.toggle('completed', chk.checked);
        const label = card.querySelector('.checkbox-label');
        if (label) {
          label.textContent = chk.checked ? 'Completed ✓' : 'Mark Completed';
        }
        showToast(chk.checked ? 'Task marked as completed!' : 'Task reopened.', chk.checked ? '✅' : '🔄');
      }
    }
  });

  // Initial Data Ingestion run
  if (dom.rawInput) {
    dom.rawInput.value = state.rawText;
  }
  processCurrentData();
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
