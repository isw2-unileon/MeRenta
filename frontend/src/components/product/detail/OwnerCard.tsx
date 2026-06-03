import { useNavigate } from "react-router-dom";

import { StarRating } from "@/components/product/detail/StarRating";
import type { CustomerProfile } from "@/types/customer";

interface OwnerCardProps {
  /** Lightweight owner profile returned by the API. */
  owner: CustomerProfile;
  /** Owner's average rating across all rentals (0 – 5). */
  rating?: number;
  /** Total number of reviews the owner has received. */
  reviewCount?: number;
}

/** Extracts uppercased initials from a first and last name. */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Extracts the four-digit year from an ISO registration date string. */
function getMemberYear(registrationDate: string): number {
  return new Date(registrationDate).getFullYear();
}

function formatRating(rating: number): string {
  return rating.toFixed(2);
}

/**
 * Card showing the listing owner's avatar, name, member-since year and rating.
 * Includes a link to the full public profile page.
 * @param owner Lightweight profile data.
 * @param rating Owner's average rating. Hidden when zero or undefined.
 * @param reviewCount Number of reviews. Shown alongside the rating.
 * @returns Owner card JSX.
 */
function OwnerCard({ owner, rating = 0, reviewCount = 0 }: OwnerCardProps) {
  const navigate = useNavigate();

  const initials = getInitials(owner.first_name, owner.last_name);
  const memberYear = getMemberYear(owner.registration_date);
  // Display as "Miguel G." to match the design
  const displayName = `${owner.first_name} ${owner.last_name.charAt(0)}.`;
  const ratingLabel = formatRating(rating);

  return (
    <div className="owner-card">
      <p className="owner-heading mb-4">Propietario</p>

      {/* ── Owner identity ── */}
      <div className="mb-4 flex items-center gap-3">
        {owner.avatar_url ? (
          <img
            className="avatar-img"
            src={owner.avatar_url}
            alt={`${owner.first_name} ${owner.last_name}`}
          />
        ) : (
          <div
            className="owner-avatar"
            aria-label={`Avatar de ${owner.first_name}`}
          >
            {initials}
          </div>
        )}

        <div>
          <p className="owner-name">{displayName}</p>
          <p className="owner-since">Miembro desde {memberYear}</p>
          {rating > 0 && reviewCount > 0 && (
            <div className="mt-0.5 flex items-center gap-1">
              <StarRating
                rating={rating}
                max={1}
                className="text-sm"
              />
              <p className="owner-rating">
                {ratingLabel} · {reviewCount} valoraciones
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile link ── */}
      <button
        type="button"
        className="btn-secondary btn--md w-full"
        onClick={() => void navigate(`/profile/${owner.customer_id}`)}
      >
        Ver perfil completo →
      </button>
    </div>
  );
}

export { OwnerCard };
