/**
 * VeritAI Fact Checker - Highlight Manager Module
 * Handles in-page text highlighting for dubious content
 */

// Make HighlightManager available globally for the extension
class HighlightManager {
  constructor() {
    this.highlights = [];
    this.highlightStyle = null;
    this.isEnabled = true;
    this.matchThreshold = 0.6; // 60% similarity threshold for fuzzy matching
  }

  /**
   * Initialize the highlight manager
   */
  init() {
    this.loadSettings();
    this.injectStyles();
    console.log('[HighlightManager] Initialized');
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
      /* Highlight base style */
      .veritai-highlight-dubious {
        background-color: rgba(239, 68, 68, 0.25) !important;
        border-bottom: 2px solid #ef4444 !important;
        cursor: help !important;
        padding: 2px 3px !important;
        border-radius: 3px !important;
        transition: all 0.2s ease !important;
        position: relative !important;
      }

      .veritai-highlight-dubious:hover {
        background-color: rgba(239, 68, 68, 0.5) !important;
        border-bottom-color: #dc2626 !important;
        z-index: 1 !important;
      }

      /* Custom tooltip container */
      .veritai-tooltip {
        position: fixed !important;
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
        color: white !important;
        padding: 0 !important;
        border-radius: 10px !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
        white-space: pre-wrap !important;
        max-width: 350px !important;
        min-width: 200px !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease !important;
        transform: translateY(5px) !important;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        overflow: hidden !important;
      }

      .veritai-tooltip.visible {
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateY(0) !important;
      }

      /* Tooltip header */
      .veritai-tooltip-header {
        background: rgba(239, 68, 68, 0.2) !important;
        padding: 10px 14px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .veritai-tooltip-header .icon {
        font-size: 16px !important;
      }

      .veritai-tooltip-header .title {
        font-weight: 600 !important;
        font-size: 13px !important;
        color: #fca5a5 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }

      /* Tooltip body */
      .veritai-tooltip-body {
        padding: 12px 14px !important;
      }

      .veritai-tooltip-section {
        margin-bottom: 10px !important;
      }

      .veritai-tooltip-section:last-child {
        margin-bottom: 0 !important;
      }

      .veritai-tooltip-label {
        font-size: 10px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        color: #9ca3af !important;
        margin-bottom: 4px !important;
        font-weight: 500 !important;
      }

      .veritai-tooltip-value {
        color: #e5e7eb !important;
        font-size: 12px !important;
        line-height: 1.5 !important;
      }

      /* Tooltip footer */
      .veritai-tooltip-footer {
        background: rgba(0, 0, 0, 0.2) !important;
        padding: 8px 14px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
        font-size: 10px !important;
        color: #6b7280 !important;
        text-align: center !important;
      }

      /* Highlighted text preview */
      .veritai-text-preview {
        background: rgba(255, 255, 255, 0.1) !important;
        padding: 8px 10px !important;
        border-radius: 5px !important;
        font-style: italic !important;
        color: #d1d5db !important;
        font-size: 11px !important;
        margin-bottom: 8px !important;
        border-left: 3px solid #ef4444 !important;
      }

      /* Arrow */
      .veritai-tooltip-arrow {
        position: absolute !important;
        bottom: -6px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 12px !important;
        height: 12px !important;
        background: #1f2937 !important;
        rotate: 45deg !important;
        border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
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
      const tooltipData = {
        text: item.text,
        tooltip: item.tooltip,
        type: item.type,
        severity: item.severity
      };
      await this.highlightText(item.text, item.tooltip, item.type, tooltipData);
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
   * @param {Object} tooltipData - Full tooltip data for the enhanced tooltip
   */
  async highlightText(textToMatch, tooltip, type = 'dubious', tooltipData = null) {
    if (!textToMatch || textToMatch.length < 10) {
      console.log('[HighlightManager] Skipping short text:', textToMatch?.substring(0, 20));
      return;
    }

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
          this.wrapTextNode(textNode, textToMatch, tooltip, tooltipData);
          this.highlights.push({ text: textToMatch, type, tooltip });
          console.log('[HighlightManager] Highlighted exact match:', textToMatch.substring(0, 30));
          return; // Only highlight first exact match
        }
      }

      // If no exact match, try fuzzy matching (simplified version)
      const fuzzyMatch = this.findFuzzyMatch(textNodes, textToMatch);
      if (fuzzyMatch) {
        this.wrapTextNode(fuzzyMatch.node, fuzzyMatch.text, tooltip, tooltipData);
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
   * Create a custom tooltip element
   */
  createTooltipElement(tooltipData) {
    const tooltip = document.createElement('div');
    tooltip.className = 'veritai-tooltip';
    
    const headerIcon = tooltipData.type === 'exaggeration' ? '⚠️' : 
                       tooltipData.type === 'fact_check' ? '❌' : 
                       tooltipData.type === 'entity' ? '🏷️' : '🔍';
    
    const headerText = tooltipData.type === 'exaggeration' ? 'Exaggerated/Misleading' : 
                       tooltipData.type === 'fact_check' ? 'Fact Check Failed' : 
                       tooltipData.type === 'entity' ? 'Entity Issue' : 'Dubious Content';
    
    const severityColor = tooltipData.severity === 'High' ? '#ef4444' : 
                          tooltipData.severity === 'Medium' ? '#f59e0b' : '#22c55e';

    tooltip.innerHTML = `
      <div class="veritai-tooltip-header">
        <span class="icon">${headerIcon}</span>
        <span class="title">${headerText}</span>
      </div>
      <div class="veritai-tooltip-body">
        <div class="veritai-tooltip-section">
          <div class="veritai-tooltip-label">Original Text</div>
          <div class="veritai-text-preview">"${tooltipData.text.substring(0, 100)}${tooltipData.text.length > 100 ? '...' : ''}"</div>
        </div>
        <div class="veritai-tooltip-section">
          <div class="veritai-tooltip-label">Analysis</div>
          <div class="veritai-tooltip-value">${tooltipData.tooltip}</div>
        </div>
        <div class="veritai-tooltip-section">
          <div class="veritai-tooltip-label">Severity</div>
          <div class="veritai-tooltip-value" style="color: ${severityColor}; font-weight: 600;">${tooltipData.severity || 'Medium'}</div>
        </div>
      </div>
      <div class="veritai-tooltip-arrow"></div>
      <div class="veritai-tooltip-footer">VeritAI Fact Checker</div>
    `;
    
    return tooltip;
  }

  /**
   * Wrap a portion of text in a highlight span
   */
  wrapTextNode(textNode, searchText, tooltip, tooltipData) {
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
    highlightSpan.textContent = match;
    highlightSpan.setAttribute('data-tooltip-text', tooltip);

    // Store tooltip data for hover
    if (tooltipData) {
      highlightSpan.setAttribute('data-tooltip-type', tooltipData.type || 'dubious');
      highlightSpan.setAttribute('data-tooltip-severity', tooltipData.severity || 'Medium');
    }

    // Create and add tooltip element
    let tooltipElement = null;
    if (tooltipData) {
      tooltipElement = this.createTooltipElement({
        text: match,
        tooltip: tooltip,
        type: tooltipData.type || 'dubious',
        severity: tooltipData.severity || 'Medium'
      });
      document.body.appendChild(tooltipElement);
    }

    // Add hover event listeners
    if (tooltipElement) {
      highlightSpan.addEventListener('mouseenter', (e) => {
        const rect = highlightSpan.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();
        
        // Calculate position
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 10;
        
        // Keep tooltip in viewport
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
          left = window.innerWidth - tooltipRect.width - 10;
        }
        if (top < 10) {
          // Show below instead if not enough space above
          top = rect.bottom + 10;
        }
        
        tooltipElement.style.left = left + 'px';
        tooltipElement.style.top = top + 'px';
        tooltipElement.classList.add('visible');
      });

      highlightSpan.addEventListener('mouseleave', () => {
        tooltipElement.classList.remove('visible');
      });
    }

    // Replace text node with before text, highlight span, and after text
    const parent = textNode.parentNode;
    if (!parent) {
      if (tooltipElement) tooltipElement.remove();
      return;
    }

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
