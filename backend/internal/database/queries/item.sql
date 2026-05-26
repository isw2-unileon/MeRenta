-- ============================================
-- CREATE
-- ============================================

-- name: CreateItem :one
INSERT INTO item (
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_condition,
    price_per_day,
    deposit,
    min_days,
    max_days
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_condition,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at;

-- ============================================
-- READ
-- ============================================

-- name: GetItemByID :one
SELECT
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_condition,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at
FROM item
WHERE item_id = $1
LIMIT 1;

-- name: ExistsItemByID :one
SELECT EXISTS (
    SELECT 1 FROM item WHERE item_id = $1
) AS item_exists;

-- name: ListItems :many
SELECT
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at
FROM item
WHERE is_available = true
ORDER BY published_at DESC
LIMIT $1 OFFSET $2;

-- name: ListItemsByOwner :many
SELECT
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at
FROM item
WHERE owner_id = $1
ORDER BY published_at DESC
LIMIT $2 OFFSET $3;

-- name: ListItemsByCategory :many
SELECT
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at
FROM item
WHERE category = $1
  AND is_available = true
ORDER BY published_at DESC
LIMIT $2 OFFSET $3;

-- name: SearchItems :many
SELECT
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at
FROM item
WHERE (title ILIKE $1 OR description ILIKE $1)
  AND is_available = true
ORDER BY published_at DESC
LIMIT $2 OFFSET $3;

-- name: SearchItemCards :many
SELECT
    i.item_id,
    i.owner_id,
    i.address_id,
    i.category,
    i.title,
    i.item_status,
    i.price_per_day,
    i.is_available,
    i.published_at,
    a.city,
    COALESCE(img.image_url, '') AS primary_image_url,
    COUNT(*) OVER() AS total_count
FROM item i
JOIN address a ON a.address_id = i.address_id
LEFT JOIN LATERAL (
    SELECT image_url
    FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order ASC, image_id ASC
    LIMIT 1
) img ON true
WHERE i.is_available = true
  AND (
    sqlc.arg(query)::text = ''
    OR i.title ILIKE '%' || sqlc.arg(query)::text || '%'
    OR COALESCE(i.description, '') ILIKE '%' || sqlc.arg(query)::text || '%'
  )
  AND (sqlc.arg(category)::text = '' OR i.category::text = sqlc.arg(category)::text)
  AND (sqlc.arg(city)::text = '' OR a.city ILIKE sqlc.arg(city)::text)
  AND (sqlc.arg(condition)::text = '' OR i.item_condition::text = sqlc.arg(condition)::text)
  AND (sqlc.narg(min_price)::numeric IS NULL OR i.price_per_day >= sqlc.narg(min_price)::numeric)
  AND (sqlc.narg(max_price)::numeric IS NULL OR i.price_per_day <= sqlc.narg(max_price)::numeric)
ORDER BY
    CASE WHEN sqlc.arg(sort)::text = 'price_asc' THEN i.price_per_day END ASC,
    CASE WHEN sqlc.arg(sort)::text = 'price_desc' THEN i.price_per_day END DESC,
    CASE WHEN sqlc.arg(sort)::text = 'oldest' THEN i.published_at END ASC,
    i.published_at DESC
LIMIT sqlc.arg(limit_rows) OFFSET sqlc.arg(offset_rows);

-- name: CountItems :one
SELECT COUNT(*) FROM item;

-- name: CountAvailableItems :one
SELECT COUNT(*) FROM item WHERE is_available = true;

-- name: CountItemsByOwner :one
SELECT COUNT(*) FROM item WHERE owner_id = $1;

-- ============================================
-- UPDATE
-- ============================================

-- name: UpdateItem :one
UPDATE item
SET
    title         = $2,
    description   = $3,
    usage_rules   = $4,
    category      = $5,
    price_per_day = $6,
    deposit       = $7,
    min_days      = $8,
    max_days      = $9
WHERE item_id = $1
RETURNING
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    usage_rules,
    item_status,
    price_per_day,
    deposit,
    min_days,
    max_days,
    is_available,
    published_at;

-- name: UpdateItemStatus :one
UPDATE item
SET item_status = $2
WHERE item_id = $1
RETURNING item_id, item_status;

-- name: UpdateItemAvailability :exec
UPDATE item
SET is_available = $2
WHERE item_id = $1;

-- ============================================
-- DELETE
-- ============================================

-- name: DeleteItem :exec
DELETE FROM item
WHERE item_id = $1;

-- name: SoftDeleteItem :exec
UPDATE item
SET is_available = false,
    item_status  = 'retired'
WHERE item_id = $1;
