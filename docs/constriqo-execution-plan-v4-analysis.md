# Constriqo - Analisis del plan maestro v4 y plan ejecutable

Fecha: 2026-07-13  
Fuente: `D:\descargas\Plan_Maestro_Constriqo_Modulos_y_Fases_v4.pdf`  
Estado del codigo revisado: prototipo visual V0.1 implementado parcialmente.

## Lectura ejecutiva

El plan maestro v4 define Constriqo como una plataforma modular para pequenas empresas de servicios, con un nucleo comun, modulos independientes y perfiles sectoriales configurables. El perfil activo es Construccion y el perfil de Aseo queda como extension futura.

El documento marca como completadas visualmente V0.1, V0.1A, V0.2 y V0.2C, y declara como siguiente fase aprobada V0.3 - UI del modulo de Cotizaciones. Sin embargo, el codigo actual no contiene todavia la UI CRM V0.2: no existen paginas de Prospectos, Clientes, Kanban, ficha, actividades, notas ni datos simulados de clientes con `clientId`. Como V0.3 depende de CRM y de clientes simulados, el plan operativo debe corregir primero esa diferencia.

## Decision de ajuste

No se debe saltar directamente a V0.3 si el codigo no tiene V0.2. El orden actualizado para este repositorio es:

1. Reconciliar V0.2 CRM visual en el codigo actual.
2. Aplicar V0.2C minimo si hace falta para mantener navegacion, dashboards y acciones simuladas.
3. Implementar V0.3 Cotizaciones visuales.
4. Continuar con V0.4 en adelante, fase por fase.

Este ajuste no contradice el plan maestro; lo alinea con el estado real del repositorio.

## Huecos importantes detectados

- CRM V0.2 falta en el codigo actual, aunque el PDF lo marca como completado.
- No existen manifiestos por modulo con identidad, version, rutas, permisos, dependencias, eventos y feature flags.
- Los permisos actuales son visuales por rol, pero falta un catalogo de capacidades tipo `clients.read`, `estimates.create`, `estimates.approve`.
- La configuracion tiene `activeIndustryProfile`, pero aun no controla completamente rutas, terminos, formularios, plantillas y modulos habilitados.
- No hay `templates/` para plantillas versionadas ES/EN-US.
- No hay `reports/` para informes de fase, riesgos y criterios verificados.
- No hay ADRs para decisiones importantes.
- No hay pruebas automatizadas ni CI; esto pertenece a F1.1, pero conviene registrarlo desde ahora.
- No hay estrategia documentada de errores, estados de carga, vacio y sin resultados por modulo; debe aplicarse en cada fase visual.

## Practicas de seguridad y datos que se deben incorporar

Durante V0:

- Mantener todos los datos como constantes locales simuladas.
- No usar `localStorage`, `sessionStorage`, IndexedDB, cookies productivas ni persistencia.
- No crear backend, API, Firebase, Supabase ni servicios externos.
- No implementar GPS, camara, QR, NFC, subida de archivos, envio de correos, PDF real ni pagos.
- Aclarar visualmente acciones futuras con avisos o modales simulados.
- Evitar que el Trabajador vea menus, rutas o contenido administrativo/financiero.

Desde F1:

- Autenticacion real sin registro publico.
- Usuarios creados por Administrador mediante invitacion o clave temporal.
- Autorizacion en servidor por capacidades, no solo por rol visual.
- Aislamiento de empresa/tenant desde el modelo de datos.
- Auditoria inmutable para acciones relevantes.
- Migraciones explicitas y seeds controlados.
- Validacion de entrada con esquemas compartidos cliente/servidor.
- Secretos por entorno, nunca en codigo.
- Storage con metadatos, permisos, validacion, retencion y URLs seguras.
- Observabilidad, backups, politica de recuperacion y plan de reversa antes de produccion.

## Flujo de datos objetivo

Flujo comun estable:

`Prospecto -> Cliente -> Cotizacion -> Aprobacion -> Trabajo -> Personal y horas -> Evidencia y costes -> Documento de cobro -> Cobro -> Rentabilidad -> Cierre`

Entidades principales futuras:

- CRM: `leads`, `clients`, `contacts`, `activities`, `notes`, `client_documents`.
- Cotizaciones: `estimates`, `estimate_versions`, `estimate_sections`, `estimate_items`, `estimate_snapshots`.
- Trabajos: `jobs`, `job_locations`, `job_phases`, `tasks`, `job_members`, `change_requests`.
- Personal y horas: `workers`, `assignments`, `time_entries`, `break_entries`, `time_approvals`.
- Campo: `field_reports`, `work_proofs`, `checklist_items`, `incidents`, `materials_used`, `photos`.
- Documentos: `files`, `file_versions`, `file_links`, `document_types`, `expirations`.
- Finanzas: `invoices`, `payments`, `expenses`, `transactions`, `assets`, `liabilities`.

En V0 estas entidades se representan solo como tipos y mock data.

## Plan de ejecucion actualizado

### Bloque A - Cierre real de V0.1/V0.2 en este repo

1. Mantener la base visual por roles ya creada.
2. Crear contratos visuales de modulos y capacidades.
3. Crear `modules/crm` con Prospectos, Clientes, ficha, actividad y estados.
4. Crear mock data de clientes/prospectos con `clientId`.
5. Conectar Admin y Gestor al CRM.
6. Confirmar que Trabajador no ve CRM ni clientes.

### Bloque B - V0.3 Cotizaciones

1. Crear `modules/estimates`.
2. Agregar listado con filtros, estados y tarjetas responsive.
3. Crear flujo visual por pasos: cliente, alcance, partidas, condiciones, idioma y vista previa.
4. Crear partidas/secciones con totales simulados.
5. Crear detalle de cotizacion, actividad, versiones y avisos de accion futura.
6. Reutilizar `DocumentLanguageSelector`.
7. Impedir acceso visual al Trabajador.

### Bloque C - Resto de V0

1. V0.4 Obras.
2. V0.5 Personal/asignaciones.
3. V0.6 Asistencia completa.
4. V0.7 Campo/pruebas/partes.
5. V0.8 Documentos.
6. V0.9 Facturas/cobros.
7. V0.10 Gastos/compras.
8. V0.11 Finanzas/caja.
9. V0.12 Activos/pasivos.
10. V0.13 Informes/notificaciones/auditoria visual.
11. V0.14 Empresa/usuarios visuales.
12. V0.15 Validacion sectorial construccion/aseo.
13. V0.16 Congelacion visual y auditoria de accesibilidad/responsive.

### Bloque D - F1 base tecnica

1. Repositorio limpio, routing definitivo, tipos, pruebas y CI.
2. Backend Node.js/TypeScript modular.
3. PostgreSQL, migraciones, seeds y auditoria.
4. Autenticacion correo/contrasena sin registro publico.
5. Permisos por capacidades en servidor.
6. Storage/documentos seguro.
7. Eventos, auditoria y notificaciones.
8. PWA/offline/despliegue/observabilidad/backups.

### Bloque E - F2 funcional

Implementar modulo por modulo siguiendo el mismo orden del plan maestro, convirtiendo cada UI aprobada en capacidad real con contratos, migraciones, permisos, pruebas y auditoria.

### Bloque F - F3/F4

Completar Construccion, habilitar Aseo sin duplicar producto, preparar despliegues por empresa, piloto, seguridad, QA final, produccion web/PWA y Android si corresponde.

### Bloque G - Modelo comercial, actualizaciones y proteccion

Decision actualizada: Constriqo debe iniciar como SaaS web/PWA multi-tenant gestionado por proveedor.

1. Un cliente debe tener su propio tenant, admin inicial, usuarios, roles, configuracion, cuotas, auditoria y exportacion.
2. `tenant_id` es obligatorio para aislar datos entre clientes.
3. No entregar el repositorio fuente al cliente salvo contrato especial; preferir SaaS administrado o contenedores privados.
4. Nunca guardar API keys o secretos en frontend ni en git.
5. Crear estrategia formal de actualizaciones con versionado semantico, migraciones, backups, smoke tests y rollback.
6. Las actualizaciones deben ser centralizadas: una version SaaS para todos los tenants, con rollout y rollback.
7. Agregar modulo Marketing al roadmap: campanas, leads, formularios, landing pages simples, seguimiento, plantillas, metricas y reputacion.
8. Android debe venir despues de web/PWA estable, como wrapper o app que consume la web/API del SaaS.
9. La arquitectura debe iniciar como monolito modular y permitir extraer microservicios solo donde sea pertinente: Marketing, Notificaciones, Storage/documentos, Evidencias fotograficas, Licencias/actualizaciones, Jobs/colas e Integraciones externas.
10. El MVP puede habilitar PDFs/fotos en storage nube limitado, con descarga semestral organizada, limpieza segura de archivos archivados y migracion futura a NAS/VPS/storage propio.
11. Fotos/evidencias deben poder venderse como add-on o plan superior y quedar listas para extraerse como microservicio.
12. La app Android/PWA debe ser completa por roles, no solo trabajador; trabajador prioriza asistencia GPS puntual, checklist e incidencias.
13. WhatsApp se usara solo como enlace manual auxiliar; el registro oficial siempre queda primero en PostgreSQL.
14. Agregar modulo Servicios y Precios para que cotizaciones no dependan solo de partidas manuales: catalogo por tenant, precios por unidad, margen, impuestos, condiciones, snapshots e historial.
15. Soportar perfiles Colombia, USA y Espana con moneda y unidades por pais: COP/metrico, USD/imperial-USA por defecto, EUR/metrico. La unidad debe depender del perfil de mercado, no solo de la moneda.
16. La navegacion movil debe usar drawer lateral izquierdo o patron equivalente; en PC puede mantenerse superior si funciona.
17. Agregar bloque formal de cumplimiento legal y privacidad: GDPR/UE, Colombia Ley 1581, Utah/EE. UU., politicas, cookies, consentimiento, retencion, derechos del titular y registro de aceptaciones.
18. Usar dominio principal con subdominios por tenant: `cliente.Constriqo.com`; no usar formatos invalidos como `Constriqo/cliente.com`.
19. Separar idioma, pais, moneda y unidades: app por usuario, documentos por tenant con override por cotizacion/factura y snapshot por documento.

Documento detallado: `docs/product-delivery-update-security-plan.md`.

## Criterio de terminado por fase visual

Cada fase debe terminar con:

- Pantallas y rutas recorribles.
- Admin/Gestor/Trabajador separados.
- Trabajador sin modulos administrativos/financieros.
- Desktop, tablet, 390 px y 360 px sin desbordamiento obligatorio.
- Estados vacio, sin resultados, carga, error y accion simulada cuando aplique.
- Datos simulados reiniciables al recargar.
- Sin backend, persistencia, API, hardware ni logica empresarial definitiva.
- `npm run build` correcto.
- Informe breve de archivos, validaciones, riesgos y pendientes.
