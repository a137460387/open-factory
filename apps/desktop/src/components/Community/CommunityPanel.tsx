/**
 * Community Panel
 *
 * Main community interface showing feed, works, and social features.
 */

import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import type {
  CommunityWork,
  CommunityUser,
  ContentType,
  Comment,
} from '../../community/community-service';

// ─── Types ────────────────────────────────────────────

interface CommunityPanelProps {
  works: CommunityWork[];
  currentUser: CommunityUser | null;
  trendingUsers: CommunityUser[];
  onSearch: (query?: string, type?: ContentType) => { works: CommunityWork[]; total: number };
  onLike: (workId: string) => void;
  onComment: (workId: string, content: string) => void;
  onFollow: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
}

// ─── Work Card ────────────────────────────────────────────

function WorkCard({
  work,
  onLike,
  onComment,
  onOpenProfile,
}: {
  work: CommunityWork;
  onLike: () => void;
  onComment: (content: string) => void;
  onOpenProfile: () => void;
}) {
  const [commentText, setCommentText] = useState('');

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
      {/* Thumbnail */}
      {work.thumbnailUrl && (
        <div className="aspect-video bg-muted relative">
          <img
            src={work.thumbnailUrl}
            alt={work.title}
            className="w-full h-full object-cover"
          />
          {work.price > 0 && (
            <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              ¥{work.price}
            </span>
          )}
        </div>
      )}

      <div className="p-3">
        {/* Author */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 mb-2 hover:opacity-80"
        >
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">
            {work.authorAvatar ? (
              <img src={work.authorAvatar} alt="" className="w-full h-full rounded-full" />
            ) : (
              work.authorName[0]
            )}
          </div>
          <span className="text-sm font-medium">{work.authorName}</span>
        </button>

        {/* Title */}
        <h3 className="font-medium text-sm mb-1 line-clamp-1">{work.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{work.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {work.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button onClick={onLike} className="flex items-center gap-1 hover:text-primary">
            ❤️ {work.likes}
          </button>
          <span>💬 {work.commentsCount}</span>
          <span>📥 {work.downloads}</span>
          <span className="ml-auto text-xs">{work.type}</span>
        </div>

        {/* Comment Input */}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="添加评论..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="text-xs h-7"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                onComment(commentText.trim());
                setCommentText('');
              }
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              if (commentText.trim()) {
                onComment(commentText.trim());
                setCommentText('');
              }
            }}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────

function UserCard({
  user,
  onFollow,
  onOpenProfile,
}: {
  user: CommunityUser;
  onFollow: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button onClick={onOpenProfile} className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full rounded-full" />
          ) : (
            <span className="text-lg font-medium">{user.displayName[0]}</span>
          )}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onOpenProfile} className="font-medium text-sm hover:underline block truncate">
          {user.displayName}
        </button>
        <p className="text-xs text-muted-foreground truncate">{user.bio ?? `@${user.username}`}</p>
        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{user.worksCount} 作品</span>
          <span>{user.followersCount} 粉丝</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onFollow}>
        关注
      </Button>
    </div>
  );
}

// ─── Community Panel ────────────────────────────────────────────

export function CommunityPanel({
  works,
  currentUser,
  trendingUsers,
  onSearch,
  onLike,
  onComment,
  onFollow,
  onOpenProfile,
}: CommunityPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('feed');

  const contentTypes: { value: string; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'template', label: '模板' },
    { value: 'preset', label: '预设' },
    { value: 'effect', label: '特效' },
    { value: 'tutorial', label: '教程' },
    { value: 'project', label: '项目' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <h2 className="text-lg font-semibold">创作者社区</h2>
        <div className="flex-1">
          <Input
            placeholder="搜索作品或创作者..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="feed">动态</TabsTrigger>
            <TabsTrigger value="explore">发现</TabsTrigger>
            <TabsTrigger value="following">关注</TabsTrigger>
            <TabsTrigger value="my">我的</TabsTrigger>
          </TabsList>
        </div>

        {/* Feed Tab */}
        <TabsContent value="feed" className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {works.slice(0, 12).map((work) => (
              <WorkCard
                key={work.id}
                work={work}
                onLike={() => onLike(work.id)}
                onComment={(content) => onComment(work.id, content)}
                onOpenProfile={() => onOpenProfile(work.authorId)}
              />
            ))}
          </div>
          {works.length === 0 && (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              暂无动态
            </div>
          )}
        </TabsContent>

        {/* Explore Tab */}
        <TabsContent value="explore" className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">热门创作者</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trendingUsers.slice(0, 6).map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onFollow={() => onFollow(user.id)}
                  onOpenProfile={() => onOpenProfile(user.id)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Following Tab */}
        <TabsContent value="following" className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {works
              .filter((w) => w.authorId !== currentUser?.id)
              .slice(0, 9)
              .map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  onLike={() => onLike(work.id)}
                  onComment={(content) => onComment(work.id, content)}
                  onOpenProfile={() => onOpenProfile(work.authorId)}
                />
              ))}
          </div>
        </TabsContent>

        {/* My Works Tab */}
        <TabsContent value="my" className="flex-1 overflow-auto p-4">
          {currentUser ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {works
                .filter((w) => w.authorId === currentUser.id)
                .map((work) => (
                  <WorkCard
                    key={work.id}
                    work={work}
                    onLike={() => onLike(work.id)}
                    onComment={(content) => onComment(work.id, content)}
                    onOpenProfile={() => onOpenProfile(work.authorId)}
                  />
                ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              请先登录
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
