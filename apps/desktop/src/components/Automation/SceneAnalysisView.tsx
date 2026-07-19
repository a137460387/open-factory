import { useState, useCallback, useMemo } from 'react';
import type {
  SceneAnalysis,
  AnalysisReport,
  AnalysisStats,
  AutomationSceneType,
} from '@open-factory/editor-core';
import {
  SceneAnalyzer,
  createDefaultAnalyzerConfig,
  getQualityGrade,
  getQualityGradeLabel,
  generateAnalysisReport,
} from '@open-factory/editor-core';
import {
  BarChart3,
  Film,
  AlertTriangle,
  CheckCircle,
  Eye,
  Tag,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

const SCENE_TYPE_LABELS: Record<AutomationSceneType, string> = {
  'dialogue': '对话',
  'action': '动作',
  'landscape': '风景',
  'close-up': '特写',
  'wide-shot': '广角',
  'montage': '蒙太奇',
  'transition': '过渡',
  'title': '标题',
  'black': '黑场',
  'unknown': '未知',
};

const SCENE_TYPE_COLORS: Record<AutomationSceneType, string> = {
  'dialogue': 'bg-blue-100 text-blue-700',
  'action': 'bg-red-100 text-red-700',
  'landscape': 'bg-green-100 text-green-700',
  'close-up': 'bg-purple-100 text-purple-700',
  'wide-shot': 'bg-cyan-100 text-cyan-700',
  'montage': 'bg-orange-100 text-orange-700',
  'transition': 'bg-gray-100 text-gray-700',
  'title': 'bg-yellow-100 text-yellow-700',
  'black': 'bg-gray-200 text-gray-600',
  'unknown': 'bg-gray-100 text-gray-500',
};

/* ------------------------------------------------------------------ */
/*  工具函数                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
}

function qualityColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function qualityBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

/* ------------------------------------------------------------------ */
/*  组件                                                              */
/* ------------------------------------------------------------------ */

interface SceneAnalysisViewProps {
  className?: string;
  /** 初始分析报告 */
  initialReport?: AnalysisReport;
}

export function SceneAnalysisView({ className, initialReport }: SceneAnalysisViewProps) {
  const [analyzer] = useState(() => new SceneAnalyzer());
  const [report, setReport] = useState<AnalysisReport | null>(initialReport || null);
  const [selectedScene, setSelectedScene] = useState<SceneAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'scenes' | 'quality' | 'tags'>('overview');

  // 模拟分析
  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      // 模拟分析过程
      const mockItems = [
        {
          path: '/media/sample-video.mp4',
          duration: 120,
          frameData: {
            brightness: Array.from({ length: 50 }, () => 80 + Math.random() * 80),
            motionVectors: Array.from({ length: 50 }, () => Math.random() * 0.5),
            audioLevels: Array.from({ length: 50 }, () => -30 + Math.random() * 20),
          },
        },
      ];

      const result = await analyzer.analyzeBatch(mockItems);
      setReport(result);
      if (result.scenes.length > 0) {
        setSelectedScene(result.scenes[0]);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [analyzer]);

  const stats = report?.stats;

  return (
    <div className={cn('flex flex-col h-full', className)} data-testid="scene-analysis-view">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold">场景分析</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          data-testid="analyze-btn"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Eye className="w-4 h-4 mr-1" />
          )}
          {isAnalyzing ? '分析中...' : '开始分析'}
        </Button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-line">
        {(['overview', 'scenes', 'quality', 'tags'] as const).map((tab) => (
          <button
            key={tab}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' ? '概览' : tab === 'scenes' ? '场景' : tab === 'quality' ? '质量' : '标签'}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {!report ? (
          <EmptyState />
        ) : (
          <>
            {activeTab === 'overview' && stats && <OverviewTab stats={stats} />}
            {activeTab === 'scenes' && (
              <ScenesTab
                scenes={report.scenes}
                selectedScene={selectedScene}
                onSelect={setSelectedScene}
              />
            )}
            {activeTab === 'quality' && stats && <QualityTab stats={stats} scenes={report.scenes} />}
            {activeTab === 'tags' && stats && <TagsTab stats={stats} />}
          </>
        )}
      </div>

      {/* 场景详情 */}
      {selectedScene && (
        <SceneDetail scene={selectedScene} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  子组件                                                             */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm">暂无分析数据</p>
      <p className="text-xs mt-1">点击"开始分析"对媒体素材进行智能分析</p>
    </div>
  );
}

interface OverviewTabProps {
  stats: AnalysisStats;
}

function OverviewTab({ stats }: OverviewTabProps) {
  return (
    <div className="p-4 space-y-4">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="总场景数"
          value={stats.totalScenes.toString()}
          icon={<Film className="w-4 h-4" />}
        />
        <StatCard
          label="总时长"
          value={formatDuration(stats.totalDuration)}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="平均质量"
          value={stats.averageQuality.toString()}
          suffix="分"
          icon={<BarChart3 className="w-4 h-4" />}
          valueColor={qualityColor(stats.averageQuality)}
        />
        <StatCard
          label="低质量场景"
          value={stats.lowQualityScenes.length.toString()}
          icon={<AlertTriangle className="w-4 h-4" />}
          valueColor={stats.lowQualityScenes.length > 0 ? 'text-orange-500' : 'text-green-500'}
        />
      </div>

      {/* 场景类型分布 */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">场景类型分布</h3>
        <div className="space-y-1.5">
          {Object.entries(stats.sceneTypeCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span className={cn('px-1.5 py-0.5 rounded text-xs', SCENE_TYPE_COLORS[type as AutomationSceneType])}>
                  {SCENE_TYPE_LABELS[type as AutomationSceneType] || type}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${(count / stats.totalScenes) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* 质量分布 */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">质量分布</h3>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span>最高 {stats.maxQuality} 分</span>
          </div>
          <Minus className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-blue-500" />
            <span>平均 {stats.averageQuality} 分</span>
          </div>
          <Minus className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span>最低 {stats.minQuality} 分</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  valueColor?: string;
}

function StatCard({ label, value, suffix, icon, valueColor }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg border border-line bg-card">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-lg font-semibold', valueColor || 'text-foreground')}>
        {value}
        {suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

interface ScenesTabProps {
  scenes: SceneAnalysis[];
  selectedScene: SceneAnalysis | null;
  onSelect: (scene: SceneAnalysis) => void;
}

function ScenesTab({ scenes, selectedScene, onSelect }: ScenesTabProps) {
  return (
    <div className="p-2 space-y-1">
      {scenes.map((scene) => {
        const grade = getQualityGrade(scene.quality.overall);
        return (
          <div
            key={scene.id}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors',
              selectedScene?.id === scene.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted',
            )}
            onClick={() => onSelect(scene)}
            data-testid={`scene-item-${scene.id}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('px-1.5 py-0.5 rounded text-xs', SCENE_TYPE_COLORS[scene.sceneType])}>
                {SCENE_TYPE_LABELS[scene.sceneType]}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {formatDuration(scene.startTime)} - {formatDuration(scene.endTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  时长 {formatDuration(scene.duration)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-xs font-semibold', qualityColor(scene.quality.overall))}>
                {scene.quality.overall}
              </span>
              <span className={cn(
                'px-1.5 py-0.5 rounded text-xs',
                grade === 'excellent' || grade === 'good' ? 'bg-green-100 text-green-700' :
                grade === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700',
              )}>
                {getQualityGradeLabel(grade)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface QualityTabProps {
  stats: AnalysisStats;
  scenes: SceneAnalysis[];
}

function QualityTab({ stats, scenes }: QualityTabProps) {
  const qualityMetrics = useMemo(() => {
    if (scenes.length === 0) return null;
    const metrics = ['sharpness', 'exposure', 'colorSaturation', 'stability', 'audioQuality', 'noiseLevel'] as const;
    const labels: Record<string, string> = {
      sharpness: '清晰度',
      exposure: '曝光',
      colorSaturation: '色彩饱和度',
      stability: '稳定性',
      audioQuality: '音频质量',
      noiseLevel: '噪点水平',
    };

    return metrics.map((key) => {
      const values = scenes.map((s) => s.quality[key]);
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      return { key, label: labels[key], avg };
    });
  }, [scenes]);

  if (!qualityMetrics) return null;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground">质量指标平均值</h3>
      <div className="space-y-3">
        {qualityMetrics.map((metric) => (
          <div key={metric.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs">{metric.label}</span>
              <span className={cn('text-xs font-semibold', qualityColor(metric.avg))}>
                {metric.avg}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', qualityBarColor(metric.avg))}
                style={{ width: `${metric.avg}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 低质量场景警告 */}
      {stats.lowQualityScenes.length > 0 && (
        <div className="p-3 rounded-md bg-orange-50 border border-orange-200">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">
              发现 {stats.lowQualityScenes.length} 个低质量场景
            </span>
          </div>
          <p className="text-xs text-orange-600 mt-1">
            建议使用自动化工作流对低质量场景进行修复处理
          </p>
        </div>
      )}
    </div>
  );
}

interface TagsTabProps {
  stats: AnalysisStats;
}

function TagsTab({ stats }: TagsTabProps) {
  if (stats.topTags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Tag className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无标签数据</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground">最常见标签</h3>
      <div className="flex flex-wrap gap-2">
        {stats.topTags.map(({ tag, count }) => (
          <div
            key={tag}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted"
          >
            <Tag className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium">{tag}</span>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SceneDetailProps {
  scene: SceneAnalysis;
}

function SceneDetail({ scene }: SceneDetailProps) {
  const grade = getQualityGrade(scene.quality.overall);

  return (
    <div className="border-t border-line p-3 max-h-48 overflow-y-auto" data-testid="scene-detail">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('px-1.5 py-0.5 rounded text-xs', SCENE_TYPE_COLORS[scene.sceneType])}>
            {SCENE_TYPE_LABELS[scene.sceneType]}
          </span>
          <span className="text-xs text-muted-foreground">
            置信度 {Math.round(scene.sceneTypeConfidence * 100)}%
          </span>
        </div>
        <span className={cn('text-sm font-semibold', qualityColor(scene.quality.overall))}>
          {scene.quality.overall} 分 · {getQualityGradeLabel(grade)}
        </span>
      </div>

      {/* 质量指标条 */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {([
          ['清晰度', scene.quality.sharpness],
          ['曝光', scene.quality.exposure],
          ['稳定性', scene.quality.stability],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs">{value}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', qualityBarColor(value))}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 标签 */}
      {scene.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scene.tags.map((tag) => (
            <span key={tag.id} className="px-1.5 py-0.5 bg-muted rounded text-xs">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* 关键帧信息 */}
      <p className="text-xs text-muted-foreground mt-2">
        关键帧: {scene.keyframes.length} 个 · 时长: {formatDuration(scene.duration)}
      </p>
    </div>
  );
}
