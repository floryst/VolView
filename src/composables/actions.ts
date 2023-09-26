import { useToolStore } from '../store/tools';
import { Tools } from '../store/tools/types';
import { useRectangleStore } from '../store/tools/rectangles';
import { useRulerStore } from '../store/tools/rulers';
import { usePolygonStore } from '../store/tools/polygons';
import { Action } from '../constants';

const applyLabelOffset = (offset: number) => {
  const toolToStore = {
    [Tools.Rectangle]: useRectangleStore(),
    [Tools.Ruler]: useRulerStore(),
    [Tools.Polygon]: usePolygonStore(),
  };
  const toolStore = useToolStore();

  // @ts-ignore - toolToStore may not have keys of all tools
  const activeToolStore = toolToStore[toolStore.currentTool];
  if (!activeToolStore) return;

  const labels = Object.entries(activeToolStore.labels);
  const activeLabelIndex = labels.findIndex(
    ([name]) => name === activeToolStore.activeLabel
  );

  const [nextLabel] = labels.at((activeLabelIndex + offset) % labels.length)!;
  activeToolStore.setActiveLabel(nextLabel);
};

export const ACTION_TO_FUNC = {
  'decrement-label': () => applyLabelOffset(-1),
  'increment-label': () => applyLabelOffset(1),
} satisfies Record<Action, () => void>;
