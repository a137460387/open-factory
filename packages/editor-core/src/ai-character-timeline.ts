/**
 * AI character appearance timeline tracking.
 *
 * Samples frames at ~2s intervals, sends to Vision AI for character detection,
 * clusters characters within clips using IOU, and matches across clips using
 * Jaccard similarity on descriptor tags.
 */

import type { Project } from './model-types';

// --- Types ---

export interface CharacterBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterDescriptor {
  descriptorTags: string[];
  box: CharacterBoundingBox;
}

export interface CharacterFrameResult {
  time: number;
  characters: CharacterDescriptor[];
}

export interface CharacterAIResponse {
  frames: CharacterFrameResult[];
}

export interface CharacterAppearance {
  clipId: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface CharacterEntry {
  label: string;
  appearances: CharacterAppearance[];
}

export interface CharacterTimeline {
  characters: Record<string, CharacterEntry>;
  lastAnalyzedAt: string;
}

export interface ClusteredCharacter {
  id: number;
  descriptorTags: string[];
  appearances: Array<{ clipId: string; startTime: number; endTime: number; confidence: number }>;
}

// --- Constants ---

export const IOU_THRESHOLD = 0.4;
export const JACCARD_THRESHOLD = 0.6;
export const SAMPLE_INTERVAL_SECONDS = 2;

// --- Core algorithms ---

/**
 * Calculate Intersection over Union (IOU) of two bounding boxes.
 * Returns 0 if there is no overlap.
 */
export function calculateIOU(a: CharacterBoundingBox, b: CharacterBoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const union = areaA + areaB - intersection;

  if (union <= 0) return 0;
  return intersection / union;
}

/**
 * Calculate Jaccard similarity between two sets of descriptor tags.
 * Tags are compared case-insensitively after trimming.
 */
export function calculateJaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((t) => t.trim().toLowerCase()));
  const setB = new Set(b.map((t) => t.trim().toLowerCase()));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Cluster character descriptors within a single clip across frames.
 * Adjacent frames with box IOU > IOU_THRESHOLD are considered the same character.
 * Returns clustered characters with merged descriptor tags and time ranges.
 */
export function clusterCharactersInClip(
  frames: CharacterFrameResult[],
  clipId: string
): ClusteredCharacter[] {
  if (frames.length === 0) return [];

  // Each cluster tracks: id, merged tags, last-seen box, appearances
  interface Cluster {
    id: number;
    tags: Set<string>;
    lastBox: CharacterBoundingBox | null;
    appearances: Array<{ clipId: string; startTime: number; endTime: number; confidence: number }>;
  }

  const clusters: Cluster[] = [];
  let nextId = 0;

  for (const frame of frames) {
    const assigned = new Set<number>();

    for (const desc of frame.characters) {
      // Find best matching existing cluster by IOU
      let bestCluster: Cluster | null = null;
      let bestIOU = 0;

      for (let ci = 0; ci < clusters.length; ci += 1) {
        if (assigned.has(ci)) continue;
        const cluster = clusters[ci];
        if (!cluster.lastBox) continue;
        const iou = calculateIOU(cluster.lastBox, desc.box);
        if (iou > bestIOU) {
          bestIOU = iou;
          bestCluster = cluster;
        }
      }

      if (bestCluster && bestIOU > IOU_THRESHOLD) {
        // Merge into existing cluster
        bestCluster.lastBox = desc.box;
        for (const tag of desc.descriptorTags) {
          bestCluster.tags.add(tag.trim().toLowerCase());
        }
        const app = bestCluster.appearances[bestCluster.appearances.length - 1];
        if (app && app.clipId === clipId) {
          app.endTime = frame.time;
          app.confidence = Math.max(app.confidence, bestIOU);
        } else {
          bestCluster.appearances.push({ clipId, startTime: frame.time, endTime: frame.time, confidence: bestIOU });
        }
        assigned.add(clusters.indexOf(bestCluster));
      } else {
        // Create new cluster
        const newCluster: Cluster = {
          id: nextId,
          tags: new Set(desc.descriptorTags.map((t) => t.trim().toLowerCase())),
          lastBox: desc.box,
          appearances: [{ clipId, startTime: frame.time, endTime: frame.time, confidence: 0.5 }],
        };
        clusters.push(newCluster);
        assigned.add(clusters.length - 1);
        nextId += 1;
      }
    }

    // Reset lastBox for clusters not seen in this frame
    for (let ci = 0; ci < clusters.length; ci += 1) {
      if (!assigned.has(ci)) {
        clusters[ci].lastBox = null;
      }
    }
  }

  return clusters.map((c) => ({
    id: c.id,
    descriptorTags: [...c.tags],
    appearances: c.appearances,
  }));
}

/**
 * Match characters across clips using Jaccard similarity on descriptor tags.
 * Assigns consistent character IDs (character_1, character_2, ...).
 * Returns a CharacterTimeline suitable for storing in the project.
 */
export function matchCharactersAcrossClips(
  clipClusters: Array<{ clipId: string; characters: ClusteredCharacter[] }>
): CharacterTimeline {
  const characters: Record<string, CharacterEntry> = {};
  let nextCharId = 1;

  // Track global character ID assignments: "clipId:clusterId" -> characterId
  const assignments = new Map<string, string>();

  for (const clip of clipClusters) {
    for (const cluster of clip.characters) {
      const key = `${clip.clipId}:${cluster.id}`;
      let matchedCharId: string | null = null;
      let bestJaccard = 0;

      // Compare against all already-assigned characters
      for (const [charId, entry] of Object.entries(characters)) {
        const existingTags = entry.appearances.flatMap(() => {
          // Collect tags from the character's tag set
          return entry.label.split(',').map((t) => t.trim()).filter(Boolean);
        });
        // Use the character's label as a proxy for its tags
        // Actually, we need to store tags separately. For matching, use the descriptorTags directly.
        // We'll compute against all tags associated with this character.
        const charTags = collectCharacterTags(charId, clipClusters, assignments);
        const jaccard = calculateJaccardSimilarity(cluster.descriptorTags, charTags);
        if (jaccard > bestJaccard) {
          bestJaccard = jaccard;
          matchedCharId = charId;
        }
      }

      if (matchedCharId && bestJaccard > JACCARD_THRESHOLD) {
        // Merge into existing character
        assignments.set(key, matchedCharId);
        const entry = characters[matchedCharId];
        for (const app of cluster.appearances) {
          entry.appearances.push(app);
        }
      } else {
        // Create new character
        const charId = `character_${nextCharId}`;
        nextCharId += 1;
        assignments.set(key, charId);
        const label = generateLabel(cluster.descriptorTags);
        characters[charId] = {
          label,
          appearances: [...cluster.appearances],
        };
      }
    }
  }

  return {
    characters,
    lastAnalyzedAt: new Date().toISOString(),
  };
}

/**
 * Generate a human-readable label from descriptor tags.
 * Uses the first 2-3 most specific tags.
 */
function generateLabel(tags: string[]): string {
  if (tags.length === 0) return 'unknown';
  const sorted = [...tags].sort((a, b) => b.length - a.length);
  return sorted.slice(0, Math.min(3, sorted.length)).join(', ');
}

/**
 * Collect all descriptor tags associated with a character across all clips.
 */
function collectCharacterTags(
  charId: string,
  clipClusters: Array<{ clipId: string; characters: ClusteredCharacter[] }>,
  assignments: Map<string, string>
): string[] {
  const tags: string[] = [];
  for (const clip of clipClusters) {
    for (const cluster of clip.characters) {
      const key = `${clip.clipId}:${cluster.id}`;
      if (assignments.get(key) === charId) {
        tags.push(...cluster.descriptorTags);
      }
    }
  }
  return [...new Set(tags.map((t) => t.trim().toLowerCase()))];
}

/**
 * Calculate frame sample times for a clip.
 * Samples at SAMPLE_INTERVAL_SECONDS intervals, plus the middle frame.
 */
export function calculateFrameSampleTimes(clipDuration: number): number[] {
  if (clipDuration <= 0) return [0];
  const times: number[] = [];
  const midTime = clipDuration / 2;
  times.push(midTime);

  // Add interval samples from start
  let t = 0;
  while (t < clipDuration) {
    if (!times.includes(t)) times.push(t);
    t += SAMPLE_INTERVAL_SECONDS;
  }
  // Ensure end frame
  const endTime = Math.max(0, clipDuration - 0.1);
  if (!times.includes(endTime)) times.push(endTime);

  return times.sort((a, b) => a - b);
}

/**
 * Build an AI prompt for character detection from sampled frames.
 */
export function buildCharacterDetectionPrompt(sampleTimes: number[]): string {
  const lines = [
    '你是一个专业的视频人物识别助手。以下是一段视频中的采样帧信息。',
    '请检测每个帧中出现的人物，为每个人返回描述性标签(descriptorTags)和边界框(box)。',
    '不要返回真实姓名或身份，只返回外观描述标签（如"戴眼镜的男性"、"红色上衣的人物"）。',
    '',
    '返回严格JSON格式:',
    '{',
    '  "frames": [',
    '    {',
    '      "time": 秒数,',
    '      "characters": [',
    '        {',
    '          "descriptorTags": ["标签1", "标签2"],',
    '          "box": { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1 }',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    '采样帧时间点:',
  ];
  for (const t of sampleTimes) {
    lines.push(`  - ${t.toFixed(1)}s`);
  }
  return lines.join('\n');
}

/**
 * Parse AI character detection response.
 */
export function parseCharacterDetectionResponse(json: string): CharacterAIResponse | null {
  try {
    const parsed = JSON.parse(json) as CharacterAIResponse;
    if (!Array.isArray(parsed.frames)) return null;
    for (const frame of parsed.frames) {
      if (typeof frame.time !== 'number' || !Array.isArray(frame.characters)) return null;
      for (const ch of frame.characters) {
        if (!Array.isArray(ch.descriptorTags) || !ch.box) return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rename a character label in the timeline.
 * Returns a new CharacterTimeline with the updated label.
 */
export function renameCharacter(
  timeline: CharacterTimeline,
  characterId: string,
  newLabel: string
): CharacterTimeline {
  if (!timeline.characters[characterId]) return timeline;
  return {
    ...timeline,
    characters: {
      ...timeline.characters,
      [characterId]: {
        ...timeline.characters[characterId],
        label: newLabel,
      },
    },
  };
}
