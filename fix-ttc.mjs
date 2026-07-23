import { readFileSync, writeFileSync } from 'rs';
const file = 'apps/desktop/src/components/Timeline/TimelineTracksContainer.tsx';
let c = readFileSync(file, 'utf8');
const R = [
  ['ticks: any[]','ticks: TimelineRulerTick[]'],
  ['renderCacheRanges: any[]','renderCacheRanges: TimelineRenderRange[]'],
  ['staleRanges: any[]','staleRanges: TimelineRenderRange[]'],
