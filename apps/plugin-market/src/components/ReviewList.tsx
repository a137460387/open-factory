'use client';

import type { PluginReview } from '@open-factory/plugin-market';
import { RatingStars } from './RatingStars';
import { formatDate } from '@/lib/utils';

interface ReviewListProps {
  readonly reviews: readonly PluginReview[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-6">
        <h2 className="text-sm font-semibold">Reviews</h2>
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">
          No reviews yet. Be the first to review!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
      <h2 className="text-sm font-semibold">
        Reviews ({reviews.length})
      </h2>
      <div className="mt-4 divide-y divide-[var(--border)]">
        {reviews.map((review) => (
          <div key={review.id} className="py-4 first:pt-0 last:pb-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Avatar placeholder */}
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-3)] text-2xs font-bold text-[var(--text-secondary)]">
                  {review.userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium">
                  {review.userName}
                </span>
                <RatingStars rating={review.rating} size="sm" />
              </div>
              <span className="text-2xs text-[var(--text-tertiary)]">
                {formatDate(review.createdAt)}
              </span>
            </div>

            {/* Body */}
            <h4 className="mt-2 text-xs font-medium">{review.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {review.content}
            </p>

            {/* Footer */}
            <div className="mt-2 flex items-center gap-3 text-2xs text-[var(--text-tertiary)]">
              <span className="font-mono">v{review.version}</span>
              <button className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.228.22.442.408.625.187.183.429.325.708.412.278.087.598.128.958.128h1.086c.358 0 .678-.041.958-.128.278-.087.52-.229.708-.412.188-.183.325-.397.408-.625" />
                </svg>
                {review.helpful} helpful
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
