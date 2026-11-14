/**
 * @fileoverview Main Application Controller (app.js)
 * Lean orchestrator coordinating application state, data processing engines,
 * UI renderers, AI orchestration, and accessibility announcements.
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
  activeTrackView: 'citizen', // 'citizen' | 'technical'
  readingLevel: 'standard',
  language: 'en',
  aiMeta: { source: 'offline_heuristic', model: 'PlanGenie Deterministic Engine', executionTimeMs: 0 }
};

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
    executionTimeMs: state.briefingResult.executionTimeMs
  };

  // 5. Render All Components
  renderAllViews();
  announceToScreenReader(`Briefing generated. City average AQI is ${avgAqi}, category ${state.processedData.summary.overallCategory}.`);
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
    dom.apiKeyStatusBadge.textContent = '✨ Gemini Key Active (Memory)';
    dom.apiKeyStatusBadge.className = 'badge badge-gemini cursor-pointer';
  } else {
    dom.apiKeyStatusBadge.textContent = '⚡ Offline AI Active';
    dom.apiKeyStatusBadge.className = 'badge badge-blue cursor-pointer';
  }
}

/**
 * Initializes listeners, accessible tabs, and default data.
 */
function initializeApp() {
  const dom = getDOMElements();

  // Load preferences
  const prefs = loadPreferences();
  if (prefs.theme === 'light') {
    document.documentElement.classList.add('light-theme');
  }

  // Load snapshots
  state.snapshots = loadSnapshots();
  if (state.snapshots.length > 0) {
    state.selectedBaselineId = state.snapshots[0].id || state.snapshots[0].title;
  }

  // Setup accessible main tabs
  if (dom.mainNavTabs) {
    setupAccessibleTabs(dom.mainNavTabs, (tabId) => {
      announceToScreenReader(`Navigated to tab: ${tabId.replace('tab-', '')}`);
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

  // Drag and drop ingestion setup
  setupDropZone(dom.dropZone, (fileContent) => {
    state.rawText = fileContent;
    if (dom.rawInput) dom.rawInput.value = fileContent;
    processCurrentData();
  });

  // File input change
  if (dom.fileInput) {
    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        readFile(file, (content) => {
          state.rawText = content;
          if (dom.rawInput) dom.rawInput.value = content;
          processCurrentData();
        });
      }
    });
  }

  // Sample data dropdown selector
  if (dom.sampleDataSelect) {
    dom.sampleDataSelect.addEventListener('change', (e) => {
      const key = e.target.value;
      if (DEMO_DATASETS[key]) {
        state.rawText = DEMO_DATASETS[key];
        if (dom.rawInput) dom.rawInput.value = state.rawText;
        processCurrentData();
      }
    });
  }

  // Process Ingestion Button
  if (dom.btnIngest) {
    dom.btnIngest.addEventListener('click', () => {
      if (dom.rawInput) state.rawText = dom.rawInput.value;
      processCurrentData();
    });
  }

  // Generate Briefing Button
  if (dom.btnGenerateBriefing) {
    dom.btnGenerateBriefing.addEventListener('click', () => {
      processCurrentData();
    });
  }

  // Reading Level Select
  if (dom.readingLevelSelect) {
    dom.readingLevelSelect.addEventListener('change', (e) => {
      state.readingLevel = e.target.value;
      processCurrentData();
    });
  }

  // Language Select
  if (dom.langSelect) {
    dom.langSelect.addEventListener('change', (e) => {
      state.language = e.target.value;
      processCurrentData();
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
    });
  }

  // Save Snapshot Button
  if (dom.btnSaveSnapshot) {
    dom.btnSaveSnapshot.addEventListener('click', () => {
      if (!state.processedData) return;
      const titlePrompt = prompt('Enter a label for this briefing snapshot:', `Briefing ${new Date().toLocaleTimeString()}`);
      if (titlePrompt) {
        const snap = createSnapshot({
          title: titlePrompt,
          stations: state.processedData.stations,
          summary: state.processedData.summary
        });
        state.snapshots = loadSnapshots();
        state.selectedBaselineId = snap.id;
        renderSnapshotOptions(dom.baselineSnapshotSelect, state.snapshots, state.selectedBaselineId);
        announceToScreenReader(`Snapshot '${snap.title}' saved successfully.`);
      }
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
    });
  }

  // API Key Modal Handling (Memory-Only & Multi-Trigger Dismissal)
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
      announceToScreenReader('Gemini API key loaded into ephemeral memory.');
    }
    closeApiKeyModal();
    updateApiKeyBadge();
    processCurrentData();
  };

  if (dom.btnSaveApiKey) {
    dom.btnSaveApiKey.addEventListener('click', handleSaveApiKey);
  }

  // Allow pressing Enter key in input field to save
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
      announceToScreenReader('Gemini API key purged from memory.');
      updateApiKeyBadge();
      closeApiKeyModal();
      processCurrentData();
    });
  }

  // Theme Toggle Button
  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light-theme');
      dom.themeToggleBtn.setAttribute('aria-pressed', String(isLight));
      savePreferences({ theme: isLight ? 'light' : 'dark' });
      announceToScreenReader(`Switched to ${isLight ? 'light' : 'dark'} mode`);
    });
  }

  // Global delegation for Copy & Print buttons in dynamic advisory
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('#btn-copy-advisory');
    if (copyBtn && state.briefingResult) {
      const text = state.activeTrackView === 'technical'
        ? state.briefingResult.technicalNote
        : state.briefingResult.citizenAdvisory;
      copyToClipboard(text, copyBtn);
    }

    const printBtn = e.target.closest('#btn-print-advisory');
    if (printBtn) {
      window.print();
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
