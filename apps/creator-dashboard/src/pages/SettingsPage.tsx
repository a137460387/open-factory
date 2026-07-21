import { useState } from 'react';
import { useCreator } from '@/hooks/useCreator';
import { TierBadge } from '@/components/TierBadge';

const CREATOR_ID = 'creator-001';

export function SettingsPage() {
  const { creator, loading } = useCreator(CREATOR_ID);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);

  // Initialize form when creator loads
  const name = displayName || creator?.displayName || '';
  const bioText = bio || creator?.bio || '';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-foreground-muted mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile settings */}
      <div className="bg-surface-raised border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold mb-5">Profile Information</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">Bio</label>
            <textarea
              value={bioText}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">Email</label>
            <input
              type="email"
              value={creator?.email ?? ''}
              disabled
              className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-foreground-muted"
            />
          </div>
          {creator && (
            <div>
              <label className="block text-xs text-foreground-muted mb-1.5">Tier</label>
              <div className="mt-1">
                <TierBadge tier={creator.tier} size="md" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
            {saved && <span className="text-xs text-success">Saved successfully</span>}
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="bg-surface-raised border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold mb-4">Account Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground-muted">Account ID</span>
            <span className="font-mono text-xs">{creator?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Status</span>
            <span className="text-success capitalize">{creator?.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Commission Rate</span>
            <span>{creator ? `${creator.commissionRate * 100}%` : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Joined</span>
            <span>{creator ? new Date(creator.createdAt).toLocaleDateString() : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
