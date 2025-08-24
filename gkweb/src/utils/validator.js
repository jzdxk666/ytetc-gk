// utils/validator.js
export function validateContainerMove(stowageData, container, targetBay, targetRow, targetTier) {
  // 1. 检查目标位置是否为空
  const targetSlot = stowageData.bayDetails
    .find(b => b.bayNumber === targetBay)?.rows
    .find(r => r.rowNumber === targetRow)?.slots
    .find(s => s.tier === targetTier);
  
  if (!targetSlot || targetSlot.container) {
    return { valid: false, message: "目标位置已被占用" };
  }

  // 2. 检查冷藏箱是否在冷藏区
  if (container.isReefer) {
    const bay = stowageData.bayDetails.find(b => b.bayNumber === targetBay);
    if (!bay?.isReeferReady) {
      return { valid: false, message: "冷藏箱必须放置在冷藏区" };
    }
  }

  // 3. 检查重量限制
  const row = stowageData.bayDetails
    .find(b => b.bayNumber === targetBay)?.rows
    .find(r => r.rowNumber === targetRow);
  
  if (row && container.weightKg > row.maxWeightKg) {
    return { valid: false, message: "超过行最大承重限制" };
  }

  // 4. 检查目的港顺序 (CB-T 3977-2008要求)
  const belowContainers = row.slots.filter(s => s.tier > targetTier && s.container);
  for (const below of belowContainers) {
    if (below.container.pod < container.pod) {
      return { valid: false, message: "不能将目的港靠后的箱子放在靠前的箱子下方" };
    }
  }

  // 5. 检查危险品隔离要求
  if (container.isHazardous) {
    // 实现危险品隔离检查逻辑
  }

  return { valid: true };
}