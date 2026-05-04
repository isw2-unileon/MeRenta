package user

// SQL queries for customer operations
const (
	// createCustomerQuery inserts a new customer and returns the customer_id and registration_date
	createCustomerQuery = `
		INSERT INTO public.customer 
		(first_name, last_name, email, phone, password_hash, account_status, user_role)
		VALUES ($1, $2, $3, $4, $5, 'active', 'user')
		RETURNING customer_id, registration_date
	`

	// getCustomerByEmailQuery retrieves a customer by email, excluding deleted accounts
	getCustomerByEmailQuery = `
		SELECT customer_id, first_name, last_name, email, phone, password_hash, 
		       avatar_url, registration_date, account_status, user_role, stripe_customer_id
		FROM public.customer
		WHERE email = $1 AND account_status != 'deleted'
	`

	// getCustomerByIDQuery retrieves a customer by ID, excluding deleted accounts
	getCustomerByIDQuery = `
		SELECT customer_id, first_name, last_name, email, phone, password_hash, 
		       avatar_url, registration_date, account_status, user_role, stripe_customer_id
		FROM public.customer
		WHERE customer_id = $1 AND account_status != 'deleted'
	`
)
