import type { Creator, Analytics, Revenue, WithdrawalRequest, Plugin } from '@open-factory/creator-dashboard';
import {
  mockCreator,
  mockAnalytics,
  mockTransactions,
  mockWithdrawals,
  mockPlugins,
} from './mock-data';

const API_DELAY = 300;

/** Simulate API delay */
function delay(ms: number = API_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulate an API response */
async function apiResponse<T>(data: T): Promise<{ success: boolean; data?: T; error?: string }> {
  await delay();
  return { success: true, data };
}

/** Fetch creator profile */
export async function fetchCreator(_id: string) {
  return apiResponse<Creator>(mockCreator);
}

/** Fetch analytics data */
export async function fetchAnalytics(_creatorId: string) {
  return apiResponse<Analytics>(mockAnalytics);
}

/** Fetch revenue transactions */
export async function fetchTransactions(_creatorId: string) {
  return apiResponse<Revenue[]>(mockTransactions);
}

/** Fetch withdrawal requests */
export async function fetchWithdrawals(_creatorId: string) {
  return apiResponse<WithdrawalRequest[]>(mockWithdrawals);
}

/** Fetch creator's plugins */
export async function fetchPlugins(_creatorId: string) {
  return apiResponse<Plugin[]>(mockPlugins);
}

/** Submit a withdrawal request */
export async function submitWithdrawal(
  _creatorId: string,
  _amount: number,
  _method: string,
  _account: string
) {
  await delay(500);
  return {
    success: true,
    data: {
      id: `wd-${Date.now()}`,
      status: 'pending' as const,
      createdAt: new Date(),
    },
  };
}
