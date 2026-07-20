# ADR 0001 - Congelar V0 visual antes de F1 funcional

## Estado

Aceptado.

## Contexto

ConstructFlow completo las fases visuales V0.2 a V0.15 con datos simulados, rutas por rol y reportes de fase. El plan maestro exige no mezclar backend, persistencia, pagos, hardware, archivos o servicios externos durante V0.

## Decision

Se congela V0 con una auditoria automatica reproducible antes de iniciar F1. La validacion minima queda en `npm run verify`, que ejecuta auditoria visual, typecheck y build.

## Consecuencias

- Las fases funcionales deben partir de una UI validada y estable.
- Cualquier cambio visual futuro debe mantener `npm run audit:visual`.
- La auditoria V0 no sustituye pruebas unitarias, e2e, seguridad de backend ni QA responsive real de F1.
