# Trabajar con dos cuentas de Claude sin pisarse

FADG trabaja FOTOS JEFFERSON desde **dos cuentas de Claude**, intercaladas. Las dos tocan el mismo repo (`Fralexito/fotos-jeff`), el mismo Supabase y los mismos Vercel. Cada cuenta tiene su propia memoria y su propia carpeta de proyecto, que la otra **no ve**.

**Por eso la única fuente de verdad compartida es GitHub (`main`)**: este manual, `EN-CURSO.md`, el código y las migraciones. Lo que no está en `main` no existe para la otra cuenta.

## Instrucciones para pegar en el proyecto de cada cuenta

Copia este bloque en las *instrucciones del proyecto* de las dos cuentas (además de [MEMORIA-PARA-IA.md](MEMORIA-PARA-IA.md)):

```
Este proyecto (FOTOS JEFFERSON) se trabaja desde DOS cuentas de Claude que no comparten memoria. La fuente de verdad es la rama main de github.com/Fralexito/fotos-jeff, carpeta docs/FOTOS-JEFFERSON/.

Al EMPEZAR cualquier tarea:
1. Traer main actualizado (git fetch origin main) y leer docs/FOTOS-JEFFERSON/MEMORIA-PARA-IA.md, PENDIENTES.md y EN-CURSO.md.
2. Si la tarea choca con algo de EN-CURSO.md (mismo sistema o mismos archivos), avisar a FADG antes de empezar.
3. Crear una rama nueva desde main: <cuenta>/<tarea-corta> (ej. a/fotos-semaforo, b/web-precios). Una rama por tarea; nunca trabajar directo en main ni reutilizar una rama ya fusionada.
4. Anotar la tarea en EN-CURSO.md (cuenta, rama, sistema, archivos/tablas, fecha) y subir ese cambio a main de inmediato con un PR corto, para que la otra cuenta lo vea.

Mientras trabajas:
5. PRs pequeños y frecuentes; fusionar apenas estén listos. No dejar ramas vivas de un día para otro.
6. Antes de fusionar, traer main otra vez (git merge origin/main) y resolver conflictos en la rama, nunca en main.
7. Supabase: un solo cambio de esquema a la vez. Antes de una migración, anotarla en EN-CURSO.md con "SUPABASE". Si la otra cuenta tiene una migración anotada, esperar. Toda migración va primero como archivo supabase/migrations/AAAAMMDDHHMMSS_nombre.sql (fecha y hora UTC actuales, mayor que la última) y se aplica en el mismo orden. Nunca cambiar Supabase "a mano" sin archivo de migración.
8. Vercel y Supabase se configuran solo desde una cuenta a la vez; anotar el cambio en EN-CURSO.md.

Al TERMINAR cada tarea:
9. Fusionar el PR en main.
10. En el mismo PR (o uno inmediato): actualizar PENDIENTES.md, la carpeta del sistema tocado, el historial de PRs del README.md y, si cambió algo de fondo, MEMORIA-PARA-IA.md.
11. Borrar tu fila de EN-CURSO.md.
12. Nunca escribir claves ni contraseñas en el repo ni en chats.
```

## Reglas en una línea

| Regla | Por qué |
|---|---|
| Siempre partir de `main` actualizado | La otra cuenta pudo haber fusionado algo |
| Una rama por tarea, con prefijo de cuenta (`a/`, `b/`) | Se sabe de quién es cada rama y no se mezclan |
| Anotar en `EN-CURSO.md` antes de empezar | La otra cuenta ve qué está ocupado |
| Fusionar al terminar, no acumular | Ramas largas = conflictos |
| Un cambio de Supabase a la vez, siempre con archivo de migración fechado | La base es una sola y no tiene "ramas" |
| Actualizar `MEMORIA-PARA-IA.md` y `PENDIENTES.md` al cerrar | Es la memoria compartida entre cuentas |

## Qué cuenta usa qué letra

- **Cuenta A**: la cuenta actual de este proyecto (prefijo de rama `a/`).
- **Cuenta B**: la segunda cuenta (prefijo `b/`).

Las ramas antiguas `claude/...` creadas automáticamente se consideran de la cuenta que las creó; no reutilizarlas después de fusionadas.

## Checklist de inicio de sesión

- [ ] `git fetch origin main` y partir de `main`.
- [ ] Leer `MEMORIA-PARA-IA.md`, `PENDIENTES.md` y `EN-CURSO.md`.
- [ ] ¿Choca con algo en curso? Si sí, avisar a FADG.
- [ ] Crear rama `a/...` o `b/...`.
- [ ] Anotar la tarea en `EN-CURSO.md` y fusionarlo.

## Checklist de cierre de sesión

- [ ] Traer `main` a la rama y comprobar que compila (`npm run build` si se tocó el panel o la web).
- [ ] Fusionar el PR.
- [ ] Actualizar `PENDIENTES.md`, el README del sistema y el historial de PRs.
- [ ] Actualizar `MEMORIA-PARA-IA.md` si hubo decisiones nuevas.
- [ ] Borrar la fila de `EN-CURSO.md`.
- [ ] Si se tocó la PC (motor, programa), decir qué hay que actualizar allí (`git pull` en `C:\dev\...`).

## Si igual se pisan

- **Conflicto en Git:** resolverlo en la rama propia trayendo `main`; nunca forzar (`force push`) sobre `main`.
- **Dos migraciones con la misma idea:** se queda la que ya está en `main`; la otra se rehace con fecha nueva encima.
- **Algo cambió en Supabase sin archivo:** escribir de inmediato la migración que lo describe para que el repo vuelva a coincidir con la base.
