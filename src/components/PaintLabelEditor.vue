<template>
  <v-text-field
    dense
    hide-details
    class="align-center ml-1 mt-0"
    readonly
    :value="name"
    @input="$emit('change:name', $event)"
  >
    <template v-slot:prepend>
      <v-menu
        v-model="menu"
        :disabled="readOnly"
        :close-on-content-click="false"
        offset-x
      >
        <template v-slot:activator="{ on, attrs }">
          <div
            :style="{
              background: color,
            }"
            class="color-box"
            v-on="on"
            v-bind="attrs"
          />
        </template>
        <v-card>
          <v-color-picker
            v-model="internalColor"
            mode="hexa"
            hide-inputs
            hide-canvas
            hide-sliders
            show-swatches
            swatches-max-height="250"
            :swatches="swatches"
            @input="onColorPick"
          />
          <div class="red--text px-3 pb-3">{{ error }}</div>
        </v-card>
      </v-menu>
    </template>
    <template v-slot:append-outer>
      <v-btn
        :disabled="readOnly"
        icon
        class="mt-0 pt-0"
        @click="$emit('delete')"
      >
        <v-icon v-show="!readOnly">mdi-delete</v-icon>
      </v-btn>
    </template>
  </v-text-field>
</template>

<script>
import {
  computed,
  defineComponent,
  ref,
  toRefs,
  watch,
} from '@vue/composition-api';

import { LABEL_SWATCHES } from '@/src/constants';

function groupBy(arr, count) {
  const result = [];
  for (let i = 0; i < arr.length; i += count) {
    result.push(arr.slice(i, i + count));
  }
  return result;
}

export default defineComponent({
  name: 'PaintLabelEditor',
  props: {
    name: {
      type: String,
      required: true,
    },
    label: {
      type: Number,
      required: true,
      validator: (v) => Number.isSafeInteger(v) && v < LABEL_SWATCHES.length,
    },
    labelValidator: {
      type: Function,
      default: () => true,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { emit }) {
    const { label } = toRefs(props);
    const { labelValidator } = props;
    const menu = ref(false);
    const internalColor = ref('');
    const color = computed(() => LABEL_SWATCHES[label.value]);
    const internalLabel = computed(() =>
      LABEL_SWATCHES.indexOf(internalColor.value.toLowerCase())
    );
    const error = computed(() => {
      if (labelValidator(internalLabel.value)) {
        return '';
      }
      return 'Label already in use!';
    });

    const onColorPick = () => {
      if (labelValidator(internalLabel.value)) {
        emit('change:label', internalLabel.value);
      }
    };

    watch(
      color,
      (c) => {
        internalColor.value = c;
      },
      { immediate: true }
    );

    watch(menu, (visible) => {
      if (!visible && !labelValidator(internalLabel.value)) {
        internalColor.value = color.value;
      }
    });

    return {
      menu,
      error,
      color,
      internalColor,
      // ignore eraser swatch
      swatches: groupBy(LABEL_SWATCHES.slice(1), 4),
      onColorPick,
    };
  },
});
</script>

<style scoped>
.color-box {
  height: 24px;
  width: 24px;
}
</style>
