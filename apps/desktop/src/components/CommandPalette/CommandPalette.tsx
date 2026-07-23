/**
 * Global Command Palette (⌘+K / Ctrl+K)
 *
 * Integrates with natural-language-commands engine for:
 * - Text command input with fuzzy matching
 * - Voice input via Web Speech API
 * - Command history and preview
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Command,
  Mic,
  MicOff,
  CornerDownLeft,
  Clock,
  Search,
  X,
  Zap,
  Scissors,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Download,
  Copy,
  Trash2,
  SplitSquareHorizontal,
  Palette,
  Wand2,
} from 'lucide-react';
import {
  parseCommand,
  buildSpeechGrammarHints,
  type ParsedCommand,
  type CommandType,
  type CommandParserConfig,
} from '@open-factory/editor-core/natural-language-commands';
import { clsx } from 'clsx';

// Web Speech API type (not in standard DOM lib)
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  /** Whether the palette is open */
  open: boolean;
  /** Called when the palette should close */
  onClose(): void;
  /** Called when a command is executed */
  onExecute(command: ParsedCommand): void;
  /** Parser language config */
  language?: 'zh' | 'en';
}

interface CommandHistoryEntry {
  text: string;
  timestamp: number;
  command: ParsedCommand;
}

// ---------------------------------------------------------------------------
// Command type metadata
// ---------------------------------------------------------------------------

const COMMAND_ICONS: Record<CommandType, typeof Scissors> = {
  'cut': Scissors,
  'delete': Trash2,
  'duplicate': Copy,
  'split': SplitSquareHorizontal,
  'trim': Scissors,
  'speed': Zap,
  'go-to': SkipForward,
  'skip-forward': SkipForward,
  'skip-backward': SkipBack,
  'play': Play,
  'pause': Pause,
  'seek': Search,
  'add-effect': Wand2,
  'remove-effect': Trash2,
  'color-grade': Palette,
  'add-transition': Wand2,
  'volume': Volume2,
  'mute': VolumeX,
  'unmute': Volume2,
  'export': Download,
  'undo': Undo2,
  'redo': Redo2,
  'select': Search,
  'deselect': X,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  'unknown': Command,
};

const COMMAND_LABELS: Record<CommandType, string> = {
  'cut': '剪切',
  'delete': '删除',
  'duplicate': '复制',
  'split': '分割',
  'trim': '裁剪',
  'speed': '变速',
  'go-to': '跳转到',
  'skip-forward': '前进',
  'skip-backward': '后退',
  'play': '播放',
  'pause': '暂停',
  'seek': '定位',
  'add-effect': '添加效果',
  'remove-effect': '移除效果',
  'color-grade': '调色',
  'add-transition': '添加转场',
  'volume': '音量',
  'mute': '静音',
  'unmute': '取消静音',
  'export': '导出',
  'undo': '撤销',
  'redo': '重做',
  'select': '选中',
  'deselect': '取消选中',
  'zoom-in': '放大',
  'zoom-out': '缩小',
  'unknown': '未知指令',
};

const QUICK_COMMANDS: Array<{ text: string; label: string }> = [
  { text: '播放', label: '播放/暂停' },
  { text: '撤销', label: '撤销' },
  { text: '重做', label: '重做' },
  { text: '放大', label: '放大时间线' },
  { text: '缩小', label: '缩小时间线' },
  { text: '导出', label: '导出视频' },
  { text: '静音', label: '静音选中片段' },
  { text: '删除', label: '删除选中片段' },
  { text: '复制', label: '复制选中片段' },
  { text: '分割', label: '在播放头分割' },
];

// ---------------------------------------------------------------------------
// Hook: Web Speech API
// ---------------------------------------------------------------------------

function useSpeechRecognition(language: 'zh' | 'en') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    // Web Speech API - not in standard TypeScript DOM types
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => SpeechRecognition)
      | undefined;

    if (!SR) return;

    const recognition = new SR();
    recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: unknown) => {
      const e = event as { results: Array<Array<{ transcript: string }>> };
      const result = e.results[e.results.length - 1];
      setTranscript(result[0].transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening, setTranscript };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ open, onClose, onExecute, language = 'zh' }: CommandPaletteProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isListening, transcript, startListening, stopListening, setTranscript } =
    useSpeechRecognition(language);

  // Parse current input
  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    return parseCommand(input, { language });
  }, [input, language]);

  // Sync speech transcript to input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
      setTranscript('');
    }
  }, [transcript, setTranscript]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setInput('');
      setShowHistory(false);
    }
  }, [open]);

  // Global shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
      }
      if (open && e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [open, onClose]);

  const handleExecute = useCallback(() => {
    if (!parsed || parsed.type === 'unknown') return;
    setHistory((prev) => [
      { text: input, timestamp: Date.now(), command: parsed },
      ...prev.slice(0, 19),
    ]);
    onExecute(parsed);
    onClose();
  }, [parsed, input, onExecute, onClose]);

  const handleQuickCommand = useCallback(
    (text: string) => {
      const cmd = parseCommand(text, { language });
      if (cmd.type !== 'unknown') {
        setHistory((prev) => [
          { text, timestamp: Date.now(), command: cmd },
          ...prev.slice(0, 19),
        ]);
        onExecute(cmd);
        onClose();
      }
    },
    [language, onExecute, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      data-testid="command-palette-overlay"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Palette panel */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-line bg-[var(--color-bg-elevated)] shadow-2xl"
        data-testid="command-palette"
        role="dialog"
        aria-label="命令面板"
      >
        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Command size={16} className="shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
            placeholder={language === 'zh' ? '输入编辑指令... (如: 剪切3秒、删除、播放)' : 'Type a command...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleExecute();
            }}
            data-testid="command-palette-input"
          />
          <button
            className={clsx(
              'shrink-0 rounded-md p-1.5 transition-colors',
              isListening
                ? 'bg-rose-100 text-rose-600'
                : 'text-[var(--color-text-muted)] hover:bg-panel',
            )}
            type="button"
            title={isListening ? '停止语音输入' : '语音输入'}
            data-testid="command-palette-voice"
            onClick={() => {
              if (isListening) stopListening();
              else startListening();
            }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            className="shrink-0 rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            data-testid="command-palette-history-toggle"
          >
            <Clock size={16} />
          </button>
        </div>

        {/* Parsed preview */}
        {parsed && parsed.type !== 'unknown' ? (
          <div className="flex items-center gap-3 border-b border-line bg-[var(--color-bg-secondary)] px-4 py-2.5">
            {(() => {
              const Icon = COMMAND_ICONS[parsed.type];
              return <Icon size={16} className="shrink-0 text-[var(--color-accent)]" />;
            })()}
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {COMMAND_LABELS[parsed.type]}
              </span>
              {parsed.timeRef !== undefined ? (
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                  @ {parsed.timeRef.toFixed(1)}s
                </span>
              ) : null}
              {Object.entries(parsed.params).map(([key, val]) =>
                key !== 'time' && val !== undefined ? (
                  <span key={key} className="ml-2 text-xs text-[var(--color-text-muted)]">
                    {key}: {String(val)}
                  </span>
                ) : null,
              )}
            </div>
            <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
              {Math.round(parsed.confidence * 100)}%
            </span>
            <button
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              type="button"
              onClick={handleExecute}
              data-testid="command-palette-execute"
            >
              <CornerDownLeft size={12} />
              执行
            </button>
          </div>
        ) : input.trim() ? (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
            无法识别该指令，请尝试更简洁的描述
          </div>
        ) : null}

        {/* History or quick commands */}
        <div className="max-h-64 overflow-y-auto p-2">
          {showHistory && history.length > 0 ? (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                历史记录
              </div>
              {history.map((entry, i) => {
                const Icon = COMMAND_ICONS[entry.command.type];
                return (
                  <button
                    key={`${entry.timestamp}-${i}`}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel"
                    type="button"
                    data-testid={`command-history-${i}`}
                    onClick={() => handleQuickCommand(entry.text)}
                  >
                    <Icon size={14} className="shrink-0 text-[var(--color-text-muted)]" />
                    <span className="flex-1 truncate text-[var(--color-text-secondary)]">
                      {entry.text}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                      {COMMAND_LABELS[entry.command.type]}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                快捷指令
              </div>
              {QUICK_COMMANDS.map((cmd) => {
                const parsedCmd = parseCommand(cmd.text, { language });
                const Icon = COMMAND_ICONS[parsedCmd.type];
                return (
                  <button
                    key={cmd.text}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel"
                    type="button"
                    data-testid={`command-quick-${cmd.text}`}
                    onClick={() => handleQuickCommand(cmd.text)}
                  >
                    <Icon size={14} className="shrink-0 text-[var(--color-text-muted)]" />
                    <span className="flex-1 text-[var(--color-text-secondary)]">{cmd.label}</span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                      {cmd.text}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
          <span>↑↓ 导航 · Enter 执行 · Esc 关闭</span>
          <span>⌘+K 切换</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage CommandPalette open state with global shortcut.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  return { open, setOpen, toggle: () => setOpen((prev) => !prev) };
}
