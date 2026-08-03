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
- **Quest Café** — sitio INDEPENDIENTE en **coffee.questhobbystore.com**
  (rama `cafe-only`, ya mergeada). `main.jsx` detecta el hostname
  (`coffee.*` / `cafe.*` / `questcafe*`) o el path `/cafe` y monta SOLO
  `CafeScreen`: la app —feed, nav, auth— ni se ejecuta, y al revés, el
  resto del sitio no se entera del café.
  · **Landing editorial** (naranja quemado + verde bosque sobre crema,
    display Rammetto One autohospedada): splash de taza llenándose, hero a
    sangre, secciones numeradas, cinta marquee, reveals al scrollear.
  · **Menú por secciones** con iconos: 🦖🔥 caliente · 🧊 fríos ·
    🫳✨ postres · 🧂 salados. Se guardan en `shop_products.subcategory`.
  · **Ficha del producto**: ilustración SVG (taza o copa según sección, o
    la foto propia si tiene), descripción, cantidad 01-04 y botón con el
    total.
  · **Rating** 1-5 estrellas SIN cuenta (guest_id de localStorage). Al
    público solo se expone el promedio, por la vista
    `cafe_product_ratings`; los votos crudos no son legibles.
  · **Pedido** por WhatsApp al número del negocio, registrado en
    `cafe_orders` con código `C-####`. Los precios los recalcula
    `place_cafe_order()` en la base: el navegador manda solo {id, qty}.
  · **Staff** entra con el botón "Staff" (email + contraseña de su cuenta
    de Quest): tablero de Órdenes (nueva → lista → entregada) y alta/edición
    de productos sin salir del café.
  · Migraciones YA CORRIDAS en prod: `cafe_orders`, `cafe_description`,
    `cafe_ratings`. QR en `public/cafe-qr.png` → coffee.questhobbystore.com.
  · **Falta**: la dirección real en la tarjeta de ubicación (hoy es
    genérica) y videos propios en "Así lo hacemos" (hay placeholders con
    imágenes de Unsplash; **video externo NO pasa la CSP** — hay que
    servirlo del mismo dominio o abrir `media-src`).

---

## 2. Pendiente: PayPal (rama `paypal-checkout`, NO publicado)

Pago online **solo para productos en stock** (los pre orders quedan afuera a
propósito: tardan meses y ahí pegan las disputas y los reembolsos vencidos).

Está completo y probado. Para activarlo:

1. **Credenciales en Vercel** (las generás vos en developer.paypal.com):
   `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV=sandbox`,
   `VITE_PAYPAL_CLIENT_ID`.
2. **Correr** `supabase/migrations/20260726_paypal_orders.sql`.
3. **Probar en sandbox** (compra completa: baja el stock, aparece el pedido).
   Recién ahí pasar a `PAYPAL_ENV=live`.
4. Mergear la rama a `main`.

Seguridad ya resuelta: el precio sale siempre de la base (nunca del
navegador), se valida el stock dos veces con la fila bloqueada, se verifica
que el monto cobrado coincida, y si algo no cuadra **se reembolsa
automáticamente**. Ya cobra el **precio de oferta** si el producto tiene
descuento. Sin credenciales el bloque de pago no aparece: es seguro publicar.

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

- **`main`** → producción. Ya incluye el café (merge de `cafe-only`).
- **`cafe-only`** → rama del café, ya mergeada. Se puede borrar.
- **`paypal-checkout`** → ver sección 2. Tiene TODO lo demás sin publicar:
  PayPal, recorte 4:5 del feed, gestión de pedidos online, WhatsApp de la
  tienda al número de negocio, envíos con aviso, fuentes autohospedadas,
  auditoría de permisos. **Ojo al mergear**: `PAYPAL_ENV` está escrita
  `sandox` — cualquier valor distinto de `live` apunta al sandbox, así que
  si las variables quedan con scope Production, los clientes podrían
  "comprar" con plata ficticia. Antes de mergear, o se corrige el valor o
  se destilda Production en las cuatro variables de PayPal.
- **`rebuild-oneui`** → rediseño visual estilo One UI **descartado** (quedó
  frío y genérico; se perdía la personalidad de la app). Se guarda por si
  sirve alguna pieza suelta.
- `redesign`, `claude/*` → viejas, ignorar.
