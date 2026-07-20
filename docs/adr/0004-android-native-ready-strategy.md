# ADR 0004 - Estrategia Android native-ready

## Estado

Aceptada.

## Contexto

ConstructFlow debe funcionar como software web/PWA para PC, tablet y movil, pero tambien debe poder convertirse en app Android con permisos nativos.

Los permisos relevantes son:

- ubicacion puntual.
- notificaciones push.
- camara.
- archivos/documentos.
- almacenamiento local seguro.
- sincronizacion diferida.

Construir una app Android separada desde cero duplicaria UI, reglas de negocio, validaciones y mantenimiento.

## Decision

ConstructFlow se construye como web/PWA responsive y native-ready.

Cuando el backend y los modulos reales esten estables, se creara Android con Capacitor o tecnologia equivalente.

La app debe aislar capacidades nativas detras de servicios:

- `LocationService`
- `NotificationService`
- `CameraFileService`
- `LocalDocumentCache`
- `SyncQueueService`

El backend, la base de datos, los roles y la auditoria siguen siendo la fuente oficial.

## Consecuencias

- Una sola UI principal para web, PWA y Android.
- Menos duplicacion de codigo.
- Android puede usar permisos nativos donde la PWA sea limitada.
- El modulo de notificaciones debe basarse en eventos del backend.
- No se activa rastreo de ubicacion en segundo plano en el MVP.
- Push requiere consentimiento y permisos del sistema.

## Limites

- La UI actual esta parcialmente preparada, pero no es todavia app Android nativa.
- Faltan plugins/capa nativa, FCM/push, almacenamiento local seguro y pruebas en dispositivos.
- Las pantallas deben seguir mejorando responsive para movil y tablet antes de empaquetar Android.
