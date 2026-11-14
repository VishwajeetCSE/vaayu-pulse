/**
 * @fileoverview UI Accessibility & WAI-ARIA Module
 * Enforces WCAG 2.1 AA compliance, accessible tabs with roving tabindex,
 * disclosure widgets, live region screen-reader announcements, and modal focus traps.
 * @module ui-accessibility
 */

/**
 * Screen-reader live announcer element reference.
 * @type {HTMLElement|null}
 */
let liveAnnouncerEl = null;

/**
 * Cache for active focus trap cleanup.
 * @type {Function|null}
 */
let activeFocusTrapCleanup = null;

/**
 * Initializes or retrieves the WAI-ARIA live region for screen-reader announcements.
 * @returns {HTMLElement} Live region DOM element.
 */
export function getLiveAnnouncer() {
  if (liveAnnouncerEl && document.body.contains(liveAnnouncerEl)) {
    return liveAnnouncerEl;
  }

  let el = document.getElementById('sr-announcer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sr-announcer';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    // Visually hidden styles
    el.style.position = 'absolute';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.padding = '0';
    el.style.margin = '-1px';
    el.style.overflow = 'hidden';
    el.style.clip = 'rect(0, 0, 0, 0)';
    el.style.whiteSpace = 'nowrap';
    el.style.border = '0';
    document.body.appendChild(el);
  }
  liveAnnouncerEl = el;
  return liveAnnouncerEl;
}

/**
 * Broadcasts an announcement to assistive screen readers via ARIA live region.
 * @param {string} message - Message to announce.
 * @param {'polite'|'assertive'} [politeness='polite'] - Urgency level.
 */
export function announceToScreenReader(message, politeness = 'polite') {
  if (!message || typeof document === 'undefined') {
    return;
  }
  const announcer = getLiveAnnouncer();
  announcer.setAttribute('aria-live', politeness);
  // Clear and update to force assistive tech re-read
  announcer.textContent = '';
  setTimeout(() => {
    announcer.textContent = message;
  }, 50);
}

/**
 * Updates WAI-ARIA disclosure state on trigger button and expandable panel.
 *
 * @param {HTMLElement} triggerBtn - Toggle button.
 * @param {HTMLElement} panelEl - Target expandable panel.
 * @param {boolean} isExpanded - Desired expansion state.
 */
export function setDisclosureState(triggerBtn, panelEl, isExpanded) {
  if (!triggerBtn || !panelEl) {
    return;
  }

  triggerBtn.setAttribute('aria-expanded', String(isExpanded));
  if (isExpanded) {
    panelEl.removeAttribute('hidden');
    panelEl.style.display = '';
  } else {
    panelEl.setAttribute('hidden', 'true');
    panelEl.style.display = 'none';
  }
}

/**
 * Sets up accessible tab navigation conforming to WAI-ARIA Tab Pattern.
 * Implements roving tabindex, Arrow Left/Right/Home/End keyboard navigation.
 *
 * @param {HTMLElement} tablist - Element containing tab buttons.
 * @param {Function} [onSelectTab] - Callback receiving (tabId, targetPanelId).
 * @returns {Function} Teardown/cleanup function.
 */
export function setupAccessibleTabs(tablist, onSelectTab = null) {
  if (!tablist) {
    return () => {};
  }

  tablist.setAttribute('role', 'tablist');
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

  const activateTab = (tabToActivate, shouldFocus = true) => {
    tabs.forEach((tab) => {
      const isSelected = tab === tabToActivate;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');

      const panelId = tab.getAttribute('aria-controls');
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tab.id);
          if (isSelected) {
            panel.removeAttribute('hidden');
            panel.style.display = '';
          } else {
            panel.setAttribute('hidden', 'true');
            panel.style.display = 'none';
          }
        }
      }
    });

    if (shouldFocus) {
      tabToActivate.focus();
    }

    if (typeof onSelectTab === 'function') {
      const panelId = tabToActivate.getAttribute('aria-controls');
      onSelectTab(tabToActivate.id, panelId);
    }
  };

  const handleKeyDown = (event) => {
    const currentTab = event.target.closest('[role="tab"]');
    if (!currentTab || !tabs.includes(currentTab)) {
      return;
    }

    const currentIndex = tabs.indexOf(currentTab);
    let targetIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        targetIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    activateTab(tabs[targetIndex], true);
  };

  const handleClick = (event) => {
    const clickedTab = event.target.closest('[role="tab"]');
    if (clickedTab && tabs.includes(clickedTab)) {
      activateTab(clickedTab, false);
    }
  };

  tablist.addEventListener('keydown', handleKeyDown);
  tablist.addEventListener('click', handleClick);

  // Initialize first active tab if none selected
  const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
  if (activeTab) {
    activateTab(activeTab, false);
  }

  return () => {
    tablist.removeEventListener('keydown', handleKeyDown);
    tablist.removeEventListener('click', handleClick);
  };
}

/**
 * Traps keyboard focus within an active dialog/modal container.
 * Releases previous trap automatically.
 *
 * @param {HTMLElement} modalEl - Dialog container.
 * @param {HTMLElement} [initialFocusEl] - Element to receive initial focus.
 * @returns {Function} Release trap function.
 */
export function trapFocus(modalEl, initialFocusEl = null) {
  if (activeFocusTrapCleanup) {
    activeFocusTrapCleanup();
  }

  if (!modalEl) {
    return () => {};
  }

  const previouslyFocused = document.activeElement;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const handleTrapKey = (e) => {
    if (e.key !== 'Tab') return;

    const focusables = Array.from(modalEl.querySelectorAll(focusableSelector)).filter(
      (el) => el.offsetWidth > 0 || el.offsetHeight > 0
    );

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', handleTrapKey);

  if (initialFocusEl && typeof initialFocusEl.focus === 'function') {
    initialFocusEl.focus();
  } else {
    const first = modalEl.querySelector(focusableSelector);
    if (first) first.focus();
  }

  const release = () => {
    document.removeEventListener('keydown', handleTrapKey);
    activeFocusTrapCleanup = null;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };

  activeFocusTrapCleanup = release;
  return release;
}

/**
 * Releases any currently active modal focus trap.
 */
export function releaseFocus() {
  if (activeFocusTrapCleanup) {
    activeFocusTrapCleanup();
  }
}
