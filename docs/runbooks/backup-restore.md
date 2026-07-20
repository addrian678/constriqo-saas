# ConstructFlow - Backup y restore seguro

Este runbook define el flujo minimo para no perder datos en staging/produccion SaaS.

## Backup

Crear backup de PostgreSQL:

```powershell
$env:BACKUP_DATABASE_URL="postgresql://usuario-backup-o-admin:..."
npm run db:backup
```

El comando genera:

- `backups/db/constructflow-<fecha>.dump`
- `backups/db/constructflow-<fecha>.dump.json`
- checksum SHA-256

Reglas:

- No subir `backups/` a Git.
- Guardar copia externa cifrada.
- Hacer backup antes de migraciones y releases.
- Hacer backup de storage/bucket además de PostgreSQL.

## Verificar backup sin restaurar

```powershell
$env:BACKUP_FILE="D:\ruta\constructflow-2026-...dump"
npm run db:restore -- --verify-only
```

Esto usa `pg_restore --list` y no modifica ninguna base de datos.

## Restore controlado

Restaurar es destructivo sobre la base destino. Usar solo en staging, ambiente de recuperacion o produccion con ventana aprobada.

```powershell
$env:BACKUP_FILE="D:\ruta\constructflow-2026-...dump"
$env:RESTORE_DATABASE_URL="postgresql://destino:..."
$env:RESTORE_CONFIRM="I_UNDERSTAND_RESTORE_OVERWRITES_DATABASE"
npm run db:restore
```

Para restaurar sobre una base local, tambien se exige:

```powershell
$env:ALLOW_LOCAL_RESTORE="true"
```

## Drill antes de produccion

1. Crear backup.
2. Verificar backup con `--verify-only`.
3. Restaurar en una base temporal.
4. Ejecutar `npm run db:migrate`.
5. Ejecutar `npm run production:preflight`.
6. Probar login admin, MFA, un tenant cliente, PDF, email sandbox/real segun entorno y aislamiento entre tenants.

## Storage

El backup de PostgreSQL no copia los archivos del bucket. Para Supabase Storage:

1. Exportar bucket privado `constructflow-documents` o usar herramienta oficial/API del proveedor.
2. Guardar copia cifrada junto al dump de PostgreSQL.
3. En restore, restaurar primero PostgreSQL y luego los objetos de storage.
4. Verificar checksums/metadata de documentos (`storage_checksum_sha256`, `storage_provider`, `storage_persisted`).
