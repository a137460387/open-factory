/**
 * Distribution Settings Panel
 *
 * AI-powered distribution settings with platform recommendations,
 * publish time optimization, and A/B testing management.
 */

import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import type {
  DistributionPlatformSpec,
  DistributionPlatformId,
} from '@open-factory/editor-core';
import type {
  DistributionContentAnalysis,
  PublishTimePrediction,
  ABTest,
  DistributionInsight,
} from '@open-factory/editor-core';

// ─── Types ────────────────────────────────────────────

interface DistributionSettingsPanelProps {
  platforms: DistributionPlatformSpec[];
  selectedPlatforms: DistributionPlatformId[];
  contentAnalysis: DistributionContentAnalysis | null;
  publishTimePredictions: Map<DistributionPlatformId, PublishTimePrediction>;
  abTests: ABTest[];
  insights: DistributionInsight[];
  onTogglePlatform: (id: DistributionPlatformId) => void;
  onRunAnalysis: () => void;
  onCreateABTest: () => void;
  onStartABTest: (testId: string) => void;
}

// ─── Platform Card ────────────────────────────────────────────

function PlatformCard({
  platform,
  selected,
  prediction,
  onToggle,
}: {
  platform: DistributionPlatformSpec;
  selected: boolean;
  prediction?: PublishTimePrediction;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/30'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{platform.icon}</span>
          <div>
            <h3 className="font-medium text-sm">{platform.name}</h3>
            <p className="text-xs text-muted-foreground">
              {platform.width}×{platform.height} · {platform.fps}fps · {platform.aspectRatio}
            </p>
          </div>
        </div>
        <Switch checked={selected} onCheckedChange={onToggle} />
      </div>

      {prediction && selected && (
        <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          <p>
            最佳发布时间: 周{['日', '一', '二', '三', '四', '五', '六'][prediction.bestTime.dayOfWeek]}{' '}
            {prediction.bestTime.hour}:00
          </p>
          <p className="mt-1">{prediction.bestTime.reason}</p>
          <p className="mt-1">置信度: {(prediction.confidence * 100).toFixed(0)}%</p>
        </div>
      )}

      {platform.maxDurationSecs && (
        <p className="text-xs text-muted-foreground mt-1">
          最长 {Math.floor(platform.maxDurationSecs / 60)} 分钟
        </p>
      )}
    </div>
  );
}

// ─── Insight Card ────────────────────────────────────────────

function InsightCard({ insight }: { insight: DistributionInsight }) {
  const icons = {
    opportunity: '💡',
    warning: '⚠️',
    success: '✅',
    tip: '💡',
  };

  const colors = {
    opportunity: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    success: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    tip: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950',
  };

  return (
    <div className={`rounded-lg border p-3 ${colors[insight.type]}`}>
      <div className="flex items-start gap-2">
        <span>{icons[insight.type]}</span>
        <div>
          <h4 className="font-medium text-sm">{insight.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── A/B Test Card ────────────────────────────────────────────

function ABTestCard({
  test,
  onStart,
}: {
  test: ABTest;
  onStart: () => void;
}) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">{test.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[test.status]}`}>
          {test.status === 'draft' ? '草稿' : test.status === 'running' ? '运行中' : test.status === 'completed' ? '已完成' : '已暂停'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{test.description}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{test.variants.length} 个变体</span>
        <span>·</span>
        <span>{test.durationDays} 天</span>
      </div>
      {test.status === 'draft' && (
        <Button size="sm" className="mt-2 w-full" onClick={onStart}>
          启动测试
        </Button>
      )}
      {test.winnerId && (
        <div className="mt-2 pt-2 border-t border-border text-xs">
          <span className="text-green-600 font-medium">
            胜出: {test.variants.find((v) => v.id === test.winnerId)?.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Distribution Settings Panel ────────────────────────────────────────────

export function DistributionSettingsPanel({
  platforms,
  selectedPlatforms,
  contentAnalysis,
  publishTimePredictions,
  abTests,
  insights,
  onTogglePlatform,
  onRunAnalysis,
  onCreateABTest,
  onStartABTest,
}: DistributionSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState('platforms');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">智能分发设置</h2>
        <Button size="sm" onClick={onRunAnalysis}>
          AI 分析
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="platforms">平台选择</TabsTrigger>
            <TabsTrigger value="insights">智能洞察</TabsTrigger>
            <TabsTrigger value="abtest">A/B 测试</TabsTrigger>
            <TabsTrigger value="analysis">内容分析</TabsTrigger>
          </TabsList>
        </div>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                selected={selectedPlatforms.includes(platform.id)}
                prediction={publishTimePredictions.get(platform.id)}
                onToggle={() => onTogglePlatform(platform.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="flex-1 overflow-auto p-4">
          {insights.length > 0 ? (
            <div className="flex flex-col gap-3">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              运行 AI 分析以获取智能洞察
            </div>
          )}
        </TabsContent>

        {/* A/B Test Tab */}
        <TabsContent value="abtest" className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">A/B 测试</h3>
            <Button size="sm" variant="outline" onClick={onCreateABTest}>
              新建测试
            </Button>
          </div>
          {abTests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {abTests.map((test) => (
                <ABTestCard key={test.id} test={test} onStart={() => onStartABTest(test.id)} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              暂无 A/B 测试
            </div>
          )}
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="flex-1 overflow-auto p-4">
          {contentAnalysis ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-sm mb-2">内容质量评分</h3>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-primary">{contentAnalysis.qualityScore}</div>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${contentAnalysis.qualityScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-sm mb-2">标题建议</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {contentAnalysis.titleSuggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-sm mb-2">推荐标签</h3>
                <div className="flex flex-wrap gap-1">
                  {contentAnalysis.recommendedTags.map((tag) => (
                    <span key={tag} className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium text-sm mb-2">封面建议</h3>
                <div className="space-y-2">
                  {contentAnalysis.coverSuggestions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span>{s.reason} (第 {s.timestamp} 秒)</span>
                      <span className="text-green-600">+{(s.expectedCtrLift * 100).toFixed(0)}% CTR</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              点击「AI 分析」按钮获取内容优化建议
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
