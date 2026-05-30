# CEQTSimple Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete redesign of CEQTSimple — dark/moody Eisenhower Matrix task manager with search, filter, subtasks, notes, reminders, and multiple views. Zero-build, 4-file modular architecture.

**Architecture:** `index.html` shell loads `styles.css`, `data.js` (state/localStorage), then `app.js` (UI). `window.CEQT` global namespace for cross-file communication. Custom `state-changed` events on `window` for decoupled reactivity.

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS (no framework), Chart.js (CDN), localStorage

---

## File Structure

```
CEQTSimple/
├── index.html       # NEW: shell, loads CSS/JS in order
├── styles.css       # NEW: dark theme, custom properties, responsive
├── app.js           # NEW: UI logic, matrix, modals, views, Chart.js
├── data.js          # NEW: state management, localStorage CRUD
└── favicon.ico      # KEEP: unchanged
```

---

### Task 1: Create `styles.css` — Dark Theme Foundation

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write CSS custom properties and base reset**

```css
/* === CSS Custom Properties (Dark Mode Default) === */
:root {
  --bg-primary: #0f0f14;
  --bg-secondary: #1a1a24;
  --bg-tertiary: #252535;
  --text-primary: #e4e4ec;
  --text-secondary: #8888a0;
  --accent-cool: #6c8cff;
  --accent-warm: #ff6b6b;
  --accent-neutral: #ffb74d;
  --border: #2a2a3a;

  --font-sans: 'Inter', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --radius: 10px;
  --transition: 250ms ease;

  --task-size: 32px;
  --matrix-bg: #14141e;
}

/* === Light Mode Override === */
[data-theme="light"] {
  --bg-primary: #f5f5f0;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e8e8e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666660;
  --accent-cool: #4466dd;
  --accent-warm: #dd4444;
  --accent-neutral: #dd9944;
  --border: #ddd8d0;
  --matrix-bg: #fafaf5;
}

/* === Reset === */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Write layout styles (header, container, matrix)**

```css
/* === Header === */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-switcher {
  display: flex;
  background: var(--bg-tertiary);
  border-radius: var(--radius);
  overflow: hidden;
}

.view-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: background var(--transition), color var(--transition);
}

.view-btn.active {
  background: var(--accent-cool);
  color: white;
}

.theme-toggle,
.workspace-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition);
}

.theme-toggle:hover,
.workspace-badge:hover {
  background: var(--border);
}

/* === Container === */
.container {
  padding: 76px 20px 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}

/* === Matrix === */
.matrix {
  width: 100%;
  height: 600px;
  position: relative;
  background: var(--matrix-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: crosshair;
}

.axis {
  position: absolute;
  z-index: 5;
  pointer-events: none;
}

.axis-x {
  width: 100%;
  height: 1px;
  background: var(--border);
  top: 50%;
  left: 0;
}

.axis-y {
  width: 1px;
  height: 100%;
  background: var(--border);
  left: 50%;
  top: 0;
}
```

- [ ] **Step 3: Write grid lines, labels, task dots, and quadrant labels**

```css
.grid-line {
  position: absolute;
  pointer-events: none;
}

.grid-line.vertical {
  width: 1px;
  height: 100%;
  background: var(--border);
  opacity: 0.3;
  transition: opacity 200ms ease;
}

.grid-line.vertical:hover {
  opacity: 0.6;
}

.grid-line.horizontal {
  width: 100%;
  height: 1px;
  background: var(--border);
  opacity: 0.3;
  transition: opacity 200ms ease;
}

.grid-line.horizontal:hover {
  opacity: 0.6;
}

.label {
  position: absolute;
  font-size: 11px;
  color: var(--text-secondary);
  pointer-events: none;
  z-index: 6;
  white-space: nowrap;
}

.quadrant-label {
  position: absolute;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-secondary);
  opacity: 0.12;
  pointer-events: none;
  z-index: 4;
}

.q1 { top: 24px; left: 24px; }
.q2 { top: 24px; right: 24px; }
.q3 { bottom: 24px; left: 24px; }
.q4 { bottom: 24px; right: 24px; }

.task-dot {
  position: absolute;
  width: var(--task-size);
  height: var(--task-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 13px;
  cursor: grab;
  z-index: 10;
  border: 2px solid rgba(255,255,255,0.2);
  transition: transform var(--transition), box-shadow var(--transition);
  user-select: none;
}

.task-dot:hover {
  transform: scale(1.4);
  z-index: 30;
}

.task-dot.dragging {
  cursor: grabbing;
  transform: scale(1.2);
  z-index: 50;
  opacity: 0.8;
}

/* Subtask progress ring */
.task-dot .progress-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  width: calc(var(--task-size) + 8px);
  height: calc(var(--task-size) + 8px);
}

.progress-ring circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke-dashoffset 300ms ease;
}

/* === Tooltip === */
.tooltip {
  position: absolute;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.6;
  z-index: 100;
  pointer-events: none;
  opacity: 0;
  transition: opacity 200ms ease;
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  max-width: 260px;
  white-space: pre-line;
}

.tooltip.visible {
  opacity: 1;
}
```

- [ ] **Step 4: Write modal, context menu, form, and button styles**

```css
/* === Modals === */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal.open {
  display: flex;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}

.modal-header {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
  color: var(--text-primary);
}

/* === Forms === */
.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font-sans);
  transition: border-color var(--transition);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-cool);
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.form-group input[type="range"] {
  padding: 0;
  background: transparent;
  border: none;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
}

.form-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-cool);
  cursor: pointer;
}

.slider-display {
  display: inline-block;
  margin-left: 10px;
  font-weight: 700;
  color: var(--accent-warm);
  font-size: 14px;
}

/* === Buttons === */
.btn {
  padding: 10px 22px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background var(--transition), opacity var(--transition);
  font-family: var(--font-sans);
}

.btn-primary {
  background: var(--accent-cool);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--border);
}

.btn-danger {
  background: var(--accent-warm);
  color: white;
}

.btn-danger:hover {
  opacity: 0.9;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}

/* === Context Menu === */
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 0;
  z-index: 300;
  display: none;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  min-width: 150px;
}

.context-menu.open {
  display: block;
}

.context-menu-item {
  padding: 10px 18px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  transition: background var(--transition);
  display: flex;
  align-items: center;
  gap: 10px;
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}
```

- [ ] **Step 5: Write search bar, filter chips, add-button, and list view styles**

```css
/* === Search & Filter === */
.search-bar {
  margin-bottom: 16px;
}

.search-bar input {
  width: 100%;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font-sans);
  transition: border-color var(--transition);
}

.search-bar input:focus {
  outline: none;
  border-color: var(--accent-cool);
}

.search-bar input::placeholder {
  color: var(--text-secondary);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-chip {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: var(--font-sans);
}

.filter-chip.active {
  background: var(--accent-cool);
  color: white;
  border-color: var(--accent-cool);
}

.filter-chip:hover {
  border-color: var(--accent-cool);
}

/* === Add Button === */
.add-button {
  position: absolute;
  width: 40px;
  height: 40px;
  background: var(--accent-cool);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 22px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(108,140,255,0.4);
  transition: transform var(--transition);
}

.add-button:hover {
  transform: scale(1.15);
}

.add-button.visible {
  display: flex;
}
```

- [ ] **Step 6: Write list view, profile, stats, timeline, chart, and responsive styles**

```css
/* === List View === */
.list-view {
  display: none;
}

.list-view.active {
  display: block;
}

.task-table {
  width: 100%;
  border-collapse: collapse;
}

.task-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.task-table td {
  padding: 12px 14px;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
}

.task-table tr:hover td {
  background: var(--bg-tertiary);
}

.task-table .task-row.completed td {
  opacity: 0.5;
  text-decoration: line-through;
}

/* === Subtask Checklist === */
.subtask-list {
  list-style: none;
  margin-top: 8px;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.subtask-item input[type="checkbox"] {
  width: auto;
  accent-color: var(--accent-cool);
}

.subtask-item .subtask-text {
  font-size: 13px;
  color: var(--text-primary);
}

.subtask-item .subtask-text.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.subtask-add-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.subtask-add-row input {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
}

.subtask-add-row button {
  padding: 6px 12px;
  font-size: 12px;
}

/* === Profile Page === */
.profile-page {
  display: none;
}

.profile-page.active {
  display: block;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
}

.stat-card .stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.stat-card .stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-card.completed .stat-value { color: #34c759; }
.stat-card.pending .stat-value { color: var(--accent-neutral); }

/* === Timeline === */
.timeline-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.timeline-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.timeline-date {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 100px;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.timeline-tags {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

/* === Chart === */
.chart-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-primary);
}

/* === Empty State === */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state .empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state .empty-text {
  font-size: 14px;
}

/* === Help Overlay === */
.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 400;
}

.help-overlay.open {
  display: flex;
}

.help-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.help-panel h3 {
  margin-bottom: 16px;
}

.help-panel kbd {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  border: 1px solid var(--border);
}

.help-shortcuts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  align-items: center;
}

.help-shortcuts .shortcut-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

/* === Responsive === */
@media (max-width: 768px) {
  .matrix {
    height: 400px;
  }

  .modal-content {
    width: 95%;
    padding: 20px;
  }

  .header {
    padding: 0 12px;
  }

  .container {
    padding: 66px 10px 10px;
  }
}

@media (max-width: 480px) {
  .matrix {
    height: 320px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .quadrant-label {
    font-size: 15px;
  }
}
```

- [ ] **Step 7: Verify styles.css**

Open `index.html` (after it's created in Task 3) in a browser and verify:
- Dark background renders
- Custom property colors visible in devtools
- No unstyled elements

---

### Task 2: Create `data.js` — State Management & localStorage

**Files:**
- Create: `data.js`

- [ ] **Step 1: Write the CEQT namespace, state, and localStorage helpers**

```js
// data.js — State management, localStorage CRUD
// Attaches to window.CEQT. Load BEFORE app.js.

(function() {
  'use strict';

  // State
  const state = {
    currentWorkspace: null,
    tasks: [],
    darkMode: true,
    activeView: 'matrix', // 'matrix' | 'list' | 'profile'
    filters: {
      search: '',
      category: null,
      importanceMin: null,
      importanceMax: null,
      showCompleted: false,
    },
  };

  // localStorage keys
  const KEYS = {
    workspace: function() {
      // Fallback: check legacy 'currentUser' key
      return localStorage.getItem('currentUser') || localStorage.getItem('currentWorkspace');
    },
    setWorkspace: function(name) {
      localStorage.setItem('currentWorkspace', name);
    },
    tasks: function(ws) { return 'tasks_' + ws; },
    prefs: function(ws) { return 'prefs_' + ws; },
  };

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert('存储空间不足！请清理一些旧任务。');
      }
    }
  }

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
```

- [ ] **Step 2: Write workspace switching and task CRUD functions**

```js
  function switchWorkspace(name) {
    if (!name || !name.trim()) return false;
    name = name.trim();
    state.currentWorkspace = name;
    KEYS.setWorkspace(name);
    state.tasks = loadFromStorage(KEYS.tasks(name), []);
    const prefs = loadFromStorage(KEYS.prefs(name), {});
    state.darkMode = prefs.darkMode !== undefined ? prefs.darkMode : true;
    state.activeView = prefs.activeView || 'matrix';
    state.filters = prefs.filters || { search: '', category: null, importanceMin: null, importanceMax: null, showCompleted: false };
    applyTheme();
    return true;
  }

  function saveTasks() {
    if (!state.currentWorkspace) return;
    saveToStorage(KEYS.tasks(state.currentWorkspace), state.tasks);
    dispatchChange();
  }

  function savePrefs() {
    if (!state.currentWorkspace) return;
    saveToStorage(KEYS.prefs(state.currentWorkspace), {
      darkMode: state.darkMode,
      activeView: state.activeView,
      filters: state.filters,
    });
  }

  function addTask(taskData) {
    const task = {
      id: Date.now().toString(),
      title: taskData.title,
      description: taskData.description || '',
      category: taskData.category || 'other',
      importance: taskData.importance || 4,
      urgency: taskData.urgency || 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false,
      completedAt: null,
      subtasks: [],
      notes: '',
      reminderAt: null,
    };
    state.tasks.push(task);
    saveTasks();
    return task;
  }

  function updateTask(id, updates) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(state.tasks[idx], updates, { updatedAt: new Date().toISOString() });
    saveTasks();
    return state.tasks[idx];
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
  }

  function completeTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return null;
    task.completed = true;
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    saveTasks();
    return task;
  }
```

- [ ] **Step 3: Write sample data, theme, filter helpers, and event dispatch**

```js
  function initSampleData() {
    if (state.tasks.length > 0) return;
    const now = Date.now();
    const d = (days) => new Date(now - days * 86400000).toISOString();
    state.tasks = [
      { id: '1', title: '完成项目报告', description: '准备季度总结报告，包括数据分析和建议', category: 'work', importance: 6, urgency: 7, createdAt: d(2), updatedAt: d(2), completed: false, completedAt: null, subtasks: [{id:'s1',text:'收集数据',done:true,order:0},{id:'s2',text:'编写分析',done:false,order:1},{id:'s3',text:'制作PPT',done:false,order:2}], notes: '', reminderAt: null },
      { id: '2', title: '健身锻炼', description: '每周至少3次有氧运动', category: 'health', importance: 5, urgency: 3, createdAt: d(5), updatedAt: d(5), completed: false, completedAt: null, subtasks: [], notes: '', reminderAt: null },
      { id: '3', title: '学习新技能', description: '学习React和Vue框架', category: 'study', importance: 4, urgency: 1, createdAt: d(7), updatedAt: d(1), completed: true, completedAt: d(1), subtasks: [], notes: '', reminderAt: null },
      { id: '4', title: '团队会议', description: '每周团队例会，讨论项目进展', category: 'work', importance: 5, urgency: 6, createdAt: d(1), updatedAt: d(1), completed: false, completedAt: null, subtasks: [], notes: '', reminderAt: null },
      { id: '5', title: '家庭聚餐', description: '周末家庭聚餐，预定餐厅', category: 'family', importance: 3, urgency: 4, createdAt: d(3), updatedAt: d(3), completed: false, completedAt: null, subtasks: [], notes: '', reminderAt: null },
      { id: '6', title: '阅读书籍', description: '完成《深度工作》阅读', category: 'personal', importance: 4, urgency: 2, createdAt: d(4), updatedAt: d(4), completed: false, completedAt: null, subtasks: [], notes: '', reminderAt: null },
      { id: '7', title: '整理邮箱', description: '清理收件箱，归档重要邮件', category: 'other', importance: 2, urgency: 8, createdAt: d(1), updatedAt: d(1), completed: false, completedAt: null, subtasks: [], notes: '', reminderAt: null },
      { id: '8', title: '预约体检', description: '年度健康体检', category: 'health', importance: 5, urgency: 2, createdAt: d(3), updatedAt: d(3), completed: false, completedAt: null, subtasks: [{id:'s4',text:'选择医院',done:false,order:0},{id:'s5',text:'预约时间',done:false,order:1}], notes: '需要空腹检查', reminderAt: new Date(now + 86400000).toISOString() },
    ];
    saveTasks();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  }

  function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyTheme();
    savePrefs();
    dispatchChange();
  }

  function setView(view) {
    state.activeView = view;
    savePrefs();
    dispatchChange();
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    savePrefs();
    dispatchChange();
  }

  function getFilteredTasks() {
    return state.tasks.filter(t => {
      if (state.filters.search) {
        const q = state.filters.search.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchNotes = (t.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchNotes) return false;
      }
      if (state.filters.category && t.category !== state.filters.category) return false;
      if (state.filters.importanceMin !== null && t.importance < state.filters.importanceMin) return false;
      if (state.filters.importanceMax !== null && t.importance > state.filters.importanceMax) return false;
      if (!state.filters.showCompleted && t.completed) return false;
      return true;
    });
  }

  function getActiveTasks() {
    return state.tasks.filter(t => !t.completed);
  }

  function getCompletedTasks() {
    return state.tasks.filter(t => t.completed);
  }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent('state-changed', { detail: state }));
  }

  // Export
  window.CEQT = {
    state,
    switchWorkspace,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    saveTasks,
    toggleTheme,
    setView,
    setFilter,
    getFilteredTasks,
    getActiveTasks,
    getCompletedTasks,
    initSampleData,
    applyTheme,
  };
})();
```

- [ ] **Step 4: Verify data.js**

```bash
# Create a test HTML file to verify the namespace loads
echo '<script src="data.js"></script><script>console.log(window.CEQT);</script>' > /tmp/test_data.html
```

Open `/tmp/test_data.html` in browser, check console:
- Expected: `window.CEQT` object exists with all exported functions
- Call `CEQT.switchWorkspace('test')` → returns `true`
- Call `CEQT.initSampleData()` → 8 sample tasks loaded
- Call `CEQT.getActiveTasks()` → returns array of 7 tasks (1 completed)

---

### Task 3: Create `index.html` — HTML Shell

**Files:**
- Create: `index.html` (overwrite existing)

- [ ] **Step 1: Write the HTML structure**

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEQTSimple — 任务四象限</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <span style="font-weight:700;font-size:16px;">CEQTSimple</span>
      <div class="view-switcher" id="viewSwitcher">
        <button class="view-btn active" data-view="matrix">四象限</button>
        <button class="view-btn" data-view="list">列表</button>
        <button class="view-btn" data-view="profile">统计</button>
      </div>
    </div>
    <div class="header-right">
      <button class="theme-toggle" id="themeToggle" title="切换主题">🌙</button>
      <button class="workspace-badge" id="workspaceBadge" title="切换工作区">?</button>
    </div>
  </header>

  <!-- Workspace Entry Modal -->
  <div class="modal open" id="workspaceModal">
    <div class="modal-content">
      <div class="modal-header">选择工作区</div>
      <div class="form-group">
        <label for="workspaceName">工作区名称</label>
        <input type="text" id="workspaceName" placeholder="输入名称进入你的工作区" autofocus>
      </div>
      <div class="button-group">
        <button class="btn btn-primary" id="workspaceEnterBtn">进入</button>
      </div>
    </div>
  </div>

  <!-- Main Container -->
  <div class="container" id="mainContainer" style="display:none;">
    <!-- Search & Filter -->
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="搜索任务标题、描述、备注... (Ctrl+K)">
    </div>
    <div class="filter-chips" id="filterChips">
      <button class="filter-chip active" data-filter="all">全部</button>
      <button class="filter-chip" data-filter="work">工作</button>
      <button class="filter-chip" data-filter="personal">个人</button>
      <button class="filter-chip" data-filter="study">学习</button>
      <button class="filter-chip" data-filter="health">健康</button>
      <button class="filter-chip" data-filter="family">家庭</button>
      <button class="filter-chip" data-filter="other">其他</button>
      <button class="filter-chip" data-filter="completed">已完成</button>
    </div>

    <!-- Matrix View -->
    <div class="matrix-view active" id="matrixView">
      <div class="matrix" id="matrix">
        <div class="axis axis-x"></div>
        <div class="axis axis-y"></div>
        <div class="quadrant-label q1">重要不紧急</div>
        <div class="quadrant-label q2">重要紧急</div>
        <div class="quadrant-label q3">不重要不紧急</div>
        <div class="quadrant-label q4">不重要紧急</div>
        <button class="add-button" id="addButton">+</button>
        <div class="tooltip" id="tooltip"></div>
      </div>
    </div>

    <!-- List View -->
    <div class="list-view" id="listView">
      <table class="task-table">
        <thead>
          <tr>
            <th>状态</th>
            <th>标题</th>
            <th>分类</th>
            <th>重要</th>
            <th>紧急</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="taskTableBody"></tbody>
      </table>
      <div class="empty-state" id="listEmpty" style="display:none;">
        <div class="empty-icon">📋</div>
        <div class="empty-text">暂无匹配任务</div>
      </div>
    </div>

    <!-- Profile View -->
    <div class="profile-page" id="profileView">
      <div class="stats-grid" id="statsGrid"></div>
      <div class="chart-section">
        <div class="section-title">任务分类分布</div>
        <canvas id="categoryChart"></canvas>
      </div>
      <div class="chart-section">
        <div class="section-title">新建任务</div>
        <div id="createdTimeline"></div>
      </div>
      <div class="chart-section">
        <div class="section-title">已完成</div>
        <div id="completedTimeline"></div>
      </div>
    </div>
  </div>

  <!-- Task Modal -->
  <div class="modal" id="taskModal">
    <div class="modal-content">
      <div class="modal-header" id="taskModalTitle">添加新任务</div>
      <div class="form-group">
        <label for="taskTitle">任务标题 *</label>
        <input type="text" id="taskTitle" required>
      </div>
      <div class="form-group">
        <label for="taskDesc">任务描述</label>
        <textarea id="taskDesc" placeholder="详细描述您的任务..."></textarea>
      </div>
      <div class="form-group">
        <label for="taskCategory">任务分类</label>
        <select id="taskCategory">
          <option value="work">工作</option>
          <option value="personal">个人</option>
          <option value="study">学习</option>
          <option value="health">健康</option>
          <option value="family">家庭</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div class="form-group">
        <label for="taskNotes">备注</label>
        <textarea id="taskNotes" placeholder="添加备注..."></textarea>
      </div>
      <div class="form-group">
        <label>重要程度 <span class="slider-display" id="importanceDisplay">4星</span></label>
        <input type="range" id="importanceSlider" min="1" max="7" value="4">
      </div>
      <div class="form-group">
        <label>紧急程度 <span class="slider-display" id="urgencyDisplay">1天</span></label>
        <select id="urgencySelect">
          <option value="0">1年</option><option value="1">半年</option><option value="2">3个月</option>
          <option value="3">1个月</option><option value="4">1周</option><option value="5">3天</option>
          <option value="6" selected>1天</option><option value="7">10小时</option>
          <option value="8">4小时</option><option value="9">2小时</option><option value="10">1小时</option>
          <option value="11">30分钟</option><option value="12">15分钟</option>
        </select>
      </div>
      <div class="form-group">
        <label>子任务</label>
        <ul class="subtask-list" id="subtaskList"></ul>
        <div class="subtask-add-row">
          <input type="text" id="subtaskInput" placeholder="添加子任务...">
          <button class="btn btn-secondary" id="subtaskAddBtn">+</button>
        </div>
      </div>
      <div class="form-group">
        <label for="reminderTime">提醒时间</label>
        <input type="datetime-local" id="reminderTime">
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" id="taskCancelBtn">取消</button>
        <button class="btn btn-primary" id="taskSaveBtn">保存</button>
      </div>
    </div>
  </div>

  <!-- Context Menu -->
  <div class="context-menu" id="contextMenu">
    <div class="context-menu-item" data-action="edit">✏️ 编辑</div>
    <div class="context-menu-item" data-action="complete">✅ 完成</div>
    <div class="context-menu-item" data-action="delete">🗑️ 删除</div>
  </div>

  <!-- Help Overlay -->
  <div class="help-overlay" id="helpOverlay">
    <div class="help-panel">
      <h3>键盘快捷键</h3>
      <div class="help-shortcuts">
        <kbd>Esc</kbd><span class="shortcut-desc">关闭弹窗</span>
        <kbd>Ctrl+N</kbd><span class="shortcut-desc">新建任务</span>
        <kbd>Ctrl+K</kbd><span class="shortcut-desc">搜索</span>
        <kbd>Ctrl+F</kbd><span class="shortcut-desc">筛选</span>
        <kbd>1</kbd><span class="shortcut-desc">四象限视图</span>
        <kbd>2</kbd><span class="shortcut-desc">列表视图</span>
        <kbd>3</kbd><span class="shortcut-desc">统计视图</span>
        <kbd>?</kbd><span class="shortcut-desc">显示此帮助</span>
      </div>
      <div class="button-group" style="margin-top:20px;">
        <button class="btn btn-secondary" id="helpCloseBtn">关闭</button>
      </div>
    </div>
  </div>

  <!-- Scripts (dependency order) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="data.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify index.html**

Open `index.html` in browser:
- Expected: dark background, header visible, workspace modal open
- CSS from `styles.css` should apply (dark theme)
- DevTools console: `window.CEQT` available
- No 404 errors for `data.js` or `app.js` (app.js doesn't exist yet — expect 404, which is fine for now)

---

### Task 4: Port Workspace Entry Flow

**Files:**
- Create: `app.js` (start)

- [ ] **Step 1: Write workspace entry handler**

```js
// app.js — UI logic
// Loaded AFTER data.js. Depends on window.CEQT.

(function() {
  'use strict';

  const C = window.CEQT;

  // === Constants ===
  const URGENCY_LABELS = ['1年', '半年', '3个月', '1个月', '1周', '3天', '1天', '10小时', '4小时', '2小时', '1小时', '30分钟', '15分钟'];
  const IMPORTANCE_LABELS = ['1星', '2星', '3星', '4星', '5星', '6星', '7星'];
  const CATEGORY_NAMES = { work: '工作', personal: '个人', study: '学习', health: '健康', family: '家庭', other: '其他' };
  const CATEGORIES = ['work', 'personal', 'study', 'health', 'family', 'other'];
  const PRIORITY_COLORS = ['#6c8cff', '#5a7de8', '#4a6dd4', '#5ca0d4', '#d4a05c', '#e87d5a', '#ff6b6b'];

  // === DOM Refs ===
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    workspaceModal: $('#workspaceModal'),
    workspaceName: $('#workspaceName'),
    workspaceEnterBtn: $('#workspaceEnterBtn'),
    workspaceBadge: $('#workspaceBadge'),
    mainContainer: $('#mainContainer'),
    themeToggle: $('#themeToggle'),
    matrix: $('#matrix'),
    addButton: $('#addButton'),
    tooltip: $('#tooltip'),
    taskModal: $('#taskModal'),
    taskModalTitle: $('#taskModalTitle'),
    contextMenu: $('#contextMenu'),
    helpOverlay: $('#helpOverlay'),
    searchInput: $('#searchInput'),
    filterChips: $('#filterChips'),
    matrixView: $('#matrixView'),
    listView: $('#listView'),
    profileView: $('#profileView'),
    viewSwitcher: $('#viewSwitcher'),
    taskTableBody: $('#taskTableBody'),
    listEmpty: $('#listEmpty'),
    statsGrid: $('#statsGrid'),
    createdTimeline: $('#createdTimeline'),
    completedTimeline: $('#completedTimeline'),
  };

  let isDragging = false;
  let dragTaskId = null;
  let editingTaskId = null;
  let contextTaskId = null;
  let tempSubtasks = [];
  let categoryChart = null;

  // === Workspace Entry ===
  function initWorkspace() {
    const saved = localStorage.getItem('currentWorkspace') || localStorage.getItem('currentUser');
    if (saved && C.switchWorkspace(saved)) {
      showApp();
      return;
    }
    dom.workspaceModal.classList.add('open');
    dom.workspaceName.focus();
  }

  dom.workspaceEnterBtn.addEventListener('click', enterWorkspace);
  dom.workspaceName.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') enterWorkspace();
  });

  function enterWorkspace() {
    const name = dom.workspaceName.value.trim();
    if (!name) return;
    if (C.switchWorkspace(name)) {
      dom.workspaceModal.classList.remove('open');
      showApp();
    }
  }

  function showApp() {
    dom.mainContainer.style.display = 'block';
    dom.workspaceBadge.textContent = C.state.currentWorkspace.charAt(0).toUpperCase();
    C.initSampleData();
    C.applyTheme();
    updateThemeIcon();
    initMatrix();
    renderTasks();
    setupEventListeners();
    updateViewVisibility();
  }

  dom.workspaceBadge.addEventListener('click', function() {
    dom.workspaceModal.classList.add('open');
    dom.workspaceName.value = '';
    dom.workspaceName.focus();
  });
```

- [ ] **Step 2: Write theme toggle**

```js
  function updateThemeIcon() {
    dom.themeToggle.textContent = C.state.darkMode ? '🌙' : '☀️';
  }

  dom.themeToggle.addEventListener('click', function() {
    C.toggleTheme();
    updateThemeIcon();
    renderTasks();
  });
```

- [ ] **Step 3: Write state-changed listener**

```js
  window.addEventListener('state-changed', function() {
    updateThemeIcon();
    updateViewVisibility();
  });
```

- [ ] **Step 4: Verify workspace entry**

Open `index.html` in browser:
- Expected: Workspace modal open (dark background, glass effect)
- Type "张三" → click "进入" → modal closes, main UI appears
- Workspace badge shows "张"
- Click workspace badge → modal reopens
- Console: `CEQT.state.currentWorkspace === '张三'`, 8 sample tasks loaded

---

### Task 5: Rebuild Matrix Rendering

**Files:**
- Modify: `app.js` (append to existing)

- [ ] **Step 1: Write matrix initialization with grid lines and labels**

```js
  function initMatrix() {
    const m = dom.matrix;
    // Clear existing grid lines/labels (keep structural elements)
    m.querySelectorAll('.grid-line, .label').forEach(el => el.remove());

    const width = m.offsetWidth;
    const height = m.offsetHeight;
    const cellWidthPct = 100 / 12;
    const cellHeightPct = 100 / 6;

    // Vertical grid lines (13 lines, urgency 0-12)
    for (let i = 0; i <= 12; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line vertical';
      line.style.left = `calc(50% + ${(i - 6) * cellWidthPct}%)`;
      m.appendChild(line);

      // Urgency label at bottom
      if (i < URGENCY_LABELS.length) {
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = URGENCY_LABELS[i];
        label.style.left = `calc(50% + ${(i - 6) * cellWidthPct * 0.875}% - 20px)`;
        label.style.bottom = '6px';
        label.style.opacity = 0.3 + (i / 12) * 0.7;
        m.appendChild(label);
      }
    }

    // Horizontal grid lines (7 lines, importance 1-7)
    for (let i = 0; i <= 6; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line horizontal';
      line.style.top = `calc(50% + ${(3 - i) * cellHeightPct}%)`;
      m.appendChild(line);

      // Importance label at left
      if (i < IMPORTANCE_LABELS.length) {
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = IMPORTANCE_LABELS[i];
        label.style.left = '8px';
        label.style.top = `calc(50% + ${(3 - i) * cellHeightPct * 0.83}% - 8px)`;
        label.style.color = PRIORITY_COLORS[i];
        label.style.fontWeight = '700';
        m.appendChild(label);
      }
    }
  }
```

- [ ] **Step 2: Write coordinate conversion functions**

```js
  function coordToPos(urgency, importance) {
    const m = dom.matrix;
    const cellW = m.offsetWidth / 12;
    const cellH = m.offsetHeight / 6;
    return {
      x: cellW / 2 + urgency * cellW,
      y: cellH / 2 + (7 - importance) * cellH,
    };
  }

  function posToCoord(x, y) {
    const m = dom.matrix;
    const cellW = m.offsetWidth / 12;
    const cellH = m.offsetHeight / 6;
    const adjX = x - cellW / 2;
    const adjY = y - cellH / 2;
    let urgency = Math.round(adjX / cellW);
    let importance = 7 - Math.round(adjY / cellH);
    urgency = Math.max(0, Math.min(12, urgency));
    importance = Math.max(1, Math.min(7, importance));
    return { urgency, importance };
  }
```

- [ ] **Step 3: Write task rendering on the matrix**

```js
  function getTaskColor(importance, urgency) {
    const base = PRIORITY_COLORS[importance - 1];
    const opacity = Math.floor((0.4 + (urgency / 12) * 0.6) * 255).toString(16).padStart(2, '0');
    return base + opacity;
  }

  function getProgress(task) {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const done = task.subtasks.filter(s => s.done).length;
    return done / task.subtasks.length;
  }

  function renderTasks() {
    const m = dom.matrix;
    // Remove existing task dots
    m.querySelectorAll('.task-dot').forEach(el => el.remove());

    const tasks = C.getActiveTasks();
    tasks.forEach(task => {
      const dot = document.createElement('div');
      dot.className = 'task-dot';
      dot.dataset.taskId = task.id;
      const pos = coordToPos(task.urgency, task.importance);
      dot.style.left = (pos.x - 16) + 'px';
      dot.style.top = (pos.y - 16) + 'px';
      dot.style.backgroundColor = getTaskColor(task.importance, task.urgency);
      dot.style.boxShadow = `0 2px 12px ${getTaskColor(task.importance, task.urgency)}`;
      dot.textContent = task.title.charAt(0);

      // Progress ring
      const progress = getProgress(task);
      if (progress > 0) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'progress-ring');
        svg.setAttribute('viewBox', '0 0 40 40');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const r = 17, circ = 2 * Math.PI * r;
        circle.setAttribute('cx', '20');
        circle.setAttribute('cy', '20');
        circle.setAttribute('r', r.toString());
        circle.setAttribute('stroke-dasharray', circ.toString());
        circle.setAttribute('stroke-dashoffset', (circ * (1 - progress)).toString());
        svg.appendChild(circle);
        dot.appendChild(svg);
      }

      // Tooltip on hover
      dot.addEventListener('mouseenter', function(e) {
        const info = `${task.title}\n重要: ${task.importance}星 | 紧急: ${URGENCY_LABELS[task.urgency]}\n分类: ${CATEGORY_NAMES[task.category] || '其他'}`;
        dom.tooltip.textContent = info;
        dom.tooltip.classList.add('visible');
        const rect = dot.getBoundingClientRect();
        const mRect = m.getBoundingClientRect();
        dom.tooltip.style.left = (rect.left - mRect.left + 16) + 'px';
        dom.tooltip.style.top = (rect.top - mRect.top - 8) + 'px';
      });

      dot.addEventListener('mouseleave', function() {
        dom.tooltip.classList.remove('visible');
      });

      // Context menu
      dot.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        contextTaskId = task.id;
        dom.contextMenu.classList.add('open');
        dom.contextMenu.style.left = e.pageX + 'px';
        dom.contextMenu.style.top = e.pageY + 'px';
      });

      // Drag
      dot.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        isDragging = true;
        dragTaskId = task.id;
        dot.classList.add('dragging');
        const moveHandler = function(ev) {
          if (!isDragging) return;
          const r = m.getBoundingClientRect();
          dot.style.left = (ev.clientX - r.left - 16) + 'px';
          dot.style.top = (ev.clientY - r.top - 16) + 'px';
        };
        const upHandler = function(ev) {
          if (!isDragging) return;
          isDragging = false;
          dragTaskId = null;
          dot.classList.remove('dragging');
          const r = m.getBoundingClientRect();
          const coords = posToCoord(ev.clientX - r.left, ev.clientY - r.top);
          C.updateTask(task.id, { urgency: coords.urgency, importance: coords.importance });
          renderTasks();
          document.removeEventListener('mousemove', moveHandler);
          document.removeEventListener('mouseup', upHandler);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
      });

      m.appendChild(dot);
    });
  }
```

- [ ] **Step 4: Write add button behavior on matrix hover**

```js
  dom.matrix.addEventListener('mousemove', function(e) {
    if (isDragging) return;
    const rect = dom.matrix.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const btn = dom.addButton;
    btn.style.left = (x - 20) + 'px';
    btn.style.top = (y - 20) + 'px';
    btn.classList.add('visible');
    btn.dataset.coordX = x;
    btn.dataset.coordY = y;
  });

  dom.matrix.addEventListener('mouseleave', function() {
    if (!isDragging) {
      dom.addButton.classList.remove('visible');
      dom.tooltip.classList.remove('visible');
    }
  });

  dom.addButton.addEventListener('click', function() {
    const x = parseFloat(dom.addButton.dataset.coordX);
    const y = parseFloat(dom.addButton.dataset.coordY);
    const coords = posToCoord(x, y);
    openTaskModal(null, coords);
  });
```

- [ ] **Step 5: Verify matrix rendering**

Open `index.html`, enter workspace:
- Expected: Matrix renders with grid lines, labels, axis lines
- Task dots visible at sample data positions
- Hovering a dot shows tooltip
- Add button follows mouse on the matrix
- Click add button → task modal opens at that position

---

### Task 6: Port Task CRUD Modals, Context Menu, and Keyboard Basics

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Write task modal open/close and save logic**

```js
  function openTaskModal(taskId, coords) {
    const task = taskId ? C.state.tasks.find(t => t.id === taskId) : null;
    editingTaskId = taskId;
    tempSubtasks = task ? JSON.parse(JSON.stringify(task.subtasks || [])) : [];

    dom.taskModalTitle.textContent = task ? '编辑任务' : '添加新任务';
    $('#taskTitle').value = task ? task.title : '';
    $('#taskDesc').value = task ? (task.description || '') : '';
    $('#taskCategory').value = task ? task.category : 'other';
    $('#taskNotes').value = task ? (task.notes || '') : '';
    $('#importanceSlider').value = task ? task.importance : (coords ? coords.importance : 4);
    $('#urgencySelect').value = task ? task.urgency : (coords ? coords.urgency : 6);
    $('#reminderTime').value = task && task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : '';
    updateImportanceDisplay();
    updateUrgencyDisplay();
    renderSubtasksInModal();

    dom.taskModal.classList.add('open');
    $('#taskTitle').focus();
  }

  function closeTaskModal() {
    dom.taskModal.classList.remove('open');
    editingTaskId = null;
    tempSubtasks = [];
  }

  $('#taskCancelBtn').addEventListener('click', closeTaskModal);

  $('#taskSaveBtn').addEventListener('click', function() {
    const title = $('#taskTitle').value.trim();
    if (!title) { alert('请输入任务标题'); return; }

    const data = {
      title: title,
      description: $('#taskDesc').value.trim(),
      category: $('#taskCategory').value,
      notes: $('#taskNotes').value.trim(),
      importance: parseInt($('#importanceSlider').value),
      urgency: parseInt($('#urgencySelect').value),
      subtasks: tempSubtasks.map((s, i) => ({ ...s, order: i })),
    };

    const reminderVal = $('#reminderTime').value;
    if (reminderVal) {
      data.reminderAt = new Date(reminderVal).toISOString();
    } else {
      data.reminderAt = null;
    }

    if (editingTaskId) {
      C.updateTask(editingTaskId, data);
    } else {
      C.addTask(data);
    }

    closeTaskModal();
    renderTasks();
    renderListView();
    if (C.state.activeView === 'profile') renderProfile();
  });
```

- [ ] **Step 2: Write importance/urgency display updaters**

```js
  function updateImportanceDisplay() {
    const v = parseInt($('#importanceSlider').value);
    $('#importanceDisplay').textContent = v + '星';
    $('#importanceDisplay').style.color = PRIORITY_COLORS[v - 1];
  }

  function updateUrgencyDisplay() {
    const v = parseInt($('#urgencySelect').value);
    $('#urgencyDisplay').textContent = URGENCY_LABELS[v];
  }

  $('#importanceSlider').addEventListener('input', updateImportanceDisplay);
  $('#urgencySelect').addEventListener('change', updateUrgencyDisplay);
```

- [ ] **Step 3: Write subtask management in modal**

```js
  function renderSubtasksInModal() {
    const list = $('#subtaskList');
    list.innerHTML = '';
    tempSubtasks.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'subtask-item';
      li.innerHTML = `
        <input type="checkbox" ${s.done ? 'checked' : ''} data-idx="${i}">
        <span class="subtask-text ${s.done ? 'done' : ''}">${escapeHtml(s.text)}</span>
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;" data-idx="${i}" data-action="remove">×</button>
      `;
      list.appendChild(li);
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function() {
        const idx = parseInt(this.dataset.idx);
        tempSubtasks[idx].done = this.checked;
        renderSubtasksInModal();
      });
    });

    list.querySelectorAll('button[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', function() {
        const idx = parseInt(this.dataset.idx);
        tempSubtasks.splice(idx, 1);
        renderSubtasksInModal();
      });
    });
  }

  $('#subtaskAddBtn').addEventListener('click', function() {
    const text = $('#subtaskInput').value.trim();
    if (!text) return;
    tempSubtasks.push({ id: 'st_' + Date.now(), text: text, done: false, order: tempSubtasks.length });
    $('#subtaskInput').value = '';
    renderSubtasksInModal();
  });

  $('#subtaskInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#subtaskAddBtn').click();
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
```

- [ ] **Step 4: Write context menu and keyboard basics**

```js
  // Context menu actions
  dom.contextMenu.querySelector('[data-action="edit"]').addEventListener('click', function() {
    dom.contextMenu.classList.remove('open');
    if (contextTaskId) openTaskModal(contextTaskId);
  });

  dom.contextMenu.querySelector('[data-action="complete"]').addEventListener('click', function() {
    dom.contextMenu.classList.remove('open');
    if (contextTaskId) {
      C.completeTask(contextTaskId);
      renderTasks();
      renderListView();
    }
  });

  dom.contextMenu.querySelector('[data-action="delete"]').addEventListener('click', function() {
    dom.contextMenu.classList.remove('open');
    if (contextTaskId && confirm('确定要删除这个任务吗？')) {
      C.deleteTask(contextTaskId);
      renderTasks();
      renderListView();
    }
  });

  // Close context menu on outside click
  document.addEventListener('click', function(e) {
    if (!dom.contextMenu.contains(e.target)) {
      dom.contextMenu.classList.remove('open');
    }
  });
```

- [ ] **Step 5: Write keyboard shortcuts (Esc, Ctrl+N, Ctrl+K, Ctrl+F, 1/2/3, ?)**

```js
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Esc - close modals
      if (e.key === 'Escape') {
        closeTaskModal();
        dom.contextMenu.classList.remove('open');
        dom.helpOverlay.classList.remove('open');
        return;
      }

      // Ctrl+N - new task at center
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const rect = dom.matrix.getBoundingClientRect();
        const coords = posToCoord(rect.width / 2, rect.height / 2);
        openTaskModal(null, coords);
        return;
      }

      // Ctrl+K - focus search
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        dom.searchInput.focus();
        return;
      }

      // Ctrl+F - toggle filter panel (focus first filter chip)
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const firstChip = dom.filterChips.querySelector('.filter-chip');
        if (firstChip) firstChip.focus();
        return;
      }

      // 1/2/3 - view switching
      if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
        C.setView('matrix');
        updateViewVisibility();
        renderTasks();
        return;
      }
      if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
        C.setView('list');
        updateViewVisibility();
        renderListView();
        return;
      }
      if (e.key === '3' && !e.ctrlKey && !e.metaKey) {
        C.setView('profile');
        updateViewVisibility();
        renderProfile();
        return;
      }

      // ? - help overlay
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        dom.helpOverlay.classList.toggle('open');
        return;
      }
    });

    $('#helpCloseBtn').addEventListener('click', function() {
      dom.helpOverlay.classList.remove('open');
    });
  }
```

- [ ] **Step 6: Verify task CRUD**

Open `index.html`, enter workspace:
- Click add button on matrix → modal opens at coordinates, fills importance/urgency
- Fill form, save → task dot appears on matrix
- Right-click task dot → context menu with edit/complete/delete
- Edit → modal pre-filled with task data
- Complete → task disappears from matrix
- Delete with confirm → task removed

---

### Task 7: Add Search, Filter, and List View

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Write search handler**

```js
  dom.searchInput.addEventListener('input', function() {
    C.setFilter('search', this.value);
    renderTasks();
    renderListView();
  });
```

- [ ] **Step 2: Write filter chips handler**

```js
  dom.filterChips.addEventListener('click', function(e) {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const filter = chip.dataset.filter;

    // Toggle active state
    dom.filterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    if (filter === 'all') {
      C.setFilter('category', null);
      C.setFilter('showCompleted', false);
    } else if (filter === 'completed') {
      C.setFilter('category', null);
      C.setFilter('showCompleted', true);
    } else {
      C.setFilter('category', filter);
      C.setFilter('showCompleted', false);
    }

    renderTasks();
    renderListView();
  });
```

- [ ] **Step 3: Write list view rendering**

```js
  function renderListView() {
    const tbody = dom.taskTableBody;
    const tasks = C.getFilteredTasks();
    tbody.innerHTML = '';

    if (tasks.length === 0) {
      dom.listEmpty.style.display = 'block';
      return;
    }
    dom.listEmpty.style.display = 'none';

    tasks.forEach(task => {
      const tr = document.createElement('tr');
      tr.className = 'task-row' + (task.completed ? ' completed' : '');
      const statusIcon = task.completed ? '✅' : '○';
      tr.innerHTML = `
        <td>${statusIcon}</td>
        <td style="font-weight:600;cursor:pointer;" data-action="edit" data-id="${task.id}">${escapeHtml(task.title)}</td>
        <td>${CATEGORY_NAMES[task.category] || '其他'}</td>
        <td>${'⭐'.repeat(task.importance)}</td>
        <td>${URGENCY_LABELS[task.urgency]}</td>
        <td>
          ${!task.completed ? `<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" data-action="complete" data-id="${task.id}">完成</button>` : ''}
          <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" data-action="edit" data-id="${task.id}">编辑</button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;" data-action="delete" data-id="${task.id}">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Row action handlers
    tbody.querySelectorAll('[data-action="edit"]').forEach(el => {
      el.addEventListener('click', function() { openTaskModal(this.dataset.id); });
    });
    tbody.querySelectorAll('[data-action="complete"]').forEach(el => {
      el.addEventListener('click', function() {
        C.completeTask(this.dataset.id);
        renderTasks();
        renderListView();
      });
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener('click', function() {
        if (confirm('确定要删除这个任务吗？')) {
          C.deleteTask(this.dataset.id);
          renderTasks();
          renderListView();
        }
      });
    });
  }
```

- [ ] **Step 4: Write view switcher**

```js
  function updateViewVisibility() {
    const v = C.state.activeView;
    dom.matrixView.style.display = v === 'matrix' ? 'block' : 'none';
    dom.listView.classList.toggle('active', v === 'list');
    dom.profileView.classList.toggle('active', v === 'profile');

    dom.viewSwitcher.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === v);
    });

    if (v === 'list') renderListView();
    if (v === 'profile') renderProfile();
    if (v === 'matrix') renderTasks();
  }

  dom.viewSwitcher.addEventListener('click', function(e) {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    C.setView(btn.dataset.view);
  });
```

- [ ] **Step 5: Verify search, filter, and list view**

Open `index.html`, enter workspace:
- Type in search → tasks filter in real-time on matrix AND list
- Click "工作" filter chip → only work tasks shown
- Click "已完成" → only completed tasks in list view
- Click "全部" → all tasks restored
- Switch to list view (click "列表" or press `2`) → table with all tasks
- Complete/delete from list view works
- Back to matrix view (`1`) → task dots updated

---

### Task 8: Add Reminder System

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Write reminder check and notification logic**

```js
  let reminderInterval = null;

  function startReminderCheck() {
    if (reminderInterval) clearInterval(reminderInterval);

    reminderInterval = setInterval(checkReminders, 30000);
    // Also check on visibility change (catch up after tab was backgrounded)
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) checkReminders();
    });
  }

  function checkReminders() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    C.state.tasks.forEach(task => {
      if (task.completed || !task.reminderAt) return;
      const reminderTime = new Date(task.reminderAt).getTime();
      if (reminderTime <= now && reminderTime > now - 60000) {
        // Only fire once within the check window
        new Notification('任务提醒', {
          body: task.title + ' — ' + (task.description || ''),
          icon: 'favicon.ico',
          tag: task.id, // prevents duplicate notifications for same task
        });
      }
    });
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
```

- [ ] **Step 2: Wire reminder system into init**

Add these calls at the end of `showApp()`:

```js
  // Inside showApp(), after renderTasks():
  requestNotificationPermission();
  startReminderCheck();
```

- [ ] **Step 3: Verify reminders**

Open `index.html`, enter workspace with sample data:
- Expected: Browser prompts for notification permission (sample task #8 has a reminder 1 day from now)
- Grant permission → no immediate notification (reminder is future)
- For testing: change task #8's reminderAt to 1 minute ago in localStorage, reload
- Expected: notification fires within 30 seconds

---

### Task 9: Add Profile Page with Stats, Chart, and Timelines

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Write stats grid rendering**

```js
  function renderProfile() {
    renderStats();
    renderCategoryChart();
    renderTimeline('created');
    renderTimeline('completed');
  }

  function renderStats() {
    const total = C.state.tasks.length;
    const completed = C.getCompletedTasks().length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    dom.statsGrid.innerHTML = `
      <div class="stat-card"><div class="stat-label">总任务数</div><div class="stat-value">${total}</div></div>
      <div class="stat-card completed"><div class="stat-label">已完成</div><div class="stat-value">${completed}</div></div>
      <div class="stat-card pending"><div class="stat-label">进行中</div><div class="stat-value">${pending}</div></div>
      <div class="stat-card"><div class="stat-label">完成率</div><div class="stat-value">${rate}%</div></div>
    `;
  }
```

- [ ] **Step 2: Write Chart.js category pie chart**

```js
  function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    const ctx2d = ctx.getContext('2d');

    if (categoryChart) categoryChart.destroy();

    const counts = {};
    CATEGORIES.forEach(cat => { counts[cat] = 0; });
    C.state.tasks.forEach(t => { if (counts[t.category] !== undefined) counts[t.category]++; });

    // Use dark-mode compatible colors
    const chartColors = ['#ff6b6b', '#4ecdc4', '#ffd166', '#6c8cff', '#ffb74d', '#8888a0'];

    categoryChart = new Chart(ctx2d, {
      type: 'pie',
      data: {
        labels: CATEGORIES.map(c => CATEGORY_NAMES[c]),
        datasets: [{
          data: CATEGORIES.map(c => counts[c]),
          backgroundColor: chartColors,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim(),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(), padding: 15, font: { size: 12 } },
          },
          title: { display: false },
        },
      },
    });
  }
```

- [ ] **Step 3: Write timeline rendering**

```js
  function renderTimeline(type) {
    const container = type === 'created' ? dom.createdTimeline : dom.completedTimeline;
    const tasks = (type === 'created'
      ? C.state.tasks.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : C.getCompletedTasks().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    );

    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-text">' + (type === 'created' ? '暂无创建的任务' : '暂无完成的任务') + '</div></div>';
      return;
    }

    const dateField = type === 'created' ? 'createdAt' : 'completedAt';
    container.innerHTML = tasks.map(task => {
      const color = getTaskColor(task.importance, task.urgency);
      return `
        <div class="timeline-item">
          <div class="timeline-badge" style="background:${color}">${task.title.charAt(0)}</div>
          <div class="timeline-date">${formatDate(task[dateField])}</div>
          <div class="timeline-content">
            <div class="timeline-title">${escapeHtml(task.title)}</div>
            <div class="timeline-tags">
              <span class="tag">${CATEGORY_NAMES[task.category]}</span>
              <span class="tag">${task.importance}星</span>
              <span class="tag">${URGENCY_LABELS[task.urgency]}</span>
              ${task.completed ? '<span class="tag" style="background:#34c759;color:white;">已完成</span>' : '<span class="tag" style="background:#ff9f0a;color:white;">进行中</span>'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return '昨天';
    if (diffDays <= 7) return diffDays + '天前';
    return date.toLocaleDateString('zh-CN');
  }
```

- [ ] **Step 4: Verify profile page**

Open `index.html`, enter workspace, press `3`:
- Expected: Stats cards show numbers
- Pie chart renders with category distribution
- "新建任务" timeline shows 8 sample tasks
- "已完成" timeline shows the 1 completed task (学习新技能)
- Press `1` → back to matrix
- Press `2` → list view

---

### Task 10: Wire Resize Handler and Final Polish

**Files:**
- Modify: `app.js` (append)

- [ ] **Step 1: Write resize handler**

```js
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      initMatrix();
      renderTasks();
      if (categoryChart) categoryChart.resize();
    }, 100);
  });
```

- [ ] **Step 2: Write setupEventListeners()**

```js
  function setupEventListeners() {
    // All event listeners are already wired via their respective sections above.
    // This function exists as an explicit call point for clarity.
    setupKeyboardShortcuts();
  }
```

- [ ] **Step 3: Close the IIFE**

```js
})(); // end of app.js IIFE
```

- [ ] **Step 4: Verify full app**

Open `index.html` in browser and run through all features:
1. Workspace entry (type name, enter)
2. Matrix: dots visible, drag works, right-click menu works
3. Add task via add button (+)
4. Edit task via right-click → edit
5. Complete task via right-click → complete (disappears from matrix, appears in completed list)
6. Delete task
7. Search: type text → filter matrix and list
8. Filter chips: click categories → filter
9. List view (`2`): table with all tasks, inline actions
10. Profile view (`3`): stats, chart, timelines
11. Dark/light toggle (🌙/☀️ button)
12. Keyboard shortcuts: Esc, Ctrl+N, Ctrl+K, 1/2/3, ?
13. Resize window → matrix redraws
14. Reminders: Notification API permission prompt

---

### Task 11: Remove Old index.html and Commit Final

**Files:**
- Modify: `index.html` (already overwritten in Task 3)
- Verify: `styles.css`, `app.js`, `data.js` all exist

- [ ] **Step 1: Commit all new files**

```bash
git add index.html styles.css app.js data.js CONTEXT.md AGENTS.md
git status
git commit -m "feat: complete redesign of CEQTSimple - dark theme, search, subtasks, notes, reminders, multiple views"
```

- [ ] **Step 2: Verify git status clean**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

---

## Self-Review (Plan Quality Check)

| Check | Status |
|---|---|
| Spec coverage | ✅ Each feature maps to a task: workspace (T4), matrix (T5), CRUD modals (T6), search/filter (T7), list view (T7), subtasks (T6 step 3), notes (T6 step 1), reminders (T8), keyboard (T6 step 5), profile (T9), dark/light (T4 step 2), resize (T10) |
| No placeholders | ✅ All steps have concrete code, no TBD/TODO |
| Type consistency | ✅ `task.subtasks` uses `{id, text, done, order}` in both data.js (sample data) and app.js (modal save). `window.CEQT` namespace consistent. |
| File paths | ✅ All paths are exact and relative to repo root |
