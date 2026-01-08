# AGENTS.md - Agentic Coding Guidelines

This document provides essential guidelines for agents working on the Verit AI Fact Checker (Chrome Extension + Node.js Backend).

## 1. Build & Test Commands

### Chrome Extension (`/chrome_extension`)
- **Build**: `npm run build` (Production)
- **Watch**: `npm run dev` (Development with auto-rebuild)
- **Clean**: `npm run clean`
- **Test All**: `npm test`
- **Test Single**: `node tests/popup.test.js` (Edit file to isolate tests if needed)
- **Test Watch**: `npm run test:watch`

### Backend (`/backend`)
- **Start**: `npm start`
- **Dev**: `npm run dev` (Nodemon auto-reload)
- **Test**: No formal suite. Manual check:
  ```bash
  curl http://localhost:4000/health
  curl -X POST http://localhost:4000/api/extension/analyze -H "Content-Type: application/json" -d '{"content":"test","url":"test"}'
  ```

## 2. Code Style & Conventions

- **Language**: JavaScript (ES6+), HTML5, CSS3.
- **Formatting**: 2 spaces indentation, 100 char line limit, semicolons required, single quotes for JS.
- **Naming**: 
  - `camelCase` for vars/functions (`fetchContent`).
  - `PascalCase` for classes (`HighlightManager`).
  - `SCREAMING_SNAKE_CASE` for constants (`API_URL`).
  - `kebab-case` for HTML/CSS files (`popup-style.css`).
- **Imports**: Group by type (libs first, then local). Use relative paths for local modules in extension.
- **Error Handling**: Use `try/catch` with explicit error logging. Backend should return JSON errors (`{ error: { message: ... } }`).
- **Comments**: JSDoc for complex functions. Explain *why*, not *what*.

## 3. Architecture (Manifest V3)

- **Service Worker**: `background.js` (module type). No persistent background pages.
- **Content Scripts**: Isolated world. Use message passing to communicate with background.
- **Messaging**: Use constants for action names (e.g., `actions.ANALYZE_CONTENT`).
- **Storage**: Prefer `chrome.storage.local` for large data, `sync` for settings.
- **Security**: Strict CSP. HTTPS only.

## 4. Git Workflow

- **Commits**: Conventional Commits (`feat: add highlight`, `fix: popup size`, `docs: update readme`).
- **Branches**: `feature/name`, `fix/issue-name`.

---

## 5. Cursor Rules (from .cursorrules)

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

Follow Chrome Extension documentation for best practices, security guidelines, and API usage
