import { hexToRGBA } from '@/src/utils/common';

export const NO_PROXY = -1;
export const NO_SELECTION = -1;
export const NO_WIDGET = -1;

export const DataTypes = {
  Image: 'Image',
  Labelmap: 'Labelmap',
  Dicom: 'DICOM',
  Model: 'Model',
};

export const DEFAULT_LABELMAP_COLORS = {
  0: [0, 0, 0, 0], // eraser
  1: [255, 0, 0, 255],
};

export const LABEL_SWATCHES = [
  '#00000000', // eraser
  '#58b5e1',
  '#873c1a',
  '#55f17b',
  '#f90da0',
  '#78ab66',
  '#781486',
  '#19a71f',
  '#d339ee',
  '#1b511d',
  '#f79dcc',
  '#bce333',
  '#2b00c2',
  '#caa487',
  '#30408d',
  '#fd8c6e',
  '#3a718b',
  '#ba1a20',
  '#8270f6',
  '#f1d438',
  '#463a14',
];

export const LABEL_COLORMAP = LABEL_SWATCHES.reduce(
  (colorMap, swatch, index) => {
    const rgba = hexToRGBA(swatch);
    return {
      ...colorMap,
      [index]: [rgba.r, rgba.g, rgba.b, rgba.a],
    };
  },
  {}
);
