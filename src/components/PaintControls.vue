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
            :items="labelmaps"
            item-text="name"
            item-value="id"
            :value="currentLabelmap"
            @input="setCurrentLabelmap"
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
        <v-btn
          small
          text
          color="blue"
          :disabled="palette.length >= numOfSwatches"
          @click="createNewLabel"
        >
          <v-icon small class="mr-2">mdi-plus-circle</v-icon>
          New Label
        </v-btn>
      </div>
      <v-radio-group
        dense
        class="scrolled-radios mt-0 pt-0"
        :value="currentLabel"
        @change="setCurrentLabel"
      >
        <div
          v-for="(item, idx) in palette"
          :key="idx"
          class="d-flex flex-row align-center"
        >
          <v-radio class="mb-0" :value="item.label" />
          <paint-label-editor
            :name="item.name"
            :label="item.label"
            :read-only="item.label === 0"
            :label-validator="validateLabelValue(idx - 1)"
            @change:label="setLabelValue(idx - 1, $event)"
            @change:name="setLabelName(idx - 1, $event)"
            @delete="deleteLabel(item.label)"
          />
        </div>
      </v-radio-group>
    </v-container>
  </v-card>
</template>

<script>
import { computed, defineComponent } from '@vue/composition-api';

import { useStore, useComputedState } from '@/src/composables/store';
import { DataTypes, NO_SELECTION, LABEL_SWATCHES } from '@/src/constants';

import PaintLabelEditor from './PaintLabelEditor.vue';

export default defineComponent({
  name: 'PaintControls',

  components: {
    PaintLabelEditor,
  },

  setup() {
    const store = useStore();

    const { radius, paintContext, labelmaps, currentLabelmap } =
      useComputedState({
        radius: {
          get: (state) => state.annotations.radius,
          set: (dispatch, val) => dispatch('annotations/setRadius', val),
        },
        currentLabelmap: (state) => {
          const { selectedBaseImage } = state;
          const { currentLabelmapForImage } = state.annotations;
          return currentLabelmapForImage[selectedBaseImage] ?? NO_SELECTION;
        },
        paintContext: (state) => {
          const { selectedBaseImage } = state;
          const { currentLabelmapForImage, paintContexts } = state.annotations;
          const labelmap = currentLabelmapForImage[selectedBaseImage];
          if (labelmap in paintContexts) {
            return paintContexts[labelmap];
          }
          return null;
        },
        labelmaps: (state) => {
          const { selectedBaseImage, data } = state;
          const children = state.dataAssoc.childrenOf[selectedBaseImage] ?? [];
          return children
            .filter(
              (childId) => data.index[childId].type === DataTypes.Labelmap
            )
            .map((id) => {
              const info = data.index[id];
              return {
                id,
                name: info.name,
              };
            });
        },
      });
    const palette = computed(() => [
      { label: 0, name: 'Eraser' },
      ...paintContext.value?.palette,
    ]);
    const currentLabel = computed(() => paintContext.value?.currentLabel);

    const setLabelName = (index, name) => {
      store.dispatch('annotations/setLabelName', { index, name });
    };

    const validateLabelValue = (index) => (value) => {
      if (value <= 0 || value >= LABEL_SWATCHES.length) {
        return false;
      }
      for (let i = 0; i < palette.value.length; i++) {
        if (index !== i) {
          if (value === palette.value[i].label) {
            return false;
          }
        }
      }
      return true;
    };

    const setLabelValue = (index, value) => {
      if (validateLabelValue(index)(value) === true) {
        store.dispatch('annotations/setLabelValue', {
          labelmapID: currentLabelmap.value,
          index,
          value,
        });
      }
    };

    const deleteLabel = (label) =>
      store.dispatch('annotations/deleteLabel', {
        labelmapID: currentLabelmap.value,
        label,
      });

    const setCurrentLabelmap = (id) =>
      store.dispatch('annotations/selectLabelmap', id);

    const setCurrentLabel = (newLabel) =>
      store.dispatch('annotations/selectLabel', {
        labelmapID: currentLabelmap.value,
        newLabel,
      });

    const createNewLabel = async () => {
      const label = await store.dispatch(
        'annotations/createLabel',
        currentLabelmap.value
      );
      if (label > 0) {
        await setCurrentLabel(label);
      }
    };

    return {
      numOfSwatches: LABEL_SWATCHES.length,
      radius,
      labelmaps,
      currentLabel,
      currentLabelmap,
      palette,
      setLabelName,
      setLabelValue,
      validateLabelValue,
      setCurrentLabelmap,
      setCurrentLabel,
      deleteLabel,
      createNewLabel,
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
