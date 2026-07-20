# Constriqo - Gestion de secretos

## Principios

- Secretos solo en variables de entorno o gestor de secretos.
- Nunca en frontend.
- Nunca en git.
- Nunca en logs.
- Secretos diferentes por cliente y por ambiente.
- Rotacion obligatoria ante incidente, cambio de personal o cada 90 dias.

## Secretos por instalacion

- `DATABASE_URL`
- credenciales de storage futuro
- credenciales de email/SMS futuro
- claves OAuth futuras
- clave de licencia futura

## Rotacion

1. Crear nuevo secreto.
2. Actualizar entorno del despliegue.
3. Reiniciar runtime de forma controlada.
4. Ejecutar smoke test.
5. Revocar secreto anterior.
6. Registrar evento de rotacion.

## Prohibiciones

- No copiar `.env` por chat, ticket o email.
- No incluir secretos en capturas.
- No usar la misma clave en dos clientes.
- No guardar tokens OAuth sin cifrado en reposo.
