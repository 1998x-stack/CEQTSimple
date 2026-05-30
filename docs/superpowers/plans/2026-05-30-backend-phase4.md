# CEQTSimple Backend System — Implementation Plan (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended).

**Goal:** Rewrite frontend to use backend API: Login/Register modal, API client layer in data.js, offline fallback, localStorage migration. Depends on Phase 3 (task API running).

---

### Task 1: Add Auth Modal to index.html

**Files:**
- Modify: `index.html` — replace `#workspaceModal` with `#authModal`

- [ ] **Step 1: Replace workspace modal with auth modal**

Find the `<!-- Workspace Entry Modal -->` section in `index.html` and replace it with:

```html
  <!-- Auth Modal (Login / Register) -->
  <div class="modal open" id="authModal">
    <div class="modal-content">
      <div class="view-switcher" id="authTabs" style="margin-bottom:20px;">
        <button class="view-btn active" data-tab="login">登录</button>
        <button class="view-btn" data-tab="register">注册</button>
      </div>
      <div id="loginForm">
        <div class="form-group">
          <label for="loginEmail">邮箱</label>
          <input type="email" id="loginEmail" placeholder="user@example.com" autofocus>
        </div>
        <div class="form-group">
          <label for="loginPassword">密码</label>
          <input type="password" id="loginPassword" placeholder="输入密码">
        </div>
        <div class="form-group" id="loginError" style="color:var(--accent-warm);font-size:13px;display:none;"></div>
        <div class="button-group">
          <button class="btn btn-primary" id="loginBtn">登录</button>
        </div>
      </div>
      <div id="registerForm" style="display:none;">
        <div class="form-group">
          <label for="registerEmail">邮箱</label>
          <input type="email" id="registerEmail" placeholder="user@example.com">
        </div>
        <div class="form-group">
          <label for="registerPassword">密码 (≥6位)</label>
          <input type="password" id="registerPassword" placeholder="输入密码">
        </div>
        <div class="form-group" id="registerError" style="color:var(--accent-warm);font-size:13px;display:none;"></div>
        <div class="button-group">
          <button class="btn btn-primary" id="registerBtn">注册</button>
        </div>
      </div>
    </div>
  </div>
```

Replace `#workspaceBadge` in the header with:

```html
<button class="workspace-badge" id="userBadge" title="用户">?</button>
```

- [ ] **Step 2: Verify HTML changes**

Open `index.html` in browser — expected: auth modal shows with Login/Register tabs. No workspace selector.

---

### Task 2: Rewrite data.js — API Client with Offline Fallback

**Files:**
- Modify: `data.js` — replace localStorage CRUD with API calls + offline fallback

- [ ] **Step 1: Rewrite data.js**

Replace the entire content of `data.js` with:

```js
// data.js — API client + localStorage fallback
// Attaches to window.CEQT. Load BEFORE app.js.

(function() {
  'use strict';

  const API_BASE = 'http://localhost:8000/api';
  let authToken = localStorage.getItem('ceqt_token');
  let userEmail = localStorage.getItem('ceqt_email') || '';

  // State (kept for offline fallback + UI reactivity)
  const state = {
    tasks: [],
    darkMode: true,
    activeView: 'matrix',
    userEmail: userEmail,
    filters: {
      search: '',
      category: null,
      importanceMin: null,
      importanceMax: null,
      showCompleted: false,
    },
  };

  // === API Helpers ===
  async function apiFetch(path, options = {}) {
    try {
      const res = await fetch(API_BASE + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          ...options.headers,
        },
      });
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem('ceqt_token');
        window.dispatchEvent(new CustomEvent('auth-expired'));
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        return fallbackLocalStorage(path, options);
      }
      throw e;
    }
  }

  function fallbackLocalStorage(path, options) {
    const body = options.body ? JSON.parse(options.body) : null;
    const idMatch = path.match(/\/api\/tasks\/([^/]+)(\/complete)?/);

    if (path === '/api/tasks' && (!options.method || options.method === 'GET'))
      return getFilteredTasks();
    if (path === '/api/tasks' && options.method === 'POST')
      return addTaskLocal(body);
    if (idMatch && (options.method === 'PUT'))
      return updateTaskLocal(idMatch[1], body);
    if (idMatch && (options.method === 'DELETE'))
      return deleteTaskLocal(idMatch[1]);
    if (idMatch && idMatch[2] === '/complete')
      return completeTaskLocal(idMatch[1]);
    if (path === '/api/tasks/refresh')
      return getActiveTasks();
    if (path === '/api/auth/me')
      return Promise.resolve({ user: { email: userEmail, id: 'offline' } });
    if (path === '/api/polish')
      throw new Error('润色功能需要服务器连接');
    throw new Error('Offline');
  }

  // === Task CRUD (API) ===
  async function loadTasks() {
    if (authToken) {
      try {
        state.tasks = await apiFetch('/api/tasks');
      } catch (e) {
        state.tasks = loadFromLocalStorage();
      }
    } else {
      state.tasks = loadFromLocalStorage();
    }
    dispatchChange();
  }

  async function addTask(taskData) {
    if (authToken) {
      const task = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
      state.tasks.push(task);
      dispatchChange();
      return task;
    }
    return addTaskLocal(taskData);
  }

  async function updateTask(id, updates) {
    if (authToken) {
      const task = await apiFetch(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const idx = state.tasks.findIndex(t => t.id === id);
      if (idx !== -1) state.tasks[idx] = task;
      dispatchChange();
      return task;
    }
    return updateTaskLocal(id, updates);
  }

  async function deleteTask(id) {
    if (authToken) {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    }
    state.tasks = state.tasks.filter(t => t.id !== id);
    dispatchChange();
  }

  async function completeTask(id) {
    if (authToken) {
      await apiFetch(`/api/tasks/${id}/complete`, { method: 'POST' });
    }
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      task.completed = true;
      task.completedAt = new Date().toISOString();
    }
    dispatchChange();
    return task;
  }

  // === Auth ===
  async function login(email, password) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authToken = res.token;
    userEmail = res.user.email;
    state.userEmail = userEmail;
    localStorage.setItem('ceqt_token', authToken);
    localStorage.setItem('ceqt_email', userEmail);
    migrateIfNeeded();
    await loadTasks();
    return res;
  }

  async function register(email, password) {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authToken = res.token;
    userEmail = res.user.email;
    state.userEmail = userEmail;
    localStorage.setItem('ceqt_token', authToken);
    localStorage.setItem('ceqt_email', userEmail);
    await loadTasks();
    return res;
  }

  async function checkAuth() {
    if (!authToken) return false;
    try {
      await apiFetch('/api/auth/me');
      return true;
    } catch {
      authToken = null;
      localStorage.removeItem('ceqt_token');
      return false;
    }
  }

  async function migrateIfNeeded() {
    // Scan ALL tasks_* localStorage keys
    const allTasks = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tasks_')) {
        try {
          const tasks = JSON.parse(localStorage.getItem(key));
          allTasks.push(...tasks);
        } catch (e) {}
      }
    }
    if (allTasks.length > 0) {
      try {
        await apiFetch('/api/tasks/migrate', {
          method: 'POST',
          body: JSON.stringify(allTasks),
        });
        // Clear migrated keys
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('tasks_') || key === 'currentUser' || key === 'currentWorkspace')) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('Migration failed:', e);
      }
    }
  }

  // === Local fallback CRUD ===
  function loadFromLocalStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tasks_')) keys.push(k);
    }
    if (keys.length > 0) {
      try { return JSON.parse(localStorage.getItem(keys[0])) || []; } catch { return []; }
    }
    return [];
  }

  function saveLocal() {
    if (userEmail) {
      localStorage.setItem('tasks_' + userEmail, JSON.stringify(state.tasks));
    }
  }

  function addTaskLocal(data) {
    const task = {
      id: Date.now().toString(),
      title: data.title, description: data.description || '',
      category: data.category || 'other',
      importance: data.importance || 5, urgency: data.urgency || 8,
      deadline: data.deadline || null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      completed: false, completedAt: null,
      subtasks: (data.subtasks || []).map((s, i) => ({ id: 's' + Date.now() + i, text: s.text, done: s.done || false, order: s.sort_order || i })),
      notes: data.notes || '', reminderAt: data.reminderAt || null,
    };
    state.tasks.push(task);
    saveLocal();
    dispatchChange();
    return task;
  }

  function updateTaskLocal(id, updates) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(state.tasks[idx], updates, { updatedAt: new Date().toISOString() });
    saveLocal();
    dispatchChange();
    return state.tasks[idx];
  }

  function deleteTaskLocal(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveLocal();
    dispatchChange();
  }

  function completeTaskLocal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) { task.completed = true; task.completedAt = new Date().toISOString(); }
    saveLocal();
    dispatchChange();
    return task;
  }

  // === Filters ===
  function getFilteredTasks() {
    return state.tasks.filter(t => {
      if (state.filters.search) {
        const q = state.filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description||'').toLowerCase().includes(q) && !(t.notes||'').toLowerCase().includes(q)) return false;
      }
      if (state.filters.category && t.category !== state.filters.category) return false;
      if (!state.filters.showCompleted && t.completed) return false;
      return true;
    });
  }

  function getActiveTasks() { return state.tasks.filter(t => !t.completed); }
  function getCompletedTasks() { return state.tasks.filter(t => t.completed); }

  function setView(view) { state.activeView = view; dispatchChange(); }
  function setFilter(key, value) { state.filters[key] = value; dispatchChange(); }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  }

  function toggleTheme() { state.darkMode = !state.darkMode; applyTheme(); dispatchChange(); }

  function dispatchChange() {
    window.dispatchEvent(new CustomEvent('state-changed', { detail: state }));
  }

  // Export
  window.CEQT = {
    state,
    login, register, checkAuth, loadTasks,
    addTask, updateTask, deleteTask, completeTask,
    toggleTheme, setView, setFilter,
    getFilteredTasks, getActiveTasks, getCompletedTasks,
    applyTheme,
  };
})();
```

- [ ] **Step 3: Verify data.js loads**

Open `index.html` in browser → DevTools console → `CEQT.state` should show the state object with `userEmail: ''`.

---

### Task 3: Update app.js — Auth Flow + Header Badge

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace workspace entry with auth init**

Replace `initWorkspace()` and `enterWorkspace()` with auth handlers:

```js
  // === Auth Init ===
  async function initAuth() {
    const authed = await C.checkAuth();
    if (authed) {
      showApp();
      return;
    }
    dom.authModal.classList.add('open');
  }

  // Replace dom references (workspace* → auth*)
  // dom.authModal instead of dom.workspaceModal
  // Add: dom.loginEmail/Password, dom.registerEmail/Password, etc.
```

- [ ] **Step 2: Update header badge**

```js
  // In showApp():
  dom.userBadge.textContent = (C.state.userEmail || '?').charAt(0).toUpperCase();
```

- [ ] **Step 3: Wire login/register buttons**

Add event listeners for `#loginBtn`, `#registerBtn`, and tab switching.

- [ ] **Step 4: Commit Phase 4**

```bash
git add index.html data.js app.js && git commit -m "feat(phase4): Frontend auth + API integration with offline fallback"
```
