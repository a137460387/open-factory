import { describe, expect, it, beforeEach } from 'vitest';
import { CommunityService, type CommunityUser, type CommunityWork } from './community-service';

function makeUser(overrides: Partial<CommunityUser> = {}): CommunityUser {
  return {
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    membership: 'free',
    joinedAt: '2026-01-01T00:00:00Z',
    followersCount: 0,
    followingCount: 0,
    worksCount: 0,
    verified: false,
    ...overrides,
  };
}

function makeWork(overrides: Partial<CommunityWork> = {}): CommunityWork {
  return {
    id: 'work-1',
    authorId: 'user-1',
    authorName: 'Test User',
    title: 'Test Work',
    description: 'A test work',
    type: 'template',
    status: 'published',
    tags: ['test'],
    downloads: 0,
    likes: 0,
    commentsCount: 0,
    publishedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    price: 0,
    ...overrides,
  };
}

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(() => {
    service = new CommunityService();
  });

  describe('User Management', () => {
    it('creates and retrieves a user', () => {
      service.createUser(makeUser());
      expect(service.getUser('user-1')).toBeDefined();
      expect(service.getUser('user-1')!.displayName).toBe('Test User');
    });

    it('gets user profile with recent works', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      const profile = service.getUserProfile('user-1');
      expect(profile).toBeDefined();
      expect(profile!.recentWorks).toHaveLength(1);
    });

    it('updates user info', () => {
      service.createUser(makeUser());
      service.updateUser('user-1', { displayName: 'Updated Name' });
      expect(service.getUser('user-1')!.displayName).toBe('Updated Name');
    });
  });

  describe('Content Management', () => {
    it('publishes a work', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      const work = service.getWork('work-1');
      expect(work).toBeDefined();
      expect(work!.status).toBe('published');
    });

    it('updates work count on publish', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());
      expect(service.getUser('user-1')!.worksCount).toBe(1);
    });

    it('deletes a work', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());
      service.deleteWork('work-1');
      expect(service.getWork('work-1')).toBeUndefined();
      expect(service.getUser('user-1')!.worksCount).toBe(0);
    });

    it('searches works by type', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork({ id: 'w1', type: 'template' }));
      service.publishWork(makeWork({ id: 'w2', type: 'effect' }));

      const result = service.searchWorks({ type: 'template' });
      expect(result.works).toHaveLength(1);
      expect(result.works[0].type).toBe('template');
    });

    it('searches works by tags', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork({ id: 'w1', tags: ['blur', 'effect'] }));
      service.publishWork(makeWork({ id: 'w2', tags: ['color'] }));

      const result = service.searchWorks({ tags: ['blur'] });
      expect(result.works).toHaveLength(1);
    });

    it('sorts works by popularity', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork({ id: 'w1', likes: 10 }));
      service.publishWork(makeWork({ id: 'w2', likes: 50 }));

      const result = service.searchWorks({ sortBy: 'popular' });
      expect(result.works[0].id).toBe('w2');
    });
  });

  describe('Social Interactions', () => {
    it('follows a user', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));

      service.follow('u1', 'u2');
      expect(service.isFollowing('u1', 'u2')).toBe(true);
      expect(service.getUser('u1')!.followingCount).toBe(1);
      expect(service.getUser('u2')!.followersCount).toBe(1);
    });

    it('unfollows a user', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));

      service.follow('u1', 'u2');
      service.unfollow('u1', 'u2');
      expect(service.isFollowing('u1', 'u2')).toBe(false);
    });

    it('prevents self-follow', () => {
      service.createUser(makeUser());
      expect(() => service.follow('user-1', 'user-1')).toThrow('Cannot follow yourself');
    });

    it('gets followers list', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));

      service.follow('u1', 'u2');
      const followers = service.getFollowers('u2');
      expect(followers).toHaveLength(1);
      expect(followers[0].id).toBe('u1');
    });
  });

  describe('Likes', () => {
    it('toggles like on a work', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      expect(service.toggleLike('user-1', 'work-1')).toBe(true);
      expect(service.isLiked('user-1', 'work-1')).toBe(true);
      expect(service.getWork('work-1')!.likes).toBe(1);
    });

    it('unlikes a work', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      service.toggleLike('user-1', 'work-1');
      expect(service.toggleLike('user-1', 'work-1')).toBe(false);
      expect(service.isLiked('user-1', 'work-1')).toBe(false);
      expect(service.getWork('work-1')!.likes).toBe(0);
    });
  });

  describe('Comments', () => {
    it('adds a comment', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      const comment = service.addComment({
        workId: 'work-1',
        userId: 'user-1',
        userName: 'Test User',
        content: 'Great work!',
      });

      expect(comment.id).toBeDefined();
      expect(service.getComments('work-1')).toHaveLength(1);
      expect(service.getWork('work-1')!.commentsCount).toBe(1);
    });

    it('deletes a comment', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      const comment = service.addComment({
        workId: 'work-1',
        userId: 'user-1',
        userName: 'Test User',
        content: 'Great work!',
      });

      service.deleteComment('work-1', comment.id);
      expect(service.getComments('work-1')).toHaveLength(0);
    });
  });

  describe('Notifications', () => {
    it('creates follow notification', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));

      service.follow('u1', 'u2');
      const notifs = service.getNotifications('u2');
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe('follow');
    });

    it('creates like notification', () => {
      service.createUser(makeUser());
      service.publishWork(makeWork());

      service.toggleLike('user-1', 'work-1');
      const notifs = service.getNotifications('user-1');
      expect(notifs.some((n) => n.type === 'like')).toBe(true);
    });

    it('marks notification as read', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));

      service.follow('u1', 'u2');
      const notifs = service.getNotifications('u2', true);
      expect(notifs).toHaveLength(1);

      service.markNotificationRead(notifs[0].id);
      expect(service.getNotifications('u2', true)).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('returns community stats', () => {
      service.createUser(makeUser({ id: 'u1' }));
      service.createUser(makeUser({ id: 'u2', username: 'user2', displayName: 'User 2' }));
      service.publishWork(makeWork({ id: 'w1', downloads: 100, likes: 50 }));
      service.publishWork(makeWork({ id: 'w2', authorId: 'u2', downloads: 200, likes: 80 }));

      const stats = service.getCommunityStats();
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalWorks).toBe(2);
      expect(stats.totalDownloads).toBe(300);
      expect(stats.totalLikes).toBe(130);
    });
  });
});
