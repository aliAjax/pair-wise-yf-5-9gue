/* 批次档案：饮片批次基础数据、档案表与旧排程渲染 */
(function (global) {
  'use strict';

  var STATUS = {
    PENDING: '待排批',
    SCHEDULED: '已排批',
    REASSIGN: '待重新分配'
  };

  var PRESET_BATCHES = [
    { id: 'P001', herb: '黄芪',   heatSensitive: false, moisture: 18.5, targetDryness: 10, retested: true,  retestTime: '2026-09-26T07:40', status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' },
    { id: 'P002', herb: '金银花', heatSensitive: true,  moisture: 16.2, targetDryness: 8,  retested: true,  retestTime: '2026-09-26T07:50', status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' },
    { id: 'P003', herb: '当归',   heatSensitive: false, moisture: 20.1, targetDryness: 11, retested: false, retestTime: '',                 status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' },
    { id: 'P004', herb: '枸杞子', heatSensitive: true,  moisture: 22.4, targetDryness: 13, retested: true,  retestTime: '2026-09-26T08:05', status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' },
    { id: 'P005', herb: '甘草',   heatSensitive: false, moisture: 15.3, targetDryness: 9,  retested: false, retestTime: '',                 status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' },
    { id: 'P006', herb: '陈皮',   heatSensitive: true,  moisture: 17.0, targetDryness: 10, retested: true,  retestTime: '2026-09-26T08:10', status: STATUS.PENDING, machineId: null, plannedIn: '', plannedOut: '' }
  ];

  function statusClass(status) {
    if (status === STATUS.SCHEDULED) return 'tag-ok';
    if (status === STATUS.REASSIGN) return 'tag-warn';
    return 'tag-idle';
  }

  /* 档案表：每行一个批次，已排批次可原地调整入炉时刻 */
  function renderBatchArchive(container, batches, machines, actions, fmtTime, toInputValue) {
    var rows = batches.map(function (b) {
      var machineCell = b.machineId ? global.Machines.machineName(machines, b.machineId) : '—';

      var inCell;
      if (b.status === STATUS.SCHEDULED) {
        inCell =
          '<input type="datetime-local" class="adj-in" data-id="' + b.id + '" value="' + toInputValue(new Date(b.plannedIn)) + '">' +
          '<button class="btn-small" data-action="adjust" data-id="' + b.id + '">调整入炉</button>';
      } else {
        inCell = b.plannedIn ? fmtTime(b.plannedIn) : '—';
      }

      var retestCell = b.retested
        ? '<span class="tag tag-ok">已复测</span><br><span class="time">' + (b.retestTime ? fmtTime(b.retestTime) : '') + '</span>'
        : '<span class="tag tag-warn">未复测</span><br><button class="btn-small" data-action="retest" data-id="' + b.id + '">登记复测</button>';

      return '<tr>' +
        '<td><strong>' + b.id + '</strong></td>' +
        '<td>' + b.herb + (b.heatSensitive ? ' <span class="tag tag-fragile">热敏</span>' : '') + '</td>' +
        '<td>' + b.moisture.toFixed(1) + '%</td>' +
        '<td>' + b.targetDryness.toFixed(1) + '%</td>' +
        '<td>' + retestCell + '</td>' +
        '<td><span class="tag ' + statusClass(b.status) + '">' + b.status + '</span></td>' +
        '<td>' + machineCell + '</td>' +
        '<td class="in-cell">' + inCell + '</td>' +
        '<td>' + (b.plannedOut && b.status === STATUS.SCHEDULED ? fmtTime(b.plannedOut) : (b.plannedOut ? fmtTime(b.plannedOut) : '—')) + '</td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<table class="archive-table"><thead><tr>' +
      '<th>批次</th><th>药材</th><th>含水率</th><th>目标干度</th><th>复测</th>' +
      '<th>状态</th><th>机位</th><th>入炉时刻</th><th>出锅时刻</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    container.querySelectorAll('[data-action="retest"]').forEach(function (btn) {
      btn.addEventListener('click', function () { actions.retest(btn.dataset.id); });
    });
    container.querySelectorAll('[data-action="adjust"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = container.querySelector('.adj-in[data-id="' + btn.dataset.id + '"]');
        actions.adjustIn(btn.dataset.id, input.value);
      });
    });
  }

  /* 旧排程：调整入炉后退出机位的历史记录，保留备查 */
  function renderHistory(container, history, machines, fmtTime) {
    if (history.length === 0) {
      container.innerHTML = '<div class="empty">暂无旧排程</div>';
      return;
    }
    var items = history.slice().reverse().map(function (h) {
      return '<li>' +
        '<strong>' + h.batchId + ' ' + h.herb + '</strong> 原排 ' +
        global.Machines.machineName(machines, h.machineId) + ' ' +
        '<span class="time">' + fmtTime(h.plannedIn) + ' → ' + fmtTime(h.plannedOut) + '</span>' +
        '　<span class="tag tag-warn">' + h.reason + '</span>' +
        ' <span class="time">退出于 ' + fmtTime(h.removedAt) + '</span>' +
        '</li>';
    }).join('');
    container.innerHTML = '<ul class="history-list">' + items + '</ul>';
  }

  global.Batches = {
    STATUS: STATUS,
    PRESET_BATCHES: PRESET_BATCHES,
    renderBatchArchive: renderBatchArchive,
    renderHistory: renderHistory
  };
})(window);
