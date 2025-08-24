<template>
  <div class="app-container">
    <header class="app-header">
      <h1>船舶配载可视化平台</h1>
      <div class="file-upload">
        <input type="file" @change="handleFileUpload" accept=".json" />
        <button @click="exportStowagePlan">导出配载方案</button>
      </div>
    </header>

    <main class="app-main">
      <div v-if="!stowageStore.stowageData" class="empty-state">
        <p>请上传配载计划JSON文件</p>
      </div>

      <div v-else class="content-area">
        <div class="bay-plan-container">
          <BayPlan 
            :bayRenderData="bayRenderData"
            @container-hover="handleContainerHover"
            @container-leave="handleContainerLeave"
            @container-click="handleContainerClick"
            @container-drop="handleContainerDrop"
          />
          
          <Tooltip 
            v-if="hoveredContainer"
            :container="hoveredContainer"
            :position="tooltipPosition"
          />
        </div>

        <div class="sidebar">
          <div class="metrics">
            <h3>配载指标</h3>
            <div>总成本: {{ stowageStore.stowageData.metrics.cost }}</div>
            <div>总移动次数: {{ stowageStore.stowageData.metrics.totalMoves }}</div>
            <div>重新配载次数: {{ stowageStore.stowageData.metrics.totalReStows }}</div>
          </div>

          <div class="container-details" v-if="stowageStore.selectedContainer">
            <h3>集装箱详情</h3>
            <div>ID: {{ stowageStore.selectedContainer.containerId }}</div>
            <div>目的港: {{ stowageStore.selectedContainer.pod }}</div>
            <div>重量: {{ stowageStore.selectedContainer.weightKg }} kg</div>
            <div v-if="stowageStore.selectedContainer.isReefer">类型: 冷藏箱</div>
            <div v-if="stowageStore.selectedContainer.isHazardous">类型: 危险品</div>
            <div>位置: {{ stowageStore.selectedContainer.locationCode }}</div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
      <button @click="errorMessage = null">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStowageStore } from '@/stores/stowage';
import { useBayPlan } from '@/composables/useBayPlan';
import { useValidation } from '@/composables/useValidation';
import BayPlan from '@/components/BayPlan.vue';
import Tooltip from '@/components/Tooltip.vue';

const stowageStore = useStowageStore();
const { 
  bayRenderData, 
  hoveredContainer, 
  tooltipPosition,
  handleContainerHover,
  handleContainerLeave,
  handleContainerClick
} = useBayPlan();
const { validateContainerMove } = useValidation();
const errorMessage = ref(null);

// 处理文件上传
const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      stowageStore.loadData(jsonData);
    } catch (err) {
      errorMessage.value = '文件解析失败: ' + err.message;
    }
  };
  reader.readAsText(file);
};

// 处理集装箱拖放
const handleContainerDrop = (container, slot) => {
  const targetBay = slot.locationCode.substring(0, 2);
  const targetRow = slot.locationCode.substring(2, 4);
  const targetTier = slot.tier;

  const validation = validateContainerMove(container, targetBay, targetRow, targetTier);
  if (!validation.valid) {
    errorMessage.value = validation.message;
    return;
  }

  // 执行移动逻辑
  const success = stowageStore.moveContainer({
    containerId: container.containerId,
    to: { bay: targetBay, row: targetRow, tier: targetTier }
  });

  if (!success) {
    errorMessage.value = '移动失败，目标位置可能已被占用或数据不一致';
  }
};

// 导出配载方案
const exportStowagePlan = () => {
  if (!stowageStore.stowageData) {
    errorMessage.value = '没有可导出的配载方案';
    return;
  }

  const dataStr = JSON.stringify(stowageStore.stowageData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `stowage_plan_${new Date().toISOString().slice(0, 10)}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  background: #1a5276;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2rem;
  color: #666;
}

.content-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.bay-plan-container {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  position: relative;
}

.sidebar {
  width: 300px;
  border-left: 1px solid #ddd;
  padding: 1rem;
  overflow-y: auto;
}

.metrics, .container-details {
  background: #f9f9f9;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
}

.error-message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #f5222d;
  color: white;
  padding: 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>