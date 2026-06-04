// Package service contains business logic for the API.
package service

import "math"

// toInt32 safely narrows an int to int32.
// Pagination values are always positive and well within int32 range in practice,
// but the explicit cap satisfies static analysis (gosec G115).
func toInt32(n int) int32 {
	if n > math.MaxInt32 {
		n = math.MaxInt32
	}
	return int32(n)
}
