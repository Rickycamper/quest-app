// ─────────────────────────────────────────────
// QUEST — Interruptores de funciones apagadas
// ─────────────────────────────────────────────
// Acá viven las funciones que el dueño pidió sacar de la app porque nadie
// las usaba o no funcionaban (sep 2026). NO se borró el código de ninguna:
// para retomar una, se pone su flag en `true` y vuelve a aparecer.
//
//   membresia      → tile "Membresía" del Q Hub (MembresiaView en QuestHubScreen)
//   folder         → tile "Folder · Tu colección" (FolderScreen, tab 'folder' en App)
//   decks          → tile "Mis Decks" (DecksView en QuestHubScreen)
//   liveStream     → "Transmisión en vivo": tile para el equipo, banner
//                    "● EN VIVO" para todos y el polling cada 30s
//                    (LiveStreamScreen + getActiveLiveStream). No funcionaba.
//   sucursalPanama → tarjeta de la sucursal Panamá en "Sucursales" (dirección,
//                    horario, WhatsApp, cómo llegar). El TRACKING sigue usando
//                    Panamá como origen/destino sin importar este flag.
//   rankingBranches → ranking dividido por sucursal (tabs Global/Panamá/David/
//                    Chitré, "Puntos por sucursal", pin de sucursal en cada
//                    fila). Apagado = un solo ranking general.
//   seasons        → temporadas del ranking (banner, tarjeta de temporada,
//                    insignias por temporada). OJO: el cron de Supabase
//                    'reset-season-quarterly' reinicia el ranking cada 1 de
//                    ene/may/sep — hay que desprogramarlo (ver ESTADO.md).
//
export const FEATURES = {
  membresia:      false,
  folder:         false,
  decks:          false,
  liveStream:     false,
  sucursalPanama: false,
  rankingBranches: false,
  seasons:         false,
}
