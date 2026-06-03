// Package service contains business logic for the API.
package service

import (
	"fmt"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func searchItemCardRowsToResponses(rows []sqlcdb.SearchItemCardsRow) ([]model.SearchItemResponse, int64, error) {
	items := make([]model.SearchItemResponse, 0, len(rows))
	var total int64

	for _, row := range rows {
		if total == 0 {
			total = row.TotalCount
		}

		pricePerDay, err := numericToFloat64(row.PricePerDay)
		if err != nil {
			return nil, 0, fmt.Errorf("converting price_per_day: %w", err)
		}

		items = append(items, model.SearchItemResponse{
			ItemID:          row.ItemID.String(),
			OwnerID:         row.OwnerID.String(),
			AddressID:       row.AddressID.String(),
			Category:        string(row.Category),
			Title:           row.Title,
			ItemStatus:      string(row.ItemStatus),
			PricePerDay:     pricePerDay,
			IsAvailable:     row.IsAvailable,
			PublishedAt:     row.PublishedAt.Time,
			City:            row.City,
			PostalCode:      row.PostalCode,
			PrimaryImageURL: row.PrimaryImageURL,
			OwnerFirstName:  row.OwnerFirstName,
			OwnerLastName:   row.OwnerLastName,
			OwnerAvatarURL:  row.OwnerAvatarURL,
		})
	}

	return items, total, nil
}
