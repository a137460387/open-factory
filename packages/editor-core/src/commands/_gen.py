
import os
filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline-commands.ts')
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()
L = lambda n: lines[n-1].rstrip()
def ext(s, e): return [L(i) for i in range(s, e+1)]
def wr(name, c):
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    with open(p, 'w', encoding='utf-8') as f: f.write(chr(10).join(c))
    print(f'{name}: {len(c)} lines')

# multicam-commands.ts
mm = []
for imp in [
    'import {', '  createId,', '  createMulticamClip,', '  normalizeMulticamSequence,', '  replaceProjectActiveTimeline,', '  type Clip,', '  type Project,', "} from '../model';",
    'import type {', '  MulticamClip,', '  MulticamClipAngle,', '  MulticamSyncMode,', '  SwitchPoint,', '  SwitchTransition,', "} from '../model-types';",
    'import {', '  createMulticamSequenceProject,', '  setMulticamSwitch,', '  trimMulticamSwitch,', '  addSwitchPoint,', '  deleteSwitchPoint,', '  updateSwitchPoint,', "} from '../multicam';",
    "import { replaceClip } from '../timeline';", "import { round } from '../time';",
    "import type { Command } from './command';", "import { type ProjectAccessor, findClip, touchProject, insertClip } from './helpers';",
    '',
]: mm.append(imp)
for s, e in [(4313,4358),(4361,4384),(4387,4436),(4180,4216),(4219,4241),(6474,6521),(6750,6789),(6795,6835),(6841,6877),(6883,6920),(6926,6964),(6970,7010)]:
    mm.extend(ext(s, e)); mm.append('')
wr('multicam-commands.ts', mm)

# subtitle-commands.ts
st = []
for imp in [
    "import { createTrack, type Clip, type Timeline, type Track } from '../model';",
    "import type { SubtitleDataImportMode } from '../subtitles/data-import';",
    "import type { SubtitleProofreadingFix } from '../subtitles/proofreading';",
    'import {', '  calculateSubtitleAlignmentUpdates,', '  calculateSubtitleShiftUpdates,', '  type SubtitleAlignmentOptions,', '  type SubtitleAlignmentReport,', '  type SubtitleTimingUpdate,', "} from '../subtitles/retiming';",
    "import { round } from '../time';", "import type { Command } from './command';",
    "import { type TimelineAccessor, findClip, timelineHasOverlaps } from './helpers';",
    '',
]: st.append(imp)
for s, e in [(3195,3202),(3205,3271),(3455,3510),(3513,3541),(3544,3575),(3578,3637),(3640,3693)]:
    st.extend(ext(s, e)); st.append('')
wr('subtitle-commands.ts', st)

# sequence-commands.ts
sq = []
for imp in [
    'import {', '  createId,', '  createNestedSequenceClip,', '  createSequence,', '  createTrack,', '  DEFAULT_NESTED_SEQUENCE_NAME,', '  normalizeColorCorrection,', '  normalizeChromaKey,', '  normalizeClipPanoramaView,', '  normalizeClipProjection,', '  normalizeFrameInterpolation,', '  normalizeMasks,', '  normalizeMotionTrack,', '  normalizeQualityEnhancement,', '  normalizeSequenceFrameRate,', '  normalizeSlowMotionMode,', '  normalizeStabilization,', '  normalizeVideoRestoration,', '  normalizeAudioDenoise,', '  replaceProjectActiveTimeline,', '  type Clip,', '  type Project,', "} from '../model';",
    "import { normalizeClipKeyframes, cloneClipKeyframes } from '../keyframes';", "import { cloneEffects } from '../effects';",
    "import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';",
    "import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../credits-roll';",
    "import { normalizeMotionGraphic } from '../motion-graphics';", "import type { Command } from './command';",
    'import {', '  type ProjectAccessor,', '  findClip,', '  findClipLocation,', '  findTrack,', '  timelineHasOverlaps,', '  insertClip,', '  touchProject,', "} from './helpers';",
    '',
]: sq.append(imp)
for s, e in [(6524,6573),(6371,6471),(4156,4177)]:
    sq.extend(ext(s, e)); sq.append('')
wr('sequence-commands.ts', sq)

# color-fx-commands.ts
cf = []
for imp in [
    'import {', '  createMask,', '  normalizeClipBorder,', '  normalizeMask,', '  normalizeMasks,', '  normalizeStabilization,', '  normalizeTransform,', '  type Clip,', '  type ClipBorder,', '  type ClipMask,', '  type ClipStabilization,', '  type Timeline,', "} from '../model';",
    "import { detectOverlap, replaceClip } from '../timeline';",
    'import {', '  calculatePiPTransform,', '  createFullFrameTransform,', '  type PiPLayoutPosition,', "} from '../pip-layout';",
    'import {', '  calculateSplitLayoutTransforms,', '  type SplitLayoutDefinition,', '  type SplitLayoutClipSource,', "} from '../split-layout';",
    "import type { Command } from './command';",
    'import {', '  type TimelineAccessor,', '  findClip,', '  findTrack,', '  mergeChromaKeyPatch,', '  isPiPVisualClip,', "} from './helpers';",
    '',
]: cf.append(imp)
for s, e in [(4439,4470),(4473,4518),(4521,4555),(4558,4601),(5642,5735),(5742,5805)]:
    cf.extend(ext(s, e)); cf.append('')
wr('color-fx-commands.ts', cf)

print('All done!')
