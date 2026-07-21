# Configuracion de dominio Constriqo

Dominio comprado: `constriqo.com`

## Objetivo

Separar marca, aplicacion y API para que el SaaS pueda crecer sin mezclar el login de clientes con la web comercial.

## Subdominios recomendados

- `constriqo.com`: pagina comercial publica del producto.
- `www.constriqo.com`: alias/redireccion a `constriqo.com`.
- `app.constriqo.com`: acceso privado al SaaS para clientes finales.
- `admin.constriqo.com`: acceso privado del proveedor/Super Admin.
- `api.constriqo.com`: backend/API runtime de Constriqo/Constriqo.
- `help.constriqo.com`: centro de ayuda futuro.
- `status.constriqo.com`: estado de servicios futuro.

## Regla importante

No apuntar ningun dominio publico a `127.0.0.1`. Esa direccion solo existe en tu PC. Para que un cliente entre desde internet, primero debe existir:

1. Un hosting/frontend publicado para la app web.
2. Un hosting/backend publicado para la API Node.
3. Variables de entorno productivas apuntando a HTTPS.
4. DNS en Hostinger apuntando a esos proveedores.

## DNS inicial en Hostinger

Crear estos registros solo cuando el proveedor entregue el destino real:

| Subdominio | Tipo | Nombre/Host | Valor |
|---|---|---|---|
| App SaaS | CNAME | `app` | destino del frontend, por ejemplo `xxxxx.vercel.app` |
| Super Admin | CNAME | `admin` | mismo destino frontend de Vercel que `app` |
| API | CNAME o A | `api` | destino backend, por ejemplo `xxxxx.onrender.com` o IP del VPS |
| Web publica | A, CNAME o ALIAS | `@` | destino de landing/web publica |
| Web publica www | CNAME | `www` | destino de landing/web publica |

Si el proveedor backend entrega IP fija, usar `A` para `api`.
Si entrega dominio, usar `CNAME` para `api`.

## Variables de entorno al publicar

Frontend:

```text
VITE_API_BASE_URL=https://api.constriqo.com
```

Backend/API:

```text
APP_ENV=staging
APP_BASE_URL=https://app.constriqo.com
APP_ALLOWED_ORIGIN_DOMAINS=constriqo.com
HOST=0.0.0.0
DATABASE_URL=postgresql://constriqo_app.iusgqqewvkpjpebxjzbx:...@aws-1-us-west-2.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
SESSION_TOKEN_PEPPER=secreto-largo-produccion
AUTH_MFA_ENCRYPTION_KEY=secreto-largo-produccion
```

No activar `APP_ENV=production` hasta configurar email real, storage real y proveedores verificados.

## Orden recomendado

1. Mantener local funcionando.
2. Elegir hosting para frontend y backend.
3. Publicar backend/API primero y probar `/health`.
4. Configurar `api.constriqo.com`.
5. Publicar frontend con `VITE_API_BASE_URL=https://api.constriqo.com`.
6. Configurar `app.constriqo.com`.
7. Configurar `admin.constriqo.com` en el mismo proyecto frontend de Vercel.
8. Probar login admin/trabajador desde `app.constriqo.com`.
9. Probar login Super Admin desde `admin.constriqo.com`.
10. Probar que cookies, CORS y MFA funcionan en HTTPS.
11. Dejar `constriqo.com` para landing comercial.

## Render

Configuracion del Web Service:

```text
Name: constriqo-api
Language: Node
Branch: main
Root Directory: vacio
Build Command: npm install
Start Command: npm run server:dev
Health Check Path: /health
Instance: Free para piloto; Starter cuando haya pago/mantenimiento.
```

En Render, `HOST=0.0.0.0` permite que la plataforma detecte el puerto del servicio. En local se mantiene `127.0.0.1`.

## Subdominios por cliente

Primera etapa:

- `app.constriqo.com`: acceso general de clientes.
- `admin.constriqo.com`: acceso privado proveedor; no se entrega a clientes.

Cuando el SaaS ya este estable:

- `cliente.constriqo.com`: entrada directa por empresa/tenant.
- `*.constriqo.com`: wildcard DNS hacia el frontend, si el proveedor lo soporta.

El backend/API no cambia por cliente. Todos los frontends hablan con:

```text
https://api.constriqo.com
```

La separacion real de datos no depende solo del subdominio: depende de tenant, sesion, roles, capabilities, RLS y filtros `tenant_id` en backend/base de datos.

## Checklist de prueba

- `https://api.constriqo.com/health` responde `ok`.
- `https://api.constriqo.com/ready` responde segun entorno esperado.
- `https://app.constriqo.com` carga el login.
- `https://cliente-prueba.constriqo.com` carga el login cuando se active wildcard.
- Login admin funciona con MFA.
- Login trabajador funciona.
- Crear cliente/trabajador/obra funciona.
- Al recargar navegador, la sesion se mantiene.
- Ningun dato de otro tenant aparece.
