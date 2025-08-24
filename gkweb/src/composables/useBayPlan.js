import { computed, ref } from 'vue';
import { useStowageStore } from '@/stores/stowage';

export function useBayPlan() {
  const stowageStore = useStowageStore();
  const hoveredContainer = ref(null);
  const tooltipPosition = ref({ x: 0, y: 0 });

  // 处理集装箱悬停事件
  const handleContainerHover = (container, event) => {
    hoveredContainer.value = container;
    tooltipPosition.value = {
      x: event.clientX,
      y: event.clientY
    };
  };

  // 处理集装箱离开事件
  const handleContainerLeave = () => {
    hoveredContainer.value = null;
  };

  // 处理集装箱点击事件
  const handleContainerClick = (container) => {
    stowageStore.selectContainer(container);
  };

  // 计算每个Bay的渲染数据
  const bayRenderData = computed(() => {
    if (!stowageStore.stowageData) return [];
    
    return stowageStore.stowageData.bayDetails.map(bay => {
      const rowsWithContainers = bay.rows.map(row => {
        // 初始化每个槽位
        const slots = Array.from({ length: row.maxTiers }, (_, i) => {
          const tier = i + 1;
          const locationCode = `${bay.bayNumber}${row.rowNumber}${tier.toString().padStart(3, '0')}`;
          const container = stowageStore.stowageData.assignments.find(
            a => a.locationCode === locationCode
          );
          
          return {
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
  });

  return {
    bayRenderData,
    hoveredContainer,
    tooltipPosition,
    handleContainerHover,
    handleContainerLeave,
    handleContainerClick
  };
}