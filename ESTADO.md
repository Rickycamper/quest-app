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
- **Tracking en 3 pasos** (ago 2026): Entregado en tienda → En tránsito →
  Listo para retirar (+ Retirado = fin). Los estados `pending_confirmation`
  y `pending_arrival` siguen en la base por paquetes viejos pero ya no son
  pasos visibles; el equipo salta de En tránsito a Listo para retirar. Cada
  card muestra "creado el <fecha>".
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
    `cafe_ratings`, `cafe_menu_real` (carta con tamaños en
    `shop_products.variants`), `cafe_leches` (cambio de leche como
    adicional, `has_milk`), `cafe_delivery` (ver abajo).
  · **Paleta definitiva** (dada por el dueño): crema #F6E9CE, rojo #DD3D26,
    índigo #3B358E. Copy en tuteo panameño, NO voseo.
  · **Delivery en radio de 1 km**: `cafe_settings` (interruptor + coords +
    radio, staff lo prende/apaga con el chip 🛵 del header). Mapa SIN
    librerías (CSP bloquea scripts externos; son teselas OSM como <img> +
    Mercator propio). El cliente marca su punto tocando el mapa o por
    geolocation; place_cafe_order() revalida radio y switch EN LA BASE.
    **⚠️ Las coordenadas del local son un PLACEHOLDER (Ciudad de Panamá)**
    — hay que correr `UPDATE public.cafe_settings SET lat=…, lng=… WHERE
    id=1;` con el pin real. Hasta entonces el círculo de 1 km está mal
    centrado. QR en `public/cafe-qr.png` → coffee.questhobbystore.com.
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
- **La gente no podía entrar (ago 2026)**: al equivocar la contraseña, el
  login mandaba AUTOMÁTICAMENTE un código OTP por email y metía al usuario
  en una pantalla de código que aceptaba 6 dígitos cuando Supabase manda 8.
  Por decisión del dueño se ELIMINARON todas las rutas de código por email
  (auto-envío, tarjeta "Entrar sin contraseña", fallback del banner de
  Discord). Login = email+contraseña, Discord, o reset por link. **No
  reintroducir OTP.** `sendOtpCode/verifyOtpCode` quedan en supabase.js
  sin usar.
- **Tracking sin sesión** tiraba "Cannot read properties of null (reading
  'user')": `getMyPackages()` no verificaba la sesión. Ahora devuelve [].

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

---

## 7. Funciones APAGADAS (retomables en un minuto)

El dueño pidió sacar de la app lo que nadie usaba o no funcionaba (sep 2026).
**No se borró código.** Cada una está detrás de un interruptor en
`src/lib/features.js`; para retomarla, se pone su flag en `true`, build, push.

| flag | qué prende | dónde vive el código |
|---|---|---|
| `membresia` | tile "Membresía" en el Q Hub | `MembresiaView` en QuestHubScreen |
| `folder` | tile "Folder · Tu colección" | `FolderScreen` + tab `folder` en App |
| `decks` | tile "Mis Decks" | `DecksView` en QuestHubScreen |
| `liveStream` | "Transmisión en vivo": tile del equipo, banner "● EN VIVO" y polling cada 30s | `LiveStreamScreen`, `getActiveLiveStream` |
| `sucursalPanama` | tarjeta de la sucursal Panamá en "Sucursales" | `SucursalesView` + `BRANCH_INFO.Panama` |

Ojo: `sucursalPanama` NO toca el tracking — Panamá sigue siendo origen/destino
válido de envíos, por pedido explícito del dueño.

Apagados después (sep 2026), mismo mecanismo:

| flag | qué prende |
|---|---|
| `rankingBranches` | ranking por sucursal: tabs Global/Panamá/David/Chitré, "Puntos por sucursal", pin de sucursal en cada fila. Apagado = **un solo ranking general** |
| `seasons` | temporadas: banner, tarjeta "Temporada activa", insignias por temporada |

**⚠️ Cron de temporadas.** En Supabase hay un job `reset-season-quarterly`
(pg_cron) que cada 1 de enero/mayo/septiembre llama a la edge function
`reset-season`, que REINICIA el ranking. Con las temporadas apagadas hay que
desprogramarlo, si no el 1 de enero se borra todo:
`SELECT cron.unschedule('reset-season-quarterly');`

---

## 8. Torneos por CSV + reclamo de nombres (sep 2026)

Migración: `supabase/migrations/20260905_torneos_csv.sql` — **hay que correrla**.

Flujo: el equipo importa el CSV (Rankings → Torneos → botón **CSV**), elige
juego/sucursal/nombre/fecha y confirma qué columna es posición y cuál nombre.
Cada fila cuyo nombre ya fue reclamado se vuelve un `ranking_claims` aprobado
(el leaderboard la suma igual que un claim manual: 3/2/1, resto 1 punto). Las
demás quedan en `tournament_import_rows` sin dueño. El jugador ve el banner
"¿Jugaste un torneo y no aparecés?" en Rankings, busca su nombre y toca
"Este soy yo": `claim_player_name` le asigna todos sus resultados y guarda
el alias en `player_aliases` — los CSV futuros lo reconocen solos. El equipo
recibe notificación de cada reclamo y puede revertirlo con
`revoke_player_alias(id)` (por ahora solo por SQL o RPC; no hay UI).

Trampas: un torneo con mismo juego+nombre+fecha no se importa dos veces
(evita puntos dobles). Los nombres se comparan normalizados
(`norm_name`: sin acentos/mayúsculas). Si `ranking_claims.position` tiene un
CHECK acotado, el CSV grande falla — la verificación al final del SQL lo
muestra.

---

## 9. Roll Player — personajes de rol (sep 2026)

Tile "Roll Player" en el Q Hub → `RollPlayerScreen`. Creador de personajes
estilo D&D Beyond para los homebrews de Quest. Arranca con **Dungeons and
Devil Fruits** (One Piece · D&D 5e, autor oneworldhd).

- **Datos**: `public/rulesets/<id>/*.json` (motor + `reference.json` con el
  manual entero). Formato descrito en `public/rulesets/one-piece-ddf/README.md`.
  Agregar otro homebrew = otra carpeta + una entrada en
  `src/rollplayer/rulesets.js`. Nada del motor sabe de One Piece.
- **Motor** (`src/rollplayer/engine.js`): implementa `derived_rules.json` —
  modificadores, bono de competencia, PV (max del dado a nivel 1, promedio
  después), CA como el MAYOR entre 10+DES / armadura / Unarmored Defense /
  Soul Armor (nunca suma), salvaciones, destrezas, rasgos activos por nivel,
  CD de conjuros y de Haki. El personaje guarda SOLO elecciones y estado.
- **Asistente**: ruleset → nombre+raza(+subraza, Human Variant con sus
  elecciones) → clase + destrezas → puntuaciones (point buy 27 / array /
  manual) → trasfondo + tripulación + sueño → equipo + Belly (tirada de la
  clase) → resumen.
- **Hoja viva**: PV con daño/curación, PV temporales, salvaciones de muerte,
  condiciones, agotamiento, descanso largo; rasgos expandibles con el texto
  del manual; Haki (colores + avances por rareza, con nota del Spirit Surge)
  y Fruta (catálogo de 224 o custom, cargas, habilidades); inventario con
  equipar armadura (afecta CA) y Belly; historia con sugerencias del
  trasfondo. **Subir de nivel**: PV, subclase cuando toca, ASI o feat.
- **Guardado** (`src/rollplayer/storage.js`): con sesión en `rp_characters`
  (jsonb, RLS dueño), sin sesión en localStorage; botón para subir los
  locales a la cuenta. Migración: `20260906_roll_player.sql`.
- **Manual**: visor con búsqueda sobre `reference.json` (1.3 MB, carga
  perezosa al abrirlo).
- **Pendiente / a decidir**: los hechizos 5e estándar solo están por nombre
  (el manual no trae el texto; hace falta el SRD aparte). Permiso del autor
  del homebrew antes de promocionarlo como feature pública (ver README).
