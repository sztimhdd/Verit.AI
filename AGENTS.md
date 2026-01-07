# AGENTS.md - Agentic Coding Guidelines

This document provides comprehensive guidelines for agentic coding agents working on the Verit AI Fact Checker project. It includes build/test commands, code style guidelines, and project-specific conventions.

## Build & Development Commands

### Chrome Extension (Frontend)

#### Build Commands
```bash
# Production build
cd chrome_extension && npm run build

# Development build with watch mode
cd chrome_extension && npm run dev

# Clean build artifacts
cd chrome_extension && npm run clean
```

#### Test Commands
```bash
# Run all tests
cd chrome_extension && npm test

# Run tests in watch mode
cd chrome_extension && npm run test:watch

# Run a single test file (example)
cd chrome_extension && node tests/popup.test.js

# Run specific test function (modify test file to isolate)
# Edit tests/popup.test.js to comment out other tests, then run:
cd chrome_extension && node tests/popup.test.js
```

### Backend (Node.js/Express)

#### Build Commands
```bash
# Start production server
cd backend && npm start

# Start development server with auto-reload
cd backend && npm run dev
```

#### Test Commands
```bash
# No formal test suite currently implemented
# For manual testing:
cd backend && node app.js
# Then test endpoints with curl:
curl http://localhost:4000/health
curl -X POST http://localhost:4000/api/extension/analyze -H "Content-Type: application/json" -d '{"content":"test","url":"test"}'
```

## Code Style Guidelines

### General Principles

- **Language**: JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Chrome Extension Manifest V3 + Node.js/Express backend
- **Philosophy**: Functional programming preferred, minimize class usage
- **Documentation**: JSDoc comments for all public functions and complex logic
- **Security**: HTTPS for all external requests, input sanitization, CSP headers

### Import Conventions

#### ES6 Modules (Backend)
```javascript
// Group imports by type, then alphabetically
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as modelManager from './model-manager.js';
```

#### Chrome Extension Scripts
```javascript
// Use relative imports for local modules
import { HighlightManager } from './highlight-manager.js';

// Global classes available via window object
const manager = new window.HighlightManager();
```

### Naming Conventions

#### Files and Directories
- **JavaScript**: `camelCase.js` (e.g., `background.js`, `contentScript.js`)
- **HTML**: `kebab-case.html` (e.g., `popup.html`, `floating-card.html`)
- **CSS**: `kebab-case.css` (e.g., `popup.css`, `content.css`)
- **Directories**: `snake_case` for Chrome extension (e.g., `chrome_extension/`)

#### Variables and Functions
```javascript
// camelCase for variables and functions
const apiBaseUrls = ['url1', 'url2'];
const isServiceReady = false;

function checkServiceStatus() {}
function updateQuotaInfo(data) {}

// PascalCase for classes (rarely used)
class HighlightManager {}

// UPPER_SNAKE_CASE for constants
const API_BASE_URLS = ['url1', 'url2'];
const STATE_KEY = 'veritai_state';
```

#### Chrome Extension Specific
```javascript
// Event listeners use onEventName pattern
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {});

// Async functions use Async suffix when needed
async function analyzeContentAsync(content) {}

// Message action types use SCREAMING_SNAKE_CASE
const actions = {
  ANALYZE_CONTENT: 'analyzeContent',
  SHOW_FLOATING_CARD: 'showFloatingCard'
};
```

### Code Formatting

#### Indentation and Spacing
- **Indentation**: 2 spaces (no tabs)
- **Line Length**: 100 characters maximum
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for JavaScript strings, double for HTML attributes

#### Function Structure
```javascript
// Async functions with proper error handling
async function fetchWebContent(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': '...' },
      timeout: 10000
    });

    // Process response
    return { title, content };
  } catch (error) {
    console.error('Failed to fetch web content:', error);
    throw new Error(`Web content fetch failed: ${error.message}`);
  }
}

// Arrow functions for callbacks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const result = await processRequest(request);
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // Keep message channel open
});
```

#### Object and Array Formatting
```javascript
// Objects: trailing commas, multi-line for readability
const config = {
  apiUrls: ['url1', 'url2'],
  timeout: 3000,
  retries: 3,
};

// Arrays: consistent formatting
const permissions = [
  'activeTab',
  'scripting',
  'storage'
];
```

### Error Handling

#### Backend (Express/Node.js)
```javascript
// Comprehensive error handling with logging
app.post('/api/extension/analyze', async (req, res) => {
  try {
    const { content, url } = req.body;

    // Input validation
    if (!content || !url) {
      return res.status(400).json({
        error: { message: 'Missing required fields: content and url' }
      });
    }

    // Process request
    const result = await analyzeContent(content, url);
    res.json({ data: result });

  } catch (error) {
    console.error('Analysis error:', error);

    // Categorize errors for appropriate responses
    if (error.message.includes('quota')) {
      res.status(429).json({ error: { message: 'API quota exceeded' } });
    } else {
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  }
});
```

#### Chrome Extension
```javascript
// Extension-specific error handling
async function checkServiceStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'checkServiceStatus'
    });

    if (response.isReady) {
      updateUI('ready');
    } else {
      updateUI('error', response.error);
    }
  } catch (error) {
    console.error('Service check failed:', error);
    updateUI('error', 'Extension communication failed');
  }
}
```

### Chrome Extension Architecture

#### Manifest V3 Compliance
- **Service Worker**: Use for background scripts (not persistent pages)
- **Permissions**: Principle of least privilege
- **Content Security Policy**: Strict CSP in manifest.json

#### Message Passing
```javascript
// Background to Content Script
chrome.tabs.sendMessage(tabId, {
  action: 'applyHighlights',
  data: analysisResult
});

// Content Script to Background
chrome.runtime.sendMessage({
  action: 'analyzeContent',
  content: pageContent,
  url: currentUrl
});
```

#### Storage API Usage
```javascript
// Local storage for temporary data
await chrome.storage.local.set({
  'highlights_data': highlightInfo
});

// Sync storage for user preferences
await chrome.storage.sync.set({
  'highlightsEnabled': true
});
```

### Testing Guidelines

#### Unit Testing (Chrome Extension)
```javascript
// Example test structure
function testHighlightManager() {
  const manager = new HighlightManager();

  // Test initialization
  assert(manager.isEnabled === true, 'Manager should be enabled by default');

  // Test highlight application
  const mockData = {
    exaggeration_check: { exaggerations_found: ['claim1'] }
  };

  manager.applyHighlights(mockData);
  assert(manager.highlights.length > 0, 'Highlights should be applied');

  console.log('✅ HighlightManager tests passed');
}

// Run tests
testHighlightManager();
```

#### Integration Testing
```bash
# Manual integration tests
# 1. Load extension in Chrome
# 2. Navigate to test page
# 3. Click analyze button
# 4. Verify highlights appear
# 5. Check browser console for errors
```

### Git Workflow

#### Commit Message Format
```bash
# Feature commits
feat: add in-page highlights feature

# Fix commits
fix: resolve extension loading error

# Documentation
docs: update AGENTS.md with new guidelines
```

#### Branch Naming
```bash
# Feature branches
feature/in-page-highlights

# Bug fixes
fix/extension-loading

# Hot fixes
hotfix/backend-connectivity
```

## Cursor Rules (from .cursorrules)

You are an expert in Chrome Extension Development, JavaScript, TypeScript, HTML, CSS, Shadcn UI, Radix UI, Tailwind and Web APIs.

### Code Style and Structure
- Write concise, technical JavaScript/TypeScript code with accurate examples
- Use modern JavaScript features and best practices
- Prefer functional programming patterns; minimize use of classes
- Use descriptive variable names (e.g., isExtensionEnabled, hasPermission)
- Structure files: manifest.json, background scripts, content scripts, popup scripts, options page

### Naming Conventions
- Use lowercase with underscores for file names (e.g., content_script.js, background_worker.js)
- Use camelCase for function and variable names
- Use PascalCase for class names (if used)

### TypeScript Usage
- Encourage TypeScript for type safety and better developer experience
- Use interfaces for defining message structures and API responses
- Leverage TypeScript's union types and type guards for runtime checks

### Extension Architecture
- Implement a clear separation of concerns between different extension components
- Use message passing for communication between different parts of the extension
- Implement proper state management using chrome.storage API

### Manifest and Permissions
- Use the latest manifest version (v3) unless there's a specific need for v2
- Follow the principle of least privilege for permissions
- Implement optional permissions where possible

### Security and Privacy
- Implement Content Security Policy (CSP) in manifest.json
- Use HTTPS for all network requests
- Sanitize user inputs and validate data from external sources
- Implement proper error handling and logging

### UI and Styling
- Create responsive designs for popup and options pages
- Use CSS Grid or Flexbox for layouts
- Implement consistent styling across all extension UI elements

### Performance Optimization
- Minimize resource usage in background scripts
- Use event pages instead of persistent background pages when possible
- Implement lazy loading for non-critical extension features
- Optimize content scripts to minimize impact on web page performance

### Browser API Usage
- Utilize chrome.* APIs effectively (e.g., chrome.tabs, chrome.storage, chrome.runtime)
- Implement proper error handling for all API calls
- Use chrome.alarms for scheduling tasks instead of setInterval

### Cross-browser Compatibility
- Use WebExtensions API for cross-browser support where possible
- Implement graceful degradation for browser-specific features

### Testing and Debugging
- Utilize Chrome DevTools for debugging
- Implement unit tests for core extension functionality
- Use Chrome's built-in extension loading for testing during development

### Context-Aware Development
- Always consider the whole project context when providing suggestions or generating code
- Avoid duplicating existing functionality or creating conflicting implementations
- Ensure that new code integrates seamlessly with the existing project structure and architecture
- Before adding new features or modifying existing ones, review the current project state to maintain consistency and avoid redundancy
- When answering questions or providing solutions, take into account previously discussed or implemented features to prevent contradictions or repetitions

### Code Output
- When providing code, always output the entire file content, not just new or modified parts
- Include all necessary imports, declarations, and surrounding code to ensure the file is complete and functional
- Provide comments or explanations for significant changes or additions within the file
- If the file is too large to reasonably include in full, provide the most relevant complete section and clearly indicate where it fits in the larger file structure

Follow Chrome Extension documentation for best practices, security guidelines, and API usage</content>
<parameter name="filePath">C:\Users\Administrator\Desktop\AI_study\factChecker_ai\factChecker_ai\AGENTS.md