interface StarRatingProps {
  /** Numeric rating value (e.g. 4.9). */
  rating: number;
  /** Total number of stars to display. Defaults to 5. */
  max?: number;
  /** Additional CSS classes applied to the wrapper. */
  className?: string;
}

/**
 * Renders a row of filled/empty star glyphs based on a numeric rating.
 * A star is filled when its position (1-indexed) is ≤ rating + 0.5,
 * so a 4.9 rating fills all 5 stars.
 * @param rating Numeric rating value.
 * @param max Total number of stars. Defaults to 5.
 * @param className Extra classes for the wrapper span.
 * @returns Accessible star rating row.
 */
function StarRating({ rating, max = 5, className = "" }: StarRatingProps) {
  const starPositions = Array.from({ length: max }, (_, index) => index + 1);

  return (
    <span
      className={`inline-flex items-center ${className}`}
      aria-label={`${rating} de ${max} estrellas`}
    >
      {starPositions.map((position) => (
        <span
          key={`star-${position}`}
          className={position - 0.5 <= rating ? "star-filled" : "star-empty"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

export { StarRating };
