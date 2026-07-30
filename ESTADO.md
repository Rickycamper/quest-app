# Estado del proyecto — Quest

App de la comunidad TCG de Panamá (questhobbystore.com).
**Stack:** React 18 + Vite (JSX, estilos inline) · Supabase (Postgres + Auth +
RLS + Realtime + Storage) · Vercel (hosting + funciones en `api/`).
Push a `main` → Vercel despliega solo.

> Para retomar: leé este archivo. Está verificado contra producción
> (jul 2026), no escrito de memoria.

---

## 1. En producción y funcionando

La migración grande **ya se aplicó** (verificado: columnas, tablas y
funciones responden OK en prod). Todo esto está vivo para los usuarios:

- **Feed separado de Trade y Ventas.** El feed son posts de comunidad; las
  compras/ventas viven en su sección. 72 posts viejos quedaron clasificados
  automáticamente (41 venta, 19 compra, 9 tengo, 3 trade).
- **Crear post**: desde el Feed pedís TCG **o Noticia** (con links
  clickeables); desde Trade y Ventas pide **Venta / Abierto a trade**.
  Subida unificada estilo IG (un solo botón para foto y video).
- **Pre orders con número** (`MTG-0001`, `OP-0042`…), máx. 4 por persona,
  50% de depósito, sujeto a recorte. Ticket descargable en PNG.
- **Mis Pedidos** (tile en el Q Hub): el cliente ve sus pedidos con número.
- **Listo para retirar**: el equipo lo marca con una observación
  (ej. "mañana a partir de las 3pm") y el cliente recibe aviso.
- **Pre order cerrado**: oculta las cantidades al público; el equipo las
  sigue viendo.
- **Precio de oferta**: el equipo carga un precio con descuento y el público
  ve el precio viejo tachado + el nuevo.
- **Chat de comunidad** por TCG (texto, foto, nota de voz), invitados
  incluidos.
- **Nav** con iconos estándar + etiquetas: Feed · Tienda · Crear · Trade ·
  Vida (d20).
- **Desktop** se ve como website (header con navegación, sin barra inferior).

---

## 2. Pendiente: PayPal (rama `paypal-checkout`, NO publicado)

Pago online **solo para productos en stock** (los pre orders quedan afuera a
propósito: tardan meses y ahí pegan las disputas y los reembolsos vencidos).

Está completo y probado. Para activarlo:

1. **Credenciales en Vercel** (las de PayPal las generás en
   developer.paypal.com): `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
   `PAYPAL_ENV=sandbox`, `VITE_PAYPAL_CLIENT_ID` **y
   `SUPABASE_SERVICE_KEY`** (la key privada/secret de Supabase →
   Settings → API; antes se llamaba `service_role`). Sin esta última la
   función devuelve 503 "Base de datos no configurada": la necesita para
   escribir el pedido salteando RLS. **Nunca con prefijo `VITE_`** — con
   ese prefijo viaja al navegador de todos los visitantes.
   Marcá cada variable para **Production y Preview**, y acordate de que
   `VITE_PAYPAL_CLIENT_ID` se hornea al compilar: hay que **redesplegar**
   después de cargarla, no alcanza con guardarla.
2. **Correr las migraciones, en orden**:
   `20260726_paypal_orders.sql` → `20260728_paypal_pending.sql` →
   `20260728_paypal_revoke_public.sql` → `20260728_fix_order_counter_ambiguo.sql`
   → `20260729_shop_orders_buyer_phone.sql`.
   (Aparte, no es de PayPal: `20260730_package_recipient_phone.sql` para el
   aviso por WhatsApp en envíos entre tiendas, y
   `20260730_auditoria_security_definer.sql` — auditoría EN VIVO que cierra
   toda función SECURITY DEFINER y re-otorga solo lo que la app llama.
   OJO con su allowlist de anon: los INVITADOS usan delete_community_message,
   create_preorder, next_preorder_code y get_game_leaderboard, además de
   is_staff que lo llaman las políticas RLS. Revocar anon ahí rompe chat,
   pre-orders o rankings para los no logueados.)
3. **Probar en sandbox** — al menos **dos compras seguidas**, para confirmar
   que la numeración avanza (`QO-0001`, `QO-0002`). Verificar: baja el stock
   de la sucursal correcta, aparece el pedido en Mis Pedidos.
   Recién ahí pasar a `PAYPAL_ENV=live`.
4. Mergear la rama a `main`. Ojo: las variables hay que cargarlas también con
   scope **Production**, y correr las migraciones en la base de producción.

Seguridad ya resuelta: el precio sale siempre de la base (nunca del
navegador), se valida el stock dos veces con la fila bloqueada, se verifica
que el monto cobrado coincida, y si algo no cuadra **se reembolsa
automáticamente**. Ya cobra el **precio de oferta** si el producto tiene
descuento. Sin credenciales el bloque de pago no aparece: es seguro publicar.

**FALTA para poder operarlo** (no está hecho): no existe ninguna pantalla de
gestión de pedidos online. `shop_orders` se lee en un solo lugar de la app —
`getMyOrders`, la vista del cliente. El equipo no tiene dónde ver los pedidos
que entran, marcar "listo para retirar" ni registrar la entrega, y **nada pasa
un pedido de `pending` a `paid`** cuando PayPal libera el cobro. Las columnas
(`ready_at`, `pickup_note`, `status`) y las políticas RLS ya están; falta la
interfaz. Hoy solo se operan desde el SQL Editor.

**Diagnóstico**: `POST /api/paypal` con `{"action":"diag"}` responde si las
credenciales están cargadas, en qué entorno apunta y si `SUPABASE_SERVICE_KEY`
es realmente la secreta. Devuelve solo booleanos. Usalo **antes** de probar
una compra: sin eso, los errores de configuración recién aparecen después de
haberle cobrado a alguien.

---

## 3. Opcional

- `supabase/migrations/OPCIONAL_limpieza_qa.sql` — borra datos de prueba del
  diagnóstico (2 mensajes en el chat de MTG, 1 post, 4 cuentas QA). No hace
  falta para nada; es solo higiene.
- Queda un `.txt` de 2 bytes en Storage → `chat` → `MTG/test/`. Solo se borra
  desde el panel (Supabase bloquea borrar storage por SQL).

---

## 4. Trampas de este proyecto (aprendidas a los golpes)

- **La base de prod está desincronizada de `supabase/migrations/`.** El SQL se
  corre **a mano** en el SQL Editor. Escribí migraciones defensivas
  (`IF NOT EXISTS`) y hacé que el cliente tolere que la columna no exista —
  si no, se rompe para todos hasta que corran el SQL.
- **El SQL Editor corre todo como un bloque**: un error al final aborta el
  script entero. No mezclar cambios de esquema con borrado de datos.
- **Supabase bloquea `DELETE FROM storage.objects`** (usar el panel).
- Al crear una tabla, PostgREST tarda unos segundos en verla (da 404 y luego
  anda). No es bug del código.
- **Para verificar si algo existe en prod**: probá un insert/upload real. El
  GET de metadata con la anon key da falsos negativos. Y las funciones hay
  que probarlas **con los nombres de argumento reales** (con `{}` parecen no
  existir).
- **Roles**: no existe el rol `owner` — es el booleano `is_owner`.
  `is_staff()` = `is_owner OR role IN ('staff','admin')`.
- **No hay base de prueba: el preview de Vercel usa la MISMA base que
  producción.** Cualquier prueba en preview escribe en prod — las compras
  sandbox de PayPal descuentan stock real. Revisá y revertí después de
  probar.
- **`create_package_as_user()` NO está en el repo**, solo se referencia su
  firma. Si hay que cambiarla, primero traé su cuerpo desde prod
  (`pg_get_functiondef`) — recrearla de memoria se lleva puesta la
  generación del `tracking_code` y los eventos.
- **El teléfono y el email de `profiles` son PII.** `20260510_pii_lockdown.sql`
  los cerró para anónimos y dejó como fase 2 cerrarlos para usuarios
  logueados. No los expongas de un usuario a otro: usá una función
  `SECURITY DEFINER` que valide `is_staff()`, como
  `get_package_recipient_phone()`. Si se filtran a la UI, esa fase 2 queda
  imposible de completar.
- **`RETURNS TABLE (code, id)` tapa las columnas que se llamen igual.** Los
  nombres de retorno se vuelven variables dentro del cuerpo de la función:
  un `WHERE id = 1` deja de apuntar a la columna y apunta al parámetro de
  salida. **Calificá siempre** con el nombre de la tabla
  (`WHERE public.order_counter.id = 1`). Nos costó dos compras de prueba y
  el error salía como "no se pudo registrar el pedido".
- **`REVOKE ... FROM anon, authenticated` NO cierra una función.** Postgres
  le concede `EXECUTE` a `PUBLIC` al crearla y anon hereda de ahí. Hay que
  hacer `REVOKE ... FROM PUBLIC` explícito. Estuvo abierta en prod una
  función `SECURITY DEFINER` que descuenta stock. Para verificar:
  `has_function_privilege('anon', p.oid, 'EXECUTE')` sobre `pg_proc`.
  **Pendiente**: auditar el resto de las funciones `SECURITY DEFINER` del
  proyecto, que pueden tener el mismo patrón.
- **La CSP de `vercel.json` bloquea cualquier dominio externo nuevo.** Si
  agregás un script de terceros, no alcanza con `script-src`: también
  `connect-src` (sus llamadas) y `frame-src` (si dibuja iframes, como los
  botones de PayPal). Despista que abrir la URL a mano funciona — una
  navegación de primer nivel no pasa por la CSP de la página.
- **PayPal puede dejar el cobro en `PENDING`** (revisión de seguridad,
  eCheck, vendedor nuevo): la plata ya se tomó. Tratarlo como fallo deja al
  cliente pagado y sin pedido. Se registra como `status = 'pending'`.
- **No enmascares errores de la base con un mensaje de negocio.** El `catch`
  del checkout reportaba cualquier excepción como "se agotó el stock", con
  7 unidades disponibles. Devolvé el mensaje real.

---

## 5. Bugs ya resueltos (no reintroducir)

- **Registro roto**: el usuario se derivaba del email y chocaba con el unique
  constraint. Ahora se busca uno libre antes de registrar.
- **No se veía lo que uno escribía al crear cuenta**: los campos son claros
  dentro de una app oscura; con el teléfono en modo oscuro el navegador
  pintaba el texto de blanco. Fix: `colorScheme: light` +
  `WebkitTextFillColor` en `inputLight` (AuthScreens).
- **Crear posts roto en prod**: `createPost` mandaba `post_type` cuando la
  columna no existía. Ahora solo se manda si tiene valor, con reintento.
- **Voz "paso turno"** (Life Counter): iOS reemplaza el transcript, no lo
  acumula. Se reinicia el reconocedor tras cada acierto.

---

## 6. Ramas

- **`main`** → producción.
- **`paypal-checkout`** → ver sección 2.
- **`fix-cls-feed`** → arregla el CLS del feed (estaba en 0.35, "Poor", por
  Speed Insights). Reserva el alto de imágenes y video con `aspect-ratio 4/5`
  y hace que el fallback de Suspense ocupe el alto de la pantalla en vez de
  200 px. **Sin mergear**: cambia el encuadre de las fotos horizontales del
  feed, hay que mirarlo en preview antes. No es verificable en localhost —
  con caché caliente y sin latencia ni el código viejo muestra shift.
- **`rebuild-oneui`** → rediseño visual estilo One UI **descartado** (quedó
  frío y genérico; se perdía la personalidad de la app). Se guarda por si
  sirve alguna pieza suelta.
- `redesign`, `claude/*` → viejas, ignorar.
