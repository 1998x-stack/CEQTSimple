# CEQTSimple Redesign — Design Spec

**Date**: 2026-05-30
**Status**: Draft (grilled)

## Summary

Complete redesign of CEQTSimple, the Eisenhower Matrix task manager. Current single-file vanilla HTML/CSS/JS app (~1566 lines in `index.html`) gets a dark/moody visual overhaul with substantially expanded features while preserving the zero-build philosophy.

## Goals
- **Complete redesign from scratch** — new visual identity, not constrained by current styles
- **Dark & moody aesthetic** — muted tones, focus-friendly, reduced visual noise
- **Substantially more features** — search, filter, subtasks, notes, reminders, multiple views
- **Zero build** — no npm, no bundler; open `index.html` directly
- **Modular code** — split into separate CSS/JS files for maintainability (still no build step)

## Architecture

### File Structure
```
CEQTSimple/
├── index.html       # HTML shell, loads CSS/JS in dependency order
├── styles.css       # All styles, CSS custom properties, responsive
├── app.js           # UI: matrix rendering, drag-drop, modals, views, Chart.js
├── data.js          # State management, localStorage wrapper, task CRUD
└── favicon.ico
```

### Script Loading & Communication
- `index.html` loads scripts in order: `data.js` then `app.js` (plain `<script>` tags, not modules)
- `data.js` attaches to `window.CEQT` namespace: `{ state, loadState, saveTasks, addTask, updateTask, deleteTask, switchWorkspace, ... }`
- `app.js` reads state from `window.CEQT.state`, calls `window.CEQT.addTask(...)`, etc.
- State changes dispatch custom `state-changed` event on `window` for decoupled reactivity

### State Management (`data.js`)
- Single `state` object: `tasks[]`, `currentWorkspace`, `activeView`, `darkMode`, `filters`
- `data.js` is the **sole** file that reads/writes localStorage
- All state mutations go through `data.js` functions — no direct localStorage access from `app.js`

### localStorage Keys
| Key | Value |
|---|---|
| `currentWorkspace` | Active workspace name (string) |
| `tasks_<workspace>` | JSON array of task objects |
| `prefs_<workspace>` | Dark mode, last view, filter preferences |

### Dependencies
- Chart.js (CDN only — check current script URL before making API assumptions)
- No other external dependencies

## Domain Model

### Workspace (formerly "Login")
A named context that contains a user's tasks. No authentication — any name creates/accesses a workspace. The entry modal is "选择工作区" (Select Workspace). Password field removed — it provided false security.

### Eisenhower Matrix (四象限)
A grid with **12 urgency levels** (horizontal, 0–12) × **6 importance levels** (vertical, 1–7).

**Coordinate system** (preserved from original):
- Horizontal center: `urgency = 6`
- Vertical center: `importance = 4`
- `importance = 1` → top of matrix (not important)
- `importance = 7` → bottom of matrix (most important)
- `urgency = 0` → left (1 year)
- `urgency = 12` → right (15 minutes)

**Quadrants**: Q1=重要不紧急 (top-left), Q2=重要紧急 (top-right), Q3=不重要不紧急 (bottom-left), Q4=不重要紧急 (bottom-right)

### Task
A unit of work with position on the matrix, category, optional subtasks, notes, and reminder.

## Visual Design

### Color Palette (Dark Mode)
```
--bg-primary:     #0f0f14    (deep near-black page background)
--bg-secondary:   #1a1a24    (card/module surfaces)
--bg-tertiary:    #252535    (hover/active states)
--text-primary:   #e4e4ec    (main content)
--text-secondary: #8888a0    (labels, muted text)
--accent-cool:    #6c8cff    (low-importance tasks)
--accent-warm:    #ff6b6b    (high-importance / urgent tasks)
--accent-neutral: #ffb74d    (mid-range tasks)
--border:         #2a2a3a    (subtle dividers)
```

### Typography
- System font stack: `'Inter', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif`
- Monospace for data/metrics: `'JetBrains Mono', 'Fira Code', 'Consolas', monospace`
- Scale: 12px (micro), 14px (body), 18px (headings), 28px (page title)

### Visual Elements
- Matrix grid lines glow faintly on hover
- Task dots: soft outer glow via `box-shadow` in accent color, single title character displayed
- Subtask progress: thin ring around each dot, fills proportional to `done/all` subtasks
- Modals: frosted glass panels (`backdrop-filter: blur(12px)`)
- All interactive elements: 200–300ms ease transitions
- Rounded corners: 8–12px throughout

### Dark/Light Toggle
- Icon toggle in header, persisted in `prefs_<workspace>`
- Light mode: warm off-white palette, muted shadows

## Data Model

### Task Object (extended)
```js
{
  id: string,              // Date.now().toString()
  title: string,           // required
  description: string,
  category: "work"|"personal"|"study"|"health"|"family"|"other",
  importance: 1–7,         // 7 = highest
  urgency: 0–12,           // 0=1year … 12=15min
  createdAt: ISO string,
  updatedAt: ISO string,
  completed: boolean,
  completedAt?: ISO string,
  subtasks: [{id: string, text: string, done: boolean, order: number}],  // NEW
  notes: string,            // NEW — plain text, searchable
  reminderAt?: ISO string   // NEW
}
```

### Backward Compatibility
- Old `tasks_<username>` data is forward-compatible (note: old key uses `username`, new key uses `workspace` name — same value, just renamed concept)
- New fields (`subtasks`, `notes`, `reminderAt`) default to `[]`, `""`, `undefined`
- No migration script needed

## Features

### Existing (Ported)
- Workspace entry (username only, no password)
- Eisenhower Matrix with 12 urgency × 6 importance grid (same coordinate center)
- Drag tasks to reposition (updates urgency/importance)
- Right-click context menu (edit / complete / delete)
- Task CRUD modal (title, description, category, importance slider, urgency dropdown)
- User profile: stats cards, creation/completion timelines, category pie chart (Chart.js)
- Keyboard: `Escape` closes modals, `Ctrl+N` creates task at center
- Sample data seeded on first use per workspace (expanded to 8 tasks with subtask/reminder examples)

### New Features
- **Dark/light mode toggle** with localStorage persistence
- **Multiple views**: Matrix (default), List view (sortable table with filters), Profile view
- **Search bar**: real-time filter by title, description, AND notes
- **Filter chips**: category, importance range, completed/pending
- **Subtasks**: checklist per task with `order` field, progress ring on task dots
- **Task notes**: plain text field, searchable, in task modal
- **Reminders**: Browser Notification API, 30s interval + `visibilitychange` catch-up for background tabs, bell icon on reminded tasks
- **Expanded keyboard shortcuts** (`Ctrl+K` search, `Ctrl+F` filters, `1`/`2`/`3` view switch, `?` help overlay)

### UI States
- Empty states for all lists ("无匹配任务", "暂无创建的任务")
- Error states: localStorage quota exceeded (warn + cleanup suggestion), corrupt data recovery
- Loading state: graceful fallback if Chart.js CDN fails

## Implementation Phases

### Phase 1 — Foundation
1. Create `styles.css` — dark theme CSS custom properties, responsive grid, component styles
2. Create `data.js` — `window.CEQT` namespace, localStorage wrapper, event dispatch
3. Rewrite `index.html` — clean shell loading CSS/JS in dependency order
4. Port workspace entry flow (no password, just username)

### Phase 2 — Core Matrix
5. Rebuild matrix rendering in `app.js` with dark theme (preserve coordinate center)
6. Port drag-drop, right-click context menu, task CRUD modals
7. Add dark/light toggle in header

### Phase 3 — New Features
8. Search bar + filter chips + empty/filtered states (search includes notes)
9. Subtasks: data model with `order`, UI checklist in edit modal, progress rings on matrix dots
10. Task notes: plain text field in task modal
11. Reminder system: Notification API, 30s interval + visibility change catch-up, bell icon
12. List view + view switcher (header segmented control)

### Phase 4 — Polish
13. Keyboard shortcut system (expanded bindings + `?` help overlay)
14. Profile page: stats, timelines, Chart.js pie chart
15. Micro-animations, transitions, skeleton states

## Constraints
- **No build step.** No package.json, no bundler, no npm. Open `index.html` directly.
- **No framework.** Vanilla JS only. No React, Vue, Alpine, etc.
- **No ES modules.** Use global `window.CEQT` namespace, plain `<script>` tags.
- **Chart.js from CDN.** Check the current `<script>` tag URL before changing API usage.
- **Chinese UI.** All labels, tooltips, error messages in zh-CN.
- **Surgical diff.** Replace `index.html` shell, add new files. Don't refactor unrelated things.
- **No breaking localStorage format.** Old user data loads without errors. Note: `currentUser` key renamed to `currentWorkspace` — code should check for old key as fallback.

## Grilling Resolutions (2026-05-30)

| # | Topic | Resolution |
|---|---|---|
| Q1 | "Login" is misleading | Renamed to Workspace Selector. Remove password field. |
| Q2 | Single-char dots may be illegible at scale | Keep compact display; compensate with fast tooltips + List View detail. |
| Q3 | Rich text notes break search | Store notes as plain text. Search includes title, description, AND notes. |
| Q4 | `setInterval` throttled in background tabs | 30s interval + `visibilitychange` catch-up. No Service Worker. |
| Q5 | Subtasks lack ordering | Added `order: number` field. No reorder UI in v1; future-proof. |
| Q6 | AGENTS.md contradicts modular split | AGENTS.md to be updated to reflect new 4-file architecture. |
| Q7 | Coordinate center undocumented in spec | Explicitly restated: importance=4, urgency=6 as center. |
| Q8 | File communication via ES modules fails on `file://` | Use `window.CEQT` global namespace + plain `<script>` loading order. |
| Q9 | Sample data quality | Keep seeding. Expand to 8 tasks with subtask + reminder examples. |
