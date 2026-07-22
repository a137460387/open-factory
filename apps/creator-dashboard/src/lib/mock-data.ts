export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

export const mockAchievements: Achievement[] = [
  { id: 'a1', title: 'First Upload', description: 'Publish your first plugin', icon: 'rocket', unlocked: true },
  { id: 'a2', title: '1K Downloads', description: 'Reach 1,000 total downloads', icon: 'download', unlocked: true },
  { id: 'a3', title: 'Rising Star', description: 'Get 100 five-star ratings', icon: 'star', unlocked: true },
  { id: 'a4', title: 'Revenue Milestone', description: 'Earn $10,000 in revenue', icon: 'trophy', unlocked: true, progress: 100, maxProgress: 100 },
  { id: 'a5', title: 'Community Leader', description: 'Reach 50,000 downloads', icon: 'crown', unlocked: true },
  { id: 'a6', title: 'Open Source Hero', description: 'Publish 5 free plugins', icon: 'heart', unlocked: false, progress: 3, maxProgress: 5 },
  { id: 'a7', title: 'Global Reach', description: 'Get users from 50+ countries', icon: 'globe', unlocked: false, progress: 38, maxProgress: 50 },
  { id: 'a8', title: 'Diamond Creator', description: 'Reach flagship tier', icon: 'diamond', unlocked: false, progress: 68, maxProgress: 100 },
];

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'success',
    title: 'Withdrawal Completed',
    message: 'Your withdrawal of 5,000 CNY has been processed to Alipay.',
    time: new Date(Date.now() - 3600000),
    read: false,
  },
  {
    id: 'n2',
    type: 'info',
    title: 'Plugin Review Update',
    message: 'AudioDenoise has entered the review queue. Expected review time: 2-3 days.',
    time: new Date(Date.now() - 7200000),
    read: false,
  },
  {
    id: 'n3',
    type: 'warning',
    title: 'Rating Alert',
    message: 'SmartCut Pro received a 1-star review. Consider responding to user feedback.',
    time: new Date(Date.now() - 86400000),
    read: true,
  },
  {
    id: 'n4',
    type: 'info',
    title: 'New Milestone',
    message: 'SubtitleSync reached 45,000 downloads! Keep up the great work.',
    time: new Date(Date.now() - 172800000),
    read: true,
  },
  {
    id: 'n5',
    type: 'success',
    title: 'Tier Upgrade',
    message: 'Congratulations! You have been promoted to Professional tier.',
    time: new Date(Date.now() - 604800000),
    read: true,
  },
];
