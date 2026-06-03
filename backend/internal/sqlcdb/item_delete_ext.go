package sqlcdb

import (
	"context"

	"github.com/google/uuid"
)

const deleteItemForOwner = `
DELETE FROM item
WHERE item_id = $1
  AND owner_id = $2
RETURNING item_id
`

// DeleteItemForOwner deletes an item only when it belongs to the given owner.
func (q *Queries) DeleteItemForOwner(ctx context.Context, itemID, ownerID uuid.UUID) error {
	row := q.db.QueryRow(ctx, deleteItemForOwner, itemID, ownerID)
	var deletedID uuid.UUID
	return row.Scan(&deletedID)
}
