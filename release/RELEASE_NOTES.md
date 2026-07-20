# Constriqo Release Notes

## 0.1.0 - Base modular instalable

Estado: pre-produccion.

### Incluye

- App web modular para construccion y servicios.
- Modelo SaaS multi-tenant gestionado por proveedor.
- Runtime HTTP local.
- Migraciones PostgreSQL versionadas.
- Seed inicial por cliente.
- Modulos visuales y contratos backend.
- Marketing agregado al producto.
- Auditorias automaticas de visual, base/backend, operaciones, runtime, DB local, instalacion y actualizacion.

### Requiere antes de produccion

- Adaptadores PostgreSQL reales por modulo.
- Autenticacion runtime conectada.
- Storage real con antivirus/URLs firmadas.
- Backups reales probados.
- Hardening de servidor y gestion de secretos.

### Actualizacion

Usar siempre:

```bash
npm run release:update -- --apply
```

El flujo exige backup antes de migrar, ejecuta migraciones pendientes y corre smoke tests.
