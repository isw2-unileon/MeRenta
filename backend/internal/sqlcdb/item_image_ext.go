package sqlcdb

import (
	"context"

	"github.com/google/uuid"
)

const countItemImages = `
SELECT COUNT(*)
FROM item_image
WHERE item_id = $1
`

// CountItemImages returns the number of images stored for an item.
func (q *Queries) CountItemImages(ctx context.Context, itemID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countItemImages, itemID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deleteItemImageForOwner = `
DELETE FROM item_image img
USING item i
WHERE img.image_id = $1
  AND img.item_id = $2
  AND i.item_id = img.item_id
  AND i.owner_id = $3
RETURNING img.image_id
`

// DeleteItemImageForOwner deletes one item image only when the item belongs to the given owner.
func (q *Queries) DeleteItemImageForOwner(ctx context.Context, imageID, itemID, ownerID uuid.UUID) error {
	row := q.db.QueryRow(ctx, deleteItemImageForOwner, imageID, itemID, ownerID)
	var deletedID uuid.UUID
	return row.Scan(&deletedID)
}
