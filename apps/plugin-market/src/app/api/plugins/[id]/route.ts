import { NextRequest, NextResponse } from 'next/server';
import { mockPlugins, mockReviews, mockVersions } from '@/lib/mock-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const plugin = mockPlugins.find((p) => p.manifest.id === id);

  if (!plugin) {
    return NextResponse.json(
      { error: 'Plugin not found', status: 404 },
      { status: 404 },
    );
  }

  const reviews = mockReviews.filter((r) => r.pluginId === id);
  const versions = mockVersions.filter((v) => v.pluginId === id);

  return NextResponse.json({ plugin, reviews, versions });
}
