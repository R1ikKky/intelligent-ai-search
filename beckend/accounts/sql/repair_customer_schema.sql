-- Align public.customer with Django unmanaged model Customer
-- (customer_inn PK, customer_name, customer_region).
-- Idempotent: safe to run on every migrate / dataset load.

DO $$
DECLARE
  has_table boolean;
  has_customer_inn boolean;
  id_is_inn_like boolean;
  login_is_inn_like boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer'
  ) INTO has_table;

  IF NOT has_table THEN
    CREATE TABLE public.customer (
      customer_inn TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_region TEXT
    );
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer' AND column_name = 'customer_inn'
  ) INTO has_customer_inn;

  IF NOT has_customer_inn THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'customer' AND c.column_name = 'id'
        AND c.data_type IN ('text', 'character varying', 'character')
    ) INTO id_is_inn_like;

    IF id_is_inn_like THEN
      ALTER TABLE public.customer RENAME COLUMN id TO customer_inn;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'customer' AND c.column_name = 'login'
          AND c.data_type IN ('text', 'character varying', 'character')
      ) INTO login_is_inn_like;

      IF login_is_inn_like THEN
        ALTER TABLE public.customer RENAME COLUMN login TO customer_inn;
      ELSE
        ALTER TABLE public.customer ADD COLUMN customer_inn TEXT;
      END IF;
    END IF;
  END IF;

  ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS customer_name TEXT;
  ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS customer_region TEXT;
END $$;
