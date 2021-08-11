<template>
  <v-card width="350px">
    <v-container>
      <v-row no-gutters align="center">
        <v-col>
          <v-select
            dense
            outlined
            hide-details
            label="Select or create a labelmap"
          />
        </v-col>
      </v-row>
      <v-row no-gutters align="center">
        <v-col>
          <v-slider
            v-model="radius"
            dense
            hide-details
            label="Radius"
            min="1"
            max="50"
          >
            <template v-slot:append>
              <v-text-field
                v-model="radius"
                class="mt-n1 pt-0"
                style="width: 40px"
                hide-details
                type="number"
                min="1"
                max="50"
              />
            </template>
          </v-slider>
        </v-col>
      </v-row>
      <div class="d-flex flex-row justify-space-between my-2">
        <div class="text-subtitle-1 form-label">Labels</div>
        <v-btn small text color="blue">
          <v-icon small class="mr-2">mdi-plus-circle</v-icon>
          New Label
        </v-btn>
      </div>
      <v-radio-group dense class="scrolled-radios mt-0 pt-0">
        <div
          v-for="(item, idx) in palette"
          :key="idx"
          class="d-flex flex-row align-center"
        >
          <v-radio class="mb-0" />
          <paint-label-editor
            :name="item.name"
            :label="item.label"
            :read-only="item.label === 0"
            :label-validator="validateLabelValue(idx)"
            @change:label="setLabelValue(idx, $event)"
            @change:name="setLabelName(idx, $event)"
          />
        </div>
      </v-radio-group>
    </v-container>
  </v-card>
</template>

<script>
import { defineComponent, reactive } from '@vue/composition-api';

import { useStore, useComputedState } from '@/src/composables/store';
import { LABEL_SWATCHES } from '@/src/constants';

import PaintLabelEditor from './PaintLabelEditor.vue';

export default defineComponent({
  name: 'PaintControls',

  components: {
    PaintLabelEditor,
  },

  setup() {
    const context = reactive({
      palette: [
        { label: 1, name: 'Label 1' },
        { label: 2, name: 'Lung' },
      ],
      currentLabel: 1,
    });

    const store = useStore();

    const { radius, paintContext } = useComputedState({
      radius: {
        get: (state) => state.annotations.radius,
        set: (dispatch, val) => dispatch('annotations/setRadius', val),
      },
      paintContext: (state) => {
        const { selectedBaseImage } = state;
        const { currentLabelmapForImage, paintContexts } = state.annotations;
        const currentLabelmap = currentLabelmapForImage[selectedBaseImage];
        if (currentLabelmap in paintContexts) {
          return paintContexts[currentLabelmap];
        }
        return null;
      },
    });
    console.log('ignore', paintContext);

    const setLabelName = (index, name) => {
      console.log('name', index, name);
      store.dispatch('annotations/setLabelName', { index, name });
    };

    const validateLabelValue = (index) => (value) => {
      if (value <= 0 || value >= LABEL_SWATCHES.length) {
        return false;
      }
      for (let i = 0; i < context.palette.length; i++) {
        if (index !== i) {
          if (value === context.palette[i].label) {
            return false;
          }
        }
      }
      return true;
    };

    const setLabelValue = (index, value) => {
      if (validateLabelValue(index)(value) === true) {
        console.log('value', index, value);
        context.palette[index].label = value;
        // store.dispatch('annotations/setLabelValue', { index, value });
      }
    };

    return {
      radius,
      currentLabel: context.currentLabel,
      palette: context.palette,
      setLabelName,
      setLabelValue,
      validateLabelValue,
    };
  },
});
</script>

<style scoped>
.form-label {
  color: rgba(0, 0, 0, 0.6);
}

.scrolled-radios {
  max-height: 300px;
  overflow: auto;
  /* prevents hover circle from clipping left */
  padding-left: 6px;
}
</style>
