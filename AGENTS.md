# AGENTS.md — CEQTSimple

## Architecture

This is a **zero-build, multi-file vanilla web app**. Open `index.html` directly in a browser — no dev server, no bundler, no `npm`.

### File Structure
```
CEQTSimple/
├── index.html       # HTML shell, loads scripts in dependency order
├── styles.css       # All styles, CSS custom properties, responsive
├── app.js           # UI: matrix rendering, drag-drop, modals, views, Chart.js
├── data.js          # State management, localStorage wrapper, task CRUD
└── favicon.ico
```

### Script Communication
- **No ES modules.** Plain `<script>` tags. `data.js` loads before `app.js`.
- `data.js` exposes `window.CEQT` namespace: state, load/save/CRUD functions
- `app.js` reads from `window.CEQT`, dispatches custom `state-changed` events on `window` for reactivity
- `data.js` is the **sole** localStorage reader/writer

- No `package.json`, no framework, no TypeScript.
- UI is in Chinese (zh-CN). All labels, tooltips, and sample data use Chinese.

## Data Model

Tasks are stored in `localStorage`:

| Key | Value |
|---|---|
| `currentWorkspace` | The active workspace name (string) |
| `tasks_<workspace>` | JSON array of task objects |
| `prefs_<workspace>` | Dark mode, last view, filter preferences |

**Legacy note**: The old key `currentUser` should be checked as a fallback — the redesign renamed it to `currentWorkspace`.

**Task object shape:**
```js
{
  id: string,              // Date.now().toString()
  title: string,           // required
  description: string,
  category: "work"|"personal"|"study"|"health"|"family"|"other",
  importance: 1–7,         // 7 is highest
  urgency: 0–12,           // 0=1year … 12=15min
  createdAt: ISO string,
  updatedAt: ISO string,
  completed: boolean,
  completedAt?: ISO string,
  subtasks: [{id: string, text: string, done: boolean, order: number}],
  notes: string,           // plain text
  reminderAt?: ISO string
}
```

## Coordinate System (Matrix)

- Matrix: 12 urgency cells (horizontal) × 6 importance cells (vertical)
- **Center**: `importance=4` (horizontal axis), `urgency=6` (vertical axis)
- `importance=1` → top, `importance=7` → bottom
- `urgency=0` → left, `urgency=12` → right
- Quadrant labels: Q1=重要不紧急, Q2=重要紧急, Q3=不重要不紧急, Q4=不重要紧急

## Key Behaviors

- **Workspace entry** (not "login"): Enter a name to access tasks. No password. No backend.
- **Drag tasks** on the matrix to change urgency/importance.
- **Right-click** a task dot for edit/complete/delete context menu.
- **Keyboard**: `Escape` closes modals, `Ctrl+N` adds task at matrix center, `Ctrl+K` search, `Ctrl+F` filters, `1`/`2`/`3` view switch, `?` help.
- **Sample data** seeds on first use per workspace (8 tasks with subtask/reminder examples).
- **Resize** handler re-renders task positions and Chart.js (100ms debounce).
- **Reminders**: `setInterval` (30s) + `visibilitychange` catch-up for background tabs.

## Style Conventions

- Functions use `camelCase`; CSS classes use `kebab-case`; CSS custom properties for theming.
- Dark theme is default; light mode toggle persisted in localStorage.
- Colors: accented by importance (cool blue → warm red) and opacity by urgency.
- Responsive breakpoints: 1000px, 768px, 480px.
- **Styles live in `styles.css`** (not inline). JS lives in `app.js` and `data.js`.

## Constraints

- **No build step.** No package.json, no bundler, no npm.
- **No framework** unless the user explicitly requests a migration.
- **No ES modules.** Plain `<script>` tags, global `window.CEQT` namespace.
- **Chart.js from CDN.** Check the current `<script>` URL before assuming API changes.
- **Surgical edits only.** Touch only what's needed. Don't reformat entire files.
- **No TypeScript.** No type suppression needed.
- **Old localStorage data must remain loadable.** Check `currentUser` as fallback for `currentWorkspace`.
