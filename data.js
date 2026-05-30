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
    if (path === '/api/auth/login' || path === '/api/auth/register')
      return Promise.resolve({ token: 'offline', user: { email: userEmail || 'offline', id: 'offline' } });
    if (path === '/api/polish')
      throw new Error('润色功能需要服务器连接');
    throw new Error('Offline');
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
    return res;
  }

  async function checkAuth() {
    if (!authToken) return false;
    try {
      await apiFetch('/api/auth/me');
      await loadTasks();
      return true;
    } catch {
      authToken = null;
      localStorage.removeItem('ceqt_token');
      return false;
    }
  }

  async function loadTasks() {
    if (authToken) {
      try { state.tasks = await apiFetch('/api/tasks'); migrateIfNeeded(); }
      catch { state.tasks = []; }
    }
    dispatchChange();
  }

  async function migrateIfNeeded() {
    const allTasks = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tasks_')) {
        try { allTasks.push(...JSON.parse(localStorage.getItem(key))); } catch {}
      }
    }
    if (allTasks.length > 0) {
      try {
        await apiFetch('/api/tasks/migrate', { method: 'POST', body: JSON.stringify(allTasks) });
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('tasks_') || key === 'currentUser' || key === 'currentWorkspace'))
            localStorage.removeItem(key);
        }
      } catch {}
    }
  }

  // === Task CRUD ===
  async function addTask(taskData) {
    const task = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(taskData) });
    state.tasks.push(task);
    dispatchChange();
    return task;
  }

  async function updateTask(id, updates) {
    const task = await apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) state.tasks[idx] = task;
    dispatchChange();
    return task;
  }

  async function deleteTask(id) {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter(t => t.id !== id);
    dispatchChange();
  }

  async function completeTask(id) {
    await apiFetch(`/api/tasks/${id}/complete`, { method: 'POST' });
    const task = state.tasks.find(t => t.id === id);
    if (task) { task.completed = true; task.completedAt = new Date().toISOString(); }
    dispatchChange();
    return task;
  }

  async function refreshTasks() {
    const tasks = await apiFetch('/api/tasks/refresh', { method: 'POST' });
    tasks.forEach(t => {
      const idx = state.tasks.findIndex(l => l.id === t.id);
      if (idx !== -1) state.tasks[idx] = t;
    });
    dispatchChange();
    return tasks;
  }

  // === Local fallback ===
  function addTaskLocal(data) {
    const task = {
      id: Date.now().toString(), title: data.title, description: data.description || '',
      category: data.category || 'other', importance: data.importance || 5, urgency: data.urgency || 8,
      deadline: data.deadline || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      completed: false, subtasks: (data.subtasks||[]).map((s,i) => ({id:'s'+Date.now()+i,text:s.text,done:false,order:i})),
      notes: data.notes || '', reminderAt: data.reminderAt || null,
    };
    state.tasks.push(task);
    dispatchChange();
    return task;
  }

  function updateTaskLocal(id, updates) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(state.tasks[idx], updates, { updatedAt: new Date().toISOString() });
    dispatchChange();
    return state.tasks[idx];
  }

  function deleteTaskLocal(id) { state.tasks = state.tasks.filter(t => t.id !== id); dispatchChange(); }
  function completeTaskLocal(id) {
    const t = state.tasks.find(t => t.id === id);
    if (t) { t.completed = true; t.completedAt = new Date().toISOString(); }
    dispatchChange();
    return t;
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

  function applyTheme() { document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light'); }
  function toggleTheme() { state.darkMode = !state.darkMode; applyTheme(); dispatchChange(); }

  function dispatchChange() { window.dispatchEvent(new CustomEvent('state-changed', { detail: state })); }

  window.CEQT = {
    state, login, register, checkAuth, loadTasks,
    addTask, updateTask, deleteTask, completeTask, refreshTasks,
    toggleTheme, setView, setFilter,
    getFilteredTasks, getActiveTasks, getCompletedTasks, applyTheme,
  };
})();
