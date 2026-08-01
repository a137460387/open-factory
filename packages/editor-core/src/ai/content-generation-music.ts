/**
 * AI content generation - music generation
 */

import {clamp} from '../utils/math';
import {
  generateId,
  GENRE_DEFAULT_TEMPO,
  GENRE_DEFAULT_KEY,
  MOOD_INTENSITY_BASE,
  type GeneratedContent,
  type MusicGenerationConfig,
  type MusicGenre,
  type MusicMood,
  type MusicSection,
  type MusicStructure,
} from './content-generation-types';

/**
 * 生成音乐结构
 *
 * 基于风格、情绪、时长和节奏生成 intro-verse-chorus-outro 结构。
 * 每个段落有起始拍号、结束拍号和强度值。
 *
 * @param genre - 音乐风格
 * @param mood - 音乐情绪
 * @param duration - 时长（秒）
 * @param tempo - 节奏（BPM）
 * @returns 音乐结构
 */
export function generateMusicStructure(
  genre: MusicGenre,
  mood: MusicMood,
  duration: number,
  tempo: number,
): MusicStructure {
  const safeDuration = clamp(duration, 5, 600);
  const safeTempo = clamp(tempo, 40, 240);

  const beatsPerSecond = safeTempo / 60;
  const totalBeats = Math.round(safeDuration * beatsPerSecond);
  const baseIntensity = MOOD_INTENSITY_BASE[mood];

  // 根据风格选择拍子记号
  const timeSignature: [number, number] = [4, 4];

  // 根据总拍数分配段落
  const sections = allocateSections(totalBeats, baseIntensity, genre);

  return {
    sections,
    totalBeats,
    tempo: safeTempo,
    timeSignature,
    key: GENRE_DEFAULT_KEY[genre],
  };
}

/**
 * 分配音乐段落
 */
function allocateSections(totalBeats: number, baseIntensity: number, genre: MusicGenre): MusicSection[] {
  const sections: MusicSection[] = [];
  let currentBeat = 0;

  // Intro: 占总长度 10-15%
  const introBeats = Math.max(4, Math.round(totalBeats * 0.12));
  sections.push({
    type: 'intro',
    startBeat: currentBeat,
    endBeat: currentBeat + introBeats,
    intensity: clamp(baseIntensity * 0.5, 0, 1),
  });
  currentBeat += introBeats;

  // 计算剩余拍数需要多少 verse-chorus 循环
  const remainingBeats = totalBeats - currentBeat;
  const isShort = remainingBeats < 32;

  if (isShort) {
    // 短曲：一个 verse + 一个 chorus + outro
    const verseBeats = Math.round(remainingBeats * 0.45);
    const chorusBeats = Math.round(remainingBeats * 0.4);

    sections.push({
      type: 'verse',
      startBeat: currentBeat,
      endBeat: currentBeat + verseBeats,
      intensity: clamp(baseIntensity * 0.7, 0, 1),
    });
    currentBeat += verseBeats;

    sections.push({
      type: 'chorus',
      startBeat: currentBeat,
      endBeat: currentBeat + chorusBeats,
      intensity: clamp(baseIntensity, 0, 1),
    });
    currentBeat += chorusBeats;
  } else {
    // 长曲：多段 verse-chorus，中间可能有 bridge
    const verseChorusUnitBeats =
      genre === 'ambient' || genre === 'lo-fi' ? Math.round(remainingBeats * 0.15) : Math.round(remainingBeats * 0.2);
    const verseBeats = Math.round(verseChorusUnitBeats * 0.55);
    const chorusBeats = verseChorusUnitBeats - verseBeats;

    let repeatCount = 0;
    const maxRepeats = Math.floor((remainingBeats * 0.85) / verseChorusUnitBeats);

    while (currentBeat < totalBeats * 0.8 && repeatCount < maxRepeats) {
      // Verse
      const vIntensity = clamp(baseIntensity * (0.6 + repeatCount * 0.05), 0, 1);
      sections.push({
        type: 'verse',
        startBeat: currentBeat,
        endBeat: currentBeat + verseBeats,
        intensity: vIntensity,
      });
      currentBeat += verseBeats;

      // Chorus
      const cIntensity = clamp(baseIntensity * (0.9 + repeatCount * 0.03), 0, 1);
      sections.push({
        type: 'chorus',
        startBeat: currentBeat,
        endBeat: currentBeat + chorusBeats,
        intensity: cIntensity,
      });
      currentBeat += chorusBeats;

      // 第二段后插入 bridge
      if (repeatCount === 1 && currentBeat < totalBeats * 0.7) {
        const bridgeBeats = Math.round(verseBeats * 0.7);
        sections.push({
          type: 'bridge',
          startBeat: currentBeat,
          endBeat: currentBeat + bridgeBeats,
          intensity: clamp(baseIntensity * 0.6, 0, 1),
        });
        currentBeat += bridgeBeats;
      }

      repeatCount++;
    }
  }

  // Outro: 占剩余拍数
  const outroBeats = Math.max(4, totalBeats - currentBeat);
  sections.push({
    type: 'outro',
    startBeat: currentBeat,
    endBeat: totalBeats,
    intensity: clamp(baseIntensity * 0.4, 0, 1),
  });

  return sections;
}

/**
 * AI 配乐生成
 *
 * 基于配置参数生成完整的音乐结构和编曲参数。
 * 不直接生成音频波形，而是输出可用于音频引擎的结构化数据。
 *
 * @param config - 配乐配置
 * @returns 生成的配乐内容
 */
export function generateMusic(config: MusicGenerationConfig = {}): GeneratedContent {
  const startTime = performance.now();

  const genre = config.genre ?? 'cinematic';
  const mood = config.mood ?? 'calm';
  const duration = clamp(config.duration ?? 30, 5, 600);
  const tempo = clamp(config.tempo ?? GENRE_DEFAULT_TEMPO[genre], 40, 240);
  const loopable = config.loopable ?? false;
  const fadeIn = clamp(config.fadeIn ?? 0, 0, 30);
  const fadeOut = clamp(config.fadeOut ?? 0, 0, 30);

  const structure = generateMusicStructure(genre, mood, duration, tempo);

  // 为每个段落生成编曲参数
  const arrangement = structure.sections.map((section) => ({
    ...section,
    instruments: config.instruments ?? getDefaultInstruments(genre),
    dynamics: computeDynamics(section.intensity, mood),
    harmonicProgression: generateChordProgression(genre, section.type),
  }));

  const generationTimeMs = performance.now() - startTime;

  return {
    id: generateId('music'),
    type: 'music',
    data: {
      structure,
      arrangement,
      genre,
      mood,
      loopable,
      fadeIn,
      fadeOut,
    },
    duration,
    metadata: {
      tempo,
      key: structure.key,
      timeSignature: structure.timeSignature,
      sectionCount: structure.sections.length,
      totalBeats: structure.totalBeats,
    },
    quality: 'standard',
    generationTimeMs,
  };
}

/**
 * 获取风格默认乐器列表
 */
function getDefaultInstruments(genre: MusicGenre): string[] {
  const instruments: Record<MusicGenre, string[]> = {
    cinematic: ['strings', 'brass', 'timpani', 'choir', 'piano'],
    pop: ['drums', 'bass', 'synth', 'vocals', 'guitar'],
    electronic: ['synth-bass', 'drum-machine', 'pad', 'lead-synth', 'fx'],
    ambient: ['pad', 'piano', 'strings', 'nature-sounds', 'reverb'],
    jazz: ['drums', 'upright-bass', 'piano', 'saxophone', 'trumpet'],
    rock: ['drums', 'bass', 'electric-guitar', 'vocals', 'keys'],
    classical: ['strings', 'woodwinds', 'brass', 'timpani', 'harp'],
    'lo-fi': ['drums', 'bass', 'electric-piano', 'vinyl-crackle', 'guitar'],
  };
  return instruments[genre] ?? instruments.cinematic;
}

/**
 * 计算动态参数
 */
function computeDynamics(
  intensity: number,
  mood: MusicMood,
): { volume: number; attack: number; release: number; sustain: number } {
  const safeIntensity = clamp(intensity, 0, 1);

  // 情绪对包络的影响
  const envelopePresets: Record<MusicMood, { attack: number; release: number; sustain: number }> = {
    happy: { attack: 0.02, release: 0.1, sustain: 0.8 },
    sad: { attack: 0.1, release: 0.5, sustain: 0.6 },
    epic: { attack: 0.05, release: 0.3, sustain: 0.9 },
    calm: { attack: 0.2, release: 0.8, sustain: 0.5 },
    tense: { attack: 0.01, release: 0.2, sustain: 0.7 },
    romantic: { attack: 0.15, release: 0.6, sustain: 0.65 },
    mysterious: { attack: 0.3, release: 0.7, sustain: 0.4 },
    energetic: { attack: 0.01, release: 0.1, sustain: 0.85 },
  };

  const preset = envelopePresets[mood];

  return {
    volume: safeIntensity,
    attack: preset.attack,
    release: preset.release,
    sustain: preset.sustain * safeIntensity,
  };
}

/**
 * 生成和弦进行
 */
function generateChordProgression(genre: MusicGenre, sectionType: MusicSection['type']): string[] {
  // 基于风格和段落类型的常见和弦进行
  const progressions: Record<MusicGenre, Record<string, string[]>> = {
    cinematic: {
      intro: ['i', 'III'],
      verse: ['i', 'III', 'VII', 'VI'],
      chorus: ['i', 'iv', 'VII', 'V'],
      bridge: ['VI', 'III', 'iv', 'V'],
      outro: ['i', 'VII', 'i'],
    },
    pop: {
      intro: ['I', 'V'],
      verse: ['I', 'V', 'vi', 'IV'],
      chorus: ['I', 'V', 'vi', 'IV'],
      bridge: ['vi', 'IV', 'I', 'V'],
      outro: ['I', 'V', 'I'],
    },
    electronic: {
      intro: ['i', 'VII'],
      verse: ['i', 'VI', 'III', 'VII'],
      chorus: ['i', 'VII', 'VI', 'VII'],
      bridge: ['iv', 'VII', 'i', 'VI'],
      outro: ['i'],
    },
    ambient: {
      intro: ['I', 'add9'],
      verse: ['I', 'add9', 'sus2', 'add9'],
      chorus: ['I', 'add9', 'sus4', 'add9'],
      bridge: ['ii', 'add9', 'sus2'],
      outro: ['I', 'add9'],
    },
    jazz: {
      intro: ['IIMaj7', 'V7'],
      verse: ['IMaj7', 'VI7', 'IIMaj7', 'V7'],
      chorus: ['IMaj7', 'IIM7', 'IIIM7', 'IVMaj7'],
      bridge: ['bVIIMaj7', 'bIIIMaj7', 'bVIMaj7', 'V7'],
      outro: ['IMaj7', 'V7', 'IMaj7'],
    },
    rock: {
      intro: ['i', 'i'],
      verse: ['i', 'VI', 'III', 'VII'],
      chorus: ['i', 'VII', 'VI', 'VII'],
      bridge: ['iv', 'V', 'iv', 'V'],
      outro: ['i', 'VII', 'i'],
    },
    classical: {
      intro: ['I', 'I6'],
      verse: ['I', 'ii6', 'V', 'I'],
      chorus: ['I', 'IV', 'V', 'I'],
      bridge: ['vi', 'ii', 'IV', 'V'],
      outro: ['I', 'V', 'I'],
    },
    'lo-fi': {
      intro: ['IMaj7', 'add9'],
      verse: ['IMaj7', 'iiMaj7', 'iii7', 'IVMaj7'],
      chorus: ['IMaj7', 'IVMaj7', 'VMaj7', 'IVMaj7'],
      bridge: ['vi7', 'iiMaj7', 'V7', 'IMaj7'],
      outro: ['IMaj7'],
    },
  };

  const genreProgressions = progressions[genre] ?? progressions.cinematic;
  return genreProgressions[sectionType] ?? genreProgressions.verse;
}
