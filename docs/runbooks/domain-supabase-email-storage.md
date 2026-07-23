# Dominio, Supabase, email y storage productivo

Este runbook prepara Constriqo para pasar de local/sandbox a staging o produccion SaaS.

## Estado actual

- Local permite `EMAIL_PROVIDER=sandbox`.
- Local permite `STORAGE_PROVIDER=not-configured`.
- Produccion (`APP_ENV=production`) queda bloqueada por `/ready` si faltan dominio HTTPS, email real, storage real o worker de email.
- La base de datos debe tener aplicadas las migraciones productivas vigentes, incluida `0057_attendance_payroll_runtime.sql`, y la persistencia fisica de documentos de `0052_document_storage_persistence.sql`.
- Las API keys y secretos no deben guardarse en frontend, Git, `.env.example`, PDF del plan ni capturas.

## Dominio

1. Comprar dominio principal de marca.
2. Crear subdominio para la app SaaS, por ejemplo `app.tumarca.com`.
3. Crear subdominio privado proveedor si se desea separar consola, por ejemplo `admin.tumarca.com`.
4. Configurar HTTPS obligatorio.
5. Definir:
   - `APP_BASE_URL=https://app.tumarca.com`
   - `APP_ALLOWED_ORIGIN_DOMAINS=tumarca.com` para permitir subdominios SaaS controlados por HTTPS.
   - `VITE_API_BASE_URL=https://api.tumarca.com` o la URL backend que se elija.

## Supabase/PostgreSQL

1. Crear proyecto Supabase.
2. Obtener connection string de migracion con usuario propietario.
3. Ejecutar:

```powershell
$env:MIGRATION_DATABASE_URL="postgresql://..."
npm run db:migrate
```

4. Crear runtime role con permisos minimos:

```powershell
$env:MIGRATION_DATABASE_URL="postgresql://..."
$env:APP_DB_USER="constriqo_app"
$env:APP_DB_PASSWORD="clave-larga-generada"
npm run db:create-runtime-role
```

5. Configurar backend runtime con el usuario limitado:

```powershell
$env:DATABASE_URL="postgresql://constriqo_app:..."
```

Si se usa Supabase Session Pooler (`*.pooler.supabase.com`), el usuario de la URL runtime debe incluir el project ref como sufijo. Ejemplo: si el rol PostgreSQL real es `constriqo_app` y el project ref es `iusgqqewvkpjpebxjzbx`, la URL runtime debe usar:

```text
postgresql://constriqo_app.iusgqqewvkpjpebxjzbx:APP_DB_PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres
```

No usar solo `constriqo_app` contra `*.pooler.supabase.com`; Supabase Pooler respondera `ENOIDENTIFIER no tenant identifier provided`.

6. Ejecutar `/ready`; debe responder `ok` solo si migraciones y proveedores estan listos.

## Supabase Storage

1. Crear bucket privado para documentos, por ejemplo `constriqo-documents`.
2. Configurar politicas del bucket por backend/servicio, no por frontend directo.
3. Configurar:

```powershell
$env:STORAGE_PROVIDER="supabase-storage"
$env:STORAGE_BUCKET_DOCUMENTS="constriqo-documents"
$env:SUPABASE_URL="https://..."
$env:SUPABASE_SERVICE_ROLE_KEY="secreto-servidor-no-frontend"
```

4. Confirmar que los documentos generados usen rutas tipo `supabase://bucket/tenant/generated/...`.
5. Generar una cotizacion/factura PDF y confirmar que:
   - `documents.storage_provider` queda en `supabase-storage`.
   - `documents.storage_uploaded_at` queda con fecha.
   - `documents.storage_checksum_sha256` queda calculado.
   - `documents.storage_persisted` queda en `true`.
6. Confirmar que la limpieza semestral conserva metadata/auditoria y limpia solo referencia/archivo pesado archivado.

Para prueba local sin nube:

```powershell
$env:STORAGE_PROVIDER="local-dev"
$env:LOCAL_STORAGE_ROOT=".local-data/storage"
npm run smoke:storage-local
```

En produccion, `local-dev` y `not-configured` no son validos.

## Email Real

1. Verificar dominio/remitente con el proveedor elegido.
2. Configurar SPF, DKIM y DMARC segun proveedor.
3. Configurar:

```powershell
$env:EMAIL_PROVIDER="smtp"
$env:EMAIL_FROM="no-reply@tumarca.com"
$env:EMAIL_REPLY_TO="soporte@tumarca.com"
$env:SMTP_HOST="smtp..."
$env:SMTP_PORT="587"
$env:SMTP_SECURE="false"
$env:SMTP_USERNAME="..."
$env:SMTP_PASSWORD="..."
$env:EMAIL_DELIVERY_WORKER_ENABLED="true"
$env:EMAIL_WORKER_DATABASE_URL="postgresql://usuario-worker-o-admin:..."
$env:EMAIL_WORKER_BATCH_SIZE="10"
$env:EMAIL_WORKER_MAX_ATTEMPTS="5"
```

4. En produccion, `/ready` debe fallar si `EMAIL_DELIVERY_WORKER_ENABLED` no esta en `true`.
5. Enviar primero a cuentas internas de prueba.
6. Revisar `email_deliveries` por tenant antes de abrir a clientes.

### Worker de email

La app web no envia directamente correos reales: los deja en `email_deliveries` con estado `queued`.
El proceso separado del worker toma esos correos, evita doble procesamiento con bloqueo temporal, reintenta con backoff y registra auditoria por tenant.

Prueba de un solo lote:

```powershell
$env:EMAIL_WORKER_DATABASE_URL="postgresql://usuario-worker-o-admin:..."
npm run email:worker:once
```

Proceso continuo:

```powershell
$env:EMAIL_WORKER_DATABASE_URL="postgresql://usuario-worker-o-admin:..."
npm run email:worker
```

Para pruebas tecnicas sin enviar al exterior:

```powershell
$env:EMAIL_WORKER_DRY_RUN="true"
npm run email:worker:once
```

Reglas de seguridad:

- `EMAIL_WORKER_DATABASE_URL` debe ser secreto de backend, nunca frontend.
- El worker debe correr en el servidor, NAS, VPS o plataforma backend donde vive la API.
- En produccion no usar `EMAIL_PROVIDER=sandbox`.
- Revisar `email_deliveries.status`, `attempt_count`, `error_message` y auditoria antes de activar clientes reales.

## Verificacion final de proveedores

Solo despues de probar dominio, SMTP/email y storage real se puede activar:

```powershell
$env:EXTERNAL_PROVIDERS_VERIFIED="true"
```

Sin esta variable, `/ready` debe responder `not-ready` en produccion aunque existan valores en las variables de entorno.

## Preflight de staging/produccion

Antes de declarar listo un entorno real, ejecutar:

```powershell
$env:APP_ENV="staging"
$env:APP_BASE_URL="https://app.tumarca.com"
$env:APP_ALLOWED_ORIGIN_DOMAINS="tumarca.com"
$env:VITE_API_BASE_URL="https://api.tumarca.com"
$env:MIGRATION_DATABASE_URL="postgresql://..."
$env:DATABASE_URL="postgresql://constriqo_app:..."
$env:EMAIL_PROVIDER="smtp"
$env:STORAGE_PROVIDER="supabase-storage"
npm run production:preflight
```

El comando valida:

- dominio HTTPS,
- secretos base,
- base de datos y migracion `0057_attendance_payroll_runtime.sql`,
- email real y worker,
- Supabase Storage,
- proveedores externos verificados.

El preflight no debe imprimir secretos en claro. Si falla, corregir los puntos `not ok` antes de intentar entregar a cliente.

## Fiscalidad por pais

Constriqo guarda perfiles fiscales operativos y snapshots por documento, pero no queda certificado fiscalmente hasta integrar o validar el proveedor fiscal correspondiente.

Fuentes oficiales a revisar antes de produccion:

- Colombia DIAN factura electronica: https://www.dian.gov.co/impuestos/factura-electronica/Paginas/inicio.aspx
- Espana AEAT SIF/VERI*FACTU: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html
- Utah Sales & Use Tax: https://tax.utah.gov/sales

Regla del producto:

- Colombia: no declarar facturacion electronica fiscal lista sin proveedor/validacion DIAN.
- Espana: no declarar cumplimiento VERI*FACTU sin adaptacion/verificacion AEAT o proveedor certificado.
- Estados Unidos/Utah: sales tax debe quedar configurable por estado/localidad/tipo de servicio; no usar una tasa fija global.

## Checklist antes de entregar a cliente

1. `npm run verify` pasa.
2. `npm audit --audit-level=moderate` pasa.
3. `/ready` en produccion responde `ok`.
4. Login admin con MFA probado manualmente.
5. Tenant de prueba no puede ver datos de otro tenant.
6. Email real probado con dominio verificado.
7. Storage real probado con documento generado.
8. Backup/restore probado.
9. Textos legales revisados por profesional.
