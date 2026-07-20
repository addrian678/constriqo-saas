# ConstructFlow - Plan de entrega comercial, actualizaciones, seguridad y Marketing

## Decision principal

ConstructFlow se debe construir inicialmente como SaaS web/PWA multi-tenant gestionado por proveedor.

Modelo recomendado:

- 1 plataforma central = varios clientes.
- 1 cliente = 1 tenant.
- Cada registro de negocio debe pertenecer a un `tenant_id`.
- Cada usuario pertenece a un tenant y uno o varios roles.
- Los clientes no ven ni modifican datos de otros clientes.
- El proveedor actualiza una sola plataforma central.
- Los archivos se organizan por tenant.
- El sistema debe permitir exportacion/migracion por tenant.

El objetivo comercial inicial es SaaS gestionado: el cliente usa la app, no administra servidores.

La arquitectura debe permitir migrar en el futuro desde Supabase/PostgreSQL gestionado hacia infraestructura propia del proveedor: VPS, NAS/DS925+, servidor local o PostgreSQL administrado.

### Seguridad multi-tenant obligatoria

Como varios clientes comparten plataforma, la seguridad por tenant es critica.

Reglas:

- Todas las tablas de negocio deben tener `tenant_id`.
- Las APIs no deben aceptar libremente `tenant_id` desde frontend.
- El tenant activo debe salir de la sesion/JWT del usuario.
- Cada consulta debe filtrar por tenant.
- Row Level Security o capa equivalente debe evaluarse antes de produccion.
- Storage debe separar rutas por tenant.
- Backups y exportaciones deben poder hacerse por tenant.
- Pruebas automaticas deben intentar acceso cruzado entre clientes.
- Auditoria debe registrar tenant, usuario, rol, accion e IP/contexto.
- Un bug de tenant isolation se considera critico.

## Que estamos construyendo exactamente

Un software web/PWA modular para empresas de construccion y servicios, con backend, base de datos, storage, usuarios, permisos, auditoria y modulos operativos.

Primero debe funcionar como web:

- SaaS web central.
- Dominio principal o subdominios por cliente.
- Login privado por cliente.
- PWA instalable en PC/tablet/movil.
- Infraestructura migrable a servidor propio futuro.

Despues se puede crear Android:

- PWA instalable.
- Wrapper Android con WebView/TWA/Capacitor.
- La app Android consume la misma web/API del cliente.
- La arquitectura debe quedar preparada desde ahora para Android nativo/hibrido, no como una web improvisada.
- Las capacidades nativas deben aislarse detras de una capa de servicios: ubicacion, camara, archivos, notificaciones push, almacenamiento local seguro y sincronizacion.

No se debe construir Android nativo separado hasta que la web este estable.

### Decision Android

ConstructFlow debe construirse con estrategia web-first, native-ready:

- Una sola experiencia funcional y responsive.
- Una sola API/backend.
- Una sola base de datos principal.
- Misma logica de permisos por rol.
- Android nativo/hibrido mediante Capacitor o tecnologia equivalente cuando el backend este estable.
- No duplicar pantallas ni reglas de negocio en una app Android separada desde cero salvo que una necesidad real lo exija.

Motivo:

- Reduce coste inicial.
- Evita mantener dos productos distintos.
- Permite usar permisos nativos cuando hagan falta.
- Mantiene migraciones, auditoria y seguridad en el backend.
- Facilita que PC, tablet, movil y Android usen los mismos datos.
- Permite actualizar la web central y que todos los clientes vean mejoras sin actualizar cliente por cliente.

### Capacidades nativas previstas

La app debe quedar preparada para:

- GPS puntual para entrada/salida/pausa.
- Notificaciones push Android.
- Canales de notificacion por modulo y prioridad.
- Camara para evidencias/fotos.
- Selector de archivos/documentos.
- Almacenamiento local seguro de PDFs/documentos pendientes.
- Cola de sincronizacion offline limitada.
- Compartir PDF por mecanismos nativos del sistema.
- Apertura de WhatsApp mediante enlace manual.

No se debe activar:

- rastreo continuo de ubicacion.
- ubicacion en segundo plano salvo decision futura muy justificada.
- push sin consentimiento.
- acceso a camara/archivos fuera de flujos claros.

## Cumplimiento legal, privacidad, cookies y consentimiento

ConstructFlow debe disenarse como SaaS privado con enfoque privacy-by-design y security-by-design.

Importante: el sistema debe estar preparado tecnicamente para cumplir normativas de Colombia, Union Europea/Espana y Estados Unidos/Utah, pero antes de produccion comercial se requiere revision legal profesional de textos, contratos, DPA, politicas y terminos.

### Normativas y marcos iniciales a cubrir

1. Union Europea / Espana
   - GDPR / Reglamento (UE) 2016/679.
   - Principios: licitud, transparencia, finalidad, minimizacion, exactitud, limitacion de conservacion, integridad y confidencialidad.
   - Derechos: acceso, rectificacion, supresion, oposicion, limitacion, portabilidad y retirada de consentimiento cuando aplique.
   - Cookies no necesarias requieren consentimiento granular previo.
   - Facturacion futura debe considerar normativa espanola vigente, incluida factura electronica y requisitos del Reglamento de facturacion.

2. Colombia
   - Ley 1581 de 2012 y regimen de proteccion de datos personales.
   - Principios: legalidad, finalidad, libertad/autorizacion, veracidad, transparencia, acceso/circulacion restringida, seguridad y confidencialidad.
   - Derechos del titular: conocer, actualizar, rectificar, solicitar prueba de autorizacion y revocar/suprimir cuando proceda.
   - Facturacion futura debe considerar DIAN/factura electronica si el cliente colombiano lo requiere.

3. Estados Unidos / Utah
   - Utah Consumer Privacy Act / Utah Code Title 13 Chapter 61 cuando aplique por umbrales y tipo de negocio.
   - Buenas practicas FTC de proteccion de informacion personal.
   - Impuestos y sales tax no deben codificarse como una regla unica nacional; se configuran por estado/localidad/cliente.
   - Primer cliente objetivo: Utah. El perfil inicial USA debe contemplar USD, unidades US customary y configuracion fiscal local.

### Politicas obligatorias antes de produccion

La app debe incluir y versionar:

- Politica de privacidad.
- Politica de cookies.
- Terminos de servicio.
- Acuerdo de tratamiento de datos / DPA para clientes empresa cuando aplique.
- Politica de retencion y eliminacion.
- Politica de seguridad y reporte de incidentes.
- Politica de backups/exportacion.
- Politica de uso aceptable.
- Politica de subprocesadores/proveedores.

Cada documento debe tener:

- version
- fecha de entrada en vigor
- idioma
- pais/perfil aplicable
- hash o identificador de version
- registro de aceptacion por usuario/tenant

### Consentimiento y aceptacion

Al primer acceso productivo de un admin o usuario, el sistema debe mostrar:

1. Politica de privacidad resumida.
2. Terminos de servicio.
3. Aviso de tratamiento de datos.
4. Politica de cookies si hay cookies no necesarias.
5. Casillas separadas cuando legalmente se requiera consentimiento separado.

El usuario debe poder:

- aceptar terminos obligatorios para usar el sistema.
- rechazar cookies no esenciales.
- configurar preferencias de cookies.
- ver para que se usaran sus datos.
- ver para que no se usaran sus datos.
- descargar o consultar politicas vigentes.
- solicitar ejercicio de derechos.

El sistema debe guardar:

- user_id
- tenant_id
- policy_version
- idioma mostrado
- fecha/hora
- IP aproximada/contexto
- user agent
- tipo de consentimiento
- estado: aceptado/rechazado/revocado
- evidencia de texto presentado

### Uso permitido de datos

La politica debe explicar que los datos se usan para:

- prestar el servicio SaaS.
- autenticar usuarios.
- separar datos por empresa/tenant.
- registrar clientes, cotizaciones, obras, trabajadores, horas, documentos, facturas y contabilidad.
- generar reportes.
- auditar acciones.
- soporte tecnico.
- seguridad, backups y recuperacion.
- cumplir obligaciones legales/fiscales cuando aplique.

### Usos prohibidos o no realizados por defecto

La politica debe explicar que los datos no se usan para:

- vender datos personales a terceros.
- compartir datos entre clientes.
- publicidad externa sin consentimiento.
- rastreo continuo de ubicacion.
- entrenar modelos de IA con datos de clientes sin contrato y consentimiento explicito.
- leer archivos/documentos fuera del soporte autorizado.
- acceder a camara, GPS o archivos fuera de flujos claros.

### Cookies y tracking

Reglas:

- Cookies tecnicas necesarias: pueden usarse para sesion, seguridad, CSRF, idioma, preferencias basicas.
- Cookies analiticas: solo si se activan y con consentimiento donde aplique.
- Cookies marketing/publicidad: desactivadas por defecto en el SaaS privado.
- Boton "rechazar no esenciales" visible.
- Boton "aceptar seleccion" visible.
- Sin dark patterns: no preseleccionar tracking no esencial.
- El panel de preferencias debe permitir cambiar/revocar consentimiento.

### Centro de privacidad

Debe existir un modulo/pantalla de privacidad para admins y usuarios autorizados:

- ver politicas vigentes.
- ver consentimientos registrados.
- exportar datos del usuario/tenant segun permisos.
- solicitar eliminacion/anonimizacion cuando proceda.
- configurar retencion.
- revisar subprocesadores/proveedores.
- descargar DPA/contratos si aplica.

### Datos sensibles y datos de trabajadores

ConstructFlow puede manejar datos laborales, ubicacion puntual y documentos. Por tanto:

- GPS solo puntual al registrar entrada/salida/pausa o accion justificada.
- No tracking continuo.
- Los trabajadores deben ver aviso claro antes de usar GPS.
- Datos de salud, biometria, documentos sensibles o menores de edad quedan fuera del MVP salvo decision legal explicita.
- Si se agregan datos sensibles, se requiere consentimiento/refuerzo legal y controles especiales.

### Incidentes y seguridad

El sistema debe preparar:

- registro de incidentes.
- deteccion de accesos sospechosos.
- rotacion de secretos.
- revocacion de sesiones.
- exportacion de logs para auditoria.
- plan de notificacion de brechas segun jurisdiccion.

## Arquitectura de datos, documentos y retencion

ConstructFlow debe soportar un modo inicial economico y migrable:

- PostgreSQL/Supabase para datos estructurados.
- Storage de archivos para PDFs, fotos, comprobantes y documentos.
- Descarga organizada desde la PWA/web.
- Limpieza segura de archivos pesados ya descargados.
- Preparacion para modo hibrido futuro con NAS, VPS o servidor propio.
- SaaS multi-tenant con exportacion por cliente.

### Datos principales en PostgreSQL

La base de datos guarda:

- usuarios, roles y permisos
- clientes
- obras/trabajos
- trabajadores
- asistencia y horas
- ubicacion puntual de entrada/salida
- checklist por obra/trabajo
- incidencias
- cotizaciones como registros
- facturas como registros
- gastos, activos y pasivos
- auditoria
- metadatos de archivos

### Archivos pesados

Los archivos pesados pueden guardarse inicialmente en storage nube del proyecto y luego migrarse a storage propio del cliente.

Incluye:

- PDFs de cotizaciones.
- PDFs de facturas.
- facturas corregidas o versiones.
- fotos de evidencia.
- comprobantes.
- documentos de obra.

La base de datos no debe depender de que el archivo siga en la nube para conservar el registro legal/contable. Siempre debe quedar:

- nombre original
- tipo de documento
- entidad relacionada
- fecha
- tamano
- hash
- estado de archivo
- fecha de descarga
- usuario que descargo
- fecha de limpieza si aplica

### Descarga organizada

La PWA/web debe permitir descargar paquetes organizados por:

- dia
- mes
- ano
- cliente
- obra
- facturas
- cotizaciones
- facturas corregidas
- comprobantes
- fotos/evidencias

Tambien debe permitir descargar reportes contables por:

- dia
- mes
- ano
- cliente
- obra
- categoria
- impuestos
- estado de cobro/pago

### Recomendacion semestral obligatoria

Por defecto, cada instalacion debe recomendar cada 6 meses descargar y organizar documentos antiguos.

La alerta debe:

- aparecer al cumplirse 6 meses desde la ultima limpieza/documentacion.
- permanecer visible hasta completar la operacion.
- no desaparecer solo por cerrarla.
- mostrar cuantos documentos y MB/GB estan pendientes.
- explicar que es una recomendacion para mantener el sistema ligero y conservar una copia local.
- permitir descarga rapida recomendada.
- permitir descarga avanzada por filtros.

Mensaje recomendado para usuarios:

> Hay documentos antiguos listos para archivar. Descargalos en carpetas organizadas y, cuando confirmes que conservas tu copia, podras liberar espacio del sistema sin borrar los registros contables.

No se debe mencionar al usuario final el nombre tecnico del proveedor de storage en el mensaje de limpieza.

### Limpieza segura de archivos

La limpieza solo puede eliminar archivos pesados previamente descargados y verificados.

No debe eliminar:

- facturas como registros.
- cotizaciones como registros.
- movimientos contables.
- horas trabajadas.
- auditoria.
- metadatos minimos del documento.

Antes de limpiar debe requerir:

- confirmacion explicita.
- contrasena del usuario.
- segundo factor si el usuario es administrador o tiene permisos de limpieza.
- verificacion de hash/tamano del paquete descargado.
- registro de auditoria.

La accion debe mostrarse como:

- "Liberar espacio de documentos archivados".
- No como "borrar base de datos".
- No como "borrar Supabase".

### Recuperacion de 2FA

Si el administrador pierde el segundo factor, debe existir un flujo seguro:

1. Codigos de recuperacion generados al activar 2FA.
2. Cuenta secundaria de emergencia o propietario verificado.
3. Procedimiento de soporte con verificacion de identidad.
4. Registro de auditoria obligatorio.
5. En instalaciones administradas, restauracion/control desde panel proveedor.

No debe permitirse desactivar 2FA solo con acceso al correo si la cuenta es administrador.

### Fotos y evidencias

Las fotos/evidencias quedan habilitadas, pero no son obligatorias para registrar entrada o salida.

Para asistencia se usa:

- hora del servidor.
- ubicacion puntual al pulsar entrada/salida.
- precision GPS.
- usuario/dispositivo.
- auditoria.

La app no debe rastrear ubicacion en segundo plano.

Las fotos se usan para:

- incidencias.
- pruebas de trabajo.
- comprobantes.
- documentos de obra.

El modulo de evidencias fotograficas debe quedar disenado como candidato futuro a microservicio si crecen almacenamiento, sincronizacion offline, antivirus, compresion o integraciones externas.

### Fotos como microservicio/add-on

La subida de fotos/evidencias queda habilitable como modulo separado.

Regla comercial inicial:

- El core puede funcionar sin fotos obligatorias.
- Fotos/evidencias pueden venderse como add-on o plan superior.
- Si se activa, debe tener limites por tenant.
- Debe aplicar compresion, cuotas, limpieza y auditoria.
- Debe poder extraerse como microservicio de storage/evidencias.
- No debe bloquear asistencia, checklist ni facturacion si esta desactivado.

### WhatsApp sin API

La app puede abrir WhatsApp con mensajes preparados, sin usar API oficial al inicio.

Regla:

- La incidencia o evidencia se guarda primero en la base de datos.
- Luego el usuario puede elegir "Enviar tambien por WhatsApp".
- WhatsApp es comunicacion auxiliar, no la fuente oficial del registro.

## Modulo de notificaciones

ConstructFlow debe tener un modulo central de notificaciones basado en eventos.

Objetivo:

- Notificar dentro de la app.
- Preparar push Android.
- Preparar push PWA si aplica.
- Preparar email futuro.
- Mantener auditoria de eventos importantes.

### Eventos que deben generar notificacion

Asistencia:

- trabajador inicia jornada.
- trabajador sale a descanso.
- trabajador vuelve de descanso.
- trabajador cierra jornada.
- trabajador no registra descanso esperado.
- trabajador llega tarde.
- trabajador registra horas extra.
- ubicacion puntual fuera del area esperada.

Obras/trabajos:

- tarea asignada.
- checklist completado.
- incidencia registrada.
- evidencia/foto subida.
- trabajo marcado como terminado.

Documentos y administracion:

- cotizacion creada/enviada/aprobada/rechazada.
- factura creada/vencida/pagada.
- documento pendiente de descarga semestral.
- limpieza documental pendiente.
- error de sincronizacion.
- backup fallido o pendiente.

Seguridad:

- inicio de sesion sospechoso.
- cambio de contrasena.
- cambio de 2FA.
- recuperacion de 2FA.
- cambio de permisos/roles.

### Canales de notificacion

1. In-app
   - Siempre disponible.
   - Fuente principal del historial.

2. Push Android
   - Prioritario para dueno/admin/gerente.
   - Requiere permiso del sistema.
   - Debe poder configurarse por tipo de evento.

3. Push PWA
   - Posible, pero secundario.
   - Depende del navegador, service worker y permisos.

4. Email futuro
   - Solo para eventos importantes.
   - Requiere configuracion SMTP/proveedor.

5. WhatsApp manual
   - Enlace auxiliar iniciado por el usuario.
   - No reemplaza la notificacion oficial.

### Flujo de notificacion recomendado

1. Una accion ocurre en un modulo.
2. El backend guarda el registro principal.
3. El backend publica evento de dominio.
4. El modulo de notificaciones evalua reglas y destinatarios.
5. Se guarda notificacion in-app.
6. Si el usuario autorizo push, se envia push Android/PWA.
7. Todo queda auditado.

## Modulo nuevo: Marketing

El modulo Marketing debe ayudar a la empresa a conseguir, convertir y retener clientes sin mezclarlo con CRM operativo.

### Funciones recomendadas

1. Campanas
   - Nombre, objetivo, canal, estado, presupuesto interno.
   - Canales: web, referidos, volanteo, redes sociales, Google Ads manual, email futuro.
   - Sin integrar APIs externas al inicio.

2. Leads de marketing
   - Fuente del lead.
   - Campana origen.
   - Servicio de interes.
   - Zona/ciudad.
   - Estado: nuevo, contactado, calificado, convertido, descartado.
   - Conversion a CRM/clientes.

3. Formularios publicos preparados
   - Formulario de solicitud de cotizacion.
   - Formulario de contacto.
   - Captura de consentimiento.
   - Anti-spam preparado.
   - En F2/F3 puede ser embebible en una landing.

4. Landing pages simples por servicio
   - Pagina para cocina, bano, remodelacion, limpieza recurrente, etc.
   - SEO basico.
   - CTA hacia formulario.
   - Sin constructor visual complejo al inicio.

5. Biblioteca de mensajes
   - Plantillas de respuesta.
   - Scripts de llamada.
   - Mensajes para seguimiento.
   - Version ES/EN.

6. Seguimientos
   - Tareas de seguimiento.
   - Recordatorios internos.
   - Resultado de contacto.
   - Conversion a cotizacion.

7. Metricas
   - Leads por fuente.
   - Leads por campana.
   - Conversion a cotizacion.
   - Conversion a trabajo.
   - Coste manual por lead.
   - Rentabilidad por campana cuando exista venta.

8. Reputacion
   - Solicitudes internas de resena.
   - Registro de resenas recibidas.
   - Enlaces manuales a Google/Facebook/Yelp.
   - No automatizar mensajes sin consentimiento.

### Seguridad Marketing

- Consentimiento explicito para email/SMS.
- No enviar spam.
- No guardar tokens de Google/Facebook en codigo.
- Integraciones externas solo con OAuth seguro y secretos por entorno.
- Separar leads publicos de clientes reales hasta calificacion.
- Rate limit y anti-spam en formularios publicos.

## Modulo nuevo: Servicios, precios y cotizacion profesional

El formulario actual de cotizaciones reales es intencionalmente inicial. En la fase final no debe quedarse como un formulario simple de partidas manuales. Debe evolucionar hacia un sistema profesional de servicios, precios, unidades, impuestos, plantillas y condiciones por pais/mercado.

### Decision

Agregar un modulo interno llamado Servicios y Precios antes de cerrar el modulo de Cotizaciones como final.

Este modulo debe permitir que cada empresa configure que cobra, como lo mide y que reglas comerciales/fiscales aplica segun su pais.

### Mercados iniciales soportados

1. Colombia
   - Moneda predeterminada: COP.
   - Unidades predeterminadas: sistema metrico.
   - Area: m2.
   - Longitud: m, cm.
   - Volumen: m3, litros cuando aplique.
   - Impuestos configurables, con IVA como regla frecuente pero no fija en codigo.
   - Documentos futuros preparados para factura electronica DIAN cuando el modulo de facturacion llegue a fase legal/fiscal.

2. Estados Unidos
   - Moneda predeterminada: USD.
   - Unidades predeterminadas: sistema US customary/imperial comercial.
   - Area: sq ft / ft2.
   - Longitud: ft, in.
   - Volumen: cu ft, cu yd cuando aplique.
   - Impuestos configurables por estado/localidad; no codificar un unico impuesto federal.
   - Cotizaciones deben contemplar licencias, permisos, sales tax si aplica, materiales, mano de obra, overhead, margen y condiciones.

3. Espana
   - Moneda predeterminada: EUR.
   - Unidades predeterminadas: sistema metrico.
   - Area: m2.
   - Longitud: m, cm.
   - Volumen: m3, litros cuando aplique.
   - IVA configurable.
   - Documentos futuros preparados para requisitos de factura y factura electronica/Verifactu cuando el modulo de facturacion llegue a fase legal/fiscal.

### Regla pais/moneda/unidades

La app no debe decidir las unidades solo por la moneda.

Orden correcto:

1. `tenant.country_profile`
2. `tenant.unit_system`
3. `tenant.currency`
4. override por cotizacion/servicio cuando el admin lo permita

Ejemplo:

- Perfil USA: USD + sq ft/ft/in por defecto.
- Perfil Colombia: COP + m2/m/cm por defecto.
- Perfil Espana: EUR + m2/m/cm por defecto.
- Si una empresa colombiana cotiza en USD por contrato especial, debe poder mantener unidades metricas si asi trabaja.

### Catalogo de servicios y precios

Debe existir un catalogo editable por tenant:

- servicio
- categoria
- descripcion comercial
- unidad base: m2, sq ft, m lineal, ft lineal, unidad, hora, dia, lote, punto, visita
- precio base
- moneda
- coste estimado
- margen objetivo
- impuesto aplicable
- desperdicio/merma por defecto
- minimo cobrable
- tiempo estimado
- notas internas
- condiciones y exclusiones predeterminadas
- activo/inactivo

Ejemplos:

- Instalacion de ceramica por m2.
- Instalacion de ceramica por sq ft.
- Demolicion por m2/sq ft.
- Pintura por m2/sq ft.
- Mano de obra por hora/dia.
- Limpieza recurrente por visita.
- Transporte/desplazamiento.
- Permisos o tasas.

### Cotizacion profesional final

El modulo de cotizaciones debe terminar soportando:

- cliente real desde CRM
- datos de obra/direccion
- pais/perfil de mercado
- moneda
- unidades
- plantilla de cotizacion
- servicios desde catalogo
- partidas manuales adicionales
- materiales
- mano de obra
- equipos/herramientas
- subcontratos
- transporte/desplazamiento
- permisos/tasas
- desperdicio/merma
- descuento
- impuestos
- margen
- overhead/gastos generales
- validez de la oferta
- forma de pago
- anticipo
- hitos de pago
- alcance
- exclusiones
- condiciones
- garantia
- firma/aceptacion futura
- versiones
- aprobacion/rechazo
- conversion a obra/trabajo
- PDF profesional futuro
- auditoria completa

### Plantillas por pais/mercado

El sistema debe permitir plantillas por perfil:

- USA construction/remodeling estimate.
- Colombia construccion/remodelacion.
- Espana reforma/construccion.
- Aseo/limpieza como perfil futuro.

Cada plantilla define:

- etiquetas visibles
- unidades predeterminadas
- moneda predeterminada
- impuestos sugeridos
- secciones comunes
- condiciones frecuentes
- exclusiones frecuentes
- campos obligatorios
- formato de PDF

### Datos legales y fiscales

La cotizacion no debe tratarse como factura fiscal, pero debe guardar suficientes datos para que luego la factura pueda generarse correctamente.

Por eso debe conservar:

- datos legales de la empresa emisora
- datos del cliente
- direccion de obra/servicio
- moneda
- impuestos
- descuentos
- precios unitarios
- totales
- fecha de emision
- fecha de validez
- version aceptada
- usuario que creo/aprobo
- auditoria

### Fuentes iniciales consultadas

- Espana: BOE, Real Decreto 1619/2012, Reglamento de facturacion. Referencia para datos minimos que luego necesitara el modulo de facturacion.
- Colombia: DIAN, portal de Factura Electronica. Referencia para futura integracion/compatibilidad fiscal.
- Estados Unidos: NIST/US customary units. Referencia para perfil de unidades USA y conversiones.

### Criterios de seguridad y mantenimiento

- El catalogo de servicios/precios es por tenant.
- Ningun tenant puede ver precios, margenes o plantillas de otro tenant.
- Los precios deben tener historial/versionado.
- Cambiar un precio no debe alterar cotizaciones ya emitidas; cada cotizacion guarda snapshot de precios y unidades.
- Los calculos deben hacerse en backend o validarse en backend antes de guardar.
- Usar decimal/numeric para dinero; no `float`.
- Conversiones de unidad deben ser explicitas y auditables.
- Los impuestos deben ser configurables, no hardcoded.

### Candidato futuro a microservicio

Servicios, precios y motor de cotizacion debe iniciar como modulo interno del monolito modular.

Puede extraerse a microservicio solo si:

- crecen reglas de precios por pais
- aparecen integraciones con proveedores
- se requiere motor avanzado de impuestos
- se vuelve necesario calcular presupuestos masivos
- requiere despliegue independiente

## Navegacion responsive y experiencia movil

La app web/PWA debe mantener experiencia profesional en PC, tablet y movil.

Reglas:

- En desktop puede usar navegacion superior o sidebar segun convenga al modulo.
- En movil no debe depender de una barra superior saturada.
- En movil debe existir navegacion lateral izquierda deslizable o drawer, accesible con boton de menu.
- El drawer movil debe mostrar modulos reales por rol y cerrar al seleccionar.
- Las acciones criticas deben quedar accesibles con botones claros, no ocultas fuera de pantalla.
- No debe haber overflow horizontal en formularios de cotizacion, tablas de partidas ni dashboards.
- Cotizaciones y formularios financieros deben tener layout por pasos en movil.
- Antes de empaquetar Android, se debe auditar navegacion movil en 360 px, 390 px, tablet y desktop.

## Dominios, tenants y acceso privado

ConstructFlow debe operar como SaaS privado con dominio principal y subdominios por cliente.

### Dominio recomendado

Comprar un dominio corto, profesional y facil de recordar.

Preferencia:

- `constructflow.com` si esta disponible.
- Alternativas aceptables: `.app`, `.io`, `.cloud`, `.software`, `.co`.
- Para confianza comercial general, `.com` sigue siendo la opcion mas reconocible.

### Modelo de URL recomendado

Usar subdominios por tenant:

- `app.constructflow.com` para login general.
- `andres.constructflow.com` para un cliente/tenant.
- `empresa-demo.constructflow.com` para demo privada.

No usar:

- `constructflow/andres.com`

Motivo: eso no es un dominio valido como subdominio SaaS. Si se usa ruta, seria `constructflow.com/andres`, pero para SaaS multi-tenant es mas limpio y seguro usar subdominios.

### Flujo de tenant por dominio

1. Usuario abre `andres.constructflow.com`.
2. Backend identifica `tenant_slug = andres` desde el host.
3. Login muestra nombre/logo del tenant si esta permitido.
4. Usuario ingresa email/password.
5. Backend valida que el usuario pertenece a ese tenant.
6. MFA si aplica.
7. Sesion queda ligada a tenant_id.

### Seguridad de dominio

- TLS/HTTPS obligatorio.
- HSTS en produccion.
- Cookies `Secure`, `HttpOnly`, `SameSite`.
- CORS solo para dominios permitidos.
- Cada subdominio apunta al mismo SaaS, pero nunca cambia la regla: datos siempre separados por `tenant_id`.
- Slug del tenant no reemplaza la seguridad; solo ayuda a enrutar.

### Cliente con dominio propio futuro

Se puede permitir en planes superiores:

- `app.empresa.com`
- CNAME hacia ConstructFlow.
- Certificado TLS gestionado.
- Validacion DNS.

Esto no debe hacerse en MVP si aumenta demasiado el soporte.

## Idioma, pais, moneda y documentos

ConstructFlow debe manejar idioma y pais como configuraciones separadas.

### Reglas base

- Pais/mercado define impuestos sugeridos, unidades y moneda predeterminada.
- Idioma define textos de interfaz y documentos.
- Moneda define formato monetario y calculos.
- Unidades definen medidas de servicios/cotizaciones.

No mezclar:

- Un cliente puede estar en Utah y usar la app en espanol.
- Un cliente puede estar en Colombia y emitir una cotizacion en ingles.
- Un cliente puede estar en Espana y generar un PDF en ingles para un cliente extranjero.

### Configuracion por tenant

En Ajustes de empresa debe existir:

- pais principal: Colombia, Estados Unidos, Espana, otro futuro.
- zona horaria.
- moneda predeterminada: COP, USD, EUR.
- sistema de unidades predeterminado: metrico, imperial/US customary.
- idioma predeterminado de la app: es, en.
- idioma predeterminado de documentos: es, en.
- formato de fecha/hora.
- formato numerico.
- impuestos configurables.
- datos legales/fiscales de la empresa.

### Configuracion por usuario

Cada usuario debe poder elegir:

- idioma de la interfaz.
- formato de fecha/hora si se permite.
- zona horaria personal si trabaja en otra zona.

El cambio de idioma de interfaz no debe cambiar impuestos, moneda ni unidades de la empresa.

### Configuracion por documento

Cada cotizacion/factura debe permitir:

- idioma del documento: espanol o ingles.
- moneda del documento si el admin tiene permiso.
- unidades del documento si el admin tiene permiso.
- plantilla por pais/mercado.

Recomendacion:

- La app completa se configura por usuario.
- Los documentos se configuran por tenant, con override por documento.
- El admin puede bloquear overrides si quiere consistencia.

### Flujo recomendado para cotizacion/factura

1. El admin configura pais, moneda, unidades e idioma base del tenant.
2. El usuario crea una cotizacion.
3. El sistema aplica plantilla por pais/mercado.
4. El usuario puede cambiar idioma del documento: ES/EN.
5. El sistema conserva snapshot de:
   - idioma
   - moneda
   - unidades
   - impuestos
   - plantilla
   - precios
6. El PDF se genera con ese snapshot.
7. Cambios futuros de idioma/precios no alteran documentos ya emitidos.

### Traducciones

La app debe implementar i18n desde frontend y backend:

- claves de traduccion, no textos sueltos.
- traducciones versionadas.
- PDFs con plantillas traducibles.
- email/notificaciones traducibles.
- auditoria guarda codigos de eventos, no solo texto visible.

Idiomas MVP:

- Espanol.
- Ingles.

Idiomas futuros:

- Portugues si se expande a otros mercados.

## Actualizaciones sin romper clientes

El producto debe tener un sistema de versionado y migraciones.

### Regla de oro

Nunca actualizar codigo sin una ruta de migracion de datos y rollback.

### Versionado

Usar versionado semantico:

- Patch: correcciones sin cambios de datos. Ejemplo `1.0.1`.
- Minor: nuevas funciones compatibles. Ejemplo `1.1.0`.
- Major: cambios incompatibles. Evitarlos en clientes activos. Ejemplo `2.0.0`.

### Migraciones

Cada cambio de base de datos debe tener:

- Archivo SQL versionado.
- Orden fijo.
- Prueba en copia/staging.
- Backup antes de aplicar.
- Registro en tabla `schema_migrations`.
- Posible rollback o plan de reversa documentado.

### Flujo recomendado de actualizacion por cliente

1. Crear backup de DB y storage.
2. Verificar version actual instalada.
3. Descargar/instalar nueva version.
4. Ejecutar migraciones pendientes.
5. Ejecutar health checks.
6. Ejecutar smoke tests.
7. Activar nueva version.
8. Registrar resultado de actualizacion.
9. Si falla, revertir codigo y restaurar backup.

### Entrega de actualizaciones

Opciones:

1. Instalacion administrada por ti
   - Mejor opcion para proteger codigo.
   - Tu controlas servidor, deploy, backups y actualizaciones.
   - El cliente usa la app, no recibe el repo.

2. Appliance/Docker cerrado
   - Cliente corre contenedores.
   - Mas dificil proteger codigo, pero se puede minimizar exposicion.
   - Requiere licencia y registry privado.

3. Entregar repo al cliente
   - No recomendado si quieres proteger codigo fuente.
   - El cliente puede copiar, modificar o redistribuir si no hay contrato fuerte.

Recomendacion: instalacion administrada o contenedores privados, no entrega del codigo fuente.

## Proteccion del codigo fuente

No existe proteccion perfecta si entregas el codigo fuente o el servidor completo al cliente. La mejor proteccion es no entregar el repo.

### Buenas practicas

- Mantener repositorio privado.
- Desplegar build compilado/minificado, no source completo.
- Backend ejecutado en servidor controlado por proveedor o contenedor privado.
- Licencia de uso clara.
- Contrato que prohiba copia, reventa, ingenieria inversa y redistribucion.
- Separar codigo, datos y secretos.
- Logs sin secretos.
- Backups cifrados.
- Acceso SSH limitado.
- Deploy con CI/CD.

### Para frontend

El frontend web siempre puede ser inspeccionado parcialmente en el navegador. Nunca poner secretos ahi.

No poner en frontend:

- API keys privadas.
- Credenciales DB.
- Tokens permanentes.
- Secretos de Stripe/Google/OpenAI/etc.
- Logica sensible de permisos.

### Para backend

- Secretos solo en variables de entorno.
- `.env` nunca se commitea.
- Rotacion de secretos.
- Minimo privilegio por servicio.
- API keys cifradas si se almacenan.
- Separar claves por cliente/despliegue.
- Auditoria de uso de integraciones.

## API keys y secretos

Reglas obligatorias:

- `.env.example` solo con placeholders.
- `.env` fuera de git.
- Secretos diferentes por cliente.
- Secretos diferentes por ambiente: dev, staging, prod.
- Nunca imprimir secretos en logs.
- Nunca exponer secretos al frontend.
- Rotacion documentada.
- Revocacion documentada.

## Licencia y control de acceso

Agregar sistema de licencia cuando el producto tenga runtime real.

Opciones:

1. Licencia local firmada
   - Archivo o clave firmada.
   - Valida cliente, dominio, fecha, modulos.
   - Funciona offline por un tiempo.

2. Servidor de licencias
   - La app valida periodicamante.
   - Mejor control.
   - Requiere alta disponibilidad.

3. Instalacion administrada
   - No necesita licencia tecnica fuerte.
   - Controlas el acceso desde infraestructura.

Recomendacion inicial:

- Instalacion administrada para primeros clientes.
- Luego licencia firmada si necesitas instalaciones en servidores del cliente.

## Super Admin y licenciamiento SaaS del proveedor

ConstructFlow debe incluir un panel separado para el proveedor del software. Este panel no pertenece a ningun tenant cliente y no debe aparecer para administradores, gerentes ni trabajadores de empresas cliente.

### Objetivo

Permitir que el proveedor controle operacion, licencias, soporte, uso y salud general del SaaS sin entrar indebidamente en datos privados de clientes.

### Rol y acceso

- Rol global: `super_admin`.
- Login separado o ruta protegida separada.
- 2FA obligatorio siempre.
- Acceso solo para el proveedor del software.
- No se heredan permisos de tenants cliente.
- Auditoria global obligatoria para cada accion.
- Acciones criticas con confirmacion y, si aplica, revalidacion MFA.

### Capacidades del Super Admin

- Crear tenants/clientes.
- Ver clientes/empresas activas, en prueba, suspendidas o vencidas.
- Activar, suspender, renovar o revocar licencias.
- Ver uso tecnico por tenant:
  - usuarios activos
  - cantidad de documentos
  - almacenamiento estimado
  - actividad reciente
  - alertas criticas
  - estado de cuotas
  - estado de migraciones
- Gestionar planes y add-ons por tenant:
  - fotos/evidencias
  - marketing avanzado
  - reportes avanzados
  - storage adicional
  - dominio propio futuro
- Ver version activa del software.
- Ver estado de backups, migraciones, jobs y errores tecnicos.
- Soporte tecnico con minimo acceso: ver logs tecnicos y metadatos, no contenido sensible del cliente salvo autorizacion expresa y auditada.

### Licencia por cliente

Cada tenant debe tener una licencia o estado comercial asociado.

Estados minimos:

- `trial`
- `active`
- `past_due`
- `suspended`
- `expired`
- `revoked`

Reglas:

- La licencia se valida en backend.
- La licencia nunca es un secreto confiable en frontend.
- Si una licencia vence o se suspende, los datos no se borran.
- El modo recomendado al vencer es solo lectura o bloqueo de funciones principales, segun politica comercial.
- Renovar/reactivar licencia debe restaurar acceso sin perdida de datos.
- Cambios de licencia deben generar auditoria global y, si aplica, auditoria visible al tenant.

### Aislamiento de datos

El Super Admin no debe romper el modelo multi-tenant.

- Toda accion sobre un tenant especifico debe declarar `tenant_id`.
- No se permite ejecutar operaciones masivas destructivas sin confirmacion fuerte.
- No se permite descargar datos de cliente sin permiso/justificacion registrada.
- Metricas globales deben ser agregadas por defecto.
- Soporte con impersonacion, si algun dia existe, debe ser temporal, auditado y aprobado.

### Relacion con actualizaciones

El panel Super Admin debe permitir ver:

- tenants en version actual
- tenants pendientes de migracion
- resultado de migraciones
- errores post-update
- rollback disponible
- fecha de ultimo backup verificado

Esto permite actualizar el SaaS una vez para todos los clientes, con control por etapas.

## Produccion externa, dominio, Supabase y servicios gestionados

Antes de vender o entregar a un cliente real, debe existir una fase formal de infraestructura externa.

### Pendientes externos obligatorios

- Dominio real comprado y configurado.
- DNS y subdominios por tenant si se usa modelo SaaS por subdominio.
- HTTPS/TLS en produccion.
- Proyecto Supabase o PostgreSQL administrado de produccion.
- Usuario de base de datos runtime con minimo privilegio.
- Variables de entorno reales:
  - `DATABASE_URL`
  - secretos de sesion
  - claves MFA/seguridad
  - claves de storage
  - claves de email futuro
  - secretos de integraciones
- Storage de produccion:
  - Supabase Storage al inicio, S3 compatible o storage propio futuro.
  - rutas por tenant.
  - cuotas por tenant.
  - limpieza semestral de archivos pesados.
- Backups:
  - backup diario de PostgreSQL.
  - backup de storage.
  - prueba periodica de restauracion.
  - exportacion por tenant.
- Deploy web/API:
  - entorno staging.
  - entorno production.
  - CI/CD privado.
  - rollback documentado.
- Monitoreo:
  - health checks.
  - logs de errores.
  - alertas tecnicas.
  - metricas de uso.
- Proveedor de email real:
  - invitaciones.
  - recuperacion de contrasena.
  - envio de cotizaciones/facturas.
  - notificaciones externas futuras.

### Supabase inicial

Supabase puede usarse como primera opcion gestionada para:

- PostgreSQL.
- Storage inicial de PDFs/fotos si se decide habilitarlo.
- Backups/exportaciones segun plan.

Reglas:

- El esquema debe seguir siendo portable a PostgreSQL propio.
- No depender de funciones propietarias innecesarias si dificultan migrar a NAS/VPS/servidor propio.
- Todas las migraciones deben poder ejecutarse fuera de Supabase.
- La exportacion por tenant debe mantenerse como objetivo.

### Dominio y subdominios

Dominio principal recomendado:

- `constructflow.com` o marca final elegida.

Subdominios:

- `app.dominio.com` para login general.
- `cliente.dominio.com` para tenant.

Esto queda pendiente hasta definir nombre comercial y comprar dominio.

### Bloqueo antes de Email real

Email real no debe implementarse hasta decidir:

- dominio/remitente
- proveedor de correo
- DKIM/SPF/DMARC
- plantillas legales
- limites de envio
- manejo de rebotes
- credenciales seguras

## Demo, login y provision inicial

El modo demo es solo una herramienta interna de desarrollo.

### Modo demo

- Solo puede estar activo en entorno `development`.
- Puede mostrar accesos rapidos por rol para que el desarrollador pruebe pantallas.
- Puede cargar datos demo.
- Debe poder resetearse o eliminarse facilmente.
- Nunca debe estar activo en instalaciones de cliente.
- Nunca debe aparecer en builds de produccion.

### Producto final para cliente

La instalacion del cliente debe iniciar limpia:

- Sin datos demo.
- Sin accesos rapidos por rol.
- Sin registro publico.
- Sin boton "crear cuenta".
- Pantalla inicial unica: iniciar sesion.
- Usuarios creados/invitados solo por administrador.
- Primer administrador creado por seed/provision segura de instalacion.

### Login seguro

El login debe usar el mismo formulario para todos los roles:

1. Usuario ingresa email y contrasena.
2. Backend valida credenciales.
3. Solo despues de validar credenciales se detectan roles/permisos.
4. Si el usuario es administrador, se exige 2FA.
5. Si es primer login de administrador, debe configurar 2FA antes de entrar.

El sistema no debe revelar si un email pertenece a un administrador antes de validar la contrasena.

### Usuarios

- No hay registro publico.
- Admin crea o invita usuarios.
- Usuario invitado configura su contrasena en flujo seguro.
- Cambios de rol requieren auditoria.
- Admin y usuarios con permisos criticos requieren 2FA.

## Arquitectura SaaS gestionada

Cada cliente debe tener:

- Tenant propio.
- Cuenta admin inicial propia.
- Usuarios y roles propios.
- Configuracion propia.
- Carpetas/rutas de storage propias.
- Cuotas propias.
- Exportacion propia.
- Auditoria propia.

Ejemplo:

- `cliente-a.constructflow.app`
- tenant: `cliente-a`
- storage path: `tenants/cliente-a/...`
- DB compartida con aislamiento por `tenant_id`

### Plan dedicado futuro

Cuando un cliente pague plan dedicado o por requerimientos legales/seguridad:

- Puede migrarse a DB propia.
- Puede migrarse a storage propio.
- Puede alojarse en VPS/NAS/infraestructura del proveedor.
- Debe usar las mismas migraciones y exportaciones.
- La migracion debe hacerse por `tenant_id`.

## Arquitectura evolutiva: monolito modular primero, microservicios despues

Decision: ConstructFlow debe construirse inicialmente como monolito modular, no como microservicios completos desde el primer dia.

Motivo:

- Menor complejidad operativa.
- SaaS inicial mas sencillo de mantener.
- Menos costos de infraestructura.
- Menos puntos de fallo.
- Mas facil de probar, auditar y actualizar.
- Mejor encaje para actualizaciones generales a todos los clientes.

La arquitectura debe dejar fronteras claras para extraer servicios en el futuro sin romper el producto.

### Reglas de diseno desde ahora

- Cada modulo debe tener dominio, repositorio, rutas, permisos, migraciones y auditoria propios.
- Las comunicaciones entre modulos deben pasar por contratos claros.
- Las escrituras importantes deben producir eventos/outbox.
- Las APIs deben versionarse antes de exponerlas externamente.
- Las migraciones deben ser compatibles hacia adelante cuando sea posible.
- Las nuevas funciones deben poder activarse con feature flags.
- No se debe acoplar la UI directamente a la base de datos.
- No se deben compartir secretos entre modulos.

### Candidatos futuros a microservicio

No se extraen ahora, pero deben disenarse para poder separarse cuando exista necesidad real.

1. Marketing
   - Formularios publicos.
   - Campanas.
   - Leads publicos.
   - Tracking.
   - Integraciones de anuncios o reputacion.

2. Notificaciones
   - Email.
   - SMS.
   - Push.
   - Reintentos.
   - Preferencias y consentimiento.
   - Eventos de asistencia, obras, documentos, seguridad y sincronizacion.
   - Android push como canal prioritario para dueno/admin/gerente.

3. Storage/documentos
   - Subida y descarga de archivos.
   - Antivirus.
   - URLs firmadas.
   - Versionado pesado.
   - Retencion.
   - Descarga semestral organizada.
   - Limpieza segura de documentos archivados.
   - Sincronizacion hibrida futura con NAS/VPS/storage local.
   - Fotos/evidencias como add-on/microservicio.

4. Licencias y actualizaciones
   - Validacion de licencia.
   - Canal de updates.
   - Versiones disponibles.
   - Control de activacion por cliente.

5. Jobs/colas
   - Backups.
   - Reportes programados.
   - Procesamiento de outbox.
   - Tareas largas.

6. Integraciones externas
   - Stripe/PayPal si algun dia se aprueba.
   - Google.
   - WhatsApp.
   - Email providers.
   - Contabilidad externa.

### Criterios para extraer un microservicio

Solo se debe separar un modulo si cumple una o varias condiciones:

- Necesita escalar de forma independiente.
- Tiene dependencias externas sensibles.
- Ejecuta tareas lentas o asincronas.
- Requiere aislamiento de seguridad superior.
- Tiene ciclos de despliegue distintos al nucleo.
- Puede fallar sin detener el sistema principal.

### Anti-regla

No dividir en microservicios solo por moda. Si no mejora seguridad, escalabilidad, soporte o actualizacion, debe permanecer como modulo interno.

## Plan actualizado de fases

### F3 - Runtime real instalable

1. Crear servidor HTTP real.
2. Conectar PostgreSQL real.
3. Ejecutar migraciones reales.
4. Crear tabla `schema_migrations`.
5. Crear comando `migrate`.
6. Crear comando `seed`.
7. Crear comando `backup`.
8. Crear comando `restore` documentado.
9. Crear health checks reales.
10. Conectar UI a API modulo por modulo.

### F3.5 - Marketing

1. UI visual Marketing.
2. Contratos backend Marketing.
3. Migraciones: campaigns, marketing_leads, forms, messages, followups, reviews.
4. Formularios publicos con anti-spam.
5. Conversion Marketing Lead -> CRM Client/Lead.
6. Metricas por fuente/campana.
7. Consentimiento para comunicaciones.

### F4 - Actualizaciones y distribucion

1. Versionado semantico.
2. Tabla `schema_migrations`.
3. Release notes.
4. Migraciones con backup obligatorio.
5. Script de actualizacion.
6. Smoke tests post-update.
7. Rollback plan.
8. Instalador local/Docker Compose.
9. CI/CD privado.
10. Guia de despliegue por cliente.
11. Arquitectura evolutiva para extraer microservicios solo donde sea pertinente.
12. Releases centralizados SaaS: actualizar una vez para todos los tenants.
13. Migraciones multi-tenant seguras.
14. Rollout por etapas y rollback global/por tenant.

### F5 - Proteccion comercial

1. Contrato/licencia.
2. Repositorio privado.
3. SaaS administrado por proveedor.
4. Contenedores privados si aplica.
5. Sistema de licencias si se entrega instalacion al cliente.
6. Hardening de servidor.
7. Gestion segura de secretos.
8. Documentacion de soporte y actualizaciones.
9. Planes comerciales por modulos/add-ons.
10. Cuotas por tenant.
11. Panel Super Admin para proveedor.
12. Activacion, suspension, renovacion y revocacion de licencias por tenant.
13. Metricas tecnicas por cliente: usuarios, storage, documentos, actividad, errores y cuotas.
14. Auditoria global del proveedor sin exposicion innecesaria de datos privados.
15. Control de version/migracion por tenant.

### F6 - Produccion externa e infraestructura SaaS

1. Comprar/configurar dominio real.
2. Configurar DNS, HTTPS y subdominios por tenant.
3. Crear proyecto Supabase/PostgreSQL de produccion.
4. Ejecutar migraciones en produccion/staging.
5. Configurar usuario runtime con minimo privilegio.
6. Configurar variables de entorno y secretos reales.
7. Configurar storage de produccion para PDFs/fotos si aplica.
8. Configurar backups de base de datos y storage.
9. Probar restore de backup.
10. Configurar deploy web/API.
11. Configurar monitoreo, logs y health checks.
12. Configurar exportacion por tenant y plan de migracion futura a NAS/VPS/servidor propio.
13. Preparar proveedor de email, pero no activar envio real hasta definir dominio/remitente y credenciales.

### F7 - Android

1. PWA estable.
2. Manifest final.
3. Service worker con QA.
4. Push notifications solo con consentimiento.
5. Wrapper Android.
6. Pruebas en dispositivos.
7. Publicacion privada o Play Store si aplica.
8. App completa por roles, no solo trabajador.
9. Permisos de camara/archivos solo dentro de flujos controlados.
10. GPS puntual solo al registrar entrada/salida.
11. PDFs y fotos descargables/archivables segun politica semestral.
12. Capa de capacidades nativas: ubicacion, push, camara, archivos, almacenamiento local y sincronizacion.
13. Notificaciones Android por eventos criticos.
14. Pruebas de permisos por version de Android.
15. Politica de privacidad y permisos lista antes de publicacion.
16. Diferenciar actualizaciones web remotas de actualizaciones nativas publicadas.

## Cambios al plan anterior

- El modelo inicial pasa a SaaS multi-tenant gestionado por proveedor.
- `tenant_id` se vuelve obligatorio para aislamiento entre clientes.
- Debe existir camino futuro para DB/storage dedicado por cliente si paga plan superior.
- Pagos internos no significan Stripe ni pasarela.
- Stripe/PayPal quedan fuera hasta que se decida explicitamente una integracion.
- Marketing se agrega como modulo nuevo.
- Actualizaciones se vuelven un bloque formal obligatorio.
- Proteccion de codigo, licencias y secretos se vuelven bloque formal obligatorio.
- Super Admin y licenciamiento SaaS por tenant se vuelven bloque formal obligatorio.
- Dominio, Supabase/PostgreSQL produccion, storage, backups, monitoreo y deploy quedan como fase separada antes de produccion comercial.
- Storage inicial puede usar nube con descarga/limpieza semestral y migracion futura a NAS/VPS.
- PDFs, fotos y documentos pesados se pueden habilitar desde el MVP, con retencion, descarga y limpieza segura.
- Android/PWA pasa a ser app completa por roles, con trabajador, gerente y admin.
- Fotos/evidencias quedan como modulo add-on y candidato temprano a microservicio.
- Actualizaciones deben ser centralizadas: una version SaaS para todos los tenants, con rollout y rollback.

## Actualizacion 2026-07-16 - Consolidacion ERP/FSM/Project y formularios modales

Esta actualizacion se agrega antes de conectar dominio real, Supabase de produccion, correo real o proveedor externo. El objetivo es no construir sobre flujos confusos y dejar los modulos reales con un patron operativo comun.

### Referencias analizadas sin copiar codigo

Se usan como referencia funcional, no como dependencia ni como fuente de codigo:

1. ERPNext (`https://github.com/frappe/erpnext`)
   - Refuerza que contabilidad, proyectos, activos, ventas, compras, CRM y reportes deben compartir documentos, estados, historial y trazabilidad.
   - Para ConstructFlow esto se traduce en ledger, facturas/cobros, anticipos, costos por obra, activos/equipos y balance general conectados por tenant.

2. OCA Field Service (`https://github.com/OCA/field-service`)
   - Refuerza operaciones de campo: ubicaciones, trabajadores, ordenes, calendario, equipos, gastos, compras, ventas, inventario, tiempos y portal.
   - Para ConstructFlow esto se traduce en obra/proyecto como entidad central, trabajadores asignados, checklist visible solo al asignado, asistencia GPS puntual, incidencias, costos y evidencias controladas.

3. OpenProject (`https://github.com/opf/openproject`)
   - Refuerza gestion de proyectos, tareas, roadmaps, Kanban/Scrum, Gantt, time tracking, costos, presupuestos y colaboracion.
   - Para ConstructFlow esto se traduce en fases, tareas, responsables, avance real, calendario, reportes por obra, rentabilidad y trazabilidad de cambios.

### Regla UI obligatoria para formularios

Todos los formularios de modulos reales deben seguir este patron:

1. Pantalla base con resumen, metricas, listados y acciones.
2. Boton explicito: crear, editar, asignar, registrar, corregir o confirmar.
3. Apertura en `BasicModal` o componente equivalente.
4. Modal responsivo con X para cerrar, cierre por fondo cuando aplique y scroll interno en movil.
5. Guardar/editar/registrar genera notificacion breve de exito o error.
6. Al exito, el modal se cierra y la vista se refresca.
7. Ningun formulario real debe aparecer al final de la pagina como panel heredado.
8. Los formularios sensibles conservan auditoria, permisos por rol y `tenant_id` obligatorio.

Se agrega auditoria automatica `npm run audit:form-modals`, incluida en `npm run verify`, para bloquear regresiones en los modulos reales.

### Estado de modulos reales tras esta consolidacion

1. Obras / Proyectos
   - Debe mantener tareas, fases, responsables, progreso real, ubicacion, costos, checklist, cambios e incidencias.
   - Formularios de crear obra, editar obra, asignar trabajador, tarea y cambio deben abrir en modal.
   - La obra sigue siendo el punto de union entre CRM, cotizacion, trabajador, asistencia, finanzas y documentos.

2. Trabajadores / Campo
   - Crear trabajador, crear acceso y editar trabajador deben abrir en modal.
   - El trabajador solo ve obras y tareas asignadas.
   - Asistencia debe vincular obra, ubicacion puntual y evento de notificacion.

3. Servicios / Precios
   - Crear servicio debe abrir en modal.
   - Codigo de servicio generado por sistema.
   - Catalogo por tenant con pais, moneda, unidad, materiales, mano de obra, equipos, subcontratos, margen e impuestos.

4. Cotizaciones
   - Crear cotizacion debe abrir en modal.
   - Debe mantener partidas, costos, margen, impuestos, descuentos, vigencia, aprobacion, cancelacion, versiones e historial.
   - Campos numericos deben permitir borrar y escribir sin bloquear al usuario con ceros forzados.

5. Facturas
   - Crear, emitir, cobrar y rectificar deben usar confirmacion/modal.
   - No se eliminan facturas: se corrigen o rectifican.
   - Cobros parciales/totales y anticipos deben crear movimiento financiero.

6. Finanzas / Contabilidad
   - Debe priorizar un unico boton "Agregar movimiento contable".
   - El tipo se decide dentro del formulario: ingreso, egreso, activo, pasivo, anticipo, pago, correccion.
   - El ledger no se borra; los errores se corrigen con movimientos de ajuste auditados.

7. Activos / Equipos
   - Crear activo/pasivo debe abrir en modal.
   - Debe soportar maquinaria, herramientas, mantenimiento, depreciacion simple, asignacion a obras y costos.

8. CRM / Clientes
   - Crear/editar cliente, nota y actividad deben abrir en modal.
   - Debe mantener ciclo prospecto, activo, pausado, historial, cotizaciones, obras, facturas y pagos.

9. Documentos / Archivo
   - Crear ficha documental y limpieza segura deben abrir en modal.
   - Limpieza semestral elimina solo archivos pesados archivados, no metadatos ni auditoria.
   - Requiere credenciales y 2FA para acciones destructivas.

10. Marketing
   - Campanas, leads y tarjetas de fidelizacion deben abrir en modal.
   - Tarjeta de fidelizacion genera codigo/QR y datos editables; no genera PDF/imagen pesada por defecto.
   - Marketing sigue siendo candidato a microservicio o add-on.

11. Reportes
   - Debe consolidar cliente, obra, trabajador, finanzas, rentabilidad, impuestos, archivos y licencias.
   - Reportes pesados o programados quedan como candidato a jobs/colas.

12. Notificaciones
   - Eventos reales: asistencia, obra, factura vencida, pago recibido, limpieza pendiente, licencia y seguridad.
   - Email real queda pendiente de proveedor/dominio; sandbox local no debe enviar fuera del sistema.

13. Super Admin / Licencias
   - Super Admin queda separado de login cliente.
   - Crear cliente y editar licencia deben abrir en modal.
   - Licencias soportan prueba 7 dias, prueba 30 dias, 1 año, 2 años y fecha manual.
   - Cambios de licencia generan auditoria y no borran datos del cliente.

### Pendiente antes de produccion externa

1. Dominio real y subdominios por tenant.
2. Supabase/PostgreSQL real de staging/produccion.
3. Runtime role con minimo privilegio y secretos reales fuera del frontend.
4. Storage real y politica de cuotas/limpieza por tenant.
5. Email real con dominio/remitente verificado.
6. Backups, restore probado, monitoreo y logs.
7. QA visual final y redisenio UI moderno despues de aprobar flujos funcionales.

### Actualizacion A2 - fiscalidad operativa, proveedores reales y dominio

Se agrega al plan una capa de preparacion productiva sin declarar cumplimiento fiscal certificado:

1. Fiscalidad/legal por pais
   - Crear perfiles fiscales operativos por tenant/pais.
   - Guardar snapshot fiscal en facturas y rectificativas.
   - Marcar explicitamente cuando un pais requiere proveedor externo o validacion oficial.
   - Colombia requiere validacion/proveedor DIAN antes de declarar facturacion electronica fiscal.
   - Espana requiere adaptacion/verificacion AEAT/VERI*FACTU o proveedor certificado antes de declarar cumplimiento.
   - Estados Unidos/Utah usa sales tax configurable por estado/localidad/tipo de servicio, no tasa fija global.

2. Email real
   - El sistema local usa sandbox.
   - Produccion debe usar proveedor configurado, dominio verificado y worker de envio activo.
   - No se guardan claves SMTP/API en frontend ni documentacion publica.

3. Storage real
   - El sistema queda preparado para Supabase Storage o S3 compatible.
   - Los documentos generados deben usar rutas por tenant y bucket.
   - La limpieza semestral no borra metadata ni auditoria.

4. Dominio/Supabase
   - Antes de produccion se debe configurar dominio HTTPS, Supabase/PostgreSQL real, runtime role limitado, storage privado y email real.
   - Runbook operativo: `docs/runbooks/domain-supabase-email-storage.md`.

### Actualizacion A3 - worker real de email/outbox

Se agrega una fase tecnica para convertir el email real en un flujo operable y auditable:

1. Cola transaccional
   - La app web/API solo crea registros en `email_deliveries`.
   - Los correos reales quedan en `queued`; sandbox local puede quedar en `sandboxed`.
   - La cola guarda `attempt_count`, `next_attempt_at`, `last_attempt_at`, `provider_message_id`, `worker_id` y bloqueo temporal.

2. Worker separado
   - El envio corre fuera del request web con `npm run email:worker`.
   - Para pruebas controladas existe `npm run email:worker:once`.
   - El worker debe usar `EMAIL_WORKER_DATABASE_URL`, `ADMIN_DATABASE_URL` o una conexion equivalente de backend, nunca expuesta al frontend.
   - El worker procesa por lotes con `FOR UPDATE SKIP LOCKED` y bloqueo temporal para evitar doble envio.

3. Reintentos y fallos
   - Fallos temporales vuelven a `queued` con backoff.
   - Al superar `EMAIL_WORKER_MAX_ATTEMPTS`, quedan como `failed`.
   - La UI/historial debe poder mostrar estado, intentos, error y proveedor.

4. Auditoria multitenant
   - Cada envio, sandbox, fallo o reintento genera `audit_events` por tenant.
   - No se borra auditoria.
   - El worker debe fijar contexto tenant al escribir estado/auditoria.

5. Preparacion para produccion
   - `/ready` exige que las migraciones productivas vigentes esten aplicadas; esta fase introduce `0051_email_delivery_worker_outbox.sql`.
   - Produccion exige `EMAIL_DELIVERY_WORKER_ENABLED=true`.
   - SMTP real requiere dominio verificado, SPF/DKIM/DMARC y secretos fuera del repositorio.
   - Antes de abrir clientes reales se debe probar `npm run smoke:email-worker-local` y envio real a cuentas internas.

### Actualizacion A4 - storage real de documentos generados

Se agrega persistencia fisica para PDFs generados y preparacion de migracion futura:

1. Storage por proveedor
   - `not-configured`: conserva metadata y descarga local, valido solo desarrollo.
   - `local-dev`: escribe archivos en `.local-data/storage` para pruebas locales.
   - `supabase-storage`: sube por backend con service role y bucket privado.
   - `s3-compatible`: queda reservado hasta implementar firma segura.

2. Metadatos de persistencia
   - Los documentos guardan `storage_provider`, `storage_uploaded_at`, `storage_checksum_sha256`, `storage_persisted` y `storage_persist_error`.
   - Esto permite auditar si el PDF existe fisicamente o solo como metadata.
   - Estos campos facilitan migrar luego de Supabase a NAS, VPS o S3 sin perder trazabilidad.

3. PDFs generados
   - Cotizaciones, facturas y recibos descargables deben persistirse con el storage provider configurado.
   - El usuario sigue recibiendo el PDF descargable en el navegador.
   - Si produccion usa Supabase, el archivo tambien queda en el bucket privado.

4. Seguridad
   - Las rutas local-dev bloquean path traversal.
   - `SUPABASE_SERVICE_ROLE_KEY` solo vive en backend.
   - Frontend nunca sube directamente con service role.
   - Limpieza semestral sigue borrando solo referencia/archivo pesado archivado, no auditoria ni metadata.

5. Readiness y pruebas
   - `/ready` exige `0055_supabase_readiness_schema_migrations_rls.sql`.
   - Se agrega `npm run audit:storage-real`.
   - Se agrega `npm run smoke:storage-local`.
   - Antes de produccion real se debe generar al menos una factura/cotizacion y comprobar archivo en bucket privado.

### Actualizacion A5 - preflight de staging/produccion

Se agrega una verificacion automatica antes de conectar clientes reales:

1. Comando operativo
   - `npm run production:preflight`.
   - Valida entorno `staging` o `production`.
   - No imprime secretos en claro.

2. Validaciones incluidas
   - Dominio HTTPS (`APP_BASE_URL` y `VITE_API_BASE_URL` si aplica).
   - Secretos base (`SESSION_TOKEN_PEPPER`, `AUTH_MFA_ENCRYPTION_KEY`).
   - `DATABASE_URL` runtime y `MIGRATION_DATABASE_URL`/`ADMIN_DATABASE_URL`.
   - Migracion vigente `0055_supabase_readiness_schema_migrations_rls.sql`.
   - Email real, SMTP y worker.
   - Storage real, Supabase URL, service role y bucket.
   - `EXTERNAL_PROVIDERS_VERIFIED=true` solo despues de pruebas reales.

3. Flujo recomendado
   - Primero ejecutar `npm run verify` local.
   - Luego configurar variables reales en staging.
   - Ejecutar `npm run db:migrate`.
   - Ejecutar `npm run production:preflight`.
   - Probar login, MFA, PDF, email y aislamiento con dos tenants de prueba.

### Actualizacion A6 - backup/restore seguro

Se agrega una fase operativa para recuperacion de datos:

1. Backup
   - `npm run db:backup` usa `BACKUP_DATABASE_URL` o `DATABASE_URL`.
   - Genera dump custom de PostgreSQL.
   - Genera metadata `.json` con tamano, fecha, checksum SHA-256 y URL redactada.

2. Restore
   - `npm run db:restore` verifica primero el dump con `pg_restore --list`.
   - El restore real exige `RESTORE_DATABASE_URL`.
   - El restore real exige confirmacion exacta `I_UNDERSTAND_RESTORE_OVERWRITES_DATABASE`.
   - Restore local exige `ALLOW_LOCAL_RESTORE=true` para evitar sobrescribir accidentalmente la DB local.

3. Drill obligatorio antes de produccion
   - Crear backup.
   - Verificar backup con `npm run db:restore -- --verify-only`.
   - Restaurar en base temporal.
   - Ejecutar migraciones.
   - Ejecutar `npm run production:preflight`.
   - Probar login, MFA, documentos, email y aislamiento multitenant.

4. Storage
   - PostgreSQL no incluye los archivos pesados del bucket.
   - Se debe respaldar bucket privado y metadata documental.
   - En restore se restaura DB y luego storage.

### Nota operativa pendiente - prueba manual MFA del admin real

Durante la auditoria de seguridad A1, `smoke:auth-local` no se completo con el admin real porque ese usuario ya tenia MFA/TOTP activo. Esto no es un fallo del sistema: la prueba necesita el secreto TOTP real mediante la variable `TEST_TOTP_SECRET`.

Antes de produccion externa o antes de declarar cerrado el flujo de autenticacion real, se debe ejecutar manualmente:

```powershell
$env:DATABASE_URL="postgresql://constructflow_user:change-me@127.0.0.1:5432/constructflow_dev"
$env:DATABASE_SSL="false"
$env:TEST_TENANT_ID="043eb358-87d0-48e1-a8de-8b82a5b31e09"
$env:TEST_ADMIN_EMAIL="admin-visual@local.test"
$env:TEST_ADMIN_PASSWORD="<TEST_ADMIN_PASSWORD>"
$env:TEST_TOTP_SECRET="SECRETO_REAL_DE_LA_APP_AUTENTICADORA"
npm run smoke:auth-local
```

Como obtener `TEST_TOTP_SECRET`:

1. Abrir la app autenticadora usada por el admin.
2. Revisar si permite mostrar/exportar el secreto de la cuenta TOTP.
3. Si no permite verlo, crear un admin temporal de pruebas, activar MFA desde cero y guardar el secreto mostrado en el setup.
4. Usar ese secreto solo en la terminal local para ejecutar el smoke.

### Nota operativa - recuperacion MFA local por cambio de clave

Si aparece un mensaje equivalente a `Unsupported state or unable to authenticate data` al verificar el codigo TOTP, la causa probable es que los factores MFA existentes fueron cifrados con una `AUTH_MFA_ENCRYPTION_KEY` distinta a la que usa el servidor actual. Esto no exige dominio ni Supabase real; exige usar la misma clave de cifrado o restablecer MFA del usuario.

Para desarrollo local se permite restablecer MFA de un usuario concreto, revocando tambien sesiones activas:

```powershell
$env:DATABASE_URL="postgresql://constructflow_user:change-me@127.0.0.1:5432/constructflow_dev"
$env:DATABASE_SSL="false"
$env:RESET_MFA_TENANT_ID="043eb358-87d0-48e1-a8de-8b82a5b31e09"
$env:RESET_MFA_EMAIL="admin-visual@local.test"
$env:RESET_MFA_CONFIRM="I_UNDERSTAND_THIS_RESETS_USER_MFA"
npm run auth:reset-mfa
```

Despues de esto, el siguiente login con la misma contrasena debe pedir configurar TOTP otra vez. En produccion no se debe ejecutar sin proceso de recuperacion verificado, identidad del solicitante, registro de auditoria y backup previo.
5. No guardar `TEST_TOTP_SECRET` en Git, `.env.example`, frontend, capturas ni documentacion publica.

Resultado esperado:

- `smoke:auth-local` debe iniciar login.
- Debe resolver MFA con el codigo TOTP generado.
- Debe validar sesion, rechazo de tenant spoofing y logout.
- Si falla, revisar credenciales, secreto TOTP, hora del sistema y estado de licencia del tenant.
