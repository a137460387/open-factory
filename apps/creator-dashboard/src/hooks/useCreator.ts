import { useState, useEffect } from 'react';
import type { Creator, Plugin } from '@open-factory/creator-dashboard';
import { fetchCreator, fetchPlugins } from '@/lib/api';

interface UseCreatorResult {
  creator: Creator | null;
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCreator(creatorId: string): UseCreatorResult {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [creatorResult, pluginsResult] = await Promise.all([
      fetchCreator(creatorId),
      fetchPlugins(creatorId),
    ]);

    if (creatorResult.success && creatorResult.data) {
      // Convert API CreatorProfile to Creator type
      const profile = creatorResult.data;
      const creatorData: Creator = {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        email: profile.email,
        avatar: profile.avatar,
        bio: profile.bio,
        status: profile.status,
        tier: profile.tier,
        totalRevenue: profile.totalRevenue,
        monthlyRevenue: profile.monthlyRevenue,
        commissionRate: profile.commissionRate,
        tags: [...profile.tags],
        socialLinks: { ...profile.socialLinks },
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
      };
      setCreator(creatorData);
    }
    if (pluginsResult.success && pluginsResult.data) {
      // Convert API Plugin to Plugin type
      const pluginsData: Plugin[] = pluginsResult.data.map((p) => ({
        id: p.manifest.id,
        creatorId: creatorId,
        name: p.manifest.name,
        slug: p.manifest.id,
        description: p.manifest.description,
        version: p.manifest.version,
        status: p.verified ? 'published' : 'review',
        category: p.manifest.category as any,
        price: 0,
        downloads: p.stats.downloads,
        rating: p.rating.averageRating,
        ratingCount: p.rating.totalReviews,
        createdAt: new Date(p.publishedAt),
        updatedAt: new Date(p.updatedAt),
        publishedAt: new Date(p.publishedAt),
      }));
      setPlugins(pluginsData);
    }
    if (!creatorResult.success || !pluginsResult.success) {
      setError('Failed to load creator data');
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [creatorId]);

  return { creator, plugins, loading, error, refetch: load };
}
