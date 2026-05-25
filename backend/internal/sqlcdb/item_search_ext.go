package sqlcdb

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const searchItemCards = `
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
WHERE ($1 = false OR i.is_available = true)
  AND (
    $2 = ''
    OR i.title ILIKE '%' || $2 || '%'
    OR COALESCE(i.description, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.brand, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.model, '') ILIKE '%' || $2 || '%'
  )
  AND ($3 = '' OR i.category::text = $3)
  AND ($4 = '' OR a.city ILIKE $4)
  AND ($5 = '' OR i.item_condition::text = $5)
  AND ($6::numeric IS NULL OR i.price_per_day >= $6::numeric)
  AND ($7::numeric IS NULL OR i.price_per_day <= $7::numeric)
ORDER BY
    CASE WHEN $8 = 'price_asc' THEN i.price_per_day END ASC,
    CASE WHEN $8 = 'price_desc' THEN i.price_per_day END DESC,
    CASE WHEN $8 = 'oldest' THEN i.published_at END ASC,
    i.published_at DESC
LIMIT $9 OFFSET $10
`

type SearchItemCardsParams struct {
	RequireAvailable bool     `json:"require_available"`
	Query     string   `json:"query"`
	Category  string   `json:"category"`
	City      string   `json:"city"`
	Condition string   `json:"condition"`
	MinPrice  *float64 `json:"min_price"`
	MaxPrice  *float64 `json:"max_price"`
	Sort      string   `json:"sort"`
	Limit     int32    `json:"limit"`
	Offset    int32    `json:"offset"`
}

type SearchItemCardsRow struct {
	ItemID          uuid.UUID          `json:"item_id"`
	OwnerID         uuid.UUID          `json:"owner_id"`
	AddressID       uuid.UUID          `json:"address_id"`
	Category        CategoryEnum       `json:"category"`
	Title           string             `json:"title"`
	ItemStatus      ItemStatus         `json:"item_status"`
	PricePerDay     pgtype.Numeric     `json:"price_per_day"`
	IsAvailable     bool               `json:"is_available"`
	PublishedAt     pgtype.Timestamptz `json:"published_at"`
	City            string             `json:"city"`
	PrimaryImageURL string             `json:"primary_image_url"`
	TotalCount      int64              `json:"total_count"`
}

const countItemCardsByCategory = `
SELECT
    i.category,
    COUNT(*) AS total_count
FROM item i
JOIN address a ON a.address_id = i.address_id
WHERE ($1 = false OR i.is_available = true)
  AND (
    $2 = ''
    OR i.title ILIKE '%' || $2 || '%'
    OR COALESCE(i.description, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.brand, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.model, '') ILIKE '%' || $2 || '%'
  )
  AND ($3 = '' OR a.city ILIKE $3)
  AND ($4 = '' OR i.item_condition::text = $4)
  AND ($5::numeric IS NULL OR i.price_per_day >= $5::numeric)
  AND ($6::numeric IS NULL OR i.price_per_day <= $6::numeric)
GROUP BY i.category
`

const countItemCardsByCity = `
SELECT
    a.city,
    COUNT(*) AS total_count
FROM item i
JOIN address a ON a.address_id = i.address_id
WHERE ($1 = false OR i.is_available = true)
  AND (
    $2 = ''
    OR i.title ILIKE '%' || $2 || '%'
    OR COALESCE(i.description, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.brand, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.model, '') ILIKE '%' || $2 || '%'
  )
  AND ($3 = '' OR i.category::text = $3)
  AND ($4 = '' OR i.item_condition::text = $4)
  AND ($5::numeric IS NULL OR i.price_per_day >= $5::numeric)
  AND ($6::numeric IS NULL OR i.price_per_day <= $6::numeric)
GROUP BY a.city
ORDER BY total_count DESC, a.city ASC
`

const countItemCardsByCondition = `
SELECT
    i.item_condition,
    COUNT(*) AS total_count
FROM item i
JOIN address a ON a.address_id = i.address_id
WHERE ($1 = false OR i.is_available = true)
  AND (
    $2 = ''
    OR i.title ILIKE '%' || $2 || '%'
    OR COALESCE(i.description, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.brand, '') ILIKE '%' || $2 || '%'
    OR COALESCE(i.model, '') ILIKE '%' || $2 || '%'
  )
  AND ($3 = '' OR i.category::text = $3)
  AND ($4 = '' OR a.city ILIKE $4)
  AND ($5::numeric IS NULL OR i.price_per_day >= $5::numeric)
  AND ($6::numeric IS NULL OR i.price_per_day <= $6::numeric)
GROUP BY i.item_condition
`

type CountItemCardsByCategoryParams struct {
	RequireAvailable bool     `json:"require_available"`
	Query     string   `json:"query"`
	City      string   `json:"city"`
	Condition string   `json:"condition"`
	MinPrice  *float64 `json:"min_price"`
	MaxPrice  *float64 `json:"max_price"`
}

type CountItemCardsByCategoryRow struct {
	Category   CategoryEnum `json:"category"`
	TotalCount int64        `json:"total_count"`
}

type CountItemCardsByCityParams struct {
	RequireAvailable bool     `json:"require_available"`
	Query     string   `json:"query"`
	Category  string   `json:"category"`
	Condition string   `json:"condition"`
	MinPrice  *float64 `json:"min_price"`
	MaxPrice  *float64 `json:"max_price"`
}

type CountItemCardsByCityRow struct {
	City       string `json:"city"`
	TotalCount int64  `json:"total_count"`
}

type CountItemCardsByConditionParams struct {
	RequireAvailable bool     `json:"require_available"`
	Query    string   `json:"query"`
	Category string   `json:"category"`
	City     string   `json:"city"`
	MinPrice *float64 `json:"min_price"`
	MaxPrice *float64 `json:"max_price"`
}

type CountItemCardsByConditionRow struct {
	Condition  ItemCondition `json:"condition"`
	TotalCount int64         `json:"total_count"`
}

func (q *Queries) SearchItemCards(ctx context.Context, arg SearchItemCardsParams) ([]SearchItemCardsRow, error) {
	rows, err := q.db.Query(
		ctx,
		searchItemCards,
		arg.RequireAvailable,
		arg.Query,
		arg.Category,
		arg.City,
		arg.Condition,
		arg.MinPrice,
		arg.MaxPrice,
		arg.Sort,
		arg.Limit,
		arg.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SearchItemCardsRow
	for rows.Next() {
		var i SearchItemCardsRow
		if err := rows.Scan(
			&i.ItemID,
			&i.OwnerID,
			&i.AddressID,
			&i.Category,
			&i.Title,
			&i.ItemStatus,
			&i.PricePerDay,
			&i.IsAvailable,
			&i.PublishedAt,
			&i.City,
			&i.PrimaryImageURL,
			&i.TotalCount,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (q *Queries) CountItemCardsByCategory(ctx context.Context, arg CountItemCardsByCategoryParams) ([]CountItemCardsByCategoryRow, error) {
	rows, err := q.db.Query(
		ctx,
		countItemCardsByCategory,
		arg.RequireAvailable,
		arg.Query,
		arg.City,
		arg.Condition,
		arg.MinPrice,
		arg.MaxPrice,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []CountItemCardsByCategoryRow
	for rows.Next() {
		var row CountItemCardsByCategoryRow
		if err := rows.Scan(&row.Category, &row.TotalCount); err != nil {
			return nil, err
		}
		counts = append(counts, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return counts, nil
}

func (q *Queries) CountItemCardsByCity(ctx context.Context, arg CountItemCardsByCityParams) ([]CountItemCardsByCityRow, error) {
	rows, err := q.db.Query(
		ctx,
		countItemCardsByCity,
		arg.RequireAvailable,
		arg.Query,
		arg.Category,
		arg.Condition,
		arg.MinPrice,
		arg.MaxPrice,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []CountItemCardsByCityRow
	for rows.Next() {
		var row CountItemCardsByCityRow
		if err := rows.Scan(&row.City, &row.TotalCount); err != nil {
			return nil, err
		}
		counts = append(counts, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return counts, nil
}

func (q *Queries) CountItemCardsByCondition(ctx context.Context, arg CountItemCardsByConditionParams) ([]CountItemCardsByConditionRow, error) {
	rows, err := q.db.Query(
		ctx,
		countItemCardsByCondition,
		arg.RequireAvailable,
		arg.Query,
		arg.Category,
		arg.City,
		arg.MinPrice,
		arg.MaxPrice,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []CountItemCardsByConditionRow
	for rows.Next() {
		var row CountItemCardsByConditionRow
		if err := rows.Scan(&row.Condition, &row.TotalCount); err != nil {
			return nil, err
		}
		counts = append(counts, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return counts, nil
}
