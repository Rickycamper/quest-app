// ─────────────────────────────────────────────
// QUEST — Shared constants
// ─────────────────────────────────────────────
import mtgIcon from '../assets/mtg.png'
import gundamIcon from '../assets/gundam.png'
import onePieceIcon from '../assets/One piece_.png'
import riftboundIcon from '../assets/riftbound.png'
import pokemonIcon from '../assets/pokemon.png'
import digimonIcon from '../assets/digimon.png'

export const GAMES = ['MTG', 'Pokemon', 'One Piece', 'Digimon', 'Riftbound', 'Gundam']

export const GAME_STYLES = {
  'MTG':       { color: '#A78BFA', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', emoji: '⚔️', icon: mtgIcon },
  'Pokemon':   { color: '#FCD34D', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', emoji: '⚡',  icon: pokemonIcon },
  'One Piece': { color: '#F87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  emoji: '🏴‍☠️', icon: onePieceIcon },
  'Digimon':   { color: '#60A5FA', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', emoji: '🦕',  icon: digimonIcon },
  'Riftbound': { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', emoji: '🌀', icon: riftboundIcon },
  'Gundam':    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)',border: 'rgba(156,163,175,0.25)',emoji: '🤖', icon: gundamIcon },
}


export const BRANCHES = ['Panama', 'David', 'Chitre']

export const BRANCH_STYLES = {
  'Panama': { color: '#38BDF8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.25)', dot: '#38BDF8' },
  'David':  { color: '#FB923C', bg: 'rgba(251,146,60,0.10)',  border: 'rgba(251,146,60,0.25)',  dot: '#FB923C' },
  'Chitre': { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', dot: '#A78BFA' },
}

export const CARD_STATUS = {
  have:  { label: 'Tengo',  color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)'  },
  want:  { label: 'Compro', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  border: 'rgba(252,211,77,0.25)'  },
  trade: { label: 'Tradeo', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
  sell:  { label: 'Vendo',  color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)'  },
}

export const PKG_STATUS = {
  pending_confirmation: { label: 'Pendiente de aprobación', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', step: 0,
                          adminLabel: 'Confirmar recepción de paquete',      adminNext: 'received_origin' },
  received_origin:      { label: 'Recibido en tienda origen', color: '#888888', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',  step: 1,
                          adminLabel: 'Enviar en tránsito',                  adminNext: 'in_transit' },
  in_transit:           { label: 'En tránsito',               color: '#AAAAAA', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.12)', step: 2,
                          adminLabel: 'Reportar llegada a sucursal destino', adminNext: 'pending_arrival' },
  pending_arrival:      { label: 'Pendiente de confirmar',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  step: 3,
                          adminLabel: 'Confirmar llegada a sucursal',        adminNext: 'arrived' },
  arrived:              { label: 'Llegó a sucursal',          color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.25)', step: 4,
                          adminLabel: 'Confirmar retiro',                    adminNext: 'delivered' },
  delivered:            { label: 'Retirado',                  color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',  border: 'rgba(255,255,255,0.22)', step: 5,
                          adminLabel: null,                                  adminNext: null },
}
export const PKG_STEPS = ['pending_confirmation', 'received_origin', 'in_transit', 'pending_arrival', 'arrived', 'delivered']

export const ROLE_CONFIG = {
  client:  { label: 'MEMBER',  color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)'  },
  premium: { label: 'PREMIUM', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  staff:   { label: 'STAFF',   color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.25)'  },
  admin:   { label: 'ADMIN',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
}

export const RANKING_PTS = { 1: 3, 2: 2, 3: 1 }

export const NOTIF_CONFIG = {
  new_package:        { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)'  },
  package_arrived:    { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)'  },
  new_claim:          { color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  border: 'rgba(252,211,77,0.2)'  },
  post_reported:      { color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  tournament_pending: { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  new_message:        { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
  claim_approved:     { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)'  },
  claim_rejected:     { color: '#F87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  match_result:       { color: '#FB923C', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.2)'  },
  auction_won:        { color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  border: 'rgba(252,211,77,0.2)'  },
  auction_ended:      { color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  border: 'rgba(252,211,77,0.2)'  },
  auction_live:       { color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'   },
  tournament_invite:  { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.2)'  },
}
