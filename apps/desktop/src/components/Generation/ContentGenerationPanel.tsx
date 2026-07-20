import { useState, useCallback, useRef } from 'react';
import type { Project, ContentType, ContentGenerationConfig, ContentGenerationResult } from '@open-factory/editor-core';
import {
  createDefaultContentGenerationConfig,
  validateContentGenerationConfig,
  estimateGenerationTime,
} from '@open-factory/editor-core';
import { X, Subtitles, Mic, Music, Wand2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
];

const VOICE_STYLES = [
  { value: 'natural', label: '自然' },
  { value: 'warm', label: '温暖' },
  { value: 'energetic', label: '活力' },
  { value: 'calm', label: '沉稳' },
  { value: 'dramatic', label: '戏剧' },
  { value: 'whisper', label: '低语' },
];

const EMOTIONS = [
  { value: 'neutral', label: '中性' },
  { value: 'happy', label: '快乐' },
  { value: 'sad', label: '悲伤' },
  { value: 'excited', label: '兴奋' },
  { value: 'serious', label: '严肃' },
  { value: 'gentle', label: '温柔' },
];

const MUSIC_GENRES = [
  { value: 'pop', label: '流行' },
  { value: 'electronic', label: '电子' },
  { value: 'classical', label: '古典' },
  { value: 'jazz', label: '爵士' },
  { value: 'rock', label: '摇滚' },
  { value: 'ambient', label: '氛围' },
  { value: 'hiphop', label: '嘻哈' },
  { value: 'cinematic', label: '电影' },
];

const MUSIC_MOODS = [
  { value: 'happy', label: '快乐' },
  { value: 'sad', label: '悲伤' },
  { value: 'dramatic', label: '戏剧' },
  { value: 'peaceful', label: '平静' },
  { value: 'intense', label: '紧张' },
  { value: 'mysterious', label: '神秘' },
  { value: 'romantic', label: '浪漫' },
  { value: 'epic', label: '史诗' },
];

const EFFECT_TYPES = [
  { value: 'blur', label: '模糊' },
  { value: 'sharpen', label: '锐化' },
  { value: 'glow', label: '发光' },
  { value: 'shake', label: '抖动' },
  { value: 'zoom', label: '缩放' },
  { value: 'flash', label: '闪光' },
  { value: 'particles', label: '粒子' },
  { value: 'light-leak', label: '漏光' },
  { value: 'vignette', label: '暗角' },
  { value: 'chromatic', label: '色差' },
];

type Phase = 'idle' | 'generating' | 'done';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ContentGenerationPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  /* --- AI provider ------------------------------------------------ */
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled);
  const defaultProvider = textProviders[0];

  /* --- local state ------------------------------------------------ */
  const [activeTab, setActiveTab] = useState<ContentType>('subtitle');
  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ContentGenerationResult[]>([]);
  const abortRef = useRef(false);

  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  /* --- subtitle config -------------------------------------------- */
  const [subtitleLang, setSubtitleLang] = useState('auto');
  const [maxCharsPerLine, setMaxCharsPerLine] = useState(20);
  const [autoBreak, setAutoBreak] = useState(true);
  const [speakerDiarization, setSpeakerDiarization] = useState(false);

  /* --- tts config ------------------------------------------------- */
  const [voiceStyle, setVoiceStyle] = useState('natural');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [emotion, setEmotion] = useState('neutral');
  const [ttsText, setTtsText] = useState('');

  /* --- music config ----------------------------------------------- */
  const [musicGenre, setMusicGenre] = useState('pop');
  const [musicMood, setMusicMood] = useState('happy');
  const [musicDuration, setMusicDuration] = useState(30);
  const [bpm, setBpm] = useState(120);
  const [loopable, setLoopable] = useState(false);

  /* --- effect config ---------------------------------------------- */
  const [effectType, setEffectType] = useState('blur');
  const [effectIntensity, setEffectIntensity] = useState(50);
  const [effectDuration, setEffectDuration] = useState(2);

  /* --- generation ------------------------------------------------- */
  const startGeneration = useCallback(async () => {
    if (!selectedProvider) return;

    const customParams: Record<string, unknown> = {};
    if (activeTab === 'subtitle') {
      Object.assign(customParams, { language: subtitleLang, maxCharsPerLine, autoBreak, speakerDiarization });
    } else if (activeTab === 'dubbing') {
      Object.assign(customParams, { voiceStyle, speechRate, pitch, volume, emotion, text: ttsText });
    } else if (activeTab === 'music') {
      Object.assign(customParams, { genre: musicGenre, mood: musicMood, duration: musicDuration, bpm, loopable });
    } else if (activeTab === 'effect') {
      Object.assign(customParams, { effectType, intensity: effectIntensity, duration: effectDuration });
    }

    const config: ContentGenerationConfig = {
      type: activeTab,
      language: subtitleLang,
      enableGPU: false,
      quality: 'standard',
      outputFormat: 'default',
      customParams,
    };

    if (!validateContentGenerationConfig(config)) {
      showToast({ kind: 'error', title: '参数错误', message: '请检查内容生成参数配置' });
      return;
    }

    abortRef.current = false;
    setPhase('generating');
    setProgress(0);

    try {
      const estTime = estimateGenerationTime(config);
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, estTime * 10);

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages: [
            {
              role: 'system' as const,
              content: `你是一个专业的${activeTab === 'subtitle' ? '字幕' : activeTab === 'dubbing' ? '配音' : activeTab === 'music' ? '配乐' : '特效'}生成助手。`,
            },
            { role: 'user' as const, content: JSON.stringify(config) },
          ],
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 4096,
          temperature: 0.5,
        },
        apiKey,
      );

      clearInterval(progressInterval);
      if (abortRef.current) {
        setPhase('idle');
        return;
      }

      setProgress(100);
      const generatedContent = {
        id: `gen-${Date.now()}`,
        type: activeTab,
        data: response.content,
        duration: 0,
        metadata: {},
        quality: 'standard' as const,
        generationTimeMs: 0,
      };
      const result: ContentGenerationResult = {
        contents: [generatedContent],
        totalGenerationTimeMs: 0,
        gpuUsed: false,
        warnings: [],
      };
      setResults((prev) => [result, ...prev]);
      setPhase('done');
      showToast({ kind: 'success', title: '生成完成', message: `${getTabLabel(activeTab)}已成功生成。` });
    } catch (error) {
      showToast({
        kind: 'error',
        title: '生成失败',
        message: error instanceof Error ? error.message : '无法生成内容，请检查AI服务配置。',
      });
      setPhase('idle');
    }
  }, [
    selectedProvider,
    activeTab,
    subtitleLang,
    maxCharsPerLine,
    autoBreak,
    speakerDiarization,
    voiceStyle,
    speechRate,
    pitch,
    volume,
    emotion,
    ttsText,
    musicGenre,
    musicMood,
    musicDuration,
    bpm,
    loopable,
    effectType,
    effectIntensity,
    effectDuration,
  ]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('idle');
  }, []);

  /* --- helpers ---------------------------------------------------- */
  function getTabLabel(tab: ContentType): string {
    switch (tab) {
      case 'subtitle':
        return '字幕';
      case 'dubbing':
        return '配音';
      case 'music':
        return '配乐';
      case 'effect':
        return '特效';
      case 'voiceover':
        return '配音';
      default:
        return tab;
    }
  }

  /* --- render ----------------------------------------------------- */
  return (
    <div className="flex flex-col h-full bg-panel text-ink overflow-hidden" data-testid="content-generation-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI 内容生成</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="content-gen-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Provider selection */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">AI 服务商</Label>
          <Select
            value={selectedProviderId}
            onValueChange={setSelectedProviderId}
            disabled={textProviders.length === 0}
          >
            <SelectTrigger data-testid="content-gen-provider-select">
              <SelectValue placeholder="未配置AI服务商" />
            </SelectTrigger>
            <SelectContent>
              {textProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)}>
          <TabsList className="w-full grid grid-cols-4" data-testid="content-gen-tabs">
            <TabsTrigger value="subtitle" data-testid="content-gen-tab-subtitle">
              <Subtitles className="mr-1 h-3.5 w-3.5" />
              字幕
            </TabsTrigger>
            <TabsTrigger value="dubbing" data-testid="content-gen-tab-tts">
              <Mic className="mr-1 h-3.5 w-3.5" />
              配音
            </TabsTrigger>
            <TabsTrigger value="music" data-testid="content-gen-tab-music">
              <Music className="mr-1 h-3.5 w-3.5" />
              配乐
            </TabsTrigger>
            <TabsTrigger value="effect" data-testid="content-gen-tab-effect">
              <Wand2 className="mr-1 h-3.5 w-3.5" />
              特效
            </TabsTrigger>
          </TabsList>

          {/* ---- Subtitle Tab ---- */}
          <TabsContent value="subtitle" className="space-y-3 mt-3" data-testid="content-gen-subtitle">
            {phase === 'idle' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">语言</Label>
                  <Select value={subtitleLang} onValueChange={setSubtitleLang}>
                    <SelectTrigger data-testid="content-gen-subtitle-lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">每行最大字符数</Label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={maxCharsPerLine}
                    onChange={(e) => setMaxCharsPerLine(Math.max(5, Math.min(50, Number(e.target.value) || 20)))}
                    data-testid="content-gen-subtitle-maxchars"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">自动断行</Label>
                  <Switch
                    checked={autoBreak}
                    onCheckedChange={setAutoBreak}
                    data-testid="content-gen-subtitle-autobreak"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">说话人分离</Label>
                  <Switch
                    checked={speakerDiarization}
                    onCheckedChange={setSpeakerDiarization}
                    data-testid="content-gen-subtitle-diarization"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedProvider}
                  onClick={() => void startGeneration()}
                  data-testid="content-gen-subtitle-generate"
                >
                  <Subtitles className="mr-1.5 h-4 w-4" />
                  生成字幕
                </Button>
              </>
            )}
          </TabsContent>

          {/* ---- TTS Tab ---- */}
          <TabsContent value="dubbing" className="space-y-3 mt-3" data-testid="content-gen-tts">
            {phase === 'idle' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">语音风格</Label>
                  <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                    <SelectTrigger data-testid="content-gen-tts-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_STYLES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Speech rate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">语速</Label>
                    <span className="text-xs tabular-nums text-ink">{speechRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(Number(e.target.value))}
                    data-testid="content-gen-tts-rate"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.5x</span>
                    <span>2.0x</span>
                  </div>
                </div>

                {/* Pitch */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">音调</Label>
                    <span className="text-xs tabular-nums text-ink">{pitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    data-testid="content-gen-tts-pitch"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>低</span>
                    <span>高</span>
                  </div>
                </div>

                {/* Volume */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">音量</Label>
                    <span className="text-xs tabular-nums text-ink">{(volume * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    data-testid="content-gen-tts-volume"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">情感</Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger data-testid="content-gen-tts-emotion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">文本内容</Label>
                  <textarea
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={4}
                    placeholder="输入要配音的文本..."
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    data-testid="content-gen-tts-text"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedProvider || !ttsText.trim()}
                  onClick={() => void startGeneration()}
                  data-testid="content-gen-tts-generate"
                >
                  <Mic className="mr-1.5 h-4 w-4" />
                  生成配音
                </Button>
              </>
            )}
          </TabsContent>

          {/* ---- Music Tab ---- */}
          <TabsContent value="music" className="space-y-3 mt-3" data-testid="content-gen-music">
            {phase === 'idle' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">风格</Label>
                  <Select value={musicGenre} onValueChange={setMusicGenre}>
                    <SelectTrigger data-testid="content-gen-music-genre">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_GENRES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">情绪</Label>
                  <Select value={musicMood} onValueChange={setMusicMood}>
                    <SelectTrigger data-testid="content-gen-music-mood">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_MOODS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">时长（秒）</Label>
                  <Input
                    type="number"
                    min={5}
                    max={600}
                    value={musicDuration}
                    onChange={(e) => setMusicDuration(Math.max(5, Math.min(600, Number(e.target.value) || 30)))}
                    data-testid="content-gen-music-duration"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">BPM</Label>
                  <Input
                    type="number"
                    min={40}
                    max={240}
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
                    data-testid="content-gen-music-bpm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">可循环</Label>
                  <Switch checked={loopable} onCheckedChange={setLoopable} data-testid="content-gen-music-loop" />
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedProvider}
                  onClick={() => void startGeneration()}
                  data-testid="content-gen-music-generate"
                >
                  <Music className="mr-1.5 h-4 w-4" />
                  生成配乐
                </Button>
              </>
            )}
          </TabsContent>

          {/* ---- Effect Tab ---- */}
          <TabsContent value="effect" className="space-y-3 mt-3" data-testid="content-gen-effect">
            {phase === 'idle' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">特效类型</Label>
                  <Select value={effectType} onValueChange={setEffectType}>
                    <SelectTrigger data-testid="content-gen-effect-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EFFECT_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Intensity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">强度</Label>
                    <span className="text-xs tabular-nums text-ink">{effectIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    min={0}
                    max={100}
                    step={1}
                    value={effectIntensity}
                    onChange={(e) => setEffectIntensity(Number(e.target.value))}
                    data-testid="content-gen-effect-intensity"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">时长（秒）</Label>
                  <Input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={effectDuration}
                    onChange={(e) => setEffectDuration(Math.max(0.5, Math.min(60, Number(e.target.value) || 2)))}
                    data-testid="content-gen-effect-duration"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedProvider}
                  onClick={() => void startGeneration()}
                  data-testid="content-gen-effect-generate"
                >
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  生成特效
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Generating state */}
        {phase === 'generating' && (
          <div className="space-y-3" data-testid="content-gen-generating">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>正在生成{getTabLabel(activeTab)}...</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-right text-[11px] text-muted-foreground tabular-nums">{progress.toFixed(0)}%</div>
            <Button variant="outline" className="w-full" onClick={cancelGeneration} data-testid="content-gen-cancel">
              取消
            </Button>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && phase !== 'generating' && (
          <div className="space-y-2" data-testid="content-gen-results">
            <Label className="text-xs font-medium text-ink">生成结果</Label>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {results.map((r, i) => {
                const firstContent = r.contents[0];
                const displayType = firstContent?.type ?? 'subtitle';
                const displayData = typeof firstContent?.data === 'string' ? firstContent.data : '';
                return (
                  <div
                    key={i}
                    className="rounded-md border border-line bg-white p-2.5 space-y-1"
                    data-testid={`content-gen-result-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">{getTabLabel(displayType)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">
                      {displayData.length > 100 ? displayData.slice(0, 100) + '...' : displayData}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
