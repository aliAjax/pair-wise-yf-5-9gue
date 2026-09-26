/* 校验规则：排批前逐项校验，任一不通过即拒绝排批，机器与批次状态保持不变。
 * 纯函数模块，不读写页面与存储。 */
(function () {
  'use strict';

  function ts(iso) { return new Date(iso).getTime(); }

  /* 规则一：同一烘干机时段不得重叠（半开区间 [入炉, 出锅) 之外算冲突） */
  function overlapError(batch, machine, entry, exit, batches) {
    var start = ts(entry);
    var end = ts(exit);
    var clashes = batches.filter(function (other) {
      if (other.id === batch.id) return false;
      if (other.machineId !== machine.id) return false;
      if (!other.entryTime || !other.exitTime) return false;
      return start < ts(other.exitTime) && end > ts(other.entryTime);
    });
    if (!clashes.length) return null;
    return '时段冲突：' + machine.name + ' 该时段已排「' +
      clashes.map(function (b) { return b.herb + '（' + b.id + '）'; }).join('、') + '」';
  }

  window.Rules = {
    /**
     * 校验一次排批。返回错误信息数组，空数组表示通过。
     * @param batch   待排批次（含表单拟登记的字段）
     * @param machine 目标烘干机
     * @param entry   入炉时刻（datetime-local 字符串）
     * @param exit    出锅时刻
     * @param batches 当前全部批次（用于时段重叠比对）
     */
    validateSchedule: function (batch, machine, entry, exit, batches) {
      var errors = [];

      if (!batch.herb || !String(batch.herb).trim()) {
        errors.push('请登记药材名称');
      }
      if (!(batch.moisture >= 0 && batch.moisture <= 100)) {
        errors.push('请登记 0–100 之间的含水率');
      }
      if (!(batch.targetDryness >= 0 && batch.targetDryness <= 100)) {
        errors.push('请登记 0–100 之间的目标干度');
      }
      if (!entry || !exit) {
        errors.push('请登记入炉与出锅时刻');
      } else if (ts(entry) >= ts(exit)) {
        errors.push('入炉时刻必须早于出锅时刻');
      }

      /* 规则二：入炉前含水率须已复测 */
      if (!batch.rechecked) {
        errors.push('「' + batch.herb + '」入炉前含水率未复测，请先在批次档案中复测');
      }

      /* 规则三：热敏药材不得进入高温炉 */
      if (batch.heatSensitive && machine.kind === '高温炉') {
        errors.push('「' + batch.herb + '」为热敏药材，不得进入' + machine.name + '（高温炉）');
      }

      /* 规则一：时段重叠 */
      if (entry && exit && ts(entry) < ts(exit)) {
        var msg = overlapError(batch, machine, entry, exit, batches);
        if (msg) errors.push(msg);
      }

      return errors;
    }
  };
})();
