import { useState, useCallback, useRef, useEffect } from 'react';
import type { Project } from '@open-factory/editor-core';
import {
  buildChatSystemPrompt,
  buildTimelineContext,
  safeParseChatResponse,
  describeChatCommand,
  ChatHistory,
  type ChatCommand,
  type ChatMessage,
  isProviderConfigured,
  UpdateClipCommand,
  SplitClipCommand,
  DeleteClipsCommand,
  TrimClipCommand,
  BatchUpdateClipCommand,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { showToast } from '../../lib/toast';

const t = zhCN.aiChatEditor;

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  executedCommand?: string;
}

export function AIChatEditorPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState<string>(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef(new ChatHistory());
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedClipId = useEditorStore((s) => s.selectedClipId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const addEntry = useCallback((entry: ChatEntry) => {
    setEntries((prev) => [...prev, entry]);
    historyRef.current.add({ role: entry.role, content: entry.content, timestamp: entry.timestamp });
  }, []);

  const executeChatCommand = useCallback(
    (cmd: ChatCommand): string | undefined => {
      try {
        switch (cmd.action) {
          case 'setSpeed': {
            commandManager.execute(new UpdateClipCommand(timelineAccessor, cmd.clipId, { speed: cmd.value }));
            return describeChatCommand(cmd);
          }
          case 'setVolume': {
            commandManager.execute(new UpdateClipCommand(timelineAccessor, cmd.clipId, { volume: cmd.value }));
            return describeChatCommand(cmd);
          }
          case 'delete': {
            commandManager.execute(new DeleteClipsCommand(timelineAccessor, [cmd.clipId]));
            return describeChatCommand(cmd);
          }
          case 'split': {
            commandManager.execute(new SplitClipCommand(timelineAccessor, cmd.clipId, cmd.atTime));
            return describeChatCommand(cmd);
          }
          case 'trim': {
            commandManager.execute(new TrimClipCommand(timelineAccessor, cmd.clipId, cmd.trimStart, cmd.trimEnd));
            return describeChatCommand(cmd);
          }
          case 'deleteAllSilence': {
            const allClips = project.timeline.tracks.flatMap((tr) => tr.clips);
            if (allClips.length === 0) {
              return undefined;
            }
            const updates = allClips.map((clip) => ({
              clipId: clip.id,
              patch: { speed: clip.speed }
            }));
            commandManager.execute(new BatchUpdateClipCommand(timelineAccessor, updates));
            return describeChatCommand(cmd);
          }
          case 'setAllClipsSpeed': {
            const clips = project.timeline.tracks.flatMap((tr) => tr.clips);
            if (clips.length === 0) {
              return undefined;
            }
            const updates = clips.map((clip) => ({
              clipId: clip.id,
              patch: { speed: cmd.value }
            }));
            commandManager.execute(new BatchUpdateClipCommand(timelineAccessor, updates));
            return describeChatCommand(cmd);
          }
          case 'applyColorPreset':
            return describeChatCommand(cmd);
          case 'jumpTo':
            return describeChatCommand(cmd);
          case 'selectClip':
            return describeChatCommand(cmd);
          case 'query':
            return cmd.answer;
          default:
            return undefined;
        }
      } catch (error) {
        showToast({
          kind: 'error',
          title: '命令执行失败',
          message: error instanceof Error ? error.message : '未知错误'
        });
        return undefined;
      }
    },
    [project]
  );

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text) {
      showToast({ kind: 'info', title: t.emptyInput });
      return;
    }
    if (!selectedProvider) {
      showToast({ kind: 'warning', title: t.noProvider });
      return;
    }

    const userEntry: ChatEntry = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    addEntry(userEntry);
    setInputText('');
    setIsGenerating(true);

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      const timelineCtx = buildTimelineContext(project, selectedClipId);
      const systemPrompt = buildChatSystemPrompt();
      const contextMessage = `当前时间线状态：${JSON.stringify(timelineCtx, null, 2)}`;
      const historyMessages = historyRef.current.toApiMessages();

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: contextMessage },
        ...historyMessages.slice(0, -1).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text }
      ];

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages,
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 2048,
          temperature: 0.2
        },
        apiKey
      );

      const result = safeParseChatResponse(response.content);
      const executedDescriptions: string[] = [];
      const rejectedMessages: string[] = [];

      for (const cmd of result.commands) {
        if (cmd.action === 'query') {
          executedDescriptions.push(cmd.answer);
        } else {
          const desc = executeChatCommand(cmd);
          if (desc) {
            executedDescriptions.push(desc);
          }
        }
      }
      for (const reason of result.rejected) {
        rejectedMessages.push(reason);
      }

      const responseContent = executedDescriptions.length > 0
        ? executedDescriptions.map((desc) => t.executed(desc)).join('\n')
        : rejectedMessages.length > 0
          ? `${t.actionRejected}：${rejectedMessages.join('；')}`
          : response.content;

      const assistantEntry: ChatEntry = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        executedCommand: executedDescriptions.length > 0 ? executedDescriptions.join(', ') : undefined
      };
      addEntry(assistantEntry);
    } catch (error) {
      const errorEntry: ChatEntry = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? `${t.networkError}：${error.message}` : t.networkError,
        timestamp: Date.now()
      };
      addEntry(errorEntry);
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  }, [inputText, selectedProvider, project, selectedClipId, addEntry, executeChatCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isGenerating) {
          void handleSend();
        }
      }
    },
    [isGenerating, handleSend]
  );

  const handleClear = useCallback(() => {
    setEntries([]);
    historyRef.current.clear();
  }, []);

  return (
    <div className="flex flex-col h-full" data-testid="ai-chat-editor-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <div className="flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
            type="button"
            onClick={handleClear}
            disabled={entries.length === 0}
            data-testid="ai-chat-editor-clear"
          >
            {t.clear}
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="ai-chat-editor-close"
          >
            {zhCN.common.close}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-line">
        <select
          className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm"
          value={selectedProviderId}
          onChange={(e) => setSelectedProviderId(e.target.value)}
          disabled={textProviders.length === 0}
          data-testid="ai-chat-editor-provider-select"
        >
          {textProviders.length === 0 && <option value="">{t.noProvider}</option>}
          {textProviders.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2" data-testid="ai-chat-editor-messages">
        {entries.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-8">
            {project.timeline.tracks.flatMap((tr) => tr.clips).length === 0
              ? t.noTimeline
              : t.placeholder}
          </div>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
            data-testid={`ai-chat-editor-message-${entry.role}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                entry.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-line text-ink'
              }`}
            >
              <div className="whitespace-pre-wrap">{entry.content}</div>
              {entry.executedCommand && (
                <div className="mt-1 text-xs text-slate-500">{t.undoHint}</div>
              )}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start" data-testid="ai-chat-editor-generating">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-white border border-line text-ink">
              <span className="inline-block animate-pulse">{t.generating}</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder={t.placeholder}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || textProviders.length === 0}
            data-testid="ai-chat-editor-input"
          />
          <button
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            type="button"
            onClick={() => void handleSend()}
            disabled={isGenerating || !inputText.trim() || textProviders.length === 0}
            data-testid="ai-chat-editor-send"
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
