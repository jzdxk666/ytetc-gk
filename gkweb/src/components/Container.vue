<template>
  <div
    class="container-slot"
    :class="{
      'has-container': slot.container,
      'is-reefer': slot.container?.isReefer,
      'is-hazardous': slot.container?.isHazardous,
      [`pod-${slot.container?.pod}`]: slot.container?.pod
    }"
    @click="handleClick"
    @dragover.prevent
    @drop="handleDrop"
    @mouseover="showTooltip"
    @mouseleave="hideTooltip"
  >
    <div v-if="slot.container" class="container">
      {{ slot.container.containerId.substring(0, 5) }}
    </div>
    <Tooltip v-if="showTooltipFlag && slot.container" :container="slot.container" />
  </div>
</template>