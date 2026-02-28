# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean-language bucket list (life goals) web application. Pure client-side SPA with no build tools, no package manager, and no framework dependencies. Data persists in browser LocalStorage.

## Running the App

No build step required. Open `index.html` directly in a browser, or serve with any static file server:

```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

VS Code: right-click `index.html` → "Open with Live Server"

There are no tests, linter, or CI pipeline configured.

## Architecture

Two-layer vanilla JS architecture with strict separation between data and UI:

- **`js/storage.js`** — `BucketStorage` object literal (not a class). Data access layer wrapping LocalStorage under key `'bucketList'`. Provides: `load()`, `save()`, `addItem()`, `updateItem()`, `deleteItem()`, `toggleComplete()`, `getStats()`, `getFilteredList()`. Every mutation loads the full array, modifies it, and saves it back.

- **`js/app.js`** — `BucketListApp` class. UI controller instantiated as global `app` variable on DOMContentLoaded. Manages state (`currentFilter`, `editingId`), caches DOM elements in `cacheElements()`, and re-renders the entire list on every data change via `render()`. Inline `onclick` handlers in generated HTML reference the global `app` instance (e.g., `onclick="app.handleToggle('${item.id}')"`).

- **`index.html`** — Single HTML page. Loads Tailwind CSS via CDN (`https://cdn.tailwindcss.com`), then `css/styles.css`, then scripts in order: `storage.js` before `app.js` (script order matters).

- **`css/styles.css`** — Supplements Tailwind with custom animations (`slideIn`, `fadeIn`, `scaleIn`), filter button active states, mobile responsive overrides (640px breakpoint), and basic dark mode via `prefers-color-scheme: dark`.

## Data Model

Items stored as JSON array in LocalStorage:

```javascript
{
  id: string,          // Date.now().toString()
  title: string,
  completed: boolean,
  createdAt: string,   // ISO 8601
  completedAt: string | null
}
```

New items are prepended (`unshift`), not appended.

## Key Patterns

- **Full re-render on mutation**: Every add/edit/delete/toggle calls `render()` which regenerates all list HTML via `innerHTML`.
- **XSS prevention**: User input is escaped via `escapeHtml()` (creates a temporary DOM element, sets `textContent`, reads `innerHTML`).
- **No module system**: Files use global scope. `BucketStorage` is a global object; `app` is a global variable. Script load order in `index.html` is the dependency mechanism.
- **Korean UI**: All user-facing strings are in Korean. Dates formatted with `toLocaleDateString('ko-KR')`.
