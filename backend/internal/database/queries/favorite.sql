-- ============================================
-- CREATE / DELETE
-- ============================================

-- name: AddFavorite :exec
INSERT INTO favorite (customer_id, item_id)
VALUES ($1, $2)
ON CONFLICT (customer_id, item_id) DO NOTHING;

-- name: RemoveFavorite :exec
DELETE FROM favorite
WHERE customer_id = $1 AND item_id = $2;

-- ============================================
-- READ
-- ============================================

-- name: IsFavorite :one
SELECT EXISTS (
    SELECT 1 FROM favorite
    WHERE customer_id = $1 AND item_id = $2
) AS is_favorite;

-- name: ListFavoriteItems :many
SELECT
    i.item_id,
    i.category,
    i.title,
    i.item_status,
    i.price_per_day,
    i.is_available,
    a.city,
    COALESCE(img.image_url, '') AS primary_image_url,
    f.saved_at
FROM favorite f
JOIN item i ON i.item_id = f.item_id
JOIN address a ON a.address_id = i.address_id
LEFT JOIN LATERAL (
    SELECT image_url
    FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order ASC, image_id ASC
    LIMIT 1
) img ON true
WHERE f.customer_id = $1
ORDER BY f.saved_at DESC;
