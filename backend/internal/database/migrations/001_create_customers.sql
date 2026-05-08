CREATE TYPE account_status AS ENUM ('active', 'inactive', 'suspended', 'banned');
CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE customer (
                          customer_id        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                          first_name         varchar(100) NOT NULL,
                          last_name          varchar(150) NOT NULL,
                          email              varchar(255) NOT NULL UNIQUE,
                          phone              varchar(20),
                          password_hash      varchar(255) NOT NULL,
                          avatar_url         varchar(500),
                          registration_date  timestamp with time zone DEFAULT now() NOT NULL,
                          account_status     account_status DEFAULT 'active' NOT NULL,
                          user_role          user_role DEFAULT 'user' NOT NULL,
                          stripe_customer_id varchar(255)
);
