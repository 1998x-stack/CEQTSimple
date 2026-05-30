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
    authModal: $('#authModal'),
    loginEmail: $('#loginEmail'),
    loginPassword: $('#loginPassword'),
    loginBtn: $('#loginBtn'),
    registerEmail: $('#registerEmail'),
    registerPassword: $('#registerPassword'),
    registerBtn: $('#registerBtn'),
    authTabs: $('#authTabs'),
    loginError: $('#loginError'),
    registerError: $('#registerError'),
    userBadge: $('#userBadge'),
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
    refreshBtn: $('#refreshBtn'),
    deadlineInput: $('#deadlineInput'),
    polishBtn: $('#polishBtn'),
  };

  let isDragging = false;
  let dragTaskId = null;
  let editingTaskId = null;
  let contextTaskId = null;
  let tempSubtasks = [];
  let categoryChart = null;

  // === Auth Init ===
  async function initAuth() {
    const authed = await C.checkAuth();
    if (authed) {
      showApp();
      return;
    }
    dom.authModal.classList.add('open');
    setupAuthListeners();
  }

  function setupAuthListeners() {
    // Tab switching
    dom.authTabs.addEventListener('click', function(e) {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      dom.authTabs.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('loginForm').style.display = btn.dataset.tab === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = btn.dataset.tab === 'register' ? 'block' : 'none';
    });

    dom.loginBtn.addEventListener('click', handleLogin);
    dom.registerBtn.addEventListener('click', handleRegister);
    dom.loginPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') handleLogin(); });
    dom.registerPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') handleRegister(); });
  }

  async function handleLogin() {
    const email = dom.loginEmail.value.trim();
    const pwd = dom.loginPassword.value;
    dom.loginError.style.display = 'none';
    if (!email || !pwd) { dom.loginError.textContent = '请填写邮箱和密码'; dom.loginError.style.display = 'block'; return; }
    try {
      await C.login(email, pwd);
      dom.authModal.classList.remove('open');
      showApp();
    } catch (e) {
      dom.loginError.textContent = '登录失败: ' + e.message;
      dom.loginError.style.display = 'block';
    }
  }

  async function handleRegister() {
    const email = dom.registerEmail.value.trim();
    const pwd = dom.registerPassword.value;
    dom.registerError.style.display = 'none';
    if (!email || !pwd) { dom.registerError.textContent = '请填写邮箱和密码'; dom.registerError.style.display = 'block'; return; }
    if (pwd.length < 6) { dom.registerError.textContent = '密码至少6位'; dom.registerError.style.display = 'block'; return; }
    try {
      await C.register(email, pwd);
      dom.authModal.classList.remove('open');
      showApp();
    } catch (e) {
      dom.registerError.textContent = '注册失败: ' + e.message;
      dom.registerError.style.display = 'block';
    }
  }

  function showApp() {
    dom.mainContainer.style.display = 'block';
    dom.userBadge.textContent = (C.state.userEmail || '?').charAt(0).toUpperCase();
    C.applyTheme();
    updateThemeIcon();
    initMatrix();
    renderTasks();
    setupEventListeners();
    updateViewVisibility();
    requestNotificationPermission();
    startReminderCheck();
  }

  dom.userBadge.addEventListener('click', function() {
    if (confirm('确定要退出登录吗？')) {
      localStorage.removeItem('ceqt_token');
      location.reload();
    }
  });

  // === Theme Toggle ===
  function updateThemeIcon() {
    dom.themeToggle.textContent = C.state.darkMode ? '🌙' : '☀️';
  }

  dom.themeToggle.addEventListener('click', function() {
    C.toggleTheme();
    updateThemeIcon();
    renderTasks();
  });

  // === State Changed Listener ===
  window.addEventListener('state-changed', function() {
    updateThemeIcon();
    updateViewVisibility();
  });

  // === Matrix Rendering ===
  function initMatrix() {
    const m = dom.matrix;
    m.querySelectorAll('.grid-line, .label').forEach(el => el.remove());

    const width = m.offsetWidth;
    const height = m.offsetHeight;
    const cellWidthPct = 100 / 12;
    const cellHeightPct = 100 / 6;

    for (let i = 0; i <= 12; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line vertical';
      line.style.left = `calc(50% + ${(i - 6) * cellWidthPct}%)`;
      m.appendChild(line);

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

    for (let i = 0; i <= 6; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line horizontal';
      line.style.top = `calc(50% + ${(3 - i) * cellHeightPct}%)`;
      m.appendChild(line);

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

      const progress = getProgress(task);
      if (progress > 0) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'progress-ring');
        svg.setAttribute('viewBox', '0 0 40 40');
        const circle = document.createElementNS(svgNS, 'circle');
        const r = 17, circ = 2 * Math.PI * r;
        circle.setAttribute('cx', '20');
        circle.setAttribute('cy', '20');
        circle.setAttribute('r', r.toString());
        circle.setAttribute('stroke-dasharray', circ.toString());
        circle.setAttribute('stroke-dashoffset', (circ * (1 - progress)).toString());
        svg.appendChild(circle);
        dot.appendChild(svg);
      }

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

      dot.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        contextTaskId = task.id;
        dom.contextMenu.classList.add('open');
        dom.contextMenu.style.left = e.pageX + 'px';
        dom.contextMenu.style.top = e.pageY + 'px';
      });

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

  // === Task Modal ===
  function openTaskModal(taskId, coords) {
    const task = taskId ? C.state.tasks.find(t => t.id === taskId) : null;
    editingTaskId = taskId;
    tempSubtasks = task ? JSON.parse(JSON.stringify(task.subtasks || [])) : [];

    dom.taskModalTitle.textContent = task ? '编辑任务' : '添加新任务';
    $('#taskTitle').value = task ? task.title : '';
    $('#taskDesc').value = task ? (task.description || '') : '';
    $('#taskCategory').value = task ? task.category : 'other';
    $('#taskNotes').value = task ? (task.notes || '') : '';
    $('#importanceSlider').value = task ? task.importance : (coords ? coords.importance : 5);
    $('#urgencySelect').value = task ? task.urgency : (coords ? coords.urgency : 8);
    $('#reminderTime').value = task && task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : '';
    $('#deadlineInput').value = task && task.deadline ? task.deadline.slice(0, 16) : '';
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
      deadline: $('#deadlineInput').value || null,
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

  $('#deadlineInput').addEventListener('change', function() {
    const dl = this.value;
    if (dl) {
      const reminderDate = new Date(new Date(dl).getTime() - 30 * 60000);
      const iso = reminderDate.toISOString().slice(0, 16);
      $('#reminderTime').value = iso;
    }
  });

  // === Subtask Management in Modal ===
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

  // === Context Menu ===
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

  document.addEventListener('click', function(e) {
    if (!dom.contextMenu.contains(e.target)) {
      dom.contextMenu.classList.remove('open');
    }
  });

  // === Keyboard Shortcuts ===
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeTaskModal();
        dom.contextMenu.classList.remove('open');
        dom.helpOverlay.classList.remove('open');
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const rect = dom.matrix.getBoundingClientRect();
        const coords = posToCoord(rect.width / 2, rect.height / 2);
        openTaskModal(null, coords);
        return;
      }

      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        dom.searchInput.focus();
        return;
      }

      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const firstChip = dom.filterChips.querySelector('.filter-chip');
        if (firstChip) firstChip.focus();
        return;
      }

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

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        dom.helpOverlay.classList.toggle('open');
        return;
      }
    });

    $('#helpCloseBtn').addEventListener('click', function() {
      dom.helpOverlay.classList.remove('open');
    });
  }

  // === Search ===
  dom.searchInput.addEventListener('input', function() {
    C.setFilter('search', this.value);
    renderTasks();
    renderListView();
  });

  // === Filter Chips ===
  dom.filterChips.addEventListener('click', function(e) {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const filter = chip.dataset.filter;

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

  // === List View ===
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

  // === View Switcher ===
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

  // === Reminder System ===
  let reminderInterval = null;

  function startReminderCheck() {
    if (reminderInterval) clearInterval(reminderInterval);

    reminderInterval = setInterval(checkReminders, 30000);
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
        new Notification('任务提醒', {
          body: task.title + ' — ' + (task.description || ''),
          icon: 'favicon.ico',
          tag: task.id,
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

  // === Profile Page ===
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

  function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    const ctx2d = ctx.getContext('2d');

    if (categoryChart) categoryChart.destroy();

    const counts = {};
    CATEGORIES.forEach(cat => { counts[cat] = 0; });
    C.state.tasks.forEach(t => { if (counts[t.category] !== undefined) counts[t.category]++; });

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

  // === Resize Handler ===
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      initMatrix();
      renderTasks();
      if (categoryChart) categoryChart.resize();
    }, 100);
  });

  // === Setup ===
  function setupEventListeners() {
    setupKeyboardShortcuts();

    dom.refreshBtn.addEventListener('click', async function() {
      dom.refreshBtn.style.transform = 'rotate(360deg)';
      dom.refreshBtn.style.transition = 'transform 0.6s ease';
      try {
        await C.refreshTasks();
        renderTasks();
      } catch (e) {}
      dom.refreshBtn.style.transform = 'rotate(0deg)';
      dom.refreshBtn.style.transition = 'none';
    });

    if (dom.polishBtn) {
      dom.polishBtn.addEventListener('click', async function() {
        const title = $('#taskTitle').value.trim();
        if (!title) { alert('请先输入任务标题'); return; }
        dom.polishBtn.textContent = '⏳ 分析中...';
        dom.polishBtn.disabled = true;
        try {
          const token = localStorage.getItem('ceqt_token');
          const resp = await fetch('http://localhost:8000/api/polish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ task_title: title, task_description: $('#taskDesc').value.trim(), category: $('#taskCategory').value }),
          });
          const result = await resp.json();
          tempSubtasks = result.subtasks.map((s, i) => ({ id: 'ps_' + Date.now() + i, text: s.text, done: false, order: i }));
          renderSubtasksInModal();
          if (result.suggested_importance) $('#importanceSlider').value = result.suggested_importance;
          if (result.suggested_urgency) $('#urgencySelect').value = result.suggested_urgency;
          updateImportanceDisplay();
          updateUrgencyDisplay();
        } catch (e) { alert('润色失败: ' + e.message); }
        finally { dom.polishBtn.textContent = '✨ 润色'; dom.polishBtn.disabled = false; }
      });
    }
  }

  // === Init ===
  initAuth();
})();
