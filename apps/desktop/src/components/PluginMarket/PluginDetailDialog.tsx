import { useState, useCallback } from 'react';
import type { MarketPluginEntry, PluginReview } from '@open-factory/editor-core';
import { checkVersionCompatibility } from '@open-factory/editor-core';
import type { PluginInstallState } from '../../plugins/plugin-market';

const categoryLabels: Record<string, string> = {
  effect: '效果插件',
  export: '导出插件',
  workflow: '工作流插件',
  'ai-model': 'AI 模型插件',
};

const permissionLabels: Record<string, string> = {
  'read-project': '读取项目',
  'write-project': '写入项目',
  'read-media': '读取媒体',
  'export-hook': '导出钩子',
  'menu-register': '菜单注册',
  'timeline-mutation': '时间线修改',
  'ai-inference': 'AI 推理',
  'network-access': '网络访问',
};

export interface PluginDetailDialogProps {
  entry: MarketPluginEntry;
  installState?: PluginInstallState;
  reviews?: PluginReview[];
  appVersion?: string;
  onClose: () => void;
  onInstall?: (entry: MarketPluginEntry) => void;
  onUpdate?: (entry: MarketPluginEntry) => void;
  onAddReview?: (pluginId: string, rating: number, comment: string) => void;
}

export function PluginDetailDialog({
  entry,
  installState,
  reviews = [],
  appVersion = '4.36.0',
  onClose,
  onInstall,
  onUpdate,
  onAddReview,
}: PluginDetailDialogProps) {
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const compatibility = checkVersionCompatibility(entry.minAppVersion, appVersion);
  const status = installState?.status ?? 'not-installed';

  const handleSubmitReview = useCallback(() => {
    if (!reviewComment.trim()) return;
    onAddReview?.(entry.id, reviewRating, reviewComment.trim());
    setReviewComment('');
    setReviewRating(5);
    setShowReviewForm(false);
  }, [entry.id, reviewRating, reviewComment, onAddReview]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose} data-testid="plugin-detail-dialog">
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{entry.name}</h2>
              {entry.official && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  官方
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {entry.author} · v{entry.version}
            </p>
          </div>
          <button
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm">{entry.description}</p>

        {/* Meta info */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-muted/50 p-2">
            <span className="text-muted-foreground">分类</span>
            <p className="font-medium">{categoryLabels[entry.category] ?? entry.category}</p>
          </div>
          <div className="rounded bg-muted/50 p-2">
            <span className="text-muted-foreground">下载量</span>
            <p className="font-medium">{entry.downloads.toLocaleString()}</p>
          </div>
          <div className="rounded bg-muted/50 p-2">
            <span className="text-muted-foreground">评分</span>
            <p className="font-medium">
              {'★'.repeat(Math.round(entry.rating.average))} {entry.rating.average.toFixed(1)} ({entry.rating.count})
            </p>
          </div>
          <div className="rounded bg-muted/50 p-2">
            <span className="text-muted-foreground">发布日期</span>
            <p className="font-medium">{new Date(entry.publishedAt).toLocaleDateString('zh-CN')}</p>
          </div>
        </div>

        {/* Permissions */}
        {entry.permissions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground">所需权限</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.permissions.map((perm) => (
                <span
                  key={perm}
                  className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px]"
                >
                  {permissionLabels[perm] ?? perm}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-medium text-muted-foreground">标签</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Compatibility warning */}
        {!compatibility.compatible && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
            ⚠️ {compatibility.reason}
          </div>
        )}

        {/* Install/Update button */}
        <div className="mt-4 flex gap-2">
          {status === 'not-installed' && (
            <button
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              onClick={() => onInstall?.(entry)}
              disabled={!compatibility.compatible}
              data-testid="plugin-detail-install"
            >
              安装插件
            </button>
          )}
          {status === 'installed' && (
            <span className="flex-1 rounded-md bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
              ✓ 已安装 (v{installState?.installedVersion})
            </span>
          )}
          {status === 'update-available' && (
            <button
              className="flex-1 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              onClick={() => onUpdate?.(entry)}
              data-testid="plugin-detail-update"
            >
              更新至 v{entry.version}
            </button>
          )}
          {entry.homepage && (
            <a
              href={entry.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              主页
            </a>
          )}
        </div>

        {/* Reviews section */}
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">用户评价 ({reviews.length})</h3>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setShowReviewForm(!showReviewForm)}
            >
              写评价
            </button>
          </div>

          {showReviewForm && (
            <div className="mt-3 rounded-md border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">评分：</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`text-lg ${star <= reviewRating ? 'text-yellow-500' : 'text-muted-foreground/30'}`}
                    onClick={() => setReviewRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:border-ring"
                rows={3}
                placeholder="分享你的使用体验…"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => setShowReviewForm(false)}
                >
                  取消
                </button>
                <button
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                  onClick={handleSubmitReview}
                  disabled={!reviewComment.trim()}
                >
                  提交
                </button>
              </div>
            </div>
          )}

          {reviews.length === 0 && !showReviewForm && (
            <p className="mt-2 text-xs text-muted-foreground">暂无评价</p>
          )}

          {reviews.map((review) => (
            <div key={review.id} className="mt-3 border-b border-border/20 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{review.author}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="text-xs text-yellow-500">
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
