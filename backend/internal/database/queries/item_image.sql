-- ============================================
-- CREATE
-- ============================================

-- name: CreateItemImage :one
INSERT INTO item_image (item_id, image_url, display_order)
VALUES ($1, $2, $3)
RETURNING image_id, item_id, image_url, display_order;

-- ============================================
-- READ
-- ============================================

-- name: GetItemImages :many
SELECT image_id, item_id, image_url, display_order
FROM item_image
WHERE item_id = $1
ORDER BY display_order ASC;

-- ============================================
-- DELETE
-- ============================================

-- name: DeleteItemImages :exec
DELETE FROM item_image WHERE item_id = $1;
