<template>
  <div class="bay-plan">
    <div v-for="bay in bayRenderData" :key="bay.bayNumber" class="bay">
      <h3 class="bay-title">Bay {{ bay.bayNumber }}</h3>
      <div class="bay-rows">
        <div v-for="row in bay.rows" :key="row.rowNumber" class="row">
          <div class="row-label">Row {{ row.rowNumber }}</div>
          <div class="slots">
            <div
              v-for="slot in row.slots"
              :key="`${bay.bayNumber}-${row.rowNumber}-${slot.tier}`"
              class="slot"
              :class="getSlotClasses(slot)"
              @click="handleSlotClick(slot)"
              @mouseover="(e) => handleSlotHover(slot, e)"
              @mouseleave="handleSlotLeave"
              @dragover.prevent
              @drop="(e) => handleSlotDrop(slot, e)"
            >
              <div 
                v-if="slot.container" 
                class="container"
                draggable="true"
                @dragstart="(e) => handleDragStart(slot.container, e)"
              >
                {{ getContainerDisplayId(slot.container.containerId) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  bayRenderData: {
    type: Array,
    required: true,
    default: () => []
  }
});

const emit = defineEmits([
  'container-hover',
  'container-leave',
  'container-click',
  'container-drop'
]);

// 获取槽位的CSS类
const getSlotClasses = (slot) => {
  return {
    'has-container': slot.container,
    'is-empty': !slot.container,
    'is-reefer': slot.container?.isReefer,
    'is-hazardous': slot.container?.isHazardous,
    [`pod-${slot.container?.pod.toLowerCase()}`]: slot.container?.pod
  };
};

// 处理槽位悬停
const handleSlotHover = (slot, event) => {
  if (slot.container) {
    emit('container-hover', slot.container, event);
  }
};

// 处理槽位离开
const handleSlotLeave = () => {
  emit('container-leave');
};

// 处理槽位点击
const handleSlotClick = (slot) => {
  if (slot.container) {
    emit('container-click', slot.container);
  }
};

// 处理拖拽开始
const handleDragStart = (container, event) => {
  event.dataTransfer.setData('text/plain', JSON.stringify(container));
  event.dataTransfer.effectAllowed = 'move';
};

// 处理槽位拖放
const handleSlotDrop = (slot, event) => {
  event.preventDefault();
  if (!slot.container) {
    try {
      const containerData = JSON.parse(event.dataTransfer.getData('text/plain'));
      emit('container-drop', containerData, slot);
    } catch (e) {
      console.error('Error parsing dropped container data:', e);
    }
  }
};

// 简化容器ID显示
const getContainerDisplayId = (containerId) => {
  return containerId.length > 5 ? `${containerId.substring(0, 3)}...` : containerId;
};
</script>

<style scoped>
.bay-plan {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  overflow: auto;
}

.bay {
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 10px;
}

.bay-title {
  margin-bottom: 10px;
  text-align: center;
  color: #333;
  font-size: 14px;
}

.bay-rows {
  display: flex;
  gap: 15px;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.row-label {
  font-size: 12px;
  text-align: center;
  color: #666;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slots {
  display: flex;
  flex-direction: column-reverse;
  gap: 3px;
}

.slot {
  width: 60px;
  height: 30px;
  border: 1px solid #e0e0e0;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.slot.is-empty {
  background-color: #f9f9f9;
}

.slot.has-container {
  font-weight: bold;
  color: white;
  font-size: 10px;
}

/* 目的港颜色编码 */
.slot.pod-hkg { background-color: #4CAF50; }
.slot.pod-sin { background-color: #2196F3; }
.slot.pod-nyc { background-color: #9C27B0; }
.slot.pod-lax { background-color: #FF9800; }
.slot[class*="pod-"]:not(.pod-hkg):not(.pod-sin):not(.pod-nyc):not(.pod-lax) {
  background-color: #607D8B;
}

/* 特殊箱样式 */
.slot.is-reefer {
  border: 2px solid #00BCD4;
}

.slot.is-hazardous {
  border: 2px solid #F44336;
  background-image: linear-gradient(
    45deg,
    transparent 65%,
    #F44336 65%,
    #F44336 80%,
    transparent 80%
  );
}

.slot:hover {
  transform: scale(1.05);
  z-index: 1;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
}
</style>