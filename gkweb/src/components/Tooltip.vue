<template>
  <div class="tooltip" :style="tooltipStyle">
    <div class="tooltip-header">{{ container.containerId }}</div>
    <div class="tooltip-body">
      <div><strong>目的港:</strong> {{ container.pod }}</div>
      <div><strong>重量:</strong> {{ container.weightKg }} kg</div>
      <div v-if="container.isReefer" class="reefer-flag">冷藏箱</div>
      <div v-if="container.isHazardous" class="hazardous-flag">危险品</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  container: {
    type: Object,
    required: true
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
});

const tooltipStyle = computed(() => ({
  left: `${props.position.x + 10}px`,
  top: `${props.position.y + 10}px`
}));
</script>

<style scoped>
.tooltip {
  position: absolute;
  z-index: 100;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 200px;
}

.tooltip-header {
  font-weight: bold;
  margin-bottom: 6px;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.reefer-flag {
  color: #1890ff;
  font-weight: bold;
}

.hazardous-flag {
  color: #f5222d;
  font-weight: bold;
}
</style>