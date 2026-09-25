# ---- Etapa 1: construccion ----
# Instala dependencias, genera el cliente Prisma y compila NestJS.
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests del workspace raiz y del workspace apps/api
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Todas las dependencias (devDeps incluidas para nest build + prisma generate)
RUN npm ci

# Generar el cliente Prisma (solo necesita el schema, no conexion a BD)
COPY apps/api/prisma ./apps/api/prisma
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Fuente y configuracion de compilacion
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig*.json ./apps/api/
COPY apps/api/nest-cli.json ./apps/api/

RUN npm run build:api

# ---- Etapa 2: runtime ----
# Imagen minima de produccion: solo dependencias de runtime + artefactos compilados.
FROM node:22-alpine AS runtime
WORKDIR /app

# OpenSSL requerido por el motor de consultas de Prisma en Alpine (musl)
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Solo dependencias de produccion
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --omit=dev

# Salida compilada de NestJS
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Schema de Prisma (referenciado por migrate deploy al iniciar si aplica)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Cliente Prisma generado (binario del motor de consultas para linux-musl)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Cloud Run inyecta PORT automaticamente; NestJS lo lee en main.ts como
# process.env.PORT ?? 3000
EXPOSE 8080

CMD ["node", "apps/api/dist/main.js"]
