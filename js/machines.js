/* 机器看板：烘干机台账（预置三台）与看板渲染。 */
(function () {
  'use strict';

  var KEY = 'tcm_dryer_v1_machines';

  var PRESET = [
    { id: 'M1', name: '一号热风炉', kind: '高温炉', tempRange: '80–105℃' },
    { id: 'M2', name: '二号热风炉', kind: '高温炉', tempRange: '80–105℃' },
    { id: 'M3', name: '三号低温炉', kind: '低温炉', tempRange: '40–60℃（热敏药材专用）' }
  ];

  /* 小工具：转义与时间格式化，供各业务文件共用 */
  window.AppUtil = {
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    fmt: function (iso) {
      if (!iso) return '—';
      return String(iso).replace('T', ' ').slice(5); /* "MM-DD HH:mm" */
    },
    nowLocal: function () {
      var d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    }
  };

  window.MachineStore = {
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
      return this.all().find(function (m) { return m.id === id; }) || null;
    },
    reset: function () { localStorage.removeItem(KEY); }
  };

  /* 看板渲染：状态由批次排程推导（当前时刻落在某批次入炉—出锅之间即“作业中”） */
  window.renderMachineBoard = function () {
    var esc = AppUtil.esc, fmt = AppUtil.fmt;
    var machines = MachineStore.all();
    var batches = BatchStore.all();
    var now = Date.now();

    document.getElementById('machine-board').innerHTML = machines.map(function (m) {
      var scheduled = batches
        .filter(function (b) { return b.machineId === m.id && b.entryTime && b.exitTime; })
        .sort(function (a, b) { return a.entryTime < b.entryTime ? -1 : 1; });

      var busy = scheduled.some(function (b) {
        return now >= new Date(b.entryTime).getTime() && now < new Date(b.exitTime).getTime();
      });

      var rows = scheduled.length
        ? scheduled.map(function (b) {
            return '<li>' + esc(b.herb) + '（' + esc(b.id) + '） ' +
              fmt(b.entryTime) + ' → ' + fmt(b.exitTime) + '</li>';
          }).join('')
        : '<li class="empty">暂无排程</li>';

      return '<article class="machine">' +
        '<header><h3>' + esc(m.name) + '</h3>' +
        '<span class="badge ' + (m.kind === '高温炉' ? 'hot' : 'low') + '">' + esc(m.kind) + '</span>' +
        '<span class="badge ' + (busy ? 'busy' : 'idle') + '">' + (busy ? '作业中' : '空闲') + '</span>' +
        '</header>' +
        '<p class="temp">炉温 ' + esc(m.tempRange) + '</p>' +
        '<ul>' + rows + '</ul>' +
        '</article>';
    }).join('');
  };
})();
