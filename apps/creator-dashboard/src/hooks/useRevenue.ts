import { useState, useEffect } from 'react';
import type { Revenue, WithdrawalRequest } from '@open-factory/creator-dashboard';
import { fetchTransactions, fetchWithdrawals, submitWithdrawal } from '@/lib/api';

interface UseRevenueResult {
  transactions: Revenue[];
  withdrawals: WithdrawalRequest[];
  loading: boolean;
  error: string | null;
  requestWithdrawal: (amount: number, method: string, account: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useRevenue(creatorId: string): UseRevenueResult {
  const [transactions, setTransactions] = useState<Revenue[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [txResult, wdResult] = await Promise.all([
      fetchTransactions(creatorId),
      fetchWithdrawals(creatorId),
    ]);

    if (txResult.success && txResult.data) {
      // Convert API revenue breakdown to Revenue type
      const revenueData: Revenue[] = txResult.data.map((item, index) => ({
        id: `rev-${index}`,
        creatorId: creatorId,
        type: 'sales' as const,
        amount: item.revenue,
        commissionRate: 0.3,
        netAmount: item.revenue * 0.7,
        productName: item.pluginName,
        orderId: `order-${index}`,
        createdAt: new Date(),
      }));
      setTransactions(revenueData);
    }
    if (wdResult.success && wdResult.data) {
      setWithdrawals(wdResult.data);
    }
    if (!txResult.success || !wdResult.success) {
      setError('Failed to load revenue data');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [creatorId]);

  const requestWithdrawal = async (amount: number, method: string, account: string): Promise<boolean> => {
    const result = await submitWithdrawal(creatorId, amount, method, account);
    if (result.success) {
      await load();
      return true;
    }
    return false;
  };

  return { transactions, withdrawals, loading, error, requestWithdrawal, refetch: load };
}
