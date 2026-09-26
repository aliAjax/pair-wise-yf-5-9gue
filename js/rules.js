/* 校验规则：排批前的硬性检查。
 * 所有规则通过才允许排批；任一规则不通过时，
 * 调用方不得改动机器与批次状态。 */
(function (global) {
  'use strict';

  function toTime(v) {
    return new Date(v).getTime();
  }

  function intervalsOverlap(aIn, aOut, bIn, bOut) {
    return aIn < bOut && bIn < aOut;
  }

  /**
   * 校验批次排入指定烘干机是否合法。
   * @param {Object} batch    批次档案（含热敏、复测标记）
   * @param {Object} machine  目标烘干机
   * @param {Object} draft    本次登记的排程 { plannedIn, plannedOut }
   * @param {Array}  allBatches 全部批次（用于时段重叠检查）
   * @returns {{ok: boolean, errors: string[]}}
   */
  function validateSchedule(batch, machine, draft, allBatches) {
    const errors = [];
    const inT = toTime(draft.plannedIn);
    const outT = toTime(draft.plannedOut);

    if (!draft.plannedIn || !draft.plannedOut || isNaN(inT) || isNaN(outT)) {
      errors.push('入炉/出锅时刻缺失或格式不正确');
    } else if (outT <= inT) {
      errors.push('出锅时刻必须晚于入炉时刻');
    }

    // 规则一：同一烘干机时段不得重叠
    if (!isNaN(inT) && !isNaN(outT)) {
      const clash = allBatches.find(function (b) {
        return b.id !== batch.id &&
          b.status === '已排批' &&
          b.machineId === machine.id &&
          intervalsOverlap(inT, outT, toTime(b.plannedIn), toTime(b.plannedOut));
      });
      if (clash) {
        errors.push('与 ' + machine.name + ' 已排批次「' + clash.id + ' ' + clash.herb + '」时段重叠');
      }
    }

    // 规则二：热敏药材不得进入高温炉
    if (batch.heatSensitive && machine.furnace === '高温炉') {
      errors.push('「' + batch.herb + '」为热敏药材，禁止进入' + machine.furnace + '（' + machine.temp + '℃）');
    }

    // 规则三：入炉前含水率必须复测
    if (!batch.retested) {
      errors.push('批次「' + batch.id + ' ' + batch.herb + '」入炉前含水率未复测');
    }

    return { ok: errors.length === 0, errors: errors };
  }

  global.Rules = { validateSchedule: validateSchedule };
})(window);
