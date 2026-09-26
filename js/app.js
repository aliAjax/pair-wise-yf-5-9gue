/* 装配层：状态管理、浏览器本地存储、事件接线 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tcm-drying-scheduler-v1';
  var STATUS = Batches.STATUS;

  /* ---------- 状态 ---------- */

  function seed() {
    return {
      machines: JSON.parse(JSON.stringify(Machines.PRESET_MACHINES)),
      batches: JSON.parse(JSON.stringify(Batches.PRESET_BATCHES)),
      history: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : seed();
    } catch (e) {
      return seed();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = load();

  /* ---------- 工具 ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function toInputValue(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function findBatch(id) {
    return state.batches.find(function (b) { return b.id === id; });
  }

  function showMessage(text, isError) {
    var box = document.getElementById('message');
    box.className = isError ? 'msg msg-error' : 'msg msg-ok';
    if (Array.isArray(text)) {
      box.innerHTML = '<ul>' + text.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    } else {
      box.textContent = text;
    }
  }

  /* ---------- 渲染 ---------- */

  function renderAll() {
    Machines.renderMachineBoard(document.getElementById('machineBoard'), state.machines, state.batches, fmtTime);
    Batches.renderBatchArchive(document.getElementById('batchArchive'), state.batches, state.machines, actions, fmtTime, toInputValue);
    Batches.renderHistory(document.getElementById('historyList'), state.history, state.machines, fmtTime);
    fillBatchOptions();
    fillMachineOptions();
  }

  function schedulableBatches() {
    return state.batches.filter(function (b) {
      return b.status === STATUS.PENDING || b.status === STATUS.REASSIGN;
    });
  }

  function fillBatchOptions() {
    var sel = document.getElementById('fBatch');
    var prev = sel.value;
    var list = schedulableBatches();
    sel.innerHTML = list.map(function (b) {
      return '<option value="' + b.id + '">' + b.id + ' ' + b.herb + '（' + b.status + '）</option>';
    }).join('');
    if (list.some(function (b) { return b.id === prev; })) sel.value = prev;
    onBatchChange();
  }

  function fillMachineOptions() {
    var sel = document.getElementById('fMachine');
    var prev = sel.value;
    sel.innerHTML = state.machines.map(function (m) {
      return '<option value="' + m.id + '">' + m.name + '（' + m.furnace + ' ' + m.temp + '℃）</option>';
    }).join('');
    if (state.machines.some(function (m) { return m.id === prev; })) sel.value = prev;
  }

  function onBatchChange() {
    var b = findBatch(document.getElementById('fBatch').value);
    var hints = document.getElementById('fHints');
    if (!b) {
      document.getElementById('fHerb').value = '';
      hints.innerHTML = '<span class="empty">没有待排批次</span>';
      return;
    }
    document.getElementById('fHerb').value = b.herb + (b.heatSensitive ? '（热敏）' : '');
    document.getElementById('fMoisture').value = b.moisture;
    document.getElementById('fTarget').value = b.targetDryness;

    var defIn = b.plannedIn ? new Date(b.plannedIn) : new Date(Date.now() + 3600 * 1000);
    var defOut = b.plannedOut ? new Date(b.plannedOut) : new Date(defIn.getTime() + 4 * 3600 * 1000);
    document.getElementById('fIn').value = toInputValue(defIn);
    document.getElementById('fOut').value = toInputValue(defOut);

    var warn = [];
    if (b.heatSensitive) warn.push('<span class="tag tag-fragile">热敏药材：禁止排入高温炉</span>');
    if (!b.retested) warn.push('<span class="tag tag-warn">含水率未复测：请先在批次档案中登记复测</span>');
    hints.innerHTML = warn.join(' ');
  }

  /* ---------- 动作 ---------- */

  var actions = {
    /* 排批：先过校验规则，任何一条不通过则机器与批次状态不动 */
    schedule: function (e) {
      e.preventDefault();
      var b = findBatch(document.getElementById('fBatch').value);
      if (!b) { showMessage('没有可排的批次', true); return; }
      var machine = state.machines.find(function (m) { return m.id === document.getElementById('fMachine').value; });
      var draft = {
        plannedIn: document.getElementById('fIn').value,
        plannedOut: document.getElementById('fOut').value
      };

      var result = Rules.validateSchedule(b, machine, draft, state.batches);
      if (!result.ok) {
        showMessage(result.errors, true);
        return;
      }

      b.moisture = parseFloat(document.getElementById('fMoisture').value);
      b.targetDryness = parseFloat(document.getElementById('fTarget').value);
      b.plannedIn = draft.plannedIn;
      b.plannedOut = draft.plannedOut;
      b.machineId = machine.id;
      b.status = STATUS.SCHEDULED;
      save();
      renderAll();
      showMessage('批次 ' + b.id + '（' + b.herb + '）已排入 ' + machine.name);
    },

    /* 登记复测：记录复测时刻，解除排批限制 */
    retest: function (id) {
      var b = findBatch(id);
      if (!b || b.retested) return;
      b.retested = true;
      b.retestTime = toInputValue(new Date());
      save();
      renderAll();
      showMessage('批次 ' + id + ' 含水率已复测（' + b.moisture.toFixed(1) + '%）');
    },

    /* 调整入炉：批次退出原机位等待重新分配，旧排程保留 */
    adjustIn: function (id, newIn) {
      var b = findBatch(id);
      if (!b || b.status !== STATUS.SCHEDULED) return;
      if (!newIn) { showMessage('请先选择新的入炉时刻', true); return; }
      if (newIn === b.plannedIn) { showMessage('入炉时刻未变化', true); return; }
      if (!window.confirm('调整后批次 ' + id + ' 将退出原机位等待重新分配，旧排程保留。确认调整？')) return;

      state.history.push({
        batchId: b.id,
        herb: b.herb,
        machineId: b.machineId,
        plannedIn: b.plannedIn,
        plannedOut: b.plannedOut,
        removedAt: toInputValue(new Date()),
        reason: '调整入炉'
      });
      b.machineId = null;
      b.status = STATUS.REASSIGN;
      b.plannedIn = newIn;
      save();
      renderAll();
      showMessage('批次 ' + id + ' 已退出原机位，等待重新分配');
    },

    reset: function () {
      if (!window.confirm('确认清空本地数据并恢复预置的三台烘干机与六批饮片？')) return;
      localStorage.removeItem(STORAGE_KEY);
      state = seed();
      save();
      renderAll();
      showMessage('已恢复预置数据');
    }
  };

  /* ---------- 启动 ---------- */

  document.getElementById('scheduleForm').addEventListener('submit', actions.schedule);
  document.getElementById('fBatch').addEventListener('change', onBatchChange);
  document.getElementById('resetBtn').addEventListener('click', actions.reset);
  renderAll();
})();
