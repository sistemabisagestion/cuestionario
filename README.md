# BISAQUIZ — Evaluación de Estándares de Gestión

Aplicación web para evaluar a los colaboradores de BISA sobre los estándares de gestión:

- **Nuevo Ingreso**: evaluación global según la Matriz de Nuevo Ingreso.
- **Usuario Antiguo**: evaluación por estándar según la Matriz de Personal Antiguo.
- **Administrador**: monitoreo de resultados y Gestión de Datos (banco de preguntas, links y matrices) mediante Excel.

## Arquitectura

| Parte | Tecnología |
| --- | --- |
| Interfaz | React 19, TypeScript, Vite, React Router |
| API | Funciones de Vercel en `api/` (Node.js), lógica en `server/` |
| Resultados de evaluaciones | PostgreSQL (Neon), tabla `public.intentos` |
| Banco de preguntas, links y matrices | Versiones JSON: archivos locales en desarrollo, Vercel Blob privado en producción |
| Código compartido | `shared/` (validación, Excel, datos iniciales) |

El navegador nunca accede directamente a la base de datos ni a Blob, y no contiene credenciales: todo pasa por `/api/*`. La contraseña administrativa se valida solo en el servidor y la sesión se guarda en una cookie firmada `HttpOnly`.

### Reglas que aplica el servidor

- **Máximo dos intentos por estándar** (Nuevo Ingreso: la evaluación `EVALUACION-GLOBAL`), contados desde los registros existentes y protegidos con una transacción y un bloqueo por participante y evaluación: ni llamadas directas a la API ni pestañas simultáneas crean un tercer intento.
- **Tiempo de la evaluación**: al iniciar, el servidor asigna el id del intento y firma un *ticket* con la hora de inicio; el resultado final se acepta solo dentro de `preguntas × 45 s + 10 min`.
- **Resultados inmutables**: un resultado final no se sobrescribe; reenviar el mismo resultado es idempotente.
- **Evaluaciones recuperables**: al recargar, la evaluación continúa con las mismas preguntas, respuestas, posición y tiempo restante (estado de la pestaña en `sessionStorage`, sin respuestas correctas).
- **Gestión de Datos**: cada importación se valida y compara en el servidor, requiere confirmación, se publica como versión inmutable y puede restaurarse.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```bash
npm install
npm run dev        # web en http://localhost:5173 y API en http://127.0.0.1:3002, en un solo proceso
```

Crear archivos de entorno locales (ignorados por Git; **nunca** con credenciales de producción):

- `.env.matrices.local`: `MATRICES_STORAGE=local`, `MATRICES_LOCAL_DIR=.local-matrices` y, opcionalmente, `BISA_API_PORT`, `BISA_WEB_PORT` y una `ADMIN_PASSWORD` solo para desarrollo.
- `.env.neon-test.local` (opcional): `DATABASE_URL` de la rama de **pruebas** de Neon, `SESSION_SECRET` (mínimo 32 caracteres) y `ADMIN_PASSWORD` de pruebas.

Ver `.env.example`. Las matrices iniciales se crean con `npm run matrices:recover` (no sobrescribe datos existentes).

Protecciones de desarrollo:

- `npm run dev` solo usa una base de datos si es la rama de pruebas verificada de Neon; cualquier otra se ignora y los resultados quedan desactivados.
- `scripts/dev-api.mjs` se niega a iniciar si `DATABASE_URL` no es esa rama de pruebas.
- `npm run dev` detiene automáticamente una instancia anterior **de la misma instalación** solo si lo puede demostrar (PID, comando, registro local y secreto); cualquier otro proceso solo se informa.

## Pruebas

```bash
npx tsc -b
npm run lint
npm run build
npm test                    # pruebas automatizadas (PostgreSQL en memoria; no usan Neon)
npm run test:ui             # navegador real (Edge/Chrome) contra una instancia aislada y datos temporales
npm run test:concurrencia   # límite de intentos con PostgreSQL real temporal (requiere binarios de PostgreSQL, PG_BIN)
```

Ninguna prueba escribe en Neon ni en Blob.

## Variables de entorno en Vercel

Solo del servidor (nunca con prefijo `VITE_`):

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL (Neon, *pooled*) para `public.intentos`. |
| `SESSION_SECRET` | Firma de sesiones y tickets de intento; aleatorio, mínimo 32 caracteres. |
| `ADMIN_PASSWORD` | Contraseña del panel administrativo. |
| `MATRICES_STORAGE` | `blob` en producción (`disabled` por defecto). |
| `MATRICES_BLOB_APPROVED` | `true` para habilitar Blob de forma explícita. |
| `BLOB_READ_WRITE_TOKEN` | Token del Blob Store privado (o `BLOB_STORE_ID` con OIDC de Vercel). |

Sin almacenamiento configurado, las matrices responden 503 y no es posible registrarse ni evaluar.
