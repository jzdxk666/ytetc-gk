import { defineStore } from 'pinia';
import { parseStowageData } from '@/utils/parser';

export const useStowageStore = defineStore('stowage', {
  state: () => ({
    rawData: null,
    stowageData: null,
    selectedContainer: null,
    error: null,
    isLoading: false
  }),
  actions: {
    async loadData(jsonData) {
      this.isLoading = true;
      try {
        this.rawData = jsonData;
        this.stowageData = parseStowageData(jsonData);
        this.error = null;
      } catch (err) {
        this.error = '文件解析失败: ' + err.message;
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    selectContainer(container) {
      this.selectedContainer = container;
    },

    moveContainer(moveInfo) {
      if (!this.stowageData) return false;

      // 1. 找到源容器
      const assignmentIndex = this.stowageData.assignments.findIndex(
        a => a.containerId === moveInfo.containerId
      );
      if (assignmentIndex === -1) return false;

      // 2. 检查目标位置是否已有容器
      const targetLocationCode = `${moveInfo.to.bay}${moveInfo.to.row}${moveInfo.to.tier.toString().padStart(3, '0')}`;
      const existingContainer = this.stowageData.assignments.find(
        a => a.locationCode === targetLocationCode && a.containerId !== moveInfo.containerId
      );
      if (existingContainer) return false;

      // 3. 更新容器位置
      this.stowageData.assignments[assignmentIndex] = {
        ...this.stowageData.assignments[assignmentIndex],
        bay: moveInfo.to.bay,
        row: moveInfo.to.row,
        tier: moveInfo.to.tier,
        locationCode: targetLocationCode
      };

      // 4. 更新操作指标
      this.stowageData.metrics.totalMoves += 1;

      return true;
    },

    resetSelection() {
      this.selectedContainer = null;
    }
  },
  getters: {
    bayRenderData: (state) => {
      if (!state.stowageData) return [];
      
      return state.stowageData.bayDetails.map(bay => {
        const rowsWithContainers = bay.rows.map(row => {
          const slots = Array.from({ length: row.maxTiers }, (_, i) => {
            const tier = i + 1;
            const locationCode = `${bay.bayNumber}${row.rowNumber}${tier.toString().padStart(3, '0')}`;
            const container = state.stowageData.assignments.find(
              a => a.locationCode === locationCode
            );
            
            return {
              bayNumber: bay.bayNumber,
              rowNumber: row.rowNumber,
              tier,
              container,
              locationCode,
              maxWeight: row.maxWeightKg,
              isReeferReady: bay.isReeferReady
            };
          });

          return {
            ...row,
            slots
          };
        });

        return {
          ...bay,
          rows: rowsWithContainers
        };
      });
    }
  }
});