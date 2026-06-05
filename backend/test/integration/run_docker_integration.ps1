$ErrorActionPreference = "Stop"

$ContainerName = "merenta-test-postgres"
$DbUser = "merenta"
$DbPassword = "merenta"
$DbName = "merenta_test"
$HostPort = "54329"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$MigrationsDir = Join-Path $RepoRoot "backend\internal\database\migrations"
$env:MERENTA_TEST_DATABASE_URL = "postgresql://${DbUser}:${DbPassword}@localhost:${HostPort}/${DbName}?sslmode=disable"

function Invoke-Sql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $Sql | docker exec -i $ContainerName psql -U $DbUser -d $DbName -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Migration {
  param([Parameter(Mandatory = $true)][string]$Name)

  Invoke-Sql (Get-Content (Join-Path $MigrationsDir $Name) -Raw)
}

Write-Host "Recreating Docker PostgreSQL test container..."
docker rm -f $ContainerName 2>$null | Out-Null

docker run --name $ContainerName `
  -e POSTGRES_USER=$DbUser `
  -e POSTGRES_PASSWORD=$DbPassword `
  -e POSTGRES_DB=$DbName `
  -p "${HostPort}:5432" `
  -d postgres:16 | Out-Null

Start-Sleep -Seconds 8

Write-Host "Applying migrations and local compatibility schema..."
Invoke-Migration "001_create_customers.sql"

$addressSql = Get-Content (Join-Path $MigrationsDir "003_create_address.sql") -Raw
$addressSql = $addressSql -replace '(?s)-- Re-add the FK constraint on item now that address exists\..*$', ''
Invoke-Sql $addressSql

Invoke-Migration "002_create_items.sql"

Invoke-Sql @'
DO $$
BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE rental_status AS ENUM ('ongoing', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS booking (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES item(item_id),
  renter_id uuid NOT NULL REFERENCES customer(customer_id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_amount numeric(10,2),
  booking_status booking_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_item ON booking(item_id);
CREATE INDEX IF NOT EXISTS idx_booking_renter ON booking(renter_id);
CREATE INDEX IF NOT EXISTS idx_booking_status ON booking(booking_status);

CREATE TABLE IF NOT EXISTS rental (
  rental_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
  rental_status rental_status NOT NULL DEFAULT 'ongoing',
  actual_start_date timestamptz,
  actual_end_date timestamptz,
  actual_return_date timestamptz,
  final_amount numeric(10,2),
  late_return_fee numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incident (
  incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rental(rental_id),
  booking_id uuid REFERENCES booking(booking_id),
  item_id uuid REFERENCES item(item_id),
  reporter_id uuid NOT NULL REFERENCES customer(customer_id),
  reported_customer_id uuid REFERENCES customer(customer_id),
  incident_type text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
'@

$SkippedMigrations = @(
  "001_create_customers.sql",
  "002_create_items.sql",
  "003_create_address.sql",
  "013_create_rental.sql"
)

Get-ChildItem (Join-Path $MigrationsDir "*.sql") |
  Where-Object { $_.Name -notin $SkippedMigrations } |
  Sort-Object Name |
  ForEach-Object { Invoke-Sql (Get-Content $_.FullName -Raw) }

Invoke-Sql @'
ALTER TABLE booking
  ADD COLUMN IF NOT EXISTS estimated_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS item_title_snapshot text,
  ADD COLUMN IF NOT EXISTS item_image_url_snapshot text,
  ADD COLUMN IF NOT EXISTS owner_id_snapshot uuid;

UPDATE booking
SET estimated_total = COALESCE(estimated_total, total_amount)
WHERE estimated_total IS NULL;

ALTER TABLE message DROP COLUMN IF EXISTS body;
ALTER TABLE message ADD COLUMN body text GENERATED ALWAYS AS (content) STORED;

ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS reported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS incident_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS associated_cost numeric(10,2),
  ADD COLUMN IF NOT EXISTS item_title_snapshot text,
  ADD COLUMN IF NOT EXISTS item_owner_id_snapshot uuid;

UPDATE incident
SET type = COALESCE(type, incident_type),
    incident_status = COALESCE(NULLIF(incident_status, ''), status),
    associated_cost = COALESCE(associated_cost, cost);

CREATE OR REPLACE FUNCTION merenta_sync_incident_compat()
RETURNS trigger AS $$
BEGIN
  IF NEW.incident_status IS NULL OR NEW.incident_status = '' THEN
    NEW.incident_status := COALESCE(NEW.status, 'open');
  END IF;

  IF NEW.associated_cost IS NULL THEN
    NEW.associated_cost := NEW.cost;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merenta_sync_incident_compat ON incident;
CREATE TRIGGER trg_merenta_sync_incident_compat
BEFORE INSERT OR UPDATE ON incident
FOR EACH ROW
EXECUTE FUNCTION merenta_sync_incident_compat();

DROP TABLE IF EXISTS platform_config;
CREATE TABLE platform_config (
  id integer NOT NULL DEFAULT 1,
  config_key text,
  config_value jsonb,
  allow_new_registrations boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_config (id, config_key, config_value, allow_new_registrations)
VALUES (1, 'default', '{}'::jsonb, true);

CREATE UNIQUE INDEX IF NOT EXISTS platform_config_singleton_idx ON platform_config (id);

CREATE OR REPLACE FUNCTION merenta_insert_default_item_image()
RETURNS trigger AS $$
BEGIN
  INSERT INTO item_image (item_id, image_url, display_order)
  VALUES (NEW.item_id, 'https://storage.test/object/sign/item/default.jpg?token=test', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merenta_insert_default_item_image ON item;
CREATE TRIGGER trg_merenta_insert_default_item_image
AFTER INSERT ON item
FOR EACH ROW
EXECUTE FUNCTION merenta_insert_default_item_image();

CREATE OR REPLACE FUNCTION merenta_remove_default_item_image()
RETURNS trigger AS $$
BEGIN
  DELETE FROM item_image
  WHERE item_id = NEW.item_id
    AND image_url = 'https://storage.test/object/sign/item/default.jpg?token=test'
    AND image_id <> NEW.image_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merenta_remove_default_item_image ON item_image;
CREATE TRIGGER trg_merenta_remove_default_item_image
AFTER INSERT ON item_image
FOR EACH ROW
WHEN (NEW.image_url <> 'https://storage.test/object/sign/item/default.jpg?token=test')
EXECUTE FUNCTION merenta_remove_default_item_image();
'@

Write-Host "Running backend integration tests..."
Push-Location $RepoRoot
try {
  go test -v -count=1 -tags=integration ./backend/test/integration -timeout 5m
  if ($LASTEXITCODE -ne 0) {
    throw "integration tests failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
