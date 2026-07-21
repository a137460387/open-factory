'use client';

import { useState } from 'react';

interface ScreenshotGalleryProps {
  readonly screenshots: readonly string[];
}

export function ScreenshotGallery({ screenshots }: ScreenshotGalleryProps) {
  const [active, setActive] = useState(0);

  if (screenshots.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Screenshots</h2>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="aspect-video bg-[var(--surface-2)] flex items-center justify-center">
          <img
            src={screenshots[active]}
            alt={`Screenshot ${active + 1}`}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
      {screenshots.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {screenshots.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === active
                  ? 'border-[var(--accent)]'
                  : 'border-transparent hover:border-[var(--border-hover)]'
              }`}
            >
              <img
                src={src}
                alt={`Thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
