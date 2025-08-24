import { useStowageStore } from '@/stores/stowage';

export function useValidation() {
  const stowageStore = useStowageStore();

  // 验证集装箱移动是否符合所有约束规则
  const validateContainerMove = (container, targetBayNumber, targetRowNumber, targetTier) => {
    // FR2.1 - 物理约束验证
    const targetBay = stowageStore.stowageData.bayDetails.find(b => b.bayNumber === targetBayNumber);
    if (!targetBay) {
      return { valid: false, message: "目标贝位不存在" };
    }

    const targetRow = targetBay.rows.find(r => r.rowNumber === targetRowNumber);
    if (!targetRow) {
      return { valid: false, message: "目标行不存在" };
    }

    if (targetTier < 1 || targetTier > targetRow.maxTiers) {
      return { valid: false, message: "目标层数超出范围" };
    }

    // 检查目标位置是否已有集装箱
    const targetLocationCode = `${targetBayNumber}${targetRowNumber}${targetTier.toString().padStart(3, '0')}`;
    const existingContainer = stowageStore.stowageData.assignments.find(
      a => a.locationCode === targetLocationCode && a.containerId !== container.containerId
    );
    if (existingContainer) {
      return { valid: false, message: "目标位置已被占用" };
    }

    // FR2.1 - 重量限制检查：单个箱位总重量不能超过 maxWeightKg
    if (container.weightKg > targetRow.maxWeightKg) {
      return { 
        valid: false, 
        message: `集装箱重量 ${container.weightKg}kg 超过行最大承重限制 ${targetRow.maxWeightKg}kg` 
      };
    }

    // FR2.4 - 特殊箱约束验证：冷藏箱必须在冷藏区
    if (container.isReefer && !targetBay.isReeferReady) {
      return { valid: false, message: "冷藏箱必须放置在冷藏区" };
    }

    // FR2.2 - 目的港约束验证：目的港靠前的不能被压在靠后的下面
    // 检查下方所有集装箱的目的港
    const containersBelow = getContainersInColumn(targetBayNumber, targetRowNumber)
      .filter(item => item.tier > targetTier && item.container);
    
    for (const item of containersBelow) {
      if (item.container.pod < container.pod) {
        return { 
          valid: false, 
          message: `违反目的港顺序：${container.pod} 不能放在 ${item.container.pod} 上方`
        };
      }
    }

    // FR2.3 - 重量约束验证：重下轻上
    // 检查上方所有集装箱的重量
    const containersAbove = getContainersInColumn(targetBayNumber, targetRowNumber)
      .filter(item => item.tier < targetTier && item.container);
    
    for (const item of containersAbove) {
      if (item.container.weightKg < container.weightKg) {
        return { 
          valid: false, 
          message: `违反重量约束：重量 ${container.weightKg}kg 的集装箱不能放在重量 ${item.container.weightKg}kg 的集装箱下方（重下轻上原则）` 
        };
      }
    }

    // 检查下方所有集装箱的重量
    for (const item of containersBelow) {
      if (item.container.weightKg < container.weightKg) {
        return { 
          valid: false, 
          message: `违反重量约束：重量 ${container.weightKg}kg 的集装箱不能放在重量 ${item.container.weightKg}kg 的集装箱上方（重下轻上原则）` 
        };
      }
    }

    // FR2.4 - 危险品隔离约束：周围一格内不能有其他集装箱
    if (container.isHazardous) {
      const adjacentSlots = getAdjacentSlots(targetBayNumber, targetRowNumber, targetTier);
      const adjacentContainers = adjacentSlots.filter(slot => slot.container && slot.container.containerId !== container.containerId);
      
      if (adjacentContainers.length > 0) {
        return { 
          valid: false, 
          message: "危险品箱周围一格内不能有其他集装箱" 
        };
      }
    }

    // 检查是否有其他危险品箱在目标位置附近
    const adjacentSlots = getAdjacentSlots(targetBayNumber, targetRowNumber, targetTier);
    const adjacentHazardous = adjacentSlots.filter(slot => 
      slot.container && 
      slot.container.isHazardous && 
      slot.container.containerId !== container.containerId
    );
    
    if (adjacentHazardous.length > 0) {
      return { 
        valid: false, 
        message: "目标位置附近有危险品箱，不能放置其他集装箱" 
      };
    }

    return { valid: true };
  };

  // 获取指定列（bay-row）中的所有槽位信息
  const getContainersInColumn = (bayNumber, rowNumber) => {
    const bay = stowageStore.stowageData.bayDetails.find(b => b.bayNumber === bayNumber);
    if (!bay) return [];

    const row = bay.rows.find(r => r.rowNumber === rowNumber);
    if (!row) return [];

    return row.slots || [];
  };

  // 获取相邻槽位（上、下、左、右）
  const getAdjacentSlots = (bayNumber, rowNumber, tier) => {
    const result = [];
    const bay = stowageStore.stowageData.bayDetails.find(b => b.bayNumber === bayNumber);
    if (!bay) return result;

    const currentRow = bay.rows.find(r => r.rowNumber === rowNumber);
    if (!currentRow) return result;

    // 上方槽位（tier - 1）
    if (tier > 1) {
      const locationCodeAbove = `${bayNumber}${rowNumber}${(tier - 1).toString().padStart(3, '0')}`;
      const containerAbove = stowageStore.stowageData.assignments.find(a => a.locationCode === locationCodeAbove);
      result.push({
        bayNumber,
        rowNumber,
        tier: tier - 1,
        locationCode: locationCodeAbove,
        container: containerAbove
      });
    }

    // 下方槽位（tier + 1）
    if (tier < currentRow.maxTiers) {
      const locationCodeBelow = `${bayNumber}${rowNumber}${(tier + 1).toString().padStart(3, '0')}`;
      const containerBelow = stowageStore.stowageData.assignments.find(a => a.locationCode === locationCodeBelow);
      result.push({
        bayNumber,
        rowNumber,
        tier: tier + 1,
        locationCode: locationCodeBelow,
        container: containerBelow
      });
    }

    // 左侧行
    const rowNumberInt = parseInt(rowNumber);
    if (rowNumberInt > 1) {
      const leftRowNumber = (rowNumberInt - 1).toString().padStart(2, '0');
      const leftRow = bay.rows.find(r => r.rowNumber === leftRowNumber);
      if (leftRow && tier <= leftRow.maxTiers) {
        const locationCodeLeft = `${bayNumber}${leftRowNumber}${tier.toString().padStart(3, '0')}`;
        const containerLeft = stowageStore.stowageData.assignments.find(a => a.locationCode === locationCodeLeft);
        result.push({
          bayNumber,
          rowNumber: leftRowNumber,
          tier,
          locationCode: locationCodeLeft,
          container: containerLeft
        });
      }
    }

    // 右侧行
    const maxRowNumber = Math.max(...bay.rows.map(r => parseInt(r.rowNumber)));
    if (rowNumberInt < maxRowNumber) {
      const rightRowNumber = (rowNumberInt + 1).toString().padStart(2, '0');
      const rightRow = bay.rows.find(r => r.rowNumber === rightRowNumber);
      if (rightRow && tier <= rightRow.maxTiers) {
        const locationCodeRight = `${bayNumber}${rightRowNumber}${tier.toString().padStart(3, '0')}`;
        const containerRight = stowageStore.stowageData.assignments.find(a => a.locationCode === locationCodeRight);
        result.push({
          bayNumber,
          rowNumber: rightRowNumber,
          tier,
          locationCode: locationCodeRight,
          container: containerRight
        });
      }
    }

    return result;
  };

  return {
    validateContainerMove
  };
}