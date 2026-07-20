# ADR 0002 - Registro central de manifiestos modulares

## Estado

Aceptado.

## Contexto

Cada modulo visual declara rutas, roles, capacidades, dependencias, version y fase. Antes de F1 no habia un registro unico para auditar esos contratos.

## Decision

Crear `src/core/modules/moduleRegistry.ts` como fuente central de manifiestos disponibles en la app.

## Consecuencias

- F1 puede validar modulos habilitados contra manifiestos.
- Las futuras migraciones y permisos pueden mapearse por `manifest.id`.
- Cualquier modulo nuevo debe exportar su `ModuleManifest` y registrarse aqui.
