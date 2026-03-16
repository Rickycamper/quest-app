// Renders a game icon: PNG if available, otherwise emoji
import { GAME_STYLES } from '../lib/constants'

export default function GameIcon({ game, size = 14, style = {} }) {
  const gs = GAME_STYLES[game]
  if (!gs) return null
  if (gs.icon) {
    return <img src={gs.icon} alt={game} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block', ...style }} />
  }
  return <span style={{ fontSize: size * 0.9, lineHeight: 1, ...style }}>{gs.emoji}</span>
}
