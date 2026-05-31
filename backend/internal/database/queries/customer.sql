-- ============================================
-- CREATE
-- ============================================

-- name: CreateCustomer :one
INSERT INTO customer (
    first_name,
    last_name,
    email,
    phone,
    password_hash,
    user_role,
    avatar_url,
    stripe_customer_id
) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8
         )
RETURNING
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id;

-- ============================================
-- READ
-- ============================================

-- name: GetCustomerByID :one
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
WHERE customer_id = $1
LIMIT 1;

-- name: GetCustomerByEmail :one
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    password_hash,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
WHERE email = $1
LIMIT 1;

-- name: GetCustomerByStripeID :one
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
WHERE stripe_customer_id = $1
LIMIT 1;

-- name: ExistsCustomerByEmail :one
SELECT EXISTS (
    SELECT 1 FROM customer WHERE email = $1
) AS email_exists;

-- name: ListCustomers :many
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
ORDER BY registration_date DESC
LIMIT $1 OFFSET $2;

-- name: CountCustomers :one
SELECT COUNT(*) FROM customer;

-- name: ListCustomersByStatus :many
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
WHERE account_status = $1
ORDER BY registration_date DESC
LIMIT $2 OFFSET $3;

-- name: SearchCustomers :many
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id
FROM customer
WHERE
    first_name ILIKE $1
OR last_name ILIKE $1
OR email ILIKE $1
ORDER BY registration_date DESC
LIMIT $2 OFFSET $3;

-- ============================================
-- UPDATE
-- ============================================

-- name: UpdateCustomerProfile :one
UPDATE customer
SET
    first_name = $2,
last_name  = $3,
phone      = $4,
avatar_url = $5
WHERE customer_id = $1
RETURNING
    customer_id,
    first_name,
    last_name,
    email,
    phone,
    avatar_url,
    registration_date,
    account_status,
    user_role,
    stripe_customer_id;

-- name: UpdateCustomerEmail :one
UPDATE customer
SET email = $2
WHERE customer_id = $1
RETURNING customer_id, email;

-- name: UpdateCustomerPassword :exec
UPDATE customer
SET password_hash = $2
WHERE customer_id = $1;

-- name: UpdateCustomerAvatar :exec
UPDATE customer
SET avatar_url = $2
WHERE customer_id = $1;

-- name: UpdateCustomerStatus :one
UPDATE customer
SET account_status = $2
WHERE customer_id = $1
RETURNING customer_id, account_status;

-- name: UpdateCustomerRole :one
UPDATE customer
SET user_role = $2
WHERE customer_id = $1
RETURNING customer_id, user_role;

-- name: UpdateCustomerStripeID :exec
UPDATE customer
SET stripe_customer_id = $2
WHERE customer_id = $1;

-- ============================================
-- DELETE
-- ============================================

-- name: DeleteCustomer :exec
DELETE FROM customer
WHERE customer_id = $1;

-- name: DeleteCustomerAccountData :exec
DELETE FROM message
WHERE sender_id = $1
   OR conversation_id IN (
       SELECT c.conversation_id
       FROM conversation c
       LEFT JOIN item i ON i.item_id = c.item_id
       WHERE c.customer_1_id = $1
          OR c.customer_2_id = $1
          OR i.owner_id = $1
   );

DELETE FROM conversation
WHERE customer_1_id = $1
   OR customer_2_id = $1
   OR item_id IN (SELECT item_id FROM item WHERE owner_id = $1);

DELETE FROM review
WHERE reviewer_id = $1 OR reviewed_id = $1;

DELETE FROM favorite
WHERE customer_id = $1
   OR item_id IN (SELECT item_id FROM item WHERE owner_id = $1);

DELETE FROM incident
WHERE reporter_id = $1
   OR rental_id IN (
       SELECT r.rental_id
       FROM rental r
       JOIN booking b ON b.booking_id = r.booking_id
       LEFT JOIN item i ON i.item_id = b.item_id
       WHERE b.renter_id = $1 OR i.owner_id = $1
   );

DELETE FROM payment
WHERE payer_id = $1
   OR rental_id IN (
       SELECT r.rental_id
       FROM rental r
       JOIN booking b ON b.booking_id = r.booking_id
       LEFT JOIN item i ON i.item_id = b.item_id
       WHERE b.renter_id = $1 OR i.owner_id = $1
   );

DELETE FROM rental
WHERE booking_id IN (
    SELECT b.booking_id
    FROM booking b
    LEFT JOIN item i ON i.item_id = b.item_id
    WHERE b.renter_id = $1 OR i.owner_id = $1
);

DELETE FROM booking
WHERE renter_id = $1
   OR item_id IN (SELECT item_id FROM item WHERE owner_id = $1);

DELETE FROM item_image
WHERE item_id IN (SELECT item_id FROM item WHERE owner_id = $1);

DELETE FROM item
WHERE owner_id = $1;

DELETE FROM address
WHERE customer_id = $1;

DELETE FROM customer
WHERE customer_id = $1;

-- name: SoftDeleteCustomer :exec
UPDATE customer
SET account_status = 'inactive'
WHERE customer_id = $1;
