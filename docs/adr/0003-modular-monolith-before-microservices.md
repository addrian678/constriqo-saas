# ADR 0003 - Monolito modular antes de microservicios

## Estado

Aceptado.

## Contexto

Constriqo se entregara inicialmente como SaaS web/PWA multi-tenant gestionado por proveedor. El producto necesita ser facil de desplegar, actualizar, auditar y soportar para todos los clientes desde una plataforma central.

Dividir todo en microservicios desde el inicio aumentaria complejidad operativa, costos, puntos de fallo y dificultad de soporte.

## Decision

Construir primero como monolito modular con fronteras claras por dominio. Preparar extraccion futura de microservicios solo donde aporte valor real.

## Modulos candidatos a extraer en el futuro

- Marketing.
- Notificaciones.
- Storage/documentos.
- Evidencias fotograficas.
- Licencias y actualizaciones.
- Jobs/colas.
- Integraciones externas.

## Criterios de extraccion

Un modulo solo se extrae si necesita escalar aparte, aislar secretos, procesar tareas lentas, desplegar con ciclo propio o fallar sin detener el nucleo.

## Consecuencias

- Menor complejidad inicial.
- Mejor soporte para SaaS central y actualizaciones generales.
- Contratos internos mas importantes.
- Eventos/outbox y migraciones por modulo deben mantenerse desde el inicio.
- Se evita partir el producto prematuramente.
