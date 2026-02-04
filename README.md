# Gestión de QRs (Calidad / Obra)

Aplicación web para **trazabilidad en obra**: permite **cargar datos desde Excel**, **vincular documentación**, **generar QRs imprimibles** y **escanear QRs** para abrir una ficha con descarga de documentación.

## Qué puede hacer

- **Carga masiva desde Excel** (upsert en Supabase)
  - Hormigones
  - Cañerías (con “cantidad” calculada por repeticiones en el Excel)
- **Gestión / trazabilidad (Calidad)**
  - Buscar/filtrar por campos principales + satélite
  - Subir y vincular archivo (Storage) por registro
  - Generar QR (descargar PNG / imprimir)
- **Obra (Calidad / Obrero)**
  - Escanear QR desde el celular (cámara)
  - Ver “Detalle” del registro y **descargar/ver el archivo** asociado

## Roles y acceso

En el estado actual del proyecto se usan **2 roles**:

- **Calidad (id_rol = 2)**: acceso a gestión (`/trazabilidad`) + puede subir/vincular archivos y generar QRs.
- **Obrero (id_rol = 3)**: acceso a escáner (`/escanner`) y detalle (`/detalle/:id`) en modo lectura/descarga.

> Nota: la app restringe por rol a nivel UI/rutas. Para producción se recomienda reforzar con **RLS** (ver más abajo).

## Rutas

- **Públicas**
  - `/login`
  - `/registro`
- **Privadas (Calidad, Obrero)**
  - `/escanner`
  - `/detalle/:id`
- **Gestión (solo Calidad)**
  - `/trazabilidad`
  - `/carga-datos` (compat: abre la misma pantalla de gestión)
  - `/generar-qr` (compat: abre la misma pantalla de gestión)

## Cómo funciona (flujo rápido)

- **Calidad**
  - Entrar a **Trazabilidad** (`/trazabilidad`)
  - **Cargar datos** (Excel) → quedan disponibles en la tabla
  - Para un registro: **vincular archivo** (PDF/imagen) → se guarda en Storage y se registra en `archivo_url`
  - **Generar QR** → descargar PNG o imprimir (el QR abre la ficha de detalle)
- **Obra**
  - Abrir **Escáner** (`/escanner`) y escanear el QR
  - Se abre **Detalle** (`/detalle/:id`) con la ficha y el botón de **Descargar / Ver archivo**

## Tecnologías

- React + Vite
- Tailwind CSS
- Supabase (Auth + DB + Storage)
- QR: `qrcode.react` + `@yudiel/react-qr-scanner`
- Excel: `xlsx`

## Configuración (local)

Instalar dependencias:

```bash
npm i
```

Crear variables de entorno en un archivo `.env` (en la raíz del proyecto):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_BUCKET` (por defecto: `documentos`)
- `VITE_PUBLIC_APP_URL` (recomendado): URL pública del deploy que se usará para armar el link dentro del QR.

Ejecutar:

```bash
npm run dev
```

### Link que se guarda en el QR

El QR se genera como una URL del estilo:

- `https://TU-DOMINIO/detalle/<uuid>?t=hormigones|canerias`

Si no seteás `VITE_PUBLIC_APP_URL`, el proyecto usa un fallback: `https://gestion-qr.vercel.app`.

## Excel: formato esperado

La carga masiva está pensada para **formatos fijos**.

### Hormigones

- **Desde fila 3**
- Columnas:
  - **A** = `satelite`
  - **C** = `titulo`
  - **E** = `nro_interno` (**clave única**)
  - **I** = `peso_total_base_kg`

### Cañerías

- **Desde fila 5**
- Columnas:
  - **A** = `satelite`
  - **B** = `nro_linea`
  - **C** = `nro_iso` (clave)
- La app calcula `cantidad` como **repeticiones** (mismo `satelite + nro_linea + nro_iso`).

## Base de datos (Supabase)

El script de referencia está en `database/Tables.sql`. Tablas principales:

- `roles` (ids usados: 2 = Calidad, 3 = Obrero)
- `perfiles` (extiende `auth.users` con `id_rol`)
- `hormigones`
- `canerias`

Incluye un trigger para **crear/actualizar el perfil** al crear usuarios en `auth.users` (tomando `roleId` desde `user_metadata` cuando exista).

## Storage

- Bucket: configurable con `VITE_SUPABASE_BUCKET` (default: `documentos`)
- Se suben archivos a rutas tipo:
  - `hormigones/<id>/<timestamp>-<filename>`
  - `canerias/<id>/<timestamp>-<filename>`
- En DB se guarda `archivo_url` como:
  - **URL pública** si el bucket es público, o
  - **path** si el bucket es privado (en ese caso la app genera **signed URL** para descargar).

## Seguridad (recomendado para producción)

- **RLS en tablas**:
  - Obrero: solo lectura
  - Calidad: lectura + escritura en `hormigones/canerias`
- **Policies en Storage**:
  - Obrero: lectura (o signed URL)
  - Calidad: lectura + escritura

## Deploy

Proyecto preparado para SPA en Vercel (ver `vercel.json` con rewrite a `index.html`).


