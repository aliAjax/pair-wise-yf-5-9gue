/* 批次档案：饮片批次台账（预置六批）、排批登记、含水率复测、
 * 入炉时刻调整（退出原机位、旧排程留档）。 */
(function () {
  'use strict';

  var KEY = 'tcm_dryer_v1_batches';
  var HKEY = 'tcm_dryer_v1_history';

  var PRESET = [
    { id: 'B1', herb: '黄芪片', moisture: 62, targetDryness: 12, heatSensitive: false, rechecked: true,  recheckedAt: '2026-09-26T07:30', machineId: null, entryTime: null, exitTime: null, status: '待排' },
    { id: 'B2', herb: '金银花', moisture: 45, targetDryness: 10, heatSensitive: true,  rechecked: true,  recheckedAt: '2026-09-26T07:35', machineId: null, entryTime: null, exitTime: null, status: '待排' },
    { id: 'B3', herb: '枸杞子', moisture: 55, targetDryness: 13, heatSensitive: true,  rechecked: false, recheckedAt: null,              machineId: null, entryTime: null, exitTime: null, status: '待排' },
    { id: 'B4', herb: '党参段', moisture: 60, targetDryness: 12, heatSensitive: false, rechecked: false, recheckedAt: null,              machineId: null, entryTime: null, exitTime: null, status: '待排' },
    { id: 'B5', herb: '当归片', moisture: 58, targetDryness: 12, heatSensitive: false, rechecked: true,  recheckedAt: '2026-09-26T07:40', machineId: null, entryTime: null, exitTime: null, status: '待排' },
    { id: 'B6', herb: '薄荷',   moisture: 50, targetDryness: 9,  heatSensitive: true,  rechecked: false, recheckedAt: null,              machineId: null, entryTime: null, exitTime: null, status: '待排' }
  ];

  window.BatchStore = {
    all: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* 数据损坏则回落预置 */ }
      var seed = JSON.parse(JSON.stringify(PRESET));
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    },
    find: function (id) {
      return this.all().find(function (b) { return b.id === id; }) || null;
    },
    save: function (list) { localStorage.setItem(KEY, JSON.stringify(list)); },
    history: function () {
      try {
        var raw = localStorage.getItem(HKEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* 忽略损坏留档 */ }
      return [];
    },
    saveHistory: function (list) { localStorage.setItem(HKEY, JSON.stringify(list)); },
    reset: function () {
      localStorage.removeItem(KEY);
      localStorage.removeItem(HKEY);
    }
  };

  var esc = AppUtil.esc, fmt = AppUtil.fmt;

  /* ---------- 渲染 ---------- */

  function renderAll() {
    renderMachineBoard();
    renderBatchRows();
    renderHistory();
    fillBatchSelect();
  }

  function statusBadge(s) {
    var cls = s === '已排' ? 'done' : (s === '待重排' ? 'rework' : 'wait');
    return '<span class="badge ' + cls + '">' + s + '</span>';
  }

  function renderBatchRows() {
    var batches = BatchStore.all();
    document.getElementById('batch-rows').innerHTML = batches.map(function (b) {
      var machine = b.machineId ? MachineStore.find(b.machineId) : null;
      var slot = machine
        ? esc(machine.name) + '<span class="sub">' + fmt(b.entryTime) + ' → ' + fmt(b.exitTime) + '</span>'
        : '<span class="sub">未分配机位</span>';

      var recheckCell = b.rechecked
        ? '已复测<span class="sub">' + fmt(b.recheckedAt) + '</span>'
        : '<span class="badge no">未复测</span>';

      var ops = [];
      if (!b.rechecked) {
        ops.push('<button class="small ghost" data-recheck="' + esc(b.id) + '">复测含水率</button>');
      }
      if (b.status === '已排') {
        ops.push(
          '<input type="datetime-local" data-adj-entry="' + esc(b.id) + '" value="' + esc(b.entryTime) + '">' +
          '<button class="small ghost" data-adjust="' + esc(b.id) + '">调整入炉</button>'
        );
      }

      return '<tr>' +
        '<td>' + esc(b.id) + '</td>' +
        '<td>' + esc(b.herb) + '</td>' +
        '<td>' + esc(b.moisture) + '%</td>' +
        '<td>≤' + esc(b.targetDryness) + '%</td>' +
        '<td><span class="badge ' + (b.heatSensitive ? 'sens' : 'norm') + '">' + (b.heatSensitive ? '热敏' : '常规') + '</span></td>' +
        '<td>' + recheckCell + '</td>' +
        '<td>' + statusBadge(b.status) + '</td>' +
        '<td>' + slot + '</td>' +
        '<td>' + (ops.join(' ') || '<span class="sub">—</span>') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderHistory() {
    var list = BatchStore.history();
    document.getElementById('history-list').innerHTML = list.length
      ? list.map(function (h) {
          return '<p>「' + esc(h.herb) + '（' + esc(h.batchId) + '）」原排 ' + esc(h.machineName) +
            ' ' + fmt(h.entryTime) + ' → ' + fmt(h.exitTime) +
            ' <span class="muted">｜' + esc(h.reason) + '，' + fmt(h.removedAt) + ' 退出机位留档</span></p>';
        }).join('')
      : '<p class="muted">暂无留档。已排批次调整入炉时刻后，旧排程会保留在此处。</p>';
  }

  /* ---------- 排批表单 ---------- */

  var form, msgBox;

  function fillBatchSelect() {
    var select = document.getElementById('f-batch');
    var current = select.value;
    var pending = BatchStore.all().filter(function (b) { return b.status !== '已排'; });
    select.innerHTML = pending.length
      ? pending.map(function (b) {
          return '<option value="' + esc(b.id) + '">' + esc(b.id) + ' ' + esc(b.herb) + '（' + b.status + '）</option>';
        }).join('')
      : '<option value="">（无待排批次）</option>';
    if (pending.some(function (b) { return b.id === current; })) select.value = current;
    prefillForm();
  }

  function prefillForm() {
    var b = BatchStore.find(document.getElementById('f-batch').value);
    if (!b) return;
    document.getElementById('f-herb').value = b.herb;
    document.getElementById('f-moisture').value = b.moisture;
    document.getElementById('f-target').value = b.targetDryness;
    document.getElementById('f-heat').checked = b.heatSensitive;
  }

  function fillMachineSelect() {
    document.getElementById('f-machine').innerHTML = MachineStore.all().map(function (m) {
      return '<option value="' + esc(m.id) + '">' + esc(m.name) + '（' + esc(m.kind) + '）</option>';
    }).join('');
  }

  function showMsg(html, ok) {
    msgBox.className = ok ? 'ok' : 'err';
    msgBox.innerHTML = html;
  }

  function onSubmit(e) {
    e.preventDefault();
    var batchId = document.getElementById('f-batch').value;
    var batch = BatchStore.find(batchId);
    if (!batch) { showMsg('没有可排的批次。', false); return; }

    var machine = MachineStore.find(document.getElementById('f-machine').value);
    var entry = document.getElementById('f-entry').value;
    var exit = document.getElementById('f-exit').value;

    /* 先用表单拟登记值构造候选批次做校验，通过前不写任何状态 */
    var candidate = {
      id: batch.id,
      herb: document.getElementById('f-herb').value.trim(),
      moisture: parseFloat(document.getElementById('f-moisture').value),
      targetDryness: parseFloat(document.getElementById('f-target').value),
      heatSensitive: document.getElementById('f-heat').checked,
      rechecked: batch.rechecked
    };

    var errors = Rules.validateSchedule(candidate, machine, entry, exit, BatchStore.all());
    if (errors.length) {
      /* 校验不过：机器与批次状态不动 */
      showMsg('排批被拒绝：<ul><li>' + errors.map(esc).join('</li><li>') + '</li></ul>', false);
      return;
    }

    var batches = BatchStore.all();
    var target = batches.find(function (b) { return b.id === batch.id; });
    target.herb = candidate.herb;
    target.moisture = candidate.moisture;
    target.targetDryness = candidate.targetDryness;
    target.heatSensitive = candidate.heatSensitive;
    target.machineId = machine.id;
    target.entryTime = entry;
    target.exitTime = exit;
    target.status = '已排';
    BatchStore.save(batches);

    form.reset();
    renderAll();
    showMsg('已排批：「' + esc(target.herb) + '」→ ' + esc(machine.name) + '，' + fmt(entry) + ' 入炉，' + fmt(exit) + ' 出锅。', true);
  }

  /* ---------- 复测与调整 ---------- */

  function onRecheck(id) {
    var batches = BatchStore.all();
    var b = batches.find(function (x) { return x.id === id; });
    if (!b) return;
    b.rechecked = true;
    b.recheckedAt = AppUtil.nowLocal();
    BatchStore.save(batches);
    renderAll();
    showMsg('「' + esc(b.herb) + '」含水率已复测（' + fmt(b.recheckedAt) + '），可以排批。', true);
  }

  /* 调整入炉时刻：批次退出原机位等待重新分配，旧排程写入留档 */
  function onAdjust(id) {
    var input = document.querySelector('input[data-adj-entry="' + id + '"]');
    var newEntry = input && input.value;
    if (!newEntry) { showMsg('请先填写新的入炉时刻。', false); return; }

    var batches = BatchStore.all();
    var b = batches.find(function (x) { return x.id === id; });
    if (!b || b.status !== '已排') return;

    var machine = MachineStore.find(b.machineId);
    var history = BatchStore.history();
    history.unshift({
      batchId: b.id,
      herb: b.herb,
      machineId: b.machineId,
      machineName: machine ? machine.name : b.machineId,
      entryTime: b.entryTime,
      exitTime: b.exitTime,
      removedAt: AppUtil.nowLocal(),
      reason: '调整入炉时刻'
    });
    BatchStore.saveHistory(history);

    b.machineId = null;
    b.entryTime = null;
    b.exitTime = null;
    b.status = '待重排';
    BatchStore.save(batches);

    renderAll();

    /* 预填表单，便于立即重新分配 */
    document.getElementById('f-batch').value = b.id;
    prefillForm();
    document.getElementById('f-entry').value = newEntry;
    document.getElementById('f-exit').value = '';
    showMsg('「' + esc(b.herb) + '」已退出原机位，等待重新分配；旧排程已留档。', true);
  }

  /* ---------- 启动 ---------- */

  form = document.getElementById('schedule-form');
  msgBox = document.getElementById('form-msg');

  fillMachineSelect();
  renderAll();

  form.addEventListener('submit', onSubmit);
  document.getElementById('f-batch').addEventListener('change', prefillForm);

  document.getElementById('batch-rows').addEventListener('click', function (e) {
    var recheck = e.target.getAttribute('data-recheck');
    var adjust = e.target.getAttribute('data-adjust');
    if (recheck) onRecheck(recheck);
    if (adjust) onAdjust(adjust);
  });

  document.getElementById('reset-btn').addEventListener('click', function () {
    if (!confirm('清空本机全部排程与留档，恢复预置的三台烘干机、六批饮片？')) return;
    BatchStore.reset();
    MachineStore.reset();
    form.reset();
    msgBox.innerHTML = '';
    renderAll();
  });
})();
