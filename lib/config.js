/**
 * WikiSemanticImgSearch — Configuration
 * Categories, resolutions, and defaults ported from jio-commons-screensaver-harvester
 */

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const VECTOR_DB_API = 'https://wd-vectordb.wmcloud.org';
export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

export const DEFAULTS = {
  maxResults: 40,
  thumbWidth: 400,
  apiTimeout: 30000,
  pixelTolerance: 20,
  vectorK: 20,
};

/** Preset categories from Wiki Loves campaigns */
export const PRESET_CATEGORIES = [
  {
    group: 'Wiki Loves Monuments 2025',
    items: [
      { label: 'All WLM 2025', value: 'Images_from_Wiki_Loves_Monuments_2025' },
      { label: 'WLM 2025 India', value: 'Images_from_Wiki_Loves_Monuments_2025_in_India' },
      { label: 'WLM 2025 Germany', value: 'Images_from_Wiki_Loves_Monuments_2025_in_Germany' },
      { label: 'WLM 2025 France', value: 'Images_from_Wiki_Loves_Monuments_2025_in_France' },
      { label: 'WLM 2025 Italy', value: 'Images_from_Wiki_Loves_Monuments_2025_in_Italy' },
      { label: 'WLM 2025 Spain', value: 'Images_from_Wiki_Loves_Monuments_2025_in_Spain' },
    ],
  },
  {
    group: 'Wiki Loves Folklore',
    items: [
      { label: 'All Folklore', value: 'Images_from_Wiki_Loves_Folklore' },
      { label: 'Folklore 2025', value: 'Images_from_Wiki_Loves_Folklore_2025' },
      { label: 'Folklore 2024', value: 'Images_from_Wiki_Loves_Folklore_2024' },
      { label: 'Folklore 2023', value: 'Images_from_Wiki_Loves_Folklore_2023' },
      { label: 'Folklore Winners', value: 'Wiki_Loves_Folklore_winning_images' },
    ],
  },
  {
    group: 'Wiki Loves Birds',
    items: [
      { label: 'All Birds', value: 'Wiki_Loves_Birds' },
      { label: 'Birds Winners', value: 'Wiki_Loves_Birds_winning_images' },
      { label: 'Birds India', value: 'Wiki_Loves_Birds_India' },
      { label: 'Birds 2024', value: 'Wiki_Loves_Birds_2024' },
      { label: 'Birds 2023', value: 'Wiki_Loves_Birds_2023' },
    ],
  },
];

/** Common target resolutions with labels */
export const RESOLUTION_PRESETS = [
  { label: 'Any', width: null, height: null },
  { label: 'HD (1280×720)', width: 1280, height: 720 },
  { label: 'Full HD (1920×1080)', width: 1920, height: 1080 },
  { label: 'QHD (2560×1440)', width: 2560, height: 1440 },
  { label: '4K (3840×2160)', width: 3840, height: 2160 },
  { label: '6K (6000×4000)', width: 6000, height: 4000 },
];
