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
