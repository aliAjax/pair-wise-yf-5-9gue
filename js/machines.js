/* 机器看板：烘干机基础数据与看板渲染 */
(function (global) {
  'use strict';

  var PRESET_MACHINES = [
    { id: 'M1', name: '一号烘干机', furnace: '高温炉', temp: 80 },
    { id: 'M2', name: '二号烘干机', furnace: '低温炉', temp: 55 },
    { id: 'M3', name: '三号烘干机', furnace: '低温炉', temp: 50 }
  ];

  function machineName(machines, id) {
    var m = machines.find(function (x) { return x.id === id; });
    return m ? m.name : '—';
  }

  /* 看板：每台烘干机一张卡片，列出已排时段 */
  function renderMachineBoard(container, machines, batches, fmtTime) {
    container.innerHTML = '';
    machines.forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'machine-card';

      var head = document.createElement('div');
      head.className = 'machine-head';
      head.innerHTML =
        '<span class="machine-name">' + m.name + '</span>' +
        '<span class="tag ' + (m.furnace === '高温炉' ? 'tag-hot' : 'tag-low') + '">' +
          m.furnace + ' ' + m.temp + '℃</span>';
      card.appendChild(head);

      var slots = batches
        .filter(function (b) { return b.status === '已排批' && b.machineId === m.id; })
        .sort(function (a, b) { return a.plannedIn < b.plannedIn ? -1 : 1; });

      var body = document.createElement('div');
      body.className = 'machine-body';
      if (slots.length === 0) {
        body.innerHTML = '<div class="empty">空闲，暂无排批</div>';
      } else {
        var ul = document.createElement('ul');
        ul.className = 'slot-list';
        slots.forEach(function (b) {
          var li = document.createElement('li');
          li.innerHTML =
            '<strong>' + b.id + '</strong> ' + b.herb +
            (b.heatSensitive ? ' <span class="tag tag-fragile">热敏</span>' : '') +
            '<br><span class="time">' + fmtTime(b.plannedIn) + ' → ' + fmtTime(b.plannedOut) + '</span>';
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  global.Machines = {
    PRESET_MACHINES: PRESET_MACHINES,
    machineName: machineName,
    renderMachineBoard: renderMachineBoard
  };
})(window);
