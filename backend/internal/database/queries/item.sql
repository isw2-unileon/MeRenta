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
    brand,
    model,
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
    brand,
    model,
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
    brand,
    model,
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
    brand,
    model,
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
    brand,
    model,
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
    brand,
    model,
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
    brand,
    model,
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
    brand         = $4,
    model         = $5,
    category      = $6,
    price_per_day = $7,
    deposit       = $8,
    min_days      = $9,
    max_days      = $10
WHERE item_id = $1
RETURNING
    item_id,
    owner_id,
    address_id,
    category,
    title,
    description,
    brand,
    model,
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
