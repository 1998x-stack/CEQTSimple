# CEQTSimple Redesign — Design Spec

**Date**: 2026-05-30
**Status**: Draft

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
├── index.html       # HTML shell, minimal inline code
├── styles.css       # All styles, CSS custom properties, responsive
├── app.js           # UI: matrix rendering, drag-drop, modals, views, Chart.js
├── data.js          # State management, localStorage wrapper, task CRUD
└── favicon.ico
```

### State Management (`data.js`)
- Single `state` object: `tasks[]`, `currentUser`, `activeView`, `darkMode`, `filters`
- `data.js` is the **sole** file that reads/writes localStorage
- Other files call exported functions: `loadState()`, `saveTasks()`, `addTask()`, `updateTask()`, `deleteTask()`
- State changes dispatch custom `state-changed` DOM event — decoupled reactivity without a framework

### localStorage Keys
| Key | Value |
|---|---|
| `currentUser` | Active username (string) |
| `tasks_<username>` | JSON array of task objects |
| `prefs_<username>` | Dark mode, last view, filter preferences |

### Dependencies
- Chart.js (CDN only — check current script URL before making API assumptions)
- No other external dependencies

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
- Task dots: soft outer glow via `box-shadow` in accent color
- Modals: frosted glass panels (`backdrop-filter: blur(12px)`)
- All interactive elements: 200–300ms ease transitions
- Rounded corners: 8–12px throughout

### Dark/Light Toggle
- Icon toggle in header, persisted to localStorage
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
  subtasks: [{id: string, text: string, done: boolean}],  // NEW
  notes: string,                                            // NEW (rich text)
  reminderAt?: ISO string                                   // NEW
}
```

### Backward Compatibility
- Old `tasks_<username>` data is forward-compatible
- New fields (`subtasks`, `notes`, `reminderAt`) are optional with sensible defaults
- No migration script needed

## Features

### Existing (Ported)
- Login modal (username + password ≥3 chars, localStorage check)
- Eisenhower Matrix with 12 urgency × 6 importance grid
- Drag tasks to reposition (updates urgency/importance)
- Right-click context menu (edit / complete / delete)
- Task CRUD modal (title, description, category, importance slider, urgency dropdown)
- User profile: stats cards, creation/completion timelines, category pie chart (Chart.js)
- Keyboard: `Escape` closes modals, `Ctrl+N` creates task at center
- Sample data seeded on first use per user

### New Features
- **Dark/light mode toggle** with localStorage persistence
- **Multiple views**: Matrix (default), List view, Profile view
- **Search bar**: real-time filter by title/description
- **Filter chips**: category, importance range, completed/pending
- **Subtasks**: checklist per task, progress ring on task dots
- **Task notes**: rich text editor (bold, italic, bullets) in task modal
- **Reminders**: Browser Notification API, optional `reminderAt` timestamp, periodic check
- **Expanded keyboard shortcuts** (`Ctrl+K` search, `Ctrl+F` filters, `1`/`2`/`3` view switch, `?` help)

### UI States
- Empty states for all lists ("无匹配任务", "暂无创建的任务")
- Error states: localStorage quota exceeded, corrupt data recovery
- Loading state: graceful fallback if Chart.js CDN fails

## Implementation Phases

### Phase 1 — Foundation
1. Create `styles.css` — dark theme CSS custom properties, responsive grid, component styles
2. Create `data.js` — state management, localStorage wrapper, event dispatch system
3. Rewrite `index.html` — clean shell loading external CSS/JS files
4. Port login flow to new architecture

### Phase 2 — Core Matrix
5. Rebuild matrix rendering in `app.js` with dark theme
6. Port drag-drop, right-click context menu, task CRUD modals
7. Add dark/light toggle in header

### Phase 3 — New Features
8. Search bar + filter chips + empty/filtered states
9. Subtasks: data model, UI in edit modal, progress rings on matrix dots
10. Task notes: rich text editor in task modal
11. Reminder system: Notification API permission, periodic check, bell icon
12. List view + view switcher (header segmented control)

### Phase 4 — Polish
13. Keyboard shortcut system (expanded bindings + `?` help overlay)
14. Profile page: stats, timelines, Chart.js pie chart
15. Micro-animations, transitions, skeleton states

## Constraints
- **No build step.** No package.json, no bundler, no npm. Open `index.html` directly.
- **No framework.** Vanilla JS only. No React, Vue, Alpine, etc.
- **Chart.js from CDN.** Check the current `<script>` tag URL before changing API usage.
- **Chinese UI.** All labels, tooltips, error messages in zh-CN.
- **Surgical diff.** Replace `index.html` shell, add new files. Don't refactor unrelated things.
- **No breaking localStorage format.** Old user data must load without errors.
