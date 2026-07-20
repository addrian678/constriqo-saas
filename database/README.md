# ConstructFlow Database

Estado: F1.3 preparado, no conectado.

## Objetivo

Este directorio deja lista la base PostgreSQL para conectar el backend cuando existan credenciales y decision final de runtime.

## Archivos

- `migrations/0001_initial_schema.sql`: esquema inicial multi-tenant con auditoria.
- `seeds/0001_demo_seed.sql`: datos minimos de desarrollo para tenant demo.

## Conexion futura

1. Crear una base PostgreSQL vacia.
2. Copiar `.env.example` a `.env` y ajustar `DATABASE_URL`.
3. Ejecutar migraciones con la herramienta que se adopte en F1.
4. Ejecutar seeds solo en desarrollo.

## Local con Docker

1. Copiar `.env.example` a `.env`.
2. Cambiar `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `SESSION_TOKEN_PEPPER` y `AUTH_MFA_ENCRYPTION_KEY`.
3. Ejecutar `docker compose up -d db`.
4. Exportar/cargar `MIGRATION_DATABASE_URL`.
5. Ejecutar `npm run db:migrate`.
6. Crear el usuario runtime limitado con `npm run db:create-runtime-role`.
7. Usar `DATABASE_URL` con el usuario runtime, no con el usuario migrador.

Las migraciones aplicadas se registran en `schema_migrations`.

### Separacion de usuarios DB

- `MIGRATION_DATABASE_URL`: usuario con permisos para migrar schema.
- `DATABASE_URL`: usuario runtime sin superuser, sin createdb, sin createrole y sin bypass RLS.

Esto es obligatorio para probar aislamiento multi-tenant de forma real. El usuario creado por la imagen oficial de Postgres puede ser superusuario; no debe usarse como usuario runtime de la app.

## Backup y actualizaciones

Antes de aplicar una actualizacion productiva:

1. Exportar/cargar `DATABASE_URL`.
2. Ejecutar `npm run db:backup`.
3. Revisar `release/RELEASE_NOTES.md`.
4. Ejecutar `npm run release:update -- --apply`.
5. Confirmar smoke tests aprobados.

El backup se crea en `backups/db/`, directorio ignorado por git. El runbook completo esta en `docs/runbooks/update-and-rollback.md`.

## Seed inicial de instalacion

Generar un seed inicial por cliente:

```bash
npm run install:seed -- --company="Cliente Demo" --admin-email=admin@cliente.test --admin-name="Admin Cliente"
```

El archivo se crea en `tmp/install-seeds/` y no debe commitearse. El admin queda en estado `invited`; la clave real se debe establecer por flujo seguro de invitacion/auth.

Crear un admin inicial activo para prueba/local:

```bash
npm run install:admin -- --company="Cliente Local" --admin-email=admin@cliente.local --admin-name="Admin Cliente"
```

El script guarda solo hash Argon2id. Si no se define `INITIAL_ADMIN_PASSWORD`, genera una contrasena temporal y la muestra una sola vez en consola. El primer login de administrador exige setup TOTP antes de entregar sesion.

Probar auth local:

```bash
npm run smoke:auth-local
```

Requiere `DATABASE_URL`, `TEST_TENANT_ID`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `SESSION_TOKEN_PEPPER` y `AUTH_MFA_ENCRYPTION_KEY`.

## Reglas

- No guardar credenciales reales en git.
- No activar persistencia sin permisos por servidor.
- Toda escritura productiva debe generar `audit_events`.
- Todo registro de negocio debe estar aislado por `tenant_id`.
