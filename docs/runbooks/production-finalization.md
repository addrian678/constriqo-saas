# Cierre productivo Constriqo

Este runbook cierra lo que depende de infraestructura real sin duplicar logica de la app ni saltarse seguridad multi-tenant.

## 1. Despliegue Vercel/Render

Estado esperado:

- Frontend: `https://app.constriqo.com`.
- API: `https://api.constriqo.com`.
- Super Admin: `https://app.constriqo.com/acceso-admi-proveedor-constriqo`.
- No debe existir una segunda entrada tipo `admin.constriqo.com`.

Validacion:

```powershell
npm run monitor:production
```

## 2. Wildcard DNS por cliente

Cuando se active:

- DNS: `*.constriqo.com` apunta al mismo frontend.
- Cada cliente usa un `tenant_slug` publico, por ejemplo `empresa-utah.constriqo.com`.
- Nombres reservados: `app`, `api`, `www`, `help`, `status`, `admin`.

Regla de seguridad:

- El subdominio solo prellena/ayuda al login.
- La separacion real sigue siendo tenant, sesion, MFA, licencia, rol, capability, RLS y `tenant_id`.

## 3. Storage real final

Requisitos:

- Bucket privado, por ejemplo `constriqo-documents`.
- `SUPABASE_SERVICE_ROLE_KEY` solo en backend.
- `STORAGE_PROVIDER=supabase-storage`.
- `STORAGE_BUCKET_DOCUMENTS=constriqo-documents`.

Validacion tecnica:

```powershell
npm run smoke:storage-production
```

Despues de esto, generar una cotizacion o factura real desde la app y confirmar:

- `documents.storage_provider = supabase-storage`.
- `documents.storage_persisted = true`.
- `documents.storage_checksum_sha256` con valor.
- Archivo visible en el bucket privado bajo ruta del tenant correcto.

## 4. Backup/restore real

Antes de cada release productivo:

```powershell
npm run db:backup
npm run db:restore -- --verify-only
```

Antes de abrir mas clientes:

- Restaurar una copia en base temporal.
- Ejecutar migraciones.
- Probar login, MFA, documentos, finanzas y aislamiento con dos tenants.
- Respaldar tambien el bucket privado; PostgreSQL no contiene los binarios del storage.

## 5. Monitoreo externo

Configurar un monitor externo tipo Uptime/healthcheck para:

- `https://api.constriqo.com/health`.
- `https://api.constriqo.com/ready`.
- `https://app.constriqo.com`.

Reglas:

- `/health` debe responder `ok` si el proceso vive.
- `/ready` puede responder `not-ready` si faltan proveedores finales, y eso es correcto antes de produccion completa.
- Las alertas tecnicas son para el proveedor, no para clientes finales.

## 6. QA Android real

Antes de app nativa:

- Probar login/MFA.
- Probar formularios largos en modal.
- Probar geolocalizacion de trabajador.
- Probar PDFs descargados/abiertos.
- Probar cache y navegacion entre modulos.

## 7. Android nativo futuro

La web queda native-ready. Crear Android nativo/hibrido con Capacitor/TWA solo cuando:

- Flujo web esta estable.
- Permisos de ubicacion estan probados.
- Push notifications tienen consentimiento y proveedor.
- Descarga/apertura local de PDFs esta validada.

## 8. SMTP futuro

El envio actual abre el cliente de correo del usuario. Para activar SMTP automatico:

- Dominio con SPF, DKIM y DMARC.
- Variables SMTP solo en backend.
- `EMAIL_PROVIDER=smtp`.
- `EMAIL_DELIVERY_WORKER_ENABLED=true`.
- Worker corriendo con `npm run email:worker`.

Esto puede venderse como microservicio/add-on sin cambiar el flujo base.
