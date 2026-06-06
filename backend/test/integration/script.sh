#!/usr/bin/env zsh

# Detener el script si algún comando falla
set -e

CONTAINER_NAME="merenta-test-postgres"
DB_USER="merenta"
DB_PASSWORD="merenta"
DB_NAME="merenta_test"
HOST_PORT="54329"

# Encontrar la raíz del repositorio relativo al script
# (Equivalente a Resolve-Path (Join-Path $PSScriptRoot "..\..\.."))
SCRIPT_DIR="${0:A:h}"
REPO_ROOT=$(realpath "$SCRIPT_DIR/../../..")
MIGRATIONS_DIR="$REPO_ROOT/backend/internal/database/migrations"

export MERENTA_TEST_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${HOST_PORT}/${DB_NAME}?sslmode=disable"

# Función para invocar SQL dentro de Docker
invoke_sql() {
  local sql_content="$1"
  echo "$sql_content" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  if [ $? -ne 0 ]; then
    echo "psql failed with exit code $?"
    exit 1
  fi
}

# Función para aplicar una migración específica
invoke_migration() {
  local name="$1"
  local file_path="$MIGRATIONS_DIR/$name"
  if [ -f "$file_path" ]; then
    invoke_sql "$(<"$file_path")"
  else
    echo "Error: Migration file not found: $file_path"
    exit 1
  fi
}

echo "Recreating Docker PostgreSQL test container..."
# Redirigir errores al vacío para que no ensucie si el contenedor no existe
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "${HOST_PORT}:5432" \
  -d postgres:16 > /dev/null

sleep 8

echo "Applying migrations and local compatibility schema..."
invoke_migration "001_create_customers.sql"

# Leer 003_create_address.sql y emular el '-replace' regex usando perl
address_sql_path="$MIGRATIONS_DIR/003_create_address.sql"
if [ -f "$address_sql_path" ]; then
  # Perl lee todo el archivo en memoria y remueve el bloque indicado desde '-- Re-add the FK...' hasta el fin del archivo
  address_sql=$(perl -0777 -pe 's/(?s)-- Re-add the FK constraint on item now that address exists\..*//' "$address_sql_path")
  invoke_sql "$address_sql"
else
  echo "Error: 003_create_address.sql not found."
  exit 1
fi

invoke_migration "002_create_items.sql"

# Envío del bloque gigante de SQL (Equivalente al herestring de PowerShell)
invoke_sql '
DO $$
BEGIN
  CREATE TYPE booking_status AS ENUM ('\''pending'\'', '\''accepted'\'', '\''rejected'\'', '\''cancelled'\'', '\''completed'\'');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE rental_status AS ENUM ('\''ongoing'\'', '\''completed'\'', '\''cancelled'\'');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS booking (
  booking_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES item(item_id),
  renter_id uuid NOT NULL REFERENCES customer(customer_id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_amount numeric(10,2),
  booking_status booking_status NOT NULL DEFAULT '\''pending'\'',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_item ON booking(item_id);
CREATE INDEX IF NOT EXISTS idx_booking_renter ON booking(renter_id);
CREATE INDEX IF NOT EXISTS idx_booking_status ON booking(booking_status);

CREATE TABLE IF NOT EXISTS rental (
  rental_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
  rental_status rental_status NOT NULL DEFAULT '\''ongoing'\'',
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
  incident_type text NOT NULL DEFAULT '\''other'\'',
  description text NOT NULL,
  status text NOT NULL DEFAULT '\''open'\'',
  cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
'

# Lista de exclusiones (Array asociativo en Zsh para búsqueda rápida)
typeset -A skipped_migrations
skipped_migrations=(
  "001_create_customers.sql" 1
  "002_create_items.sql" 1
  "003_create_address.sql" 1
  "013_create_rental.sql" 1
)

# Leer y ordenar todos los archivos .sql del directorio de migraciones
# Aplicando el filtro de las omitidas
# Cambia (N.oN) por (N.n)
for sql_file in "${MIGRATIONS_DIR}"/*.sql(N.n); do
  filename="${sql_file:t}"
  if [[ -z "${skipped_migrations[$filename]}" ]]; then
    invoke_sql "$(<"$sql_file")"
  fi
done

# Segundo bloque gigante de SQL para compatibilidad y triggers
# Segundo bloque gigante de SQL para compatibilidad y triggers
# Segundo bloque gigante de SQL para compatibilidad y triggers
invoke_sql '
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
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT $str$medium$str$,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS incident_status text NOT NULL DEFAULT $str$open$str$,
  ADD COLUMN IF NOT EXISTS associated_cost numeric(10,2),
  ADD COLUMN IF NOT EXISTS item_title_snapshot text,
  ADD COLUMN IF NOT EXISTS item_owner_id_snapshot uuid;

UPDATE incident
SET type = COALESCE(type, incident_type),
    incident_status = COALESCE(NULLIF(incident_status, $str$$str$), status),
    associated_cost = COALESCE(associated_cost, cost);

CREATE OR REPLACE FUNCTION merenta_sync_incident_compat()
RETURNS trigger AS $body$
BEGIN
  IF NEW.incident_status IS NULL OR NEW.incident_status = $str$$str$ THEN
    NEW.incident_status := COALESCE(NEW.status, $str$open$str$);
  END IF;

  IF NEW.associated_cost IS NULL THEN
    NEW.associated_cost := NEW.cost;
  END IF;

  RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

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
VALUES (1, $str$default$str$, $str${}$str$::jsonb, true);

CREATE UNIQUE INDEX IF NOT EXISTS platform_config_singleton_idx ON platform_config (id);

CREATE OR REPLACE FUNCTION merenta_insert_default_item_image()
RETURNS trigger AS $body$
BEGIN
  INSERT INTO item_image (item_id, image_url, display_order)
  VALUES (NEW.item_id, $str$https://storage.test/object/sign/item/default.jpg?token=test$str$, 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merenta_insert_default_item_image ON item;
CREATE TRIGGER trg_merenta_insert_default_item_image
AFTER INSERT ON item
FOR EACH ROW
EXECUTE FUNCTION merenta_insert_default_item_image();

CREATE OR REPLACE FUNCTION merenta_remove_default_item_image()
RETURNS trigger AS $body$
BEGIN
  DELETE FROM item_image
  WHERE item_id = NEW.item_id
    AND image_url = $str$https://storage.test/object/sign/item/default.jpg?token=test$str$
    AND image_id <> NEW.image_id;

  RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_merenta_remove_default_item_image ON item_image;
CREATE TRIGGER trg_merenta_remove_default_item_image
AFTER INSERT ON item_image
FOR EACH ROW
WHEN (NEW.image_url <> $str$https://storage.test/object/sign/item/default.jpg?token=test$str$)
EXECUTE FUNCTION merenta_remove_default_item_image();
'

echo "Running backend integration tests..."
# pushd / popd emulan Push-Location y Pop-Location de PS
pushd "$REPO_ROOT" > /dev/null

# El bloque try/finally se maneja garantizando que popd se ejecute al salir con una trampa (trap) o condicional
go test -v -count=1 -tags=integration ./backend/test/integration -timeout 5m
GO_TEST_EXIT=$?

popd > /dev/null

if [ $GO_TEST_EXIT -ne 0 ]; then
  echo "integration tests failed with exit code $GO_TEST_EXIT"
  exit $GO_TEST_EXIT
fi
