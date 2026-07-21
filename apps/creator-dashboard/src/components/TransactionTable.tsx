import type { Revenue } from '@open-factory/creator-dashboard';
import { formatDate, formatCurrency } from '@/lib/utils';

interface TransactionTableProps {
  transactions: Revenue[];
}

const typeColors: Record<string, string> = {
  sales: 'text-success',
  bonus: 'text-info',
  refund: 'text-warning',
  penalty: 'text-danger',
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">Transaction History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Date</th>
              <th className="text-left px-5 py-3 font-medium">Product</th>
              <th className="text-left px-5 py-3 font-medium">Type</th>
              <th className="text-left px-5 py-3 font-medium">Order</th>
              <th className="text-right px-5 py-3 font-medium">Amount</th>
              <th className="text-right px-5 py-3 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border-subtle hover:bg-surface-overlay/50 transition-colors">
                <td className="px-5 py-3 text-foreground-muted">{formatDate(tx.createdAt)}</td>
                <td className="px-5 py-3">{tx.productName}</td>
                <td className={`px-5 py-3 font-medium capitalize ${typeColors[tx.type] || ''}`}>{tx.type}</td>
                <td className="px-5 py-3 text-foreground-muted font-mono text-xs">{tx.orderId}</td>
                <td className="px-5 py-3 text-right">{formatCurrency(tx.amount)}</td>
                <td className={`px-5 py-3 text-right font-medium ${tx.netAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(tx.netAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
