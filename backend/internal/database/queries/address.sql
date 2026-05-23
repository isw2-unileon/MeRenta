-- name: CreateAddress :one
INSERT INTO address (
    customer_id, street, number, floor,
    city, province, postal_code, country,
    latitude, longitude
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8,
    $9, $10
)
RETURNING
    address_id, customer_id, street, number, floor,
    city, province, postal_code, country,
    latitude, longitude;

-- name: GetAddressesByCustomer :many
SELECT
    address_id, customer_id, street, number, floor,
    city, province, postal_code, country,
    latitude, longitude
FROM address
WHERE customer_id = $1
ORDER BY address_id;

-- name: GetAddressByID :one
SELECT
    address_id, customer_id, street, number, floor,
    city, province, postal_code, country,
    latitude, longitude
FROM address
WHERE address_id = $1
LIMIT 1;
