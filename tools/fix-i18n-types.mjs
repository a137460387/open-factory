import { readFileSync, writeFileSync } from 'fs';

const path = 'apps/desktop/src/i18n/strings.ts';
let s = readFileSync(path, 'utf8');

// Fix all the arrow functions in the new sections to have typed params
const replacements = [
  ['matchScore: (score) =>', 'matchScore: (score: number) =>'],
  ['entryCount: (count) =>', 'entryCount: (count: number) =>'],
  ['syncMarkerPair: (label) =>', 'syncMarkerPair: (label: string) =>'],
  ['nestedSequence: (name) =>', 'nestedSequence: (name: string) =>'],
  ['totalSubtitles: (count) =>', 'totalSubtitles: (count: number) =>'],
  ['alignedCount: (count) =>', 'alignedCount: (count: number) =>'],
  ['warningCount: (count) =>', 'warningCount: (count: number) =>'],
  ['offsetMs: (ms) =>', 'offsetMs: (ms: number) =>'],
  ['repairSuccess: (count) =>', 'repairSuccess: (count: number) =>'],
  ['repairFailed: (count) =>', 'repairFailed: (count: number) =>'],
  ['totalCount: (count) =>', 'totalCount: (count: number) =>'],
  ['lastRun: (time) =>', 'lastRun: (time: string) =>'],
  ['historyEntry: (success, failed, duration) =>', 'historyEntry: (success: number, failed: number, duration: string) =>'],
  ['progress: (current, total) =>', 'progress: (current: number, total: number) =>'],
];

for (const [from, to] of replacements) {
  s = s.replace(from, to);
}

writeFileSync(path, s, 'utf8');
console.log('Type annotations added');

