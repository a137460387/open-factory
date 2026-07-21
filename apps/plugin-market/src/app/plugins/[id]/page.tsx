'use client';

import { usePluginDetail } from '@/hooks/usePluginDetail';
import { PluginDetail } from '@/components/PluginDetail';

interface PluginDetailPageProps {
  readonly params: { id: string };
}

export default function PluginDetailPage({ params }: PluginDetailPageProps) {
  const { data, loading, error } = usePluginDetail(params.id);

  if (loading) {
    return <PluginDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-3)] text-2xl">
          ?
        </div>
        <h1 className="mt-4 text-xl font-bold">Plugin Not Found</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {error ?? "The plugin you're looking for doesn't exist."}
        </p>
        <a
          href="/"
          className="mt-4 text-sm text-[var(--accent)] hover:underline"
        >
          Back to Market
        </a>
      </div>
    );
  }

  return (
    <PluginDetail
      plugin={data.plugin}
      reviews={data.reviews}
      versions={data.versions}
    />
  );
}

function PluginDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-24 rounded bg-[var(--surface-2)]" />
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-xl bg-[var(--surface-2)]" />
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-64 rounded bg-[var(--surface-2)]" />
        </div>
      </div>
      <div className="h-32 rounded-xl bg-[var(--surface-2)]" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  );
}
