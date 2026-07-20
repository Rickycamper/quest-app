// ─────────────────────────────────────────────
// QUEST — Ticket de pedido (PNG por canvas, sin librerías)
// Usado por el pre order del cliente (ShopScreen) y por "Mis Pedidos".
// ─────────────────────────────────────────────

const fmtPrice = (n) => (!n || Number(n) === 0) ? 'Preguntar precio' : `$${Number(n).toFixed(2)}`

/** Dibuja el ticket y devuelve un Blob PNG.
 *  { code, name, qty, price, paidPct?, branch?, dateStr? } */
export async function drawTicketPNG({ code, name, qty, price, paidPct = null, branch = null, dateStr = null }) {
  const W = 900, H = 1150
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')

  x.fillStyle = '#0A0A0A'; x.fillRect(0, 0, W, H)
  x.fillStyle = '#FBBF24'; x.fillRect(0, 0, W, 10)

  const center = (txt, y, font, color, spacing = 0) => {
    x.font = font; x.fillStyle = color; x.textAlign = 'center'
    if (spacing) {
      const chars = [...txt]
      const widths = chars.map(ch => x.measureText(ch).width)
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
      let cx = W / 2 - total / 2
      chars.forEach((ch, i) => { x.textAlign = 'left'; x.fillText(ch, cx, y); cx += widths[i] + spacing })
      x.textAlign = 'center'
    } else {
      x.fillText(txt, W / 2, y)
    }
  }
  const wrap = (txt, y, font, color, maxW, lh) => {
    x.font = font; x.fillStyle = color; x.textAlign = 'center'
    const words = String(txt).split(' '); let line = '', yy = y
    for (const w of words) {
      const t = line ? line + ' ' + w : w
      if (x.measureText(t).width > maxW && line) { x.fillText(line, W / 2, yy); line = w; yy += lh }
      else line = t
    }
    if (line) x.fillText(line, W / 2, yy)
    return yy
  }

  center('QUEST', 110, '900 64px Inter, sans-serif', '#FFFFFF', 6)
  center('HOBBY STORE', 148, '700 20px Inter, sans-serif', '#6B7280', 8)
  center('PRE ORDER', 235, '800 30px Inter, sans-serif', '#FBBF24', 10)

  x.strokeStyle = 'rgba(251,191,36,0.5)'; x.lineWidth = 3
  const boxW = 560, boxH = 130
  x.strokeRect(W / 2 - boxW / 2, 275, boxW, boxH)
  center(code, 362, '900 84px "SF Mono", Menlo, monospace', '#FFFFFF')

  let yy = wrap(name, 500, '800 40px Inter, sans-serif', '#FFFFFF', 720, 50)
  center(`Cantidad: ${qty}`, yy + 60, '700 30px Inter, sans-serif', '#9CA3AF')
  center(fmtPrice(price) + (price > 0 ? ' c/u' : ''), yy + 108, '800 34px Inter, sans-serif', '#FFFFFF')
  let extraY = yy + 154
  if (paidPct != null) {
    center(paidPct === 100 ? 'Pagado: 100% ✓' : `Abonado: ${paidPct}%`, extraY, '700 26px Inter, sans-serif', paidPct === 100 ? '#4ADE80' : '#FBBF24')
    extraY += 46
  }
  if (branch) {
    center(`Sucursal: ${branch}`, extraY, '600 24px Inter, sans-serif', '#9CA3AF')
    extraY += 46
  }
  center(`Fecha: ${dateStr || new Date().toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}`, extraY, '600 24px Inter, sans-serif', '#6B7280')

  x.strokeStyle = '#2A2A2A'; x.lineWidth = 2
  x.beginPath(); x.moveTo(90, extraY + 46); x.lineTo(W - 90, extraY + 46); x.stroke()
  const conds = [
    'Máximo 4 unidades por persona · 50% al reservar',
    'Sujeto a recorte — prioridad por orden de llegada',
    'Si no llega: devolución del 100%. Si llega recortado:',
    'recibís lo que podamos otorgar y se devuelve la diferencia.',
  ]
  conds.forEach((t, i) => center(t, extraY + 94 + i * 36, '600 22px Inter, sans-serif', '#9CA3AF'))

  center('Presentá este número al retirar tu pedido', H - 60, '700 24px Inter, sans-serif', '#FBBF24')

  return await new Promise(r => c.toBlob(r, 'image/png'))
}

/** Descarga el ticket: share sheet en móvil ("Guardar imagen"), download en desktop */
export async function downloadTicket(fields) {
  const blob = await drawTicketPNG(fields)
  const file = new File([blob], `preorder-${fields.code}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `Pre order ${fields.code}` }).catch(() => {})
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `preorder-${fields.code}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
}
