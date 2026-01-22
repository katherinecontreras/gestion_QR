-- Extensión para gen_random_uuid() / crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL -- 'Calidad', 'Obrero'
);

-- 2. Extensión de Perfiles (Se vincula con auth.users de Supabase)
CREATE TABLE IF NOT EXISTS perfiles (
    id_usuario UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    id_rol INTEGER REFERENCES roles(id_rol),
    email TEXT
);

-- 3. Tabla de Tipos de Datos
CREATE TABLE IF NOT EXISTS tipos_dato (
    id_tipo_dato SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL -- 'Hormigón', 'Cañería'
);

-- 4. Tabla de Hormigones
CREATE TABLE IF NOT EXISTS hormigones (
    id_hormigon UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_tipo_dato INTEGER DEFAULT 1 REFERENCES tipos_dato(id_tipo_dato),
    titulo TEXT NOT NULL,
    nro_interno TEXT UNIQUE NOT NULL,
    peso_total_base_kg DECIMAL,
    satelite TEXT,
    archivo_url TEXT, -- URL del archivo en Supabase Storage
    qr_code_url TEXT   -- URL o base64 del QR generado
);

-- 5. Tabla de Cañerías
CREATE TABLE IF NOT EXISTS canerias (
    id_caneria UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_tipo_dato INTEGER DEFAULT 2 REFERENCES tipos_dato(id_tipo_dato),
    satelite TEXT,
    nro_linea TEXT NOT NULL,
    nro_iso TEXT UNIQUE NOT NULL,
    archivo_url TEXT,
    qr_code_url TEXT
);

-- =========================================================
-- SEED INICIAL (Roles + Tipos)
-- =========================================================

-- Roles (sin Admin: solo Calidad y Obrero)
-- IDs:
-- 2 = Calidad
-- 3 = Obrero
DELETE FROM roles WHERE id_rol = 1;

INSERT INTO roles (id_rol, nombre)
VALUES
  (2, 'Calidad'),
  (3, 'Obrero')
ON CONFLICT (id_rol) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Tipos de dato (para que los defaults 1/2 funcionen)
INSERT INTO tipos_dato (id_tipo_dato, nombre)
VALUES
  (1, 'Hormigón'),
  (2, 'Cañería')
ON CONFLICT (id_tipo_dato) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Si querés “resetear” perfiles, ejecutá manualmente:
-- TRUNCATE TABLE perfiles;

-- =========================================================
-- TRIGGER: crear perfil automáticamente al crear usuarios Auth
-- (el rol se lee desde user_metadata.roleId; si viene inválido, usa Obrero=3)
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_text text;
  v_role_id int;
BEGIN
  v_role_text := NEW.raw_user_meta_data->>'roleId';

  BEGIN
    v_role_id := v_role_text::int;
  EXCEPTION WHEN others THEN
    v_role_id := NULL;
  END;

  IF v_role_id NOT IN (2, 3) THEN
    v_role_id := 3;
  END IF;

  -- Asegura que existan los roles para evitar fallas por FK en perfiles.id_rol
  INSERT INTO public.roles (id_rol, nombre)
  VALUES (2, 'Calidad')
  ON CONFLICT (id_rol) DO NOTHING;

  INSERT INTO public.roles (id_rol, nombre)
  VALUES (3, 'Obrero')
  ON CONFLICT (id_rol) DO NOTHING;

  BEGIN
    INSERT INTO public.perfiles (id_usuario, id_rol, email)
    VALUES (NEW.id, v_role_id, NEW.email)
    ON CONFLICT (id_usuario) DO UPDATE
    SET id_rol = EXCLUDED.id_rol,
        email = EXCLUDED.email;
  EXCEPTION WHEN others THEN
    -- No abortar la creación de usuario Auth por un problema en perfiles
    INSERT INTO public.perfiles (id_usuario, id_rol, email)
    VALUES (NEW.id, NULL, NEW.email)
    ON CONFLICT (id_usuario) DO UPDATE
    SET email = EXCLUDED.email;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();