import { useState } from 'react';

interface WithdrawalFormProps {
  availableBalance: number;
  onSubmit: (amount: number, method: string, account: string) => Promise<boolean>;
}

const METHODS = [
  { value: 'alipay', label: 'Alipay' },
  { value: 'wechat', label: 'WeChat Pay' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
];

export function WithdrawalForm({ availableBalance, onSubmit }: WithdrawalFormProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('alipay');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 100) {
      setError('Minimum withdrawal is 100 CNY');
      return;
    }
    if (numAmount > availableBalance) {
      setError('Amount exceeds available balance');
      return;
    }
    if (!account.trim()) {
      setError('Please enter account information');
      return;
    }

    setSubmitting(true);
    const ok = await onSubmit(numAmount, method, account);
    setSubmitting(false);
    if (ok) {
      setSuccess(true);
      setAmount('');
      setAccount('');
    } else {
      setError('Withdrawal request failed');
    }
  };

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-4">Request Withdrawal</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-foreground-muted mb-1.5">Amount (CNY)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Min 100"
            min={100}
            max={availableBalance}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
          />
          <p className="text-xs text-foreground-muted mt-1">Available: {availableBalance.toLocaleString()} CNY</p>
        </div>

        <div>
          <label className="block text-xs text-foreground-muted mb-1.5">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-foreground-muted mb-1.5">Account</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="Account ID or email"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-success">Withdrawal request submitted!</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
