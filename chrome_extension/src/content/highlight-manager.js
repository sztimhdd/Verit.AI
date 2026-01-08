/**
 * VeritAI Fact Checker - Highlight Manager Module
 * Handles in-page text highlighting for dubious content
 */

// Make HighlightManager available globally for the extension
class HighlightManager {
  constructor() {
    this.highlights = [];
    this.highlightStyle = null;
    this.popoverEl = null;
    this.popoverVisible = false;
    this.highlightedAnchors = new Set();
    this.matchThreshold = 0.6;
    this.currentHighlight = null;
  }

  /**
   * Initialize the highlight manager
   */
  init() {
    this.loadSettings();
    this.injectStyles();
    this.createPopoverElement();
    this.attachGlobalEventListeners();
    this.attachKeyboardListeners();
    console.log('[HighlightManager] Initialized');
  }

  createPopoverElement() {
    if (this.popoverEl) return;

    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'veritai-popover';
    this.popoverEl.setAttribute('role', 'tooltip');
    this.popoverEl.setAttribute('aria-live', 'polite');
    this.popoverEl.setAttribute('tabindex', '-1');
    this.popoverEl.innerHTML = `
      <button class="veritai-popover-close" aria-label="Close tooltip">&times;</button>
      <div class="veritai-popover-header">
        <span class="veritai-popover-type-icon" aria-hidden="true"></span>
        <span class="veritai-popover-title"></span>
        <span class="veritai-popover-score"></span>
      </div>
      <div class="veritai-popover-section">
        <div class="veritai-tooltip-label">Explanation</div>
        <div class="veritai-tooltip-explanation-container">
          <div class="veritai-tooltip-value veritai-tooltip-explanation"></div>
          <button class="veritai-see-more" aria-expanded="false">See more</button>
        </div>
      </div>
      <div class="veritai-tooltip-arrow" aria-hidden="true"></div>
    `;
    document.body.appendChild(this.popoverEl);

    this.popoverEl.querySelector('.veritai-popover-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopover();
    });

    this.popoverEl.querySelector('.veritai-see-more').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSeeMore();
    });

    console.log('[HighlightManager] Popover element created');
  }

  attachGlobalEventListeners() {
    document.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('veritai-highlight-dubious')) {
        const tooltip = e.target.getAttribute('data-tooltip');
        const type = e.target.getAttribute('data-type') || 'dubious';
        const severity = e.target.getAttribute('data-severity') || 'Medium';
        if (tooltip) {
          this.currentHighlight = e.target;
          this.showPopover(e.target, tooltip, type, severity);
        }
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('veritai-highlight-dubious') && !this.popoverEl.contains(e.relatedTarget)) {
        this.hidePopover();
      }
    });

    document.addEventListener('click', (e) => {
      if (this.popoverVisible && !this.popoverEl.contains(e.target) && !e.target.classList.contains('veritai-highlight-dubious')) {
        this.hidePopover();
      }
    });
  }

  attachKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.popoverVisible) {
        this.hidePopover();
      }
    });
  }

  showPopover(targetElement, tooltipText, type, severity) {
    if (!this.popoverEl) return;

    let icon = '⚠️';
    let title = 'Dubious Content';

    if (type === 'exaggeration') {
      icon = '📈';
      title = 'Exaggeration Detected';
    } else if (type === 'fact_check') {
      icon = '🔍';
      title = 'Fact Check';
    } else if (type === 'entity') {
      icon = '🏷️';
      title = 'Entity Issue';
    }

    const explanationEl = this.popoverEl.querySelector('.veritai-tooltip-explanation');
    explanationEl.textContent = tooltipText;

    this.popoverEl.querySelector('.veritai-popover-type-icon').textContent = icon;
    this.popoverEl.querySelector('.veritai-popover-title').textContent = title;

    const scoreEl = this.popoverEl.querySelector('.veritai-popover-score');
    scoreEl.textContent = this.getSeverityLabel(severity);
    scoreEl.className = 'veritai-popover-score severity-' + severity.toLowerCase();

    const rect = targetElement.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    let left = rect.left + scrollX + (rect.width / 2);
    let top = rect.top + scrollY - 12;

    const popoverWidth = 320;
    const padding = 10;

    if (left - popoverWidth / 2 < padding) {
      left = padding + popoverWidth / 2;
    } else if (left + popoverWidth / 2 > window.innerWidth - padding) {
      left = window.innerWidth - padding - popoverWidth / 2;
    }

    if (top < padding) {
      top = rect.bottom + scrollY + 12;
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.bottom = '-6px';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.top = 'auto';
    } else {
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.top = '-6px';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.bottom = 'auto';
    }

    this.popoverEl.style.left = left + 'px';
    this.popoverEl.style.top = top + 'px';

    this.popoverEl.classList.add('visible');
    this.popoverVisible = true;

    setTimeout(() => {
      this.popoverEl.focus();
    }, 100);
  }

  hidePopover() {
    if (!this.popoverEl) return;
    this.popoverEl.classList.remove('visible');
    this.popoverVisible = false;
    this.currentHighlight = null;
  }

  toggleSeeMore() {
    const btn = this.popoverEl.querySelector('.veritai-see-more');
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !isExpanded);
    btn.textContent = isExpanded ? 'See more' : 'See less';

    const container = this.popoverEl.querySelector('.veritai-tooltip-explanation-container');
    if (!isExpanded) {
      container.style.maxHeight = 'none';
    }
  }

  getSeverityLabel(severity) {
    const labels = { 'High': 'HIGH', 'Medium': 'MED', 'Low': 'LOW' };
    return labels[severity] || severity;
  }

  /**
   * Load user settings from chrome storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['highlightsEnabled']);
      this.isEnabled = result.highlightsEnabled !== false; // Default to true
      console.log('[HighlightManager] Settings loaded, enabled:', this.isEnabled);
    } catch (error) {
      console.error('[HighlightManager] Failed to load settings:', error);
    }
  }

  /**
   * Inject CSS styles for highlights into the page
   */
  injectStyles() {
    if (this.highlightStyle) return;

    this.highlightStyle = document.createElement('style');
    this.highlightStyle.id = 'veritai-highlight-styles';
    this.highlightStyle.textContent = `
      .veritai-highlight-dubious {
        background-color: rgba(239, 68, 68, 0.25) !important;
        border-bottom: 2px solid #ef4444 !important;
        cursor: help !important;
        padding: 1px 2px !important;
        border-radius: 2px !important;
        transition: all 0.2s ease !important;
      }

      .veritai-popover {
        position: fixed !important;
        background: #ffffff !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        color: #1f2937 !important;
        line-height: 1.5 !important;
        max-width: 320px !important;
        min-width: 260px !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.15s ease, visibility 0.15s ease, transform 0.15s ease !important;
        transform: translateY(4px) !important;
        padding: 14px 16px !important;
      }

      .veritai-popover.visible {
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateY(0) !important;
      }

      .veritai-popover-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin-bottom: 10px !important;
        border-bottom: 1px solid #e5e7eb !important;
        padding-bottom: 10px !important;
      }

      .veritai-popover-type-icon {
        font-size: 16px !important;
      }

      .veritai-popover-title {
        font-size: 13px !important;
        font-weight: 600 !important;
        color: #374151 !important;
        flex-grow: 1 !important;
        text-align: left !important;
      }

      .veritai-popover-section {
        margin-bottom: 8px !important;
      }

      .veritai-tooltip-label {
        font-size: 10px !important;
        color: #6b7280 !important;
        font-weight: 500 !important;
        margin-bottom: 4px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }

      .veritai-tooltip-explanation-container {
        max-height: 80px !important;
        overflow: hidden !important;
        transition: max-height 0.2s ease !important;
      }

      .veritai-tooltip-value {
        font-size: 13px !important;
        color: #1f2937 !important;
        line-height: 1.5 !important;
        word-wrap: break-word !important;
        white-space: pre-wrap !important;
      }

      .veritai-see-more {
        background: none !important;
        border: none !important;
        color: #3b82f6 !important;
        font-size: 12px !important;
        cursor: pointer !important;
        padding: 4px 0 !important;
        margin-top: 4px !important;
        text-decoration: underline !important;
      }

      .veritai-see-more:hover {
        color: #2563eb !important;
      }

      .veritai-popover-close {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
        cursor: pointer !important;
        background: #f3f4f6 !important;
        border: none !important;
        border-radius: 4px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 1 !important;
        text-align: center !important;
        font-size: 16px !important;
        color: #6b7280 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .veritai-popover-close:hover {
        background: #e5e7eb !important;
        color: #374151 !important;
      }

      .veritai-popover-score {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 9999px !important;
        padding: 3px 10px !important;
        font-weight: 600 !important;
        font-size: 11px !important;
        min-width: 40px !important;
        line-height: 1 !important;
      }

      .veritai-popover-score.severity-high {
        background: #fef2f2 !important;
        color: #dc2626 !important;
      }

      .veritai-popover-score.severity-medium {
        background: #fffbeb !important;
        color: #d97706 !important;
      }

      .veritai-popover-score.severity-low {
        background: #f0fdf4 !important;
        color: #16a34a !important;
      }

      .veritai-tooltip-arrow {
        position: absolute !important;
        width: 10px !important;
        height: 10px !important;
        background: #ffffff !important;
        transform: translateX(-50%) rotate(45deg) !important;
        clip-path: polygon(0 0, 100% 0, 0 100%);
      }
    `;
    document.head.appendChild(this.highlightStyle);
    console.log('[HighlightManager] Styles injected');
  }

  /**
   * Clear all highlights from the page
   */
  clearHighlights() {
    const existingHighlights = document.querySelectorAll('.veritai-highlight-dubious');
    existingHighlights.forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        const text = el.textContent;
        parent.replaceChild(document.createTextNode(text), el);
        parent.normalize();
      }
    });
    this.highlights = [];
    console.log('[HighlightManager] Highlights cleared');
  }

  /**
   * Apply highlights based on analysis results
   * @param {Object} analysisData - The analysis result from the API
   */
  async applyHighlights(analysisData) {
    if (!this.isEnabled) {
      console.log('[HighlightManager] Highlights disabled by user');
      return;
    }

    // Clear existing highlights first
    this.clearHighlights();

    // Collect dubious items to highlight
    const dubiousItems = [];

    // Add exaggerations (always dubious)
    if (analysisData.exaggeration_check?.exaggerations_found) {
      analysisData.exaggeration_check.exaggerations_found.forEach((exaggeration, index) => {
        const correction = analysisData.exaggeration_check.corrections?.[index] || '';
        const severity = analysisData.exaggeration_check.severity_assessment || 'Medium';
        dubiousItems.push({
          text: exaggeration,
          tooltip: `⚠️ Exaggeration/Misleading\n\nMore accurate: ${correction || 'See analysis for details'}`,
          type: 'exaggeration',
          severity: severity
        });
      });
    }

    // Add false/misleading claims from fact check
    if (analysisData.fact_check?.claims_identified) {
      analysisData.fact_check.claims_identified.forEach((claim, index) => {
        const result = analysisData.fact_check.verification_results?.[index] || '';
        const isDubious = this.isDubiousResult(result);
        
        if (isDubious) {
          dubiousItems.push({
            text: claim,
            tooltip: `❌ Fact Check: ${result}\n\nSee detailed analysis for evidence`,
            type: 'fact_check',
            severity: this.getSeverityFromResult(result)
          });
        }
      });
    }

    // Also check for dubious results in entity verification
    if (analysisData.entity_verification?.entities_found) {
      analysisData.entity_verification.entities_found.forEach((entity, index) => {
        const assessment = analysisData.entity_verification.accuracy_assessment || '';
        const corrections = analysisData.entity_verification.corrections?.[index] || '';
        
        if (assessment.toLowerCase().includes('low') || corrections) {
          dubiousItems.push({
            text: entity,
            tooltip: `⚠️ Entity Verification Issue\n\n${corrections || 'See analysis for details'}`,
            type: 'entity',
            severity: 'Medium'
          });
        }
      });
    }

    console.log(`[HighlightManager] Found ${dubiousItems.length} dubious items to highlight`);

    // Apply highlights for each dubious item
    for (const item of dubiousItems) {
      await this.highlightText(item.text, item.tooltip, item.type, item.severity);
    }

    // Store highlights for this URL
    await this.saveHighlightsForUrl(analysisData.url || window.location.href);
  }

  /**
   * Check if a verification result is dubious (false, misleading, etc.)
   */
  isDubiousResult(result) {
    if (!result) return false;
    const lower = result.toLowerCase();
    return lower.includes('false') || 
           lower.includes('misleading') || 
           lower.includes('low') ||
           lower.includes('unverified');
  }

  /**
   * Get severity level from verification result
   */
  getSeverityFromResult(result) {
    if (!result) return 'Medium';
    const lower = result.toLowerCase();
    if (lower.includes('false') && !lower.includes('partially')) return 'High';
    if (lower.includes('misleading')) return 'High';
    if (lower.includes('partially')) return 'Medium';
    return 'Low';
  }

  /**
   * Highlight text matching the given string in the page
   * @param {string} textToMatch - The text to search for and highlight
   * @param {string} tooltip - Tooltip text to show on hover
   * @param {string} type - Type of highlight (exaggeration, fact_check, entity)
   * @param {string} severity - Severity level (High, Medium, Low)
   */
  async highlightText(textToMatch, tooltip, type = 'dubious', severity = 'Medium') {
    if (!textToMatch || textToMatch.length < 10) {
      console.log('[HighlightManager] Skipping short text:', textToMatch?.substring(0, 20));
      return;
    }

    console.log('[HighlightManager] highlightText called with:', {
      textLength: textToMatch?.length,
      tooltipLength: tooltip?.length,
      type,
      severity
    });

    try {
      // Create a TreeWalker to find text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip script, style, and already highlighted elements
            const parent = node.parentElement;
            if (parent?.tagName === 'SCRIPT' || 
                parent?.tagName === 'STYLE' || 
                parent?.classList?.contains('veritai-highlight-dubious') ||
                parent?.closest('script, style, nav, header, footer')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push(node);
      }

      // Search for matching text nodes
      for (const textNode of textNodes) {
        const textContent = textNode.textContent;
        
        // Try exact match first
        if (this.containsText(textContent, textToMatch)) {
          this.wrapTextNode(textNode, textToMatch, tooltip, type, severity);
          this.highlights.push({ text: textToMatch, type, tooltip });
          console.log('[HighlightManager] Highlighted exact match:', textToMatch.substring(0, 30));
          return; // Only highlight first exact match
        }
      }

      // If no exact match, try fuzzy matching (simplified version)
      const fuzzyMatch = this.findFuzzyMatch(textNodes, textToMatch);
      if (fuzzyMatch) {
        this.wrapTextNode(fuzzyMatch.node, fuzzyMatch.text, tooltip, type, severity);
        this.highlights.push({ text: fuzzyMatch.text, type, tooltip });
        console.log('[HighlightManager] Highlighted fuzzy match:', fuzzyMatch.text.substring(0, 30));
      }

    } catch (error) {
      console.error('[HighlightManager] Error highlighting text:', error);
    }
  }

  /**
   * Check if text content contains the search text (case-insensitive)
   */
  containsText(textContent, searchText) {
    return textContent.toLowerCase().includes(searchText.toLowerCase().trim());
  }

  /**
   * Find a fuzzy match in text nodes (simplified implementation)
   */
  findFuzzyMatch(textNodes, searchText) {
    const searchLower = searchText.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(w => w.length > 3);

    for (const textNode of textNodes) {
      const contentLower = textNode.textContent.toLowerCase();
      
      // Check if most search words are present
      let matchCount = 0;
      for (const word of searchWords) {
        if (contentLower.includes(word)) {
          matchCount++;
        }
      }

      // If at least 70% of significant words match
      if (searchWords.length > 0 && matchCount / searchWords.length >= 0.7) {
        // Find the actual matched portion
        const matchIndex = contentLower.indexOf(searchWords[0]);
        if (matchIndex !== -1) {
          const startIndex = Math.max(0, matchIndex - 10);
          const endIndex = Math.min(textNode.textContent.length, matchIndex + searchText.length + 10);
          const matchedText = textNode.textContent.substring(startIndex, endIndex);
          return { node: textNode, text: matchedText };
        }
      }
    }
    return null;
  }

  /**
   * Wrap a portion of text in a highlight span
   */
  wrapTextNode(textNode, searchText, tooltip, type = 'dubious', severity = 'Medium') {
    const textContent = textNode.textContent;
    const searchLower = searchText.toLowerCase().trim();
    const contentLower = textContent.toLowerCase();
    
    const index = contentLower.indexOf(searchLower);
    if (index === -1) return;

    // Get the text before, during, and after the match
    const before = textContent.substring(0, index);
    const match = textContent.substring(index, index + searchText.length);
    const after = textContent.substring(index + searchText.length);

    // Create highlight span
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'veritai-highlight-dubious';
    highlightSpan.setAttribute('data-tooltip', tooltip);
    highlightSpan.setAttribute('data-type', type);
    highlightSpan.setAttribute('data-severity', severity);
    highlightSpan.textContent = match;

    // Replace text node with before text, highlight span, and after text
    const parent = textNode.parentNode;
    if (!parent) return;

    const beforeText = document.createTextNode(before);
    const afterText = document.createTextNode(after);

    parent.insertBefore(beforeText, textNode);
    parent.insertBefore(highlightSpan, textNode);
    parent.insertBefore(afterText, textNode);
    parent.removeChild(textNode);
  }

  /**
   * Save highlights for a specific URL
   */
  async saveHighlightsForUrl(url) {
    try {
      const key = `highlights_${new URL(url).hostname}`;
      await chrome.storage.local.set({
        [key]: {
          url: url,
          highlights: this.highlights,
          timestamp: Date.now()
        }
      });
      console.log('[HighlightManager] Saved highlights for URL');
    } catch (error) {
      console.error('[HighlightManager] Failed to save highlights:', error);
    }
  }

  /**
   * Load highlights for a specific URL
   */
  async loadHighlightsForUrl(url) {
    try {
      const key = `highlights_${new URL(url).hostname}`;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('[HighlightManager] Failed to load highlights:', error);
      return null;
    }
  }

  /**
   * Toggle highlights on/off
   */
  async toggleHighlights(enabled) {
    this.isEnabled = enabled;
    await chrome.storage.sync.set({ highlightsEnabled: enabled });
    
    if (!enabled) {
      this.clearHighlights();
    }
    
    console.log('[HighlightManager] Highlights toggled:', enabled);
  }

  /**
   * Cleanup on page unload
   */
  destroy() {
    this.clearHighlights();
    if (this.highlightStyle) {
      this.highlightStyle.remove();
      this.highlightStyle = null;
    }
  }
}

// Export for use in content.js
window.HighlightManager = HighlightManager;
