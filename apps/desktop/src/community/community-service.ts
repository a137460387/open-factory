/**
 * Community Service
 *
 * Manages community features: user profiles, content publishing,
 * social interactions, and monetization.
 */

// ─── User Types ────────────────────────────────────────────

export type MembershipTier = 'free' | 'pro' | 'enterprise';

export interface CommunityUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  website?: string;
  socialLinks?: Record<string, string>;
  membership: MembershipTier;
  joinedAt: string;
  followersCount: number;
  followingCount: number;
  worksCount: number;
  verified: boolean;
}

export interface UserProfile extends CommunityUser {
  recentWorks: CommunityWork[];
  isFollowing?: boolean;
}

// ─── Content Types ────────────────────────────────────────────

export type ContentType = 'template' | 'preset' | 'effect' | 'tutorial' | 'project';
export type ContentStatus = 'draft' | 'published' | 'archived' | 'flagged';

export interface CommunityWork {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  description: string;
  type: ContentType;
  status: ContentStatus;
  tags: string[];
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  downloads: number;
  likes: number;
  commentsCount: number;
  publishedAt: string;
  updatedAt: string;
  price: number; // 0 = free
  license?: string;
}

export interface Comment {
  id: string;
  workId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  parentId?: string;
  replies?: Comment[];
}

export interface CommunityNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'download' | 'collab';
  fromUserId: string;
  fromUserName: string;
  targetId: string;
  targetType: 'work' | 'comment' | 'user';
  message: string;
  read: boolean;
  createdAt: string;
}

// ─── Community Service ────────────────────────────────────────────

export class CommunityService {
  private users = new Map<string, CommunityUser>();
  private works = new Map<string, CommunityWork>();
  private comments = new Map<string, Comment[]>();
  private follows = new Map<string, Set<string>>(); // userId -> Set of followed userIds
  private likes = new Map<string, Set<string>>(); // targetId -> Set of userIds
  private notifications: CommunityNotification[] = [];

  // ─── User Management ──────────────────────────────────────

  createUser(user: CommunityUser): void {
    this.users.set(user.id, { ...user });
  }

  getUser(userId: string): CommunityUser | undefined {
    return this.users.get(userId);
  }

  getUserProfile(userId: string, viewerId?: string): UserProfile | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const recentWorks = Array.from(this.works.values())
      .filter((w) => w.authorId === userId && w.status === 'published')
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10);

    return {
      ...user,
      recentWorks,
      isFollowing: viewerId ? this.follows.get(viewerId)?.has(userId) : undefined,
    };
  }

  updateUser(userId: string, updates: Partial<CommunityUser>): void {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);
    this.users.set(userId, { ...user, ...updates });
  }

  // ─── Content Management ──────────────────────────────────────

  publishWork(work: CommunityWork): void {
    this.works.set(work.id, { ...work, status: 'published', publishedAt: new Date().toISOString() });
    const author = this.users.get(work.authorId);
    if (author) {
      author.worksCount += 1;
    }
  }

  updateWork(workId: string, updates: Partial<CommunityWork>): void {
    const work = this.works.get(workId);
    if (!work) throw new Error(`Work ${workId} not found`);
    this.works.set(workId, { ...work, ...updates, updatedAt: new Date().toISOString() });
  }

  deleteWork(workId: string): void {
    const work = this.works.get(workId);
    if (!work) throw new Error(`Work ${workId} not found`);
    this.works.delete(workId);
    this.comments.delete(workId);
    const author = this.users.get(work.authorId);
    if (author) {
      author.worksCount = Math.max(0, author.worksCount - 1);
    }
  }

  getWork(workId: string): CommunityWork | undefined {
    return this.works.get(workId);
  }

  searchWorks(query?: {
    type?: ContentType;
    tags?: string[];
    sortBy?: 'newest' | 'popular' | 'downloads';
    page?: number;
    pageSize?: number;
  }): { works: CommunityWork[]; total: number } {
    let results = Array.from(this.works.values()).filter((w) => w.status === 'published');

    if (query?.type) {
      results = results.filter((w) => w.type === query.type);
    }
    if (query?.tags && query.tags.length > 0) {
      results = results.filter((w) => query.tags!.some((t) => w.tags.includes(t)));
    }

    const sortBy = query?.sortBy ?? 'newest';
    results.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'popular':
          return b.likes - a.likes;
        case 'downloads':
          return b.downloads - a.downloads;
      }
    });

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const start = (page - 1) * pageSize;

    return {
      works: results.slice(start, start + pageSize),
      total: results.length,
    };
  }

  // ─── Social Interactions ──────────────────────────────────────

  follow(followerId: string, targetId: string): void {
    if (followerId === targetId) throw new Error('Cannot follow yourself');

    if (!this.follows.has(followerId)) {
      this.follows.set(followerId, new Set());
    }
    this.follows.get(followerId)!.add(targetId);

    const follower = this.users.get(followerId);
    const target = this.users.get(targetId);
    if (follower) follower.followingCount += 1;
    if (target) target.followersCount += 1;

    this.addNotification({
      type: 'follow',
      fromUserId: followerId,
      fromUserName: follower?.displayName ?? followerId,
      targetId,
      targetType: 'user',
      message: `${follower?.displayName ?? followerId} 关注了你`,
    });
  }

  unfollow(followerId: string, targetId: string): void {
    const following = this.follows.get(followerId);
    if (!following?.has(targetId)) return;

    following.delete(targetId);
    const follower = this.users.get(followerId);
    const target = this.users.get(targetId);
    if (follower) follower.followingCount = Math.max(0, follower.followingCount - 1);
    if (target) target.followersCount = Math.max(0, target.followersCount - 1);
  }

  isFollowing(followerId: string, targetId: string): boolean {
    return this.follows.get(followerId)?.has(targetId) ?? false;
  }

  getFollowers(userId: string): CommunityUser[] {
    const followers: CommunityUser[] = [];
    for (const [followerId, following] of this.follows) {
      if (following.has(userId)) {
        const user = this.users.get(followerId);
        if (user) followers.push(user);
      }
    }
    return followers;
  }

  getFollowing(userId: string): CommunityUser[] {
    const following = this.follows.get(userId);
    if (!following) return [];
    return Array.from(following)
      .map((id) => this.users.get(id))
      .filter((u): u is CommunityUser => u !== undefined);
  }

  // ─── Likes ────────────────────────────────────────────

  toggleLike(userId: string, targetId: string): boolean {
    if (!this.likes.has(targetId)) {
      this.likes.set(targetId, new Set());
    }
    const likers = this.likes.get(targetId)!;
    const wasLiked = likers.has(userId);

    if (wasLiked) {
      likers.delete(userId);
    } else {
      likers.add(userId);
    }

    // Update work likes count
    const work = this.works.get(targetId);
    if (work) {
      work.likes = likers.size;
    }

    if (!wasLiked) {
      const user = this.users.get(userId);
      const work = this.works.get(targetId);
      if (work) {
        this.addNotification({
          type: 'like',
          fromUserId: userId,
          fromUserName: user?.displayName ?? userId,
          targetId,
          targetType: 'work',
          message: `${user?.displayName ?? userId} 喜欢了「${work.title}」`,
        });
      }
    }

    return !wasLiked;
  }

  isLiked(userId: string, targetId: string): boolean {
    return this.likes.get(targetId)?.has(userId) ?? false;
  }

  getLikeCount(targetId: string): number {
    return this.likes.get(targetId)?.size ?? 0;
  }

  // ─── Comments ────────────────────────────────────────────

  addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'likes'>): Comment {
    const newComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    const comments = this.comments.get(comment.workId) ?? [];
    comments.push(newComment);
    this.comments.set(comment.workId, comments);

    // Update work comment count
    const work = this.works.get(comment.workId);
    if (work) {
      work.commentsCount = comments.length;
    }

    return newComment;
  }

  getComments(workId: string): Comment[] {
    return this.comments.get(workId) ?? [];
  }

  deleteComment(workId: string, commentId: string): void {
    const comments = this.comments.get(workId);
    if (!comments) return;
    this.comments.set(
      workId,
      comments.filter((c) => c.id !== commentId),
    );
    const work = this.works.get(workId);
    if (work) {
      work.commentsCount = Math.max(0, work.commentsCount - 1);
    }
  }

  // ─── Notifications ────────────────────────────────────────────

  private addNotification(
    data: Omit<CommunityNotification, 'id' | 'read' | 'createdAt'>,
  ): void {
    this.notifications.push({
      ...data,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  getNotifications(userId: string, unreadOnly = false): CommunityNotification[] {
    let notifs = this.notifications.filter((n) => n.targetId === userId || n.fromUserId === userId);
    if (unreadOnly) {
      notifs = notifs.filter((n) => !n.read);
    }
    return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  markNotificationRead(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) notif.read = true;
  }

  // ─── Statistics ────────────────────────────────────────────

  getCommunityStats(): {
    totalUsers: number;
    totalWorks: number;
    totalDownloads: number;
    totalLikes: number;
  } {
    const works = Array.from(this.works.values());
    return {
      totalUsers: this.users.size,
      totalWorks: works.length,
      totalDownloads: works.reduce((sum, w) => sum + w.downloads, 0),
      totalLikes: works.reduce((sum, w) => sum + w.likes, 0),
    };
  }
}
