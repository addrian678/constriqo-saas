# ConstructFlow - Despliegue SaaS y tenants

## Modelo

ConstructFlow inicia como SaaS multi-tenant gestionado por proveedor.

Cada cliente debe tener:

- Tenant propio.
- Admin inicial propio.
- Usuarios y roles propios.
- Configuracion propia.
- Storage organizado por tenant.
- Auditoria propia.
- Exportacion propia.

## Modalidades recomendadas

1. SaaS administrado por proveedor
   - Recomendado para primeros clientes.
   - El cliente no recibe el repositorio.
   - Tu controlas deploy, backups, actualizaciones y soporte.
   - Actualizas una sola plataforma central.

2. Plan dedicado futuro
   - DB/storage separados para cliente que pague plan superior.
   - Usa las mismas migraciones.
   - Se migra por `tenant_id`.

3. Contenedor privado
   - Valido cuando el cliente necesita correrlo en su infraestructura.
   - La imagen se entrega desde registry privado.
   - Se combina con licencia y contrato.

4. Entrega de repositorio
   - No recomendado.
   - Solo debe hacerse con contrato especifico y entendiendo el riesgo de copia.

## Alta de cliente SaaS

1. Crear tenant.
2. Crear admin inicial invitado.
3. Configurar plan, cuotas y modulos.
4. Configurar storage path por tenant.
5. Ejecutar smoke test de tenant.
6. Registrar version activa.
7. Entregar URL/login al cliente.

## Variables por plataforma

- `DATABASE_URL`
- `DATABASE_SSL`
- `APP_ENV`
- `APP_BASE_URL`
- secretos futuros de storage, email, OAuth o licencia

## Reglas de seguridad

- No subir `.env` al repo.
- No copiar `backups/`, `.local-data/`, `tmp/` ni logs a artefactos.
- No incluir seeds demo en produccion.
- No poner secretos en frontend.
- No permitir acceso cruzado entre tenants.
- No reutilizar claves entre clientes.
- No aceptar `tenant_id` desde frontend como fuente de verdad.
- Toda consulta de negocio debe filtrar por tenant.
