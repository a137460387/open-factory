import { initializeApiClient, getApiClient } from '@open-factory/api-client/react';
import type {
  CreatorProfile,
  CreatorStats,
  CreatorRevenue,
  CreatorDashboardData,
  Plugin,
} from '@open-factory/api-client';

// Initialize API client
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
initializeApiClient({ baseUrl: API_BASE_URL });

/** Fetch creator profile */
export async function fetchCreator(_id: string) {
  const client = getApiClient();
  const profile = await client.getMyProfile();
  return { success: true, data: profile };
}

/** Fetch analytics data */
export async function fetchAnalytics(_creatorId: string) {
  const client = getApiClient();
  const stats = await client.getMyStats();
  return { success: true, data: stats };
}

/** Fetch revenue transactions */
export async function fetchTransactions(_creatorId: string) {
  const client = getApiClient();
  const revenue = await client.getMyRevenue();
  return { success: true, data: revenue.breakdown };
}

/** Fetch withdrawal requests */
export async function fetchWithdrawals(_creatorId: string) {
  // Withdrawal API not implemented yet, return empty array
  return { success: true, data: [] };
}

/** Fetch creator's plugins */
export async function fetchPlugins(_creatorId: string) {
  const client = getApiClient();
  const dashboard = await client.getDashboard();
  return { success: true, data: dashboard.recentPlugins };
}

/** Submit a withdrawal request */
export async function submitWithdrawal(
  _creatorId: string,
  _amount: number,
  _method: string,
  _account: string
) {
  // Withdrawal API not implemented yet
  return {
    success: false,
    error: 'Withdrawal API not implemented',
  };
}
