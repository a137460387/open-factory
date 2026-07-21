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
      setTransactions(txResult.data);
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
