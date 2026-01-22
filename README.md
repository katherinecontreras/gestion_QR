# Gestión de QRs (Calidad / Obra)

Sistema de trazabilidad para obras civiles/industriales: **carga masiva (Excel)**, **vinculación de documentación (Storage)**, **generación/escaneo de QRs** y **control de acceso por roles** (Admin / Calidad / Obrero).

## Rutas

- **Pública**
  - `/login`
- **Privadas (Admin, Calidad, Obrero)**
  - `/escanner`
  - `/detalle/:id`
- **Gestión (Admin, Calidad)**
  - `/dashboard`
  - `/carga-datos`
  - `/generar-qr`
- **Admin (solo Admin)**
  - `/admin/usuarios`

## Tecnologías

- React + Vite
- Tailwind CSS
- Supabase (Auth + DB + Storage)
- QR: `qrcode.react` + `@yudiel/react-qr-scanner`
- Excel: `xlsx`

## Setup

Instalar:

```bash
npm i
```

Variables de entorno:

- Copiá `env.example` a `.env.local`
- Completá:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_BUCKET` (por defecto: `documentos`)

Ejecutar:

```bash
npm run dev
```

## Modelo de datos (Supabase)

Tablas sugeridas:

```sql
-- Roles
CREATE TABLE roles (
  id_rol SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL
);

INSERT INTO roles (id_rol, nombre) VALUES
  (1, 'Admin'),
  (2, 'Calidad'),
  (3, 'Obrero');

-- Perfiles (extiende auth.users)
CREATE TABLE perfiles (
  id_usuario UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  id_rol INTEGER REFERENCES roles(id_rol),
  email TEXT
);

-- Hormigones
CREATE TABLE hormigones (
  id_hormigon UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  nro_interno TEXT UNIQUE NOT NULL,
  peso_total_base_kg DECIMAL,
  satelite TEXT,
  archivo_url TEXT,
  qr_code_url TEXT
);

-- Cañerías
CREATE TABLE canerias (
  id_caneria UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  satelite TEXT,
  nro_linea TEXT NOT NULL,
  nro_iso TEXT UNIQUE NOT NULL,
  archivo_url TEXT,
  qr_code_url TEXT
);
```

### Notas de seguridad (RLS)

- La app **ya bloquea en UI** por rol (guardias de rutas), pero para producción necesitás **RLS**:
  - Obrero: solo lectura
  - Calidad/Admin: escritura en tablas y Storage

## Storage

- Crear un bucket (ej: `documentos`)
- La app sube archivos a:
  - `hormigones/<id>/<timestamp>-<filename>`
  - `canerias/<id>/<timestamp>-<filename>`
- En DB se guarda `archivo_url` como URL pública (si el bucket es público) o como `path` (si es privado).

## Edge Function (crear usuarios)

La pantalla `/admin/usuarios` llama a una Edge Function:

- Endpoint: `POST /functions/v1/create-user`
- Body: `{ email, password, roleId }`

Implementación recomendada:
- Usar `service_role_key` dentro de la función
- Validar que el caller sea **Admin** (JWT + `perfiles.id_rol = 1`)
- Crear el usuario en Auth y luego insertar en `perfiles`

> Importante: **nunca** pongas `service_role_key` en el frontend.

