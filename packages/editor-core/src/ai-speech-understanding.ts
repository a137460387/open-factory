/**
 * AI Speech Understanding.
 *
 * Extracts keywords, topics, and narrative markers from speech transcripts.
 * Integrates with existing ASR (Whisper) to provide content understanding.
 */

// ─── Types ────────────────────────────────────────────────

export interface SpeechUnderstandingResult {
  keywords: Keyword[];
  topics: Topic[];
  narrativeMarkers: NarrativeMarker[];
  summary: string;
}

export interface Keyword {
  word: string;
  score: number;
  frequency: number;
}

export interface Topic {
  name: string;
  keywords: string[];
  relevance: number;
  timeRange: { start: number; end: number };
}

export interface NarrativeMarker {
  time: number;
  type: 'opening' | 'rising' | 'climax' | 'falling' | 'ending';
  confidence: number;
  description: string;
}

export interface SpeechUnderstandingOptions {
  maxKeywords?: number;
  maxTopics?: number;
  minKeywordFrequency?: number;
}

// ─── Chinese Stop Words ────────────────────────────────────

const STOP_WORDS = new Set([
  '的',
  '了',
  '在',
  '是',
  '我',
  '有',
  '和',
  '就',
  '不',
  '人',
  '都',
  '一',
  '一个',
  '上',
  '也',
  '很',
  '到',
  '说',
  '要',
  '去',
  '你',
  '会',
  '着',
  '没有',
  '看',
  '好',
  '自己',
  '这',
  '他',
  '她',
  '它',
  '们',
  '那',
  '里',
  '为',
  '什么',
  '怎么',
  '如何',
  '可以',
  '但是',
  '而且',
  '或者',
  '因为',
  '所以',
  '如果',
  '虽然',
  '但是',
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'its',
  'our',
  'their',
  'mine',
  'yours',
  'hers',
  'ours',
  'theirs',
  'this',
  'that',
  'these',
  'those',
  'and',
  'but',
  'or',
  'nor',
  'not',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'because',
  'as',
  'until',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
]);

// ─── Core Functions ────────────────────────────────────────

/**
 * Analyze speech transcript to extract keywords, topics, and narrative markers.
 *
 * Uses TF-IDF-like scoring for keyword extraction and pattern matching
 * for narrative structure detection.
 */
export function understandSpeech(
  transcript: string,
  timeAlignment?: { start: number; end: number }[],
  options: SpeechUnderstandingOptions = {},
): SpeechUnderstandingResult {
  const { maxKeywords = 20, maxTopics = 5, minKeywordFrequency = 2 } = options;

  // Tokenize and clean
  const tokens = tokenize(transcript);
  const filteredTokens = tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t.toLowerCase()));

  // Extract keywords using TF scoring
  const keywords = extractKeywords(filteredTokens, maxKeywords, minKeywordFrequency);

  // Extract topics using keyword clustering
  const topics = extractTopics(keywords, maxTopics, timeAlignment);

  // Detect narrative markers
  const narrativeMarkers = detectNarrativeMarkers(transcript, timeAlignment);

  // Generate summary
  const summary = generateSummary(transcript, keywords);

  return {
    keywords,
    topics,
    narrativeMarkers,
    summary,
  };
}

// ─── Tokenization ──────────────────────────────────────────

function tokenize(text: string): string[] {
  // Split into Chinese character runs and non-Chinese segments
  const segments = text.split(/([\u4e00-\u9fa5]+)/g);
  const tokens: string[] = [];

  for (const segment of segments) {
    if (!segment) continue;

    if (/[\u4e00-\u9fa5]/.test(segment)) {
      // Chinese segment: generate bigrams + unigrams for better keyword extraction
      if (segment.length === 1) {
        tokens.push(segment);
      } else {
        // Bigrams capture meaningful two-character words (most Chinese words are 2 chars)
        for (let i = 0; i < segment.length - 1; i++) {
          tokens.push(segment.substring(i, i + 2));
        }
        // Also include unigrams for single-char word coverage
        for (let i = 0; i < segment.length; i++) {
          tokens.push(segment[i]);
        }
      }
    } else {
      // Non-Chinese segment: split on whitespace and punctuation, keep alphanumeric tokens
      const words = segment
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 0);
      tokens.push(...words);
    }
  }

  return tokens;
}

// ─── Keyword Extraction ────────────────────────────────────

function extractKeywords(tokens: string[], maxKeywords: number, minFrequency: number): Keyword[] {
  // Count frequencies
  const freqMap = new Map<string, number>();
  for (const token of tokens) {
    const lower = token.toLowerCase();
    freqMap.set(lower, (freqMap.get(lower) || 0) + 1);
  }

  // Filter by minimum frequency
  const candidates: Keyword[] = [];
  for (const [word, frequency] of freqMap) {
    if (frequency >= minFrequency) {
      // TF-IDF-like score: frequency * inverse document frequency approximation
      const score = frequency * Math.log(1 + tokens.length / (frequency + 1));
      candidates.push({ word, score, frequency });
    }
  }

  // Sort by score and return top N
  return candidates.sort((a, b) => b.score - a.score).slice(0, maxKeywords);
}

// ─── Topic Extraction ──────────────────────────────────────

function extractTopics(
  keywords: Keyword[],
  maxTopics: number,
  timeAlignment?: { start: number; end: number }[],
): Topic[] {
  if (keywords.length === 0) return [];

  // Simple clustering: group keywords by co-occurrence
  const topics: Topic[] = [];
  const usedKeywords = new Set<string>();

  for (const keyword of keywords) {
    if (usedKeywords.has(keyword.word)) continue;

    const topicKeywords = [keyword.word];
    usedKeywords.add(keyword.word);

    // Find related keywords (simple heuristic: similar length or shared characters)
    for (const other of keywords) {
      if (usedKeywords.has(other.word)) continue;
      if (areKeywordsRelated(keyword.word, other.word)) {
        topicKeywords.push(other.word);
        usedKeywords.add(other.word);
      }
    }

    if (topicKeywords.length >= 1) {
      const timeRange = timeAlignment?.[0] || { start: 0, end: 100 };
      topics.push({
        name: topicKeywords[0],
        keywords: topicKeywords,
        relevance: keyword.score,
        timeRange,
      });
    }

    if (topics.length >= maxTopics) break;
  }

  return topics;
}

function areKeywordsRelated(word1: string, word2: string): boolean {
  // Simple heuristic: check if words share characters
  const chars1 = new Set(word1.split(''));
  const chars2 = new Set(word2.split(''));
  let shared = 0;
  for (const char of chars1) {
    if (chars2.has(char)) shared++;
  }
  return shared > 0 && shared >= Math.min(chars1.size, chars2.size) * 0.3;
}

// ─── Narrative Marker Detection ────────────────────────────

function detectNarrativeMarkers(
  transcript: string,
  timeAlignment?: { start: number; end: number }[],
): NarrativeMarker[] {
  const markers: NarrativeMarker[] = [];
  const sentences = transcript.split(/[。！？.!?]+/).filter((s) => s.trim().length > 0);

  if (sentences.length === 0) return markers;

  // Opening markers
  const openingPatterns = ['大家好', '欢迎', '首先', '开始', '今天', 'hello', 'welcome', 'first', 'start', 'today'];
  if (sentences.length > 0 && matchesPatterns(sentences[0], openingPatterns)) {
    markers.push({
      time: timeAlignment?.[0]?.start || 0,
      type: 'opening',
      confidence: 0.8,
      description: '开场白',
    });
  }

  // Climax markers (high emotion words)
  const climaxPatterns = [
    '重要',
    '关键',
    '核心',
    '最',
    '非常',
    '极其',
    '特别',
    'important',
    'key',
    'core',
    'most',
    'very',
    'extremely',
  ];
  for (let i = 0; i < sentences.length; i++) {
    if (matchesPatterns(sentences[i], climaxPatterns)) {
      const time = timeAlignment?.[i]?.start || (i / sentences.length) * 100;
      markers.push({
        time,
        type: 'climax',
        confidence: 0.7,
        description: '重点内容',
      });
      break; // Only mark first climax
    }
  }

  // Ending markers
  const endingPatterns = ['总结', '最后', '结束', '谢谢', '感谢', '总结一下', 'summary', 'finally', 'end', 'thank'];
  const lastSentence = sentences[sentences.length - 1];
  if (matchesPatterns(lastSentence, endingPatterns)) {
    const time = timeAlignment?.[sentences.length - 1]?.start || 100;
    markers.push({
      time,
      type: 'ending',
      confidence: 0.8,
      description: '结尾总结',
    });
  }

  // Rising and falling based on sentence length distribution
  const midPoint = Math.floor(sentences.length / 2);
  const firstHalfLength = sentences.slice(0, midPoint).join('').length;
  const secondHalfLength = sentences.slice(midPoint).join('').length;

  if (firstHalfLength < secondHalfLength * 0.7) {
    markers.push({
      time: timeAlignment?.[midPoint]?.start || 50,
      type: 'rising',
      confidence: 0.6,
      description: '内容递增',
    });
  } else if (firstHalfLength > secondHalfLength * 1.3) {
    markers.push({
      time: timeAlignment?.[midPoint]?.start || 50,
      type: 'falling',
      confidence: 0.6,
      description: '内容递减',
    });
  }

  return markers.sort((a, b) => a.time - b.time);
}

function matchesPatterns(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

// ─── Summary Generation ────────────────────────────────────

function generateSummary(transcript: string, keywords: Keyword[]): string {
  if (transcript.length <= 100) return transcript;

  // Extract first sentence and top keywords
  const firstSentence = transcript.split(/[。！？.!?]+/)[0] || '';
  const topKeywords = keywords
    .slice(0, 5)
    .map((k) => k.word)
    .join('、');

  return `${firstSentence.slice(0, 50)}... 主要内容涉及：${topKeywords}`;
}
