# ConstructFlow - Licencia comercial y control de codigo

## Decision

La proteccion principal del codigo es no entregar el repositorio fuente.

## Modalidad inicial

- Instalacion administrada por proveedor.
- Repositorio privado.
- Acceso de cliente solo a la aplicacion.
- Backups, actualizaciones y soporte controlados por proveedor.

## Modalidad alternativa

Si el cliente exige infraestructura propia:

- Imagen privada en registry controlado.
- Contrato que prohiba copia, reventa, redistribucion e ingenieria inversa.
- Licencia firmada o validacion contra servidor de licencias.
- Secretos propios del cliente fuera de la imagen.

## Licencia tecnica futura

La licencia debe poder controlar:

- cliente/empresa
- dominio o instalacion
- version permitida
- modulos habilitados
- fecha de expiracion
- estado: activa, suspendida, revocada

## Panel Super Admin

El proveedor debe tener un panel separado del admin del cliente.

Este panel debe permitir:

- crear tenants/clientes
- ver clientes activos, en prueba, vencidos o suspendidos
- activar, renovar, suspender o revocar licencias
- ver uso tecnico por tenant: usuarios, documentos, storage, actividad, errores y cuotas
- gestionar planes y add-ons
- ver version activa y estado de migraciones
- consultar logs tecnicos y auditoria global sin acceder por defecto a contenido privado del cliente

Reglas obligatorias:

- rol global `super_admin`
- 2FA obligatorio
- auditoria global por accion
- no visible para clientes
- no mezclar permisos globales con permisos de tenant
- acciones criticas con confirmacion fuerte

## Estados de licencia

Estados minimos:

- `trial`
- `active`
- `past_due`
- `suspended`
- `expired`
- `revoked`

Si una licencia vence o se suspende, los datos del cliente no se borran. El sistema puede pasar a modo solo lectura o bloquear funciones principales segun politica comercial.

## Realidad tecnica

Ningun sistema impide al 100% la copia si se entrega el codigo fuente o acceso total al servidor. La defensa correcta combina despliegue administrado, contratos, minimo acceso, auditoria y licencias.
