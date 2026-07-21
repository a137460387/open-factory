interface RatingStarsProps {
  readonly rating: number;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly showValue?: boolean;
}

export function RatingStars({
  rating,
  size = 'md',
  showValue = false,
}: RatingStarsProps) {
  const sizeClass = {
    sm: 'text-xs gap-px',
    md: 'text-sm gap-0.5',
    lg: 'text-base gap-0.5',
  }[size];

  const stars = Array.from({ length: 5 }, (_, i) => {
    const idx = i + 1;
    if (idx <= Math.floor(rating)) return 'full';
    if (idx - 0.5 <= rating) return 'half';
    return 'empty';
  });

  return (
    <span
      className={`inline-flex items-center ${sizeClass}`}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {stars.map((type, i) => (
        <svg
          key={i}
          className={`h-3.5 w-3.5 ${
            size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
          }`}
          viewBox="0 0 20 20"
          fill="none"
        >
          {type === 'full' && (
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              fill="#facc15"
            />
          )}
          {type === 'half' && (
            <>
              <path
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                fill="var(--text-tertiary)"
                opacity="0.3"
              />
              <clipPath id={`half-${i}`}>
                <rect x="0" y="0" width="10" height="20" />
              </clipPath>
              <path
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                fill="#facc15"
                clipPath={`url(#half-${i})`}
              />
            </>
          )}
          {type === 'empty' && (
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              fill="var(--text-tertiary)"
              opacity="0.3"
            />
          )}
        </svg>
      ))}
      {showValue && (
        <span className="ml-1.5 font-mono text-xs text-[var(--text-secondary)]">
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}
