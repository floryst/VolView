<template>
  <item-group mandatory v-model="currentTool">
    <groupable-item
      v-slot:default="{ active, toggle }"
      :value="Tools.WindowLevel"
    >
      <tool-button
        size="40"
        icon="mdi-circle-half-full"
        name="Window/Level"
        :buttonClass="['tool-btn', active ? 'tool-btn-selected' : '']"
        :disabled="noBaseImage"
        @click="toggle"
      />
    </groupable-item>
    <groupable-item v-slot:default="{ active, toggle }" :value="Tools.Paint">
      <v-menu offset-x :close-on-content-click="false" :disabled="!active">
        <template v-slot:activator="{ attrs, on }">
          &nbsp;
          <tool-button
            size="40"
            icon="mdi-brush"
            name="Paint"
            :buttonClass="['tool-btn', active ? 'tool-btn-selected' : '']"
            :disabled="noBaseImage"
            @click.stop="toggle"
            v-on="on"
            v-bind="attrs"
          >
            <v-icon v-if="active" class="menu-more" size="18">
              mdi-menu-right
            </v-icon>
          </tool-button>
        </template>
        <paint-controls />
      </v-menu>
    </groupable-item>
    <groupable-item v-slot:default="{ active, toggle }" :value="Tools.Ruler">
      <tool-button
        size="40"
        icon="mdi-ruler"
        name="Ruler"
        :buttonClass="['tool-btn', active ? 'tool-btn-selected' : '']"
        :disabled="noBaseImage"
        @click="toggle"
      />
    </groupable-item>
    <groupable-item
      v-slot:default="{ active, toggle }"
      :value="Tools.Crosshairs"
    >
      <tool-button
        size="40"
        icon="mdi-crosshairs"
        name="Crosshairs"
        :buttonClass="['tool-btn', active ? 'tool-btn-selected' : '']"
        :disabled="noBaseImage"
        @click="toggle"
      />
    </groupable-item>
  </item-group>
</template>

<script>
import { defineComponent, ref, watch } from '@vue/composition-api';
import { useComputedState } from '@/src/composables/store';
import { useWidgetProvider } from '@/src/composables/widgetProvider';
import { NO_WIDGET, NO_SELECTION } from '@/src/constants';

import ToolButton from './ToolButton.vue';
import ItemGroup from './ItemGroup.vue';
import GroupableItem from './GroupableItem.vue';
import PaintControls from './PaintControls.vue';

const Tools = {
  WindowLevel: 'WindowLevel',
  Paint: 'Paint',
  Ruler: 'Ruler',
  Crosshairs: 'Crosshairs',
};

const WidgetSet = new Set([Tools.Paint, Tools.Ruler, Tools.Crosshairs]);

export default defineComponent({
  name: 'ToolStrip',
  components: {
    ToolButton,
    ItemGroup,
    GroupableItem,
    PaintControls,
  },
  setup(props, { emit }) {
    const currentTool = ref(Tools.WindowLevel); // string: tool name
    const allowPaintMenu = ref(false);

    const widgetProvider = useWidgetProvider();

    const { noBaseImage, focusedWidget } = useComputedState({
      noBaseImage: (state) => state.selectedBaseImage === NO_SELECTION,
      focusedWidget: (state) => state.widgets.focusedWidget,
    });

    // handle case when widget unfocuses self while tool is active
    // in such event, create a new widget
    watch(focusedWidget, (widgetId) => {
      if (widgetId === NO_WIDGET && WidgetSet.has(currentTool.value)) {
        const widget = widgetProvider.createWidget(currentTool.value);
        widgetProvider.focusWidget(widget.id);
      }
    });

    watch(currentTool, (curTool) => {
      // unfocus existing widgets
      widgetProvider.unfocus();

      if (curTool === Tools.WindowLevel) {
        // do something
      } else if (curTool === Tools.Paint) {
        emit('focus-module', 'Annotations');
      }

      if (WidgetSet.has(curTool)) {
        const widget = widgetProvider.createWidget(curTool);
        widgetProvider.focusWidget(widget.id);
      }
    });

    return {
      currentTool,
      allowPaintMenu,
      noBaseImage,
      Tools,
    };
  },
});
</script>

<style>
.tool-btn-selected {
  background-color: rgba(128, 128, 255, 0.7);
}
</style>

<style scoped>
.menu-more {
  position: absolute;
  right: -50%;
}
</style>
