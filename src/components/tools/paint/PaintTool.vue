<template>
  <div class="overlay-no-events">
    <PaintWidget2D
      v-if="active"
      :slice="slice"
      :view-id="viewId"
      :view-direction="viewDirection"
      :widget-manager="widgetManager"
    />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import { usePaintToolStore } from '@/src/store/tools/paint';
import { LPSAxisDir } from '@/src/types/lps';
import PaintWidget2D from './PaintWidget2D.vue';

export default defineComponent({
  name: 'PaintTool',
  props: {
    viewId: {
      type: String,
      required: true,
    },
    slice: {
      type: Number,
      required: true,
    },
    viewDirection: {
      type: String as PropType<LPSAxisDir>,
      required: true,
    },
    widgetManager: {
      type: Object as PropType<vtkWidgetManager>,
      required: true,
    },
  },
  components: {
    PaintWidget2D,
  },
  setup() {
    const paintStore = usePaintToolStore();
    const active = computed(() => paintStore.isActive);

    return {
      active,
    };
  },
});
</script>

<style scoped src="@/src/components/styles/vtk-view.css"></style>
