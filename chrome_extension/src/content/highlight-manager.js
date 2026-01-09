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
    this.matchThreshold = 0.75;
    this.currentHighlight = null;
    this.highlightedTexts = new Set();
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
        <div class="veritai-tooltip-label">Analysis & Evidence</div>
        <div class="veritai-tooltip-explanation-container">
          <div class="veritai-tooltip-value veritai-tooltip-explanation"></div>
        </div>
      </div>
      <div class="veritai-popover-section veritai-sources-section hidden">
        <div class="veritai-tooltip-label">Sources</div>
        <div class="veritai-tooltip-sources"></div>
      </div>
      <div class="veritai-tooltip-arrow" aria-hidden="true"></div>
    `;
    document.body.appendChild(this.popoverEl);

    this.popoverEl.querySelector('.veritai-popover-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hidePopover();
    });

    console.log('[HighlightManager] Popover element created');
  }

  attachGlobalEventListeners() {
    document.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('veritai-highlight-dubious')) {
        const tooltip = e.target.getAttribute('data-tooltip');
        const type = e.target.getAttribute('data-type') || 'dubious';
        const severity = e.target.getAttribute('data-severity') || 'Medium';
        const sourcesJson = e.target.getAttribute('data-sources');
        let sources = [];
        try {
          if (sourcesJson) sources = JSON.parse(sourcesJson);
        } catch (err) {}

        if (tooltip) {
          this.currentHighlight = e.target;
          this.showPopover(e.target, tooltip, type, severity, sources);
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

  showPopover(targetElement, tooltipText, type, severity, sources = []) {
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
    
    // Support markdown-like bolding for the label
    const formattedText = tooltipText
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    
    explanationEl.innerHTML = formattedText;

    this.popoverEl.querySelector('.veritai-popover-type-icon').textContent = icon;
    this.popoverEl.querySelector('.veritai-popover-title').textContent = title;

    const scoreEl = this.popoverEl.querySelector('.veritai-popover-score');
    scoreEl.textContent = this.getSeverityLabel(severity);
    scoreEl.className = 'veritai-popover-score severity-' + severity.toLowerCase();

    // Handle Sources
    const sourcesSection = this.popoverEl.querySelector('.veritai-sources-section');
    const sourcesContainer = this.popoverEl.querySelector('.veritai-tooltip-sources');
    
    if (sources && sources.length > 0) {
      sourcesSection.classList.remove('hidden');
      sourcesContainer.innerHTML = sources.map(s => 
        `<a href="${s.url}" target="_blank" class="veritai-tooltip-source-link">${s.title || s.url}</a>`
      ).join('');
    } else {
      sourcesSection.classList.add('hidden');
    }

    const rect = targetElement.getBoundingClientRect();
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    let left = rect.left + scrollX + (rect.width / 2);
    let top = rect.top + scrollY - 12; // Position above the highlight

    const popoverWidth = 320;
    const padding = 10;

    // Boundary check for horizontal positioning
    if (left - popoverWidth / 2 < padding) {
      left = padding + popoverWidth / 2;
    } else if (left + popoverWidth / 2 > document.documentElement.clientWidth - padding) {
      left = document.documentElement.clientWidth - padding - popoverWidth / 2;
    }

    // Flip to bottom if there's no space on top
    if (rect.top < 150) { // If near top of viewport
      top = rect.bottom + scrollY + 12;
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.bottom = 'auto';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.top = '-6px';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.transform = 'translateX(-50%) rotate(225deg)';
    } else {
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.top = 'auto';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.bottom = '-6px';
      this.popoverEl.querySelector('.veritai-tooltip-arrow').style.transform = 'translateX(-50%) rotate(45deg)';
    }

    this.popoverEl.style.left = left + 'px';
    this.popoverEl.style.top = top + 'px';
    this.popoverEl.style.transform = 'translate(-50%, -100%)'; 
    
    // If we flipped to bottom, adjust transform
    if (rect.top < 150) {
        this.popoverEl.style.transform = 'translate(-50%, 0)';
    }

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
        position: absolute !important;
        background: #ffffff !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        color: #1f2937 !important;
        line-height: 1.5 !important;
        max-width: 350px !important;
        min-width: 280px !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.15s ease, visibility 0.15s ease, transform 0.15s ease !important;
        transform: translateY(4px) !important;
        padding: 14px 16px !important;
        max-height: 450px !important;
        overflow-y: auto !important;
      }

      .veritai-popover.hidden {
        display: none !important;
      }

      .veritai-sources-section.hidden {
        display: none !important;
      }

      .veritai-tooltip-sources {
        font-size: 12px !important;
        color: #3b82f6 !important;
        word-break: break-all !important;
      }

      .veritai-tooltip-source-link {
        display: block !important;
        margin-top: 4px !important;
        text-decoration: underline !important;
        color: #2563eb !important;
      }

      .veritai-popover.visible {
        opacity: 1 !important;
        visibility: visible !important;
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
        margin-bottom: 12px !important;
      }

      .veritai-tooltip-label {
        font-size: 10px !important;
        color: #6b7280 !important;
        font-weight: 600 !important;
        margin-bottom: 6px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }

      .veritai-tooltip-explanation-container {
        transition: max-height 0.2s ease !important;
      }

      .veritai-tooltip-value {
        font-size: 13px !important;
        color: #1f2937 !important;
        line-height: 1.6 !important;
        word-wrap: break-word !important;
        white-space: pre-wrap !important;
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
    this.highlightedTexts.clear();
    console.log('[HighlightManager] Highlights cleared');
  }

   /**
    * Apply highlights based on analysis results
    * @param {Object} analysisData - The analysis result from the API
    */
   async applyHighlights(analysisData) {
     console.log('[HighlightManager] applyHighlights called with data:', {
       score: analysisData.score,
       hasExaggerations: !!analysisData.exaggeration_check?.exaggerations_found?.length,
       hasClaims: !!analysisData.fact_check?.claims_identified?.length,
       hasEntities: !!analysisData.entity_verification?.entities_found?.length
     });

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
       console.log('[DEBUG] Processing exaggerations:', analysisData.exaggeration_check.exaggerations_found.length);
       analysisData.exaggeration_check.exaggerations_found.forEach((exaggeration, index) => {
         if (exaggeration && exaggeration.trim()) {
           const explanation = analysisData.exaggeration_check.explanations?.[index] || '';
           const correction = analysisData.exaggeration_check.corrections?.[index] || '';
           const severity = analysisData.exaggeration_check.severity_assessment || 'Medium';

           const fullTooltip = `⚠️ **EXAGGERATION**\n${explanation}\n\n✅ **CORRECTION**\n${correction}`;

           dubiousItems.push({
             text: exaggeration,
             tooltip: fullTooltip,
             type: 'exaggeration',
             severity: severity
           });
         }
       });
     }

     // Add false/misleading claims from fact check
     if (analysisData.fact_check?.claims_identified) {
       console.log('[DEBUG] Processing claims:', analysisData.fact_check.claims_identified.length);
       analysisData.fact_check.claims_identified.forEach((claim, index) => {
         const result = analysisData.fact_check.verification_results?.[index] || '';
         const evidence = analysisData.fact_check.supporting_evidence?.[index] || '';
         const isDubious = this.isDubiousResult(result);

         console.log('[DEBUG] Claim check:', { claim: claim?.substring(0, 30), result, isDubious });

         if (isDubious && claim && claim.trim()) {
           const fullTooltip = `❌ **FACT CHECK: ${result.toUpperCase()}**\n${evidence || 'No detailed evidence provided by the AI.'}`;

           dubiousItems.push({
             text: claim,
             tooltip: fullTooltip,
             type: 'fact_check',
             severity: this.getSeverityFromResult(result)
           });
         }
       });
     }

     // Also check for dubious results in entity verification
     if (analysisData.entity_verification?.entities_found) {
       console.log('[DEBUG] Processing entities:', analysisData.entity_verification.entities_found.length);
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

     console.log(`[HighlightManager] Found ${dubiousItems.length} dubious items to highlight (limiting to first 10)`);
     console.log('[DEBUG] Dubious items:', dubiousItems.map(i => ({
       text: i.text?.substring(0, 30),
       type: i.type,
       severity: i.severity
     })));

     // Limit to first 10 items to prevent freezing
     const itemsToHighlight = dubiousItems.slice(0, 10);

     // Apply highlights for each dubious item (using requestAnimationFrame to prevent blocking)
     for (const item of itemsToHighlight) {
       console.log('[DEBUG] Applying highlight for:', {
         text: item.text?.substring(0, 30),
         type: item.type,
         tooltip: item.tooltip?.substring(0, 50)
       });

       await new Promise(resolve => {
         requestAnimationFrame(() => {
           this.highlightText(item.text, item.tooltip, item.type, item.severity);
           resolve();
         });
       });
       // Small delay between highlights to prevent UI blocking
       await new Promise(r => setTimeout(r, 50));
     }

     console.log(`[HighlightManager] Highlight application complete. Applied ${itemsToHighlight.length} highlights.`);

     // Store highlights for this URL
     await this.saveHighlightsForUrl(analysisData.url || window.location.href);
   }

   /**
    * Check if a verification result is dubious (false, misleading, etc.)
    */
   isDubiousResult(result) {
     if (!result) return false;
     const lower = result.toLowerCase();
     const isDubious = lower.includes('false') ||
            lower.includes('misleading') ||
            lower.includes('low') ||
            lower.includes('unverified') ||
            lower.includes('partially true');

     console.log('[DEBUG] isDubiousResult check:', { result, lower, isDubious });
     return isDubious;
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
     * Uses improved fuzzy matching with higher threshold and deduplication
     * @param {string} textToMatch - The text to search for and highlight
     * @param {string} tooltip - Tooltip text to show on hover
     * @param {string} type - Type of highlight (exaggeration, fact_check, entity)
     * @param {string} severity - Severity level (High, Medium, Low)
     * @param {Array} sources - Optional array of source objects
     */
    async highlightText(textToMatch, tooltip, type = 'dubious', severity = 'Medium', sources = []) {
      if (!textToMatch || textToMatch.trim().length < 5) {
        console.log('[DEBUG] Skipping short text:', textToMatch?.substring(0, 20));
        return;
      }

      // Skip if this exact text is already highlighted
      const normalizedText = textToMatch.trim().toLowerCase().replace(/\s+/g, ' ');
      if (this.highlightedTexts.has(normalizedText)) {
        console.log('[DEBUG] Text already highlighted, skipping:', textToMatch?.substring(0, 30));
        return;
      }

      console.log('[DEBUG] highlightText search:', {
        text: textToMatch?.substring(0, 50),
        textLength: textToMatch?.length,
        type
      });

      // Normalize search text: remove only OUTER quotes and normalize ellipses
      const cleanSearchText = textToMatch
         .replace(/^["'""'']|["'""'']$/g, '') // Strip only outer quotes
         .replace(/…/g, '...')
         .trim();

      if (cleanSearchText.length < 5) {
        console.log('[DEBUG] Cleaned text too short, skipping');
        return;
      }

      console.log('[DEBUG] Cleaned search text:', cleanSearchText.substring(0, 50));

      try {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
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
        let maxNodes = 500; // Limit text nodes to prevent freezing
        while ((node = walker.nextNode()) && textNodes.length < maxNodes) {
          textNodes.push(node);
        }
        
        if (textNodes.length >= maxNodes) {
          console.log(`[DEBUG] Limited text nodes to ${maxNodes} to prevent freezing`);
        } else {
          console.log(`[DEBUG] Found ${textNodes.length} text nodes`);
        }

        // 1. Try exact match (normalized) - this is most accurate
        for (const textNode of textNodes) {
          if (this.containsText(textNode.textContent, cleanSearchText)) {
            this.wrapTextNode(textNode, cleanSearchText, tooltip, type, severity, sources);
            this.highlights.push({ text: cleanSearchText, type, tooltip });
            this.highlightedTexts.add(normalizedText);
            console.log('[DEBUG] ✅ EXACT MATCH FOUND');
            return;
          }
        }
        
        console.log('[DEBUG] ❌ No exact match. Trying smart phrase match...');

        // 2. Smart Phrase Match: Extract meaningful phrases (8+ chars, not too short)
        const phrases = this.extractMeaningfulPhrases(cleanSearchText);
        
        console.log('[DEBUG] Trying', phrases.length, 'meaningful phrases...');

        for (const phrase of phrases) {
          // Skip if already highlighted
          const normalizedPhrase = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
          if (this.highlightedTexts.has(normalizedPhrase)) {
            console.log('[DEBUG] Phrase already highlighted, skipping');
            continue;
          }

          // Try this phrase in all text nodes
          for (const textNode of textNodes) {
             if (textNode.textContent.toLowerCase().includes(normalizedPhrase)) {
                console.log('[DEBUG] ✅ PHRASE MATCH FOUND:', phrase.substring(0, 20));
                this.wrapTextNode(textNode, phrase.trim(), tooltip, type, severity, sources);
                this.highlights.push({ text: phrase.trim(), type, tooltip });
                this.highlightedTexts.add(normalizedPhrase);
                return;
             }
          }
        }

        console.log('[DEBUG] ❌ No phrase match found. Trying fuzzy match with Levenshtein...');

        // 3. Fuzzy Match with Levenshtein distance (higher threshold = more accurate)
        let bestMatch = null;
        let bestNode = null;
        let bestScore = 0;

        for (const textNode of textNodes) {
          const textContent = textNode.textContent;
          if (textContent.length < 10) continue;
          
          const fuzzyResult = this.fuzzyMatch(textContent, cleanSearchText);
          
          // Require at least 75% similarity (up from 40%)
          if (fuzzyResult.score >= this.matchThreshold && fuzzyResult.score > bestScore) {
             bestMatch = fuzzyResult.match;
             bestNode = textNode;
             bestScore = fuzzyResult.score;
          }
        }

        if (bestMatch && bestNode) {
            console.log(`[DEBUG] ✅ FUZZY MATCH FOUND (score: ${bestScore.toFixed(2)}):`, bestMatch);
            this.wrapTextNode(bestNode, bestMatch, tooltip, type, severity, sources);
            this.highlights.push({ text: bestMatch, type, tooltip });
            return;
        }
        console.log('[DEBUG] ❌ No significant fuzzy match found');

      } catch (error) {
        console.error('[HighlightManager] Error highlighting text:', error);
      }
    }

    /**
     * Extract meaningful phrases from text (longer than 8 chars, split by sentence/punctuation)
     */
    extractMeaningfulPhrases(text) {
      // Split by sentence boundaries and punctuation
      const phrases = text.split(/[。！？,.!?]+/);
      
      // Filter and clean phrases
      return phrases
        .map(p => p.trim())
        .filter(p => p.length >= 8 && p.length <= 100) // Reasonable length
        .slice(0, 3); // Max 3 phrases to try
    }

    /**
     * Fuzzy match using Levenshtein distance
     * Returns { match: string, score: number } where score is 0-1
     */
    fuzzyMatch(haystack, needle) {
      const maxLen = Math.max(haystack.length, needle.length);
      
      // Try all possible substrings of haystack that could match
      const minMatchLen = Math.floor(needle.length * 0.7); // At least 70% of needle length
      const maxMatchLen = Math.min(needle.length * 1.3, haystack.length); // Up to 130% (allow some extra)
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (let start = 0; start <= haystack.length - minMatchLen; start++) {
        for (let len = minMatchLen; len <= Math.min(maxMatchLen, haystack.length - start); len++) {
          const substring = haystack.substring(start, start + len);
          const distance = this.levenshteinDistance(substring, needle);
          const similarity = 1 - (distance / Math.max(substring.length, needle.length));
          
          if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = substring;
          }
        }
      }
      
      return { match: bestMatch, score: bestScore };
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
      const m = str1.length;
      const n = str2.length;
      
      if (m === 0) return n;
      if (n === 0) return m;
      
      const matrix = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
      
      for (let i = 0; i <= m; i++) {
        matrix[i][0] = i;
      }
      for (let j = 0; j <= n; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost // substitution
          );
        }
      }
      
      return matrix[m][n];
    }

    /**
     * Find the longest common substring between two strings
     */
    findLongestCommonSubstring(str1, str2) {
      const len1 = str1.length;
      const len2 = str2.length;
      const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));
      
      let maxLen = 0;
      let endIndex = 0;

      for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
          if (str2[i - 1] === str1[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1] + 1;
            if (matrix[i][j] > maxLen) {
              maxLen = matrix[i][j];
              endIndex = j - 1;
            }
          } else {
            matrix[i][j] = 0;
          }
        }
      }
      
      return maxLen > 0 ? str1.substring(endIndex - maxLen + 1, endIndex + 1) : null;
    }

   /**
    * Check if text content contains the search text (case-insensitive and whitespace-normalized)
    */
   containsText(textContent, searchText) {
     if (!textContent || !searchText) return false;
     
     const normalize = (str) => str.replace(/\s+/g, ' ').trim().toLowerCase();
     const contentNorm = normalize(textContent);
     const searchNorm = normalize(searchText);
     
     // Check exact match
     if (contentNorm.includes(searchNorm)) return true;
     
     // Strip quotes and check
     const searchStripped = searchNorm.replace(/^"|"$/g, '');
     if (contentNorm.includes(searchStripped)) return true;
     
     return false;
    }

   /**
    * Wrap a portion of text in a highlight span
    */
   wrapTextNode(textNode, searchText, tooltip, type = 'dubious', severity = 'Medium', sources = []) {
     const textContent = textNode.textContent;
     
     // Use normalization to find index
     const normalize = (str) => str.replace(/\s+/g, ' ').toLowerCase();
     const contentNorm = normalize(textContent);
     
     // Try various forms of search text
     const searchNorm = normalize(searchText);
     const searchStripped = searchNorm.replace(/^"|"$/g, '');
     
     let targetStr = null;
     let index = -1;
     
     // 1. Try exact normalized match
     if (contentNorm.includes(searchNorm)) {
        // We found it in normalized string, but we need index in ORIGINAL string.
        // This is hard. We'll use a simpler approach: regex with whitespace flexibility
        targetStr = searchText;
     } else if (contentNorm.includes(searchStripped)) {
        targetStr = searchText.replace(/^"|"$/g, '');
     }
     
     if (!targetStr) {
         // Fallback: If we are here from fuzzy match, we might just highlight the whole node if it's short,
         // or try to find a substantial substring.
         console.log('[DEBUG] Could not find exact location for wrapping, skipping visual highlight but keeping log.');
         return;
     }

     // Escape regex special characters
     const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     
     // Create flexible regex: replace spaces with \s+
     const pattern = escapeRegExp(targetStr).replace(/\s+/g, '\\s+');
     const regex = new RegExp(pattern, 'i');
     
     const match = regex.exec(textContent);
     
     if (!match) {
         // Try stripped version if not already
          const pattern2 = escapeRegExp(targetStr.replace(/^"|"$/g, '')).replace(/\s+/g, '\\s+');
          const regex2 = new RegExp(pattern2, 'i');
          const match2 = regex2.exec(textContent);
          if (match2) {
              this.applyHighlightRange(textNode, match2.index, match2[0].length, tooltip, type, severity, sources);
          } else {
              console.log('[DEBUG] Regex match failed for:', targetStr);
          }
          return;
     }
     
     this.applyHighlightRange(textNode, match.index, match[0].length, tooltip, type, severity, sources);
   }
   
   applyHighlightRange(textNode, index, length, tooltip, type, severity, sources = []) {
     const textContent = textNode.textContent;
     const before = textContent.substring(0, index);
     const match = textContent.substring(index, index + length);
     const after = textContent.substring(index + length);

     const highlightSpan = document.createElement('span');
     highlightSpan.className = 'veritai-highlight-dubious';
     highlightSpan.setAttribute('data-tooltip', tooltip);
     highlightSpan.setAttribute('data-type', type);
     highlightSpan.setAttribute('data-severity', severity);
     
     // Store sources as JSON string in data attribute
     if (sources && sources.length > 0) {
       highlightSpan.setAttribute('data-sources', JSON.stringify(sources));
     }

     highlightSpan.textContent = match;

     const parent = textNode.parentNode;
     if (!parent) return;

     if (before) parent.insertBefore(document.createTextNode(before), textNode);
     parent.insertBefore(highlightSpan, textNode);
     if (after) parent.insertBefore(document.createTextNode(after), textNode);
     
     parent.removeChild(textNode);
     console.log('[DEBUG] Applied highlight successfully');
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
