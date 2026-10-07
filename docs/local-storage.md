# Almacenamiento local (solo desarrollo)

Permite subir fotos/video/documentos (Alquiler paso 4, Devolución, Reservas, Flota) sin Google Cloud Storage.
El API entrega una "URL firmada" que apunta a sí mismo y guarda los archivos en disco.

## Variables (`apps/api/.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `STORAGE_DRIVER` | sí, `local` | `gcs` (default) o `local`. |
| `API_PUBLIC_URL` | recomendada | URL del API vista desde el navegador. Default `http://localhost:$PORT` (3000). |
| `LOCAL_STORAGE_DIR` | no | Carpeta destino. Default `./.local-storage` (gitignorada). |
| `LOCAL_STORAGE_SECRET` | no | Secreto HMAC de los tokens. Hay un valor por defecto de desarrollo. |
| `ALLOWED_ORIGINS` | sí | Debe incluir el origen del front, p. ej. `http://localhost:5173`. |

Con `STORAGE_DRIVER=local` no se necesita `GCS_BUCKET_NAME` ni credenciales GCS.
Con `NODE_ENV=production` y `STORAGE_DRIVER=local` la API **no arranca**.

## Cómo funciona

- El endpoint de siempre (p. ej. sesión de subida de evidencia) devuelve el mismo formato; solo cambia la URL:
  `uploadUrl = {API_PUBLIC_URL}/dev-storage/upload/<token>` y `objectUrl = {API_PUBLIC_URL}/dev-storage/objects/<clave>`.
- El front hace `PUT <uploadUrl>` con el archivo crudo y el mismo `Content-Type` declarado al pedir la sesión.
- El token (HMAC-SHA256) lleva clave de objeto, acción, content-type y expiración (15 min). No requiere login Firebase.
- Lectura: `GET /dev-storage/objects/<clave>` (URL estable guardada en BD) y `GET /dev-storage/files/<token>` (URL firmada de lectura, usada para fotos de flota).
- Las claves son las mismas que en GCS (`rental-evidence/...`, `companies/.../returns/...`, etc.) bajo el directorio local.

## Probar Alquiler -> Devolución

1. En `apps/api/.env`: `STORAGE_DRIVER=local`, `ALLOWED_ORIGINS=http://localhost:5173` (tu puerto del front), `API_PUBLIC_URL=http://localhost:3000`.
2. `npm run start:dev` en `apps/api`; el front apuntando al API local.
3. Alquiler paso 4: sube fotos/video; Devolución: sube evidencia. Los archivos aparecen en `apps/api/.local-storage/`.

## Límites

- Solo desarrollo: sin cuotas, sin limpieza automática, sin autenticación de lectura en `/objects/*`.
- Máximo 100 MB por archivo; solo tipos que el puerto ya permite (jpeg/png/webp, mp4/webm, pdf).
- Los objetos subidos con GCS no existen en local (y viceversa); las URLs guardadas en BD con un host distinto no se resuelven.
