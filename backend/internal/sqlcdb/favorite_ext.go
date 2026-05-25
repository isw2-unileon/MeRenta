package sqlcdb

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// AddFavoriteParams holds parameters for AddFavorite.
type AddFavoriteParams struct {
	CustomerID uuid.UUID `json:"customer_id"`
	ItemID     uuid.UUID `json:"item_id"`
}

// RemoveFavoriteParams holds parameters for RemoveFavorite.
type RemoveFavoriteParams struct {
	CustomerID uuid.UUID `json:"customer_id"`
	ItemID     uuid.UUID `json:"item_id"`
}

// IsFavoriteParams holds parameters for IsFavorite.
type IsFavoriteParams struct {
	CustomerID uuid.UUID `json:"customer_id"`
	ItemID     uuid.UUID `json:"item_id"`
}

// FavoriteItemRow is a compact item card enriched with the saved_at timestamp.
type FavoriteItemRow struct {
	ItemID          uuid.UUID          `json:"item_id"`
	Category        CategoryEnum       `json:"category"`
	Title           string             `json:"title"`
	ItemStatus      ItemStatus         `json:"item_status"`
	PricePerDay     pgtype.Numeric     `json:"price_per_day"`
	IsAvailable     bool               `json:"is_available"`
	City            string             `json:"city"`
	PrimaryImageURL string             `json:"primary_image_url"`
	SavedAt         pgtype.Timestamptz `json:"saved_at"`
}

const addFavorite = `
INSERT INTO favorite (customer_id, item_id)
VALUES ($1, $2)
ON CONFLICT (customer_id, item_id) DO NOTHING
`

// AddFavorite saves an item to a customer's favorites, ignoring duplicates.
func (q *Queries) AddFavorite(ctx context.Context, arg AddFavoriteParams) error {
	_, err := q.db.Exec(ctx, addFavorite, arg.CustomerID, arg.ItemID)
	return err
}

const removeFavorite = `
DELETE FROM favorite
WHERE customer_id = $1 AND item_id = $2
`

// RemoveFavorite deletes a favorite record (no-op if it does not exist).
func (q *Queries) RemoveFavorite(ctx context.Context, arg RemoveFavoriteParams) error {
	_, err := q.db.Exec(ctx, removeFavorite, arg.CustomerID, arg.ItemID)
	return err
}

const isFavorite = `
SELECT EXISTS (
    SELECT 1 FROM favorite
    WHERE customer_id = $1 AND item_id = $2
) AS is_favorite
`

// IsFavorite reports whether a customer has saved a given item.
func (q *Queries) IsFavorite(ctx context.Context, arg IsFavoriteParams) (bool, error) {
	row := q.db.QueryRow(ctx, isFavorite, arg.CustomerID, arg.ItemID)
	var exists bool
	if err := row.Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

const listFavoriteItems = `
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
ORDER BY f.saved_at DESC
`

// ListFavoriteItems returns all items saved by a customer, newest first.
func (q *Queries) ListFavoriteItems(ctx context.Context, customerID uuid.UUID) ([]FavoriteItemRow, error) {
	rows, err := q.db.Query(ctx, listFavoriteItems, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []FavoriteItemRow
	for rows.Next() {
		var row FavoriteItemRow
		if err := rows.Scan(
			&row.ItemID,
			&row.Category,
			&row.Title,
			&row.ItemStatus,
			&row.PricePerDay,
			&row.IsAvailable,
			&row.City,
			&row.PrimaryImageURL,
			&row.SavedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, row)
	}

	return items, rows.Err()
}
