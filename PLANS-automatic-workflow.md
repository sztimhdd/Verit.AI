# Automatic & Effortless Workflow Plan

## Overview
We are refactoring the extension to perform automatic content detection and fact-checking upon page load, removing the need for user initiation. This creates a "zero-click" experience where users get immediate value through visual indicators (badge score) and in-page highlights.

## UX Flow

1.  **Page Load**:
    *   User navigates to a webpage.
    *   Extension icon shows a "loading" or "scanning" state (e.g., '...').

2.  **Stage 1: Detection (Background)**:
    *   Extension sends page content to a new fast endpoint (`/api/extension/detect`).
    *   **Model**: Gemini 1.5 Flash (Fast & Cheap).
    *   **Task**: Classify content (News, Blog, Social, etc.) and decide if verification is needed.
    *   **Decision**:
        *   **No**: Stop. Icon clears or shows "ignored" state.
        *   **Yes**: Proceed to Stage 2.

3.  **Stage 2: Analysis (Background)**:
    *   Extension automatically calls the main verification endpoint (`/api/extension/analyze`).
    *   **Model**: Gemini 2.0 Flash (Comprehensive).
    *   **Task**: Full fact-check, source verification, entity check.

4.  **Results & Feedback**:
    *   **Icon Badge**: Updates to show the Factuality Score (0-100) with color coding (Green/Yellow/Red).
    *   **In-Page**: Red highlights appear automatically on dubious claims.
    *   **Popup**: If the user clicks the extension icon, they immediately see the detailed Score Card (skipping the "Analyze" button).

## Architecture Changes

### 1. Backend (`backend/app.js`)
- **New Endpoint**: `POST /api/extension/detect`
    - **Input**: `{ content, url, lang }`
    - **Output**: `{ requires_fact_check: boolean, category: string, confidence: number }`
    - **Logic**: Use a specific prompt optimized for categorization.

### 2. Background Script (`chrome_extension/src/background/background.js`)
- **Orchestration**:
    - Handle `detectContentCategory` message.
    - Chain: `detect` -> `analyze`.
- **State Management**:
    - Store analysis results in `chrome.storage.local` (keyed by Tab ID).
    - Manage Badge State (`chrome.action.setBadgeText`).

### 3. Content Script (`chrome_extension/src/content/content.js`)
- **Auto-Trigger**:
    - On `initialize()`, extract text and send `detectContentCategory`.
- **Passive Mode**:
    - Listen for `applyHighlights` without forcing the floating card to open.

### 4. Popup (`chrome_extension/public/popup.js`)
- **Reactive UI**:
    - On open, check `chrome.storage` for result associated with current tab.
    - If result exists -> Render Result View.
    - If processing -> Render Loading View.
    - If no result -> Render Default/Start View.

## Key Decisions
- **Model Selection**: 
    - Detection: Gemini 1.5 Flash (Latency < 1s preferred).
    - Analysis: Gemini 2.0 Flash (Higher reasoning capability).
- **Badge Colors**:
    - High Score (>80): Green (`#4caf50`)
    - Medium Score (50-80): Orange (`#ff9800`)
    - Low Score (<50): Red (`#f44336`)
    - Processing: Blue (`#2196f3`)
- **Storage Strategy**:
    - Use `chrome.storage.local` to persist results across popup closures.
    - Clean up old tab data when tabs are closed (via `chrome.tabs.onRemoved`).

## Implementation Steps
1.  **Backend**: Implement detection endpoint.
2.  **Background**: Implement orchestration and badge logic.
3.  **Content**: Implement auto-trigger.
4.  **Popup**: Implement state-aware rendering.
5.  **Cleanup**: Handle tab closure and navigation updates.
