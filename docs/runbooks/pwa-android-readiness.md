# Constriqo - Preparacion PWA y Android

## Decision

Constriqo debe estabilizar primero la web/PWA, pero debe quedar preparado desde ahora para Android nativo/hibrido.

La estrategia recomendada es:

- Web/PWA responsive como base funcional.
- Android con Capacitor o tecnologia equivalente.
- Misma UI y mismo backend.
- Capacidades nativas aisladas en una capa de servicios.
- Sin duplicar reglas de negocio en una app Android separada desde cero.

## Estado actual

- Manifest web activo.
- Iconos instalables preparados.
- Metadatos moviles en `index.html`.
- Sin cache offline.
- Sin push notifications.
- Permisos de dispositivo solo dentro de flujos controlados.
- Capa base Android nativo/hibrido preparada en `src/app/native/nativeCapabilities.ts`.

## Capa native-ready

La app debe abstraer estas capacidades para que puedan funcionar en navegador o Android nativo:

- `LocationService`
  - Web: Geolocation API.
  - Android: plugin nativo de ubicacion.
  - Uso: solo entrada/salida/pausa o acciones explicitas.

- `NotificationService`
  - Web: notificaciones in-app y push PWA futuro.
  - Android: push nativo/FCM futuro.
  - Uso: eventos criticos, permisos por usuario y preferencias.

- `CameraFileService`
  - Web: selector de archivo/camara cuando aplique.
  - Android: camara, galeria y archivos nativos.
  - Uso: evidencias, comprobantes, documentos.

- `LocalDocumentCache`
  - Web: descarga controlada por usuario.
  - Android: almacenamiento local seguro para PDFs/documentos pendientes.
  - Uso: documentos generados o pendientes de sincronizar.

- `SyncQueueService`
  - Web: cola limitada para operaciones seguras.
  - Android: cola local mas robusta.
  - Uso: documentos pendientes, evidencias, reintentos.

## Reglas antes de Android

1. Backend real conectado.
2. Autenticacion runtime completa.
3. Storage real asegurado.
4. QA en navegadores moviles.
5. Politica offline definida.
6. Consentimiento para push si se activa.
7. Smoke tests por version.

## Reglas de permisos

- No activar cache offline hasta definir conflictos.
- No activar push sin consentimiento.
- No pedir microfono ni pagos desde la PWA base.
- No rastrear ubicacion en segundo plano.
- GPS solo al registrar entrada/salida/pausa cuando el usuario pulse la accion.
- Camara/archivos solo para evidencias, comprobantes o documentos.
- Fotos/evidencias no son obligatorias para registrar asistencia.

## App por roles

La app Android/PWA debe cubrir todo el software, no solo trabajadores:

- Admin: configuracion, usuarios, 2FA, facturas, cotizaciones, contabilidad y limpieza segura.
- Gerente: obras, checklist, trabajadores, incidencias, documentos y reportes.
- Trabajador: jornada, checklist, incidencias, WhatsApp auxiliar y evidencias si aplica.

## Notificaciones

Debe existir modulo central de notificaciones antes de depender de push nativo.

Eventos minimos:

- entrada de trabajador.
- salida a descanso.
- regreso de descanso.
- cierre de jornada.
- incidencia registrada.
- checklist completado.
- evidencia subida.
- cotizacion aprobada/rechazada.
- factura vencida/pagada.
- documentos antiguos listos para archivar.
- error de sincronizacion.
- cambio de permisos o 2FA.

Canales:

- in-app obligatorio.
- push Android preparado.
- push PWA opcional.
- email futuro.
- WhatsApp manual auxiliar.

Reglas:

- Toda notificacion nace de un evento guardado.
- El historial in-app es la fuente oficial.
- Push requiere consentimiento/permisos del sistema.
- El usuario puede configurar tipos de notificaciones.

## Archivo semestral

La PWA debe recomendar cada 6 meses descargar documentos antiguos en carpetas organizadas y liberar espacio despues de verificar la copia.

La alerta permanece activa hasta completar la operacion. La limpieza requiere contrasena, segundo factor para administradores y auditoria.

## Criterio para crear Android nativo/hibrido

Se debe iniciar el paquete Android cuando se cumplan estas condiciones:

1. Login real y roles conectados.
2. Asistencia real con GPS puntual.
3. Modulo de notificaciones in-app funcional.
4. API estable para trabajadores/admin/gerente.
5. Storage/documentos con metadatos y estados de sincronizacion.
6. Politica de privacidad/permisos redactada.

## Estado de diseno actual

Lo ya construido esta parcialmente preparado:

- UI responsive base.
- Roles visuales separados.
- PWA manifest.
- Contratos backend por modulo.
- Seguridad y plan de permisos documentado.
- Auditoria responsive automatica para 360 px, 390 px, tablet y desktop como requisito previo a empaquetar Android.

Falta para Android nativo real:

- login/autenticacion runtime real.
- permisos Android.
- push Android/FCM.
- cola local de sincronizacion.
- storage local seguro.
- pruebas en dispositivos.

## Capa implementada en web/PWA

La base actual ya centraliza:

- informacion de runtime web/native-ready.
- ubicacion puntual para asistencia.
- solicitud de notificaciones solo si el usuario confirma.
- salida de documentos descargables por un adaptador comun.
- cola efimera en memoria para preparar sincronizacion futura sin activar escrituras offline.

Esta capa no reemplaza todavia Capacitor, FCM, storage local seguro ni pruebas en dispositivo Android.
