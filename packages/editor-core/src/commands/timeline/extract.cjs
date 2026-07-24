const fs = require('fs');
const path = require('path');

const srcFile = path.resolve(__dirname, '../timeline-commands.ts');
const outDir = path.resolve(__dirname, '../timeline');
const content = fs.readFileSync(srcFile, 'utf-8');
const lines = content.split('\n');

function extractLines(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

// Parse import statements (lines 1-288)
const importStatements = [];
let currentImport = '';
let inImport = false;
for (let i = 0; i < 288; i++) {
  const line = lines[i];
  if (line.startsWith('import ')) {
    inImport = true;
    currentImport = line;
    if (line.includes("} from '") || line.includes("} from \"")) {
      importStatements.push({ raw: currentImport, line: i + 1 });
      currentImport = '';
      inImport = false;
    }
  } else if (inImport) {
    currentImport += '\n' + line;
    if (line.includes("} from '") || line.includes("} from \"")) {
      importStatements.push({ raw: currentImport, line: i + 1 });
      currentImport = '';
      inImport = false;
    }
  }
}

// Adjust import paths for the timeline/ subdirectory
function adjustImportPath(imp) {
  // From commands/timeline/ -> model is at ../../model
  return imp
    .replace(/from\s+['"]\.\.\/model['"]/, "from '../../model'")
    .replace(/from\s+['"]\.\.\/model-types['"]/, "from '../../model-types'")
    .replace(/from\s+['"]\.\/command['"]/, "from '../command'")
    .replace(/from\s+['"]\.\.\/(.+?)['"]/, "from '../../$1'");
}

// Collect all import symbols to figure out what each module needs
// For now, include all imports in each module (TypeScript will tree-shake)
const allImports = importStatements.map(i => adjustImportPath(i.raw)).join('\n');

// Module definitions with line ranges
const moduleDefs = [
  {
    name: 'timeline-operations',
    ranges: [
      [290, 298], [300, 311], [884, 973], [975, 1327],
      [1746, 1830], [3195, 3203], [4877, 4905], [5483, 5485],
      [5631, 5640], [5653, 5666], [5738, 5740], [6336, 6369],
      [6371, 6472], [6474, 6522], [6524, 6574], [6576, 6598],
      [7015, 7030],
    ],
  },
  {
    name: 'project-commands',
    ranges: [
      [313, 335], [337, 363], [366, 421], [424, 456],
      [505, 527], [529, 552], [554, 585], [587, 611],
      [613, 643], [645, 671], [673, 699], [701, 763],
      [1492, 1525], [2129, 2201], [2203, 2238], [6701, 6748],
    ],
  },
  {
    name: 'track-commands',
    ranges: [[1331, 1353], [1354, 1377], [1379, 1408], [1410, 1490]],
  },
  {
    name: 'clip-commands',
    ranges: [
      [2899, 2907], [3013, 3313], [4907, 4930], [5396, 5448],
      [5450, 5481], [5487, 5548], [5550, 5639], [5642, 5806],
      [5808, 5996], [5998, 6032], [6034, 6076], [6601, 6699],
    ],
  },
  {
    name: 'keyframe-commands',
    ranges: [[458, 503], [4931, 5307]],
  },
  {
    name: 'effect-commands',
    ranges: [[6078, 6235]],
  },
  {
    name: 'mask-commands',
    ranges: [[6237, 6334]],
  },
  {
    name: 'media-commands',
    ranges: [[765, 895], [1527, 1744]],
  },
  {
    name: 'annotation-commands',
    ranges: [[1832, 1978], [1979, 2127], [2472, 2808]],
  },
  {
    name: 'clip-group-commands',
    ranges: [[2240, 2425]],
  },
  {
    name: 'transition-commands',
    ranges: [[2811, 2896]],
  },
  {
    name: 'marker-commands',
    ranges: [[2899, 2978], [4657, 4686]],
  },
  {
    name: 'move-commands',
    ranges: [[3315, 3453]],
  },
  {
    name: 'subtitle-timing-commands',
    ranges: [[3455, 3694]],
  },
  {
    name: 'beat-commands',
    ranges: [[3696, 3827]],
  },
  {
    name: 'trim-commands',
    ranges: [[3828, 4178]],
  },
  {
    name: 'split-commands',
    ranges: [[4244, 4311]],
  },
  {
    name: 'multicam-commands',
    ranges: [[4180, 4242], [4313, 4437], [6750, 7010]],
  },
  {
    name: 'ai-edit-commands',
    ranges: [[2427, 2470], [4439, 4602], [4604, 4906]],
  },
  {
    name: 'color-grading-commands',
    ranges: [[7033, 7181]],
  },
  {
    name: 'text-animation-commands',
    ranges: [[5348, 5394]],
  },
];

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

// Create each module file
for (const mod of moduleDefs) {
  const codeBlocks = mod.ranges.map(([start, end]) => extractLines(start, end));
  const code = codeBlocks.join('\n\n');

  let fileContent;
  if (mod.name === 'timeline-operations') {
    // This module needs its own specific imports
    fileContent = `import type {
  Clip,
  ClipGroupBatchPatch,
  ClipMask,
  MediaMetadata,
  Project,
  ProjectAnnotation,
  ProtectedRange,
  ReviewAnnotation,
  Timeline,
  TimelineBookmark,
  TimelineMarker,
  TimelineNote,
  Track,
  Transition,
  CollaborationNote,
  ColorCorrection,
  ChromaKey,
} from '../../model';
import type { ColorGradingGraph } from '../../color-grading/types';
import { createEmptyColorGradingGraph } from '../../color-grading/types';
import { round } from '../../time';
import {
  detectOverlap,
  getClipDisplayDuration,
  getClipSourceVisibleDuration,
  getClipSpeed,
  getTimelineDuration,
  moveClip,
  removeClip,
  replaceClip,
  splitClip,
  trimClip,
  calculateSpeedCurveSourceDuration,
  areClipsAdjacent,
} from '../../timeline';
import { applyProtectedRippleDeleteToTrack } from '../../timeline-protection';
import {
  normalizeColorCorrection,
  normalizeChromaKey,
  normalizeClipProjection,
  normalizeClipPanoramaView,
  normalizeAudioFadeDuration,
  normalizeAudioFadeCurve,
  normalizeAudioChannelRouting,
  normalizeAudioDenoise,
  normalizeAudioPitchSemitones,
  normalizeClipBorder,
  normalizeClipBeatMarkers,
  normalizeCollaborationNotes,
  normalizeDetectedBpm,
  normalizeClipSceneCuts,
  normalizeFrameInterpolation,
  normalizeMask,
  normalizeMasks,
  normalizeMotionTrack,
  normalizeProjectAnnotation,
  normalizeReviewAnnotation,
  normalizeTimelineNote,
  normalizeTimelineNotes,
  normalizeExportRanges,
  normalizeProtectedRanges,
  normalizeMediaMetadataEntry,
  normalizeQualityEnhancement,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeSubtitleSoundDesc,
  normalizeSubtitleSpeaker,
  normalizeSubtitleTrackType,
  normalizeTextPath,
  normalizeTimelineBookmark,
  normalizeTimelineBookmarks,
  normalizeTimelineMarker,
  normalizeTransform,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeTrackPan,
  normalizeTrackVolume,
  normalizeVideoRestoration,
  replaceProjectActiveTimeline,
  createTrack,
  createSequence,
  createId,
  createNestedSequenceClip,
  createTimelineMarker,
  DEFAULT_NESTED_SEQUENCE_NAME,
  getProjectSequences,
  normalizeClipKeyframes,
  cloneClipKeyframes,
  normalizeClipKeyframes as normalizeClipKeyframesType,
  type ClipKeyframes,
  type KeyframeProperty,
  type SubtitleTrackType,
  type SubtitleMode,
} from '../../model';
import { createMulticamClip } from '../../model';
import { normalizeClipBlendMode } from '../../blend-modes';
import { normalizeClipContentAnalysis } from '../../content-analysis';
import { normalizeClipPitchData } from '../../audio-pitch';
import { normalizeDataSubtitleSource } from '../../data-subtitle';
import { normalizeSpatialAudio } from '../../spatial-audio';
import { normalizeMotionGraphic } from '../../motion-graphics';
import { normalizeRichTextDocument, normalizeTextLayout, normalizeTextOpenTypeFeatures, normalizeTextArc } from '../../text-layout';
import { cloneEffects, normalizeEffect, normalizeEffects } from '../../effects';
import { normalizeCreditsRows, normalizeCreditsRollSpeed, normalizeCreditsStyle } from '../../credits-roll';
import {
  setMulticamSwitch,
  trimMulticamSwitch,
  normalizeMulticamSequence,
} from '../../multicam';
import type { SequenceSettings } from '../../model-types';
import { recalculateClipStartsForFrameRate } from '../../sequence-settings';
import { createKeyframe, setKeyframeForProperty, removeKeyframeForProperty } from '../../keyframes';
import { normalizeClipKeyframes as normalizeClipKeyframesFn, cloneClipKeyframes as cloneClipKeyframesFn } from '../../keyframes';
import { normalizeSubtitleStyleTemplateStyle } from '../../subtitles/style-templates';
import type { TimelineLabelColor } from '../../timeline-color-labels';
import { normalizeTimelineLabelColor } from '../../timeline-color-labels';
import type { ClipSpatialAudio } from '../../spatial-audio';
import type { ClipGroupBatchPatch as ClipGroupBatchPatchType } from '../../clip-groups';

${code}`;
  } else {
    // For non-shared modules, import from timeline-operations and relevant external modules
    fileContent = `${allImports}
import {
  TimelineAccessor,
  ProjectAccessor,
  findClip,
  findTrack,
  findClipLocation,
  insertClip,
  assertClipsNotOnLockedTrack,
  timelineHasOverlaps,
  getProjectActiveClipIds,
  removeClipsFromTimeline,
  cloneCommandValue,
  touchProject,
  sortMarkers,
  sortAnnotations,
  sortReviewAnnotations,
  sortCollaborationNotes,
  sortTimelineNotes,
  sortBookmarks,
  applyClipGroupBatchPatch,
  buildSplitRanges,
  buildKeptRanges,
  replaceClipWithSlices,
  rippleDeleteTrackClips,
  mergeTimelineIntervals,
  findTrackGapAtTime,
  closeTrackGap,
  buildRollingTrimClips,
  buildSlipClip,
  buildSlideClipEdit,
  getClipTotalSourceDuration,
  normalizeLocalTimeRanges,
  insertGeneratedClips,
  replaceClipWithGeneratedClips,
  sortTimelineClips,
  cloneClipForNestedSequence,
  cutMulticamClip,
  trimMulticamClip,
  packNestedSequence,
  clampTrimValues,
  applySpeedKeyframeDuration,
  resolveSubtitleImportTarget,
  asReplaceableMediaClip,
  isReplaceableMediaClip,
  isPiPVisualClip,
  mergeChromaKeyPatch,
  normalizeAssetIdSet,
  assertMediaAssetsExist,
  collectProjectMediaIds,
  removeMediaAssets,
  mergeMediaReferences,
  updateClipColorGradingGraph,
  type LocalTimeRange,
  type SlideClipEditResult,
} from './timeline-operations';

${code}`;
  }

  const outFile = path.join(outDir, `${mod.name}.ts`);
  fs.writeFileSync(outFile, fileContent, 'utf-8');
  console.log(`Created ${mod.name}.ts (${fileContent.split('\n').length} lines)`);
}

// Create index.ts that re-exports everything
const indexContent = moduleDefs
  .map(mod => `export * from './${mod.name}';`)
  .join('\n');

fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent, 'utf-8');
console.log('\nCreated index.ts');
console.log('Done!');
