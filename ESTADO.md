# Estado del proyecto — Quest

Resumen de dónde está todo. Actualizar cuando cambie algo importante.

## ⚠️ Pendiente: correr el SQL

Pegá **`supabase/migrations/AAA_CORRER_ESTE.sql`** completo en
Supabase → SQL Editor y ejecutá **una vez**. Es idempotente.

Hasta que lo corras, estas features están a medias (la app **no se rompe**,
tiene respaldos, pero no guardan):

| Feature | Sin el SQL |
|---|---|
| Feed vs Trade y Ventas | Separa por el prefijo `[Vendo]` del texto |
| Chat: borrar de invitado | El mensaje vuelve al recargar |
| Números de pre order (TCG-####) | Pre-ordenar abre WhatsApp sin número |
| Mis Pedidos / Listo para retirar | Sin números ni aviso de retiro |
| Pre order cerrado | El toggle no guarda |
| Precio de oferta | El descuento no guarda |

La limpieza de datos de prueba quedó aparte y es **opcional**:
`supabase/migrations/OPCIONAL_limpieza_qa.sql`.

## Ramas

- **`main`** → es lo que ven los usuarios (questhobbystore.com).
- **`paypal-checkout`** → pago online con PayPal, **solo productos en stock**.
  Listo y probado, **sin publicar**. Para activarlo:
  1. Cargar en Vercel: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
     `PAYPAL_ENV=sandbox`, `VITE_PAYPAL_CLIENT_ID`.
  2. Correr `supabase/migrations/20260726_paypal_orders.sql`.
  3. Probar en sandbox → recién ahí `PAYPAL_ENV=live`.
  - ⚠️ **Pendiente antes de publicar**: que cobre el **precio de oferta**
    cuando el producto tiene descuento (hoy cobra el precio normal).
  - Sin credenciales el bloque de pago no aparece: es seguro publicar.
- **`rebuild-oneui`** → rediseño visual estilo One UI que **se descartó**
  (quedó frío/genérico). Se guarda por si sirve alguna pieza suelta.
- **`redesign`**, **`claude/*`** → ramas viejas, ignorar.

## Cosas a tener en cuenta

- **La base de prod está desincronizada** de `supabase/migrations/`: el SQL
  se aplica a mano en el SQL Editor. Escribir migraciones defensivas
  (`IF NOT EXISTS`) y que el cliente tolere que la columna no exista.
- Al crear una tabla, PostgREST tarda unos segundos en verla (da 404 y
  después anda). No es bug del código.
- Para verificar si algo existe en prod: probar un **UPLOAD/insert real**,
  no el GET de metadata (con la anon key da falso negativo).
- Roles: no existe el rol `owner` — es el booleano `is_owner`.
  `is_staff()` = `is_owner OR role IN ('staff','admin')`.
