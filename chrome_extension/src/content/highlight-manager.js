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
      .veritai-highlight-dubious {
        background-color: rgba(239, 68, 68, 0.3) !important;
        border-bottom: 2px solid #ef4444 !important;
        cursor: help !important;
        padding: 1px 2px !important;
        border-radius: 2px !important;
        transition: background-color 0.2s ease, border-color 0.2s ease !important;
      }

      .veritai-highlight-dubious:hover {
        background-color: rgba(239, 68, 68, 0.5) !important;
        border-bottom-color: #dc2626 !important;
      }

      .veritai-highlight-dubious::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        white-space: pre-wrap !important;
        max-width: 300px !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.2s ease, visibility 0.2s ease !important;
        margin-bottom: 8px !important;
      }

      .veritai-highlight-dubious:hover::after {
        opacity: 1 !important;
        visibility: visible !important;
      }

      .veritai-highlight-dubious::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent !important;
        border-top-color: rgba(0, 0, 0, 0.9) !important;
        margin-bottom: -12px !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.2s ease, visibility 0.2s ease !important;
      }

      .veritai-highlight-dubious:hover::before {
        opacity: 1 !important;
        visibility: visible !important;
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
      await this.highlightText(item.text, item.tooltip, item.type);
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
   */
  async highlightText(textToMatch, tooltip, type = 'dubious') {
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
          this.wrapTextNode(textNode, textToMatch, tooltip);
          this.highlights.push({ text: textToMatch, type, tooltip });
          console.log('[HighlightManager] Highlighted exact match:', textToMatch.substring(0, 30));
          return; // Only highlight first exact match
        }
      }

      // If no exact match, try fuzzy matching (simplified version)
      const fuzzyMatch = this.findFuzzyMatch(textNodes, textToMatch);
      if (fuzzyMatch) {
        this.wrapTextNode(fuzzyMatch.node, fuzzyMatch.text, tooltip);
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
  wrapTextNode(textNode, searchText, tooltip) {
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
