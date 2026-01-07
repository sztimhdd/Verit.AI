# In-Page Highlights Feature Documentation

## 1. Feature Overview
**Name**: In-Page Highlights  
**Goal**: Provide a seamless "Augmented Reality" reading experience by highlighting dubious content directly on webpages.  
**User Experience**: After running an analysis, red highlights appear on exaggerated/misleading claims (with hover tooltips showing corrections). Verified content remains unhighlighted. This is the **default behavior** (no floating card required), but users can toggle it off.  
**Scope (MVP)**: Static blogs and news sites (e.g., CNN, BBC, Medium). Only highlights dubious content from API results.  
**Key Benefits**: Reduces context-switching, increases engagement, differentiates from competitors.  
**Assumptions**: Built on existing Chrome Extension (Manifest V3) and backend API. No major backend changes needed.

## 2. Detailed Plan
### Phases & Timeline (Estimated: 8-12 days total for MVP)
1. **Research & Prototyping**: Validate text matching on news/blog pages. Identify CSS conflicts.  
2. **Core Matching Logic**: Implement fuzzy text matching in `content.js`.  
3. **Highlighting & UI**: Add red highlights and tooltips.  
4. **Integration & Settings**: Connect to API response; add toggle.  
5. **Testing & Polish**: Manual testing on target sites; performance checks.  

### Requirements
- **Functional**: Highlight only dubious claims (red) from `exaggeration_check.exaggerations_found` and false/misleading `fact_check.claims_identified`.  
- **Performance**: <500ms processing for 5-10 claims.  
- **UX**: Hover tooltips show verification/corrections. Highlights persist per page until reload.  
- **Edge Cases**: Handle text across DOM elements; skip if match confidence <80%.  

### Tradeoffs Considered
- **Default On vs. Opt-In**: Chose default (based on user feedback) for better UX, with easy toggle.  
- **Selective Highlighting**: Only dubious content to avoid overwhelming users (per feedback).  
- **Site Focus**: Blogs/news first; social media deferred to avoid dynamic content complexity.  
- **Accessibility**: Ignored in MVP (per feedback); add in future iterations.

## 3. Architecture & Module Changes
### Current Architecture Recap
- **Backend (`backend/app.js`)**: Returns JSON with `exaggeration_check` and `fact_check` arrays.  
- **Extension**:
  - `background.js`: Handles API calls and messaging.
  - `content.js`: Extracts page content; shows floating cards.
  - `floating-card/`: Displays results in an iframe.  
- **Data Flow**: User analyzes → `background.js` fetches API → Results to `content.js` for floating card.

### Proposed Changes
#### Data Flow Updates
```
User clicks "Analyze" → background.js fetches API → content.js receives results → TextMatcher scans DOM → Inject highlights (red for dubious) → Tooltips on hover
```
- **New Component**: `TextMatcher` class in `content.js` for fuzzy matching.
- **Persistence**: Store highlights in `chrome.storage.local` per URL.

#### Module/File Changes (No Backend Changes Needed)
- **`chrome_extension/src/content/content.js`**:
  - Add `TextMatcher` class: Scans DOM text nodes for matches against API's `exaggerations_found` and `claims_identified` (filter for dubious only).
  - Add highlighting injection: Wrap matched text in `<span class="veritai-highlight-dubious">` with `title` for tooltips.
  - Add CSS injection for red highlights (e.g., `background: rgba(239, 68, 68, 0.3)`).
  - Handle page unload/removal.

- **`chrome_extension/src/background/background.js`**:
  - After API response, send results to `content.js` for highlighting (in addition to floating card).

- **`chrome_extension/src/popup/popup.html` & `popup.js`**:
  - Add checkbox: "Enable In-Page Highlights" (default: checked). Store in `chrome.storage.sync`.

- **`chrome_extension/manifest.json`**:
  - No changes needed (existing permissions suffice).

- **New File (Optional)**: `chrome_extension/src/content/highlights.css` for highlight styles (to avoid inline CSS clutter).

#### Data Structures
- **API Response Leverage**: Use existing `exaggeration_check.exaggerations_found` (strings) and `fact_check.claims_identified` (filter for false/misleading).
- **Match Data**: Internally, create `{originalText: string, matchedElement: DOMNode, tooltip: string}` objects.
- **Storage**: `{url: string, highlights: [{text: string, type: 'dubious', tooltip: string}]}`.

#### Dependencies
- Add `fuse.js` (fuzzy search library) to `chrome_extension/package.json` (check for bundling compatibility).

### Potential Challenges & Solutions
- **Text Matching**: Fuzzy logic may miss matches. **Solution**: Threshold at 80%; add logging for misses.
- **Performance**: DOM scanning on large pages. **Solution**: Limit to body text; batch processing.
- **CSS Conflicts**: Site styles override highlights. **Solution**: Use high-specificity selectors; test on major sites.

## 4. Deployment & Testing
### Deployment
- **Build Process**: Use existing `npm run build` in `chrome_extension/` (webpack bundles JS/CSS).
- **Extension Reload**: After changes, reload extension via `chrome://extensions/`.
- **Staging**: Test locally first; deploy backend to Railway for production API.
- **Rollout**: Enable for 10% of users via feature flag (add a config in `background.js`).

### Testing Strategy
- **Unit Tests**: Test `TextMatcher` with mock DOM (e.g., Jest in `chrome_extension/`).
- **Integration Tests**: Load local HTML pages simulating news/blogs; verify highlights appear.
- **Manual Tests**:
  - Sites: CNN, BBC, Medium blogs.
  - Scenarios: 1-5 dubious claims; long articles; page reload.
  - Metrics: Highlight accuracy (>90%), performance (<500ms), tooltip display.
- **User Testing**: Beta group (5-10 users) on target sites; collect feedback on usability.
- **Regression**: Ensure floating card still works; no conflicts with existing features.
