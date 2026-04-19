// ─────────────────────────────────────────────
// QUEST — Email Marketing Screen
// Owner-only. Manage email campaigns stored in Supabase.
// Sending is NOT implemented yet — this is storage/draft mode only.
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { getEmailCampaigns, saveEmailCampaign, deleteEmailCampaign, getEmailAudienceCount } from '../lib/supabase'

// ── Constants ────────────────────────────────
const AUDIENCES = [
  { value: 'all',     label: 'Todos los usuarios',   color: '#A78BFA' },
  { value: 'premium', label: 'Premium',               color: '#F59E0B' },
  { value: 'panama',  label: 'Panamá Capital',        color: '#38BDF8' },
  { value: 'david',   label: 'David',                 color: '#FB923C' },
  { value: 'chitre',  label: 'Chitré',                color: '#A78BFA' },
]

const STATUS_STYLE = {
  draft:     { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', label: 'Borrador' },
  scheduled: { color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  label: 'Programado' },
  sent:      { color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  label: 'Enviado' },
}

// The apertura HTML template URL (deployed to Vercel)
const APERTURA_TEMPLATE_URL = 'https://quest-tcg.vercel.app/email-apertura.html'

// ── Helpers ──────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sub-components ───────────────────────────
function Pill({ children, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      color, background: bg, borderRadius: 6, padding: '3px 8px',
    }}>{children}</span>
  )
}

function AudiencePill({ audience }) {
  const a = AUDIENCES.find(x => x.value === audience)
  if (!a) return null
  return <Pill color={a.color} bg={`${a.color}18`}>{a.label.toUpperCase()}</Pill>
}

// ── Campaign card (list view) ─────────────────
function CampaignCard({ campaign, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const st = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar campaña "${campaign.name}"?`)) return
    setDeleting(true)
    try { await onDelete(campaign.id) }
    finally { setDeleting(false) }
  }

  return (
    <div style={{
      background: '#111', border: '1px solid #1F1F1F',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: deleting ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#FFF', marginBottom: 4, wordBreak: 'break-word' }}>
            {campaign.name}
          </div>
          {campaign.subject && (
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginBottom: 6, wordBreak: 'break-word' }}>
              {campaign.subject}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Pill color={st.color} bg={st.bg}>{st.label.toUpperCase()}</Pill>
            <AudiencePill audience={campaign.audience} />
            {campaign.recipient_count != null && (
              <Pill color="#60A5FA" bg="rgba(96,165,250,0.1)">{campaign.recipient_count} CONTACTOS</Pill>
            )}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#4B5563' }}>
        <span>Creado {fmt(campaign.created_at)}</span>
        {campaign.sent_at && <span>· Enviado {fmt(campaign.sent_at)}</span>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onEdit(campaign)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            background: '#1A1A1A', border: '1px solid #2A2A2A',
            color: '#E5E5E5', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          ✏️ Editar
        </button>
        <button
          onClick={() => {
            const win = window.open('', '_blank')
            win.document.write(campaign.html_body || '<p>Sin contenido HTML</p>')
            win.document.close()
          }}
          disabled={!campaign.html_body}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            background: '#1A1A1A', border: '1px solid #2A2A2A',
            color: campaign.html_body ? '#A78BFA' : '#374151',
            fontSize: 12, fontWeight: 600,
            cursor: campaign.html_body ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          👁 Preview
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// ── Campaign form (create / edit) ─────────────
function CampaignForm({ initial, onSave, onCancel }) {
  const [name,        setName]        = useState(initial?.name     ?? '')
  const [subject,     setSubject]     = useState(initial?.subject  ?? '')
  const [audience,    setAudience]    = useState(initial?.audience ?? 'all')
  const [htmlBody,    setHtmlBody]    = useState(initial?.html_body ?? '')
  const [recipCount,  setRecipCount]  = useState(null)
  const [loadingRcpt, setLoadingRcpt] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [htmlLoading, setHtmlLoading] = useState(false)

  // Load recipient count whenever audience changes
  useEffect(() => {
    let cancelled = false
    setLoadingRcpt(true)
    getEmailAudienceCount(audience)
      .then(c => { if (!cancelled) setRecipCount(c) })
      .catch(() => { if (!cancelled) setRecipCount(null) })
      .finally(() => { if (!cancelled) setLoadingRcpt(false) })
    return () => { cancelled = true }
  }, [audience])

  const loadAperturaTemplate = async () => {
    setHtmlLoading(true)
    try {
      const res = await fetch(APERTURA_TEMPLATE_URL)
      if (!res.ok) throw new Error('No se pudo cargar el template')
      const html = await res.text()
      setHtmlBody(html)
      if (!name) setName('Apertura Panamá Capital — 2 de Mayo')
      if (!subject) setSubject('🏆 Quest Hobby Store abre en Panamá Capital · 2 de Mayo')
    } catch (e) {
      setError(e.message)
    } finally {
      setHtmlLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim())    { setError('El nombre es obligatorio'); return }
    if (!subject.trim()) { setError('El asunto es obligatorio'); return }
    setError('')
    setSaving(true)
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        subject: subject.trim(),
        html_body: htmlBody,
        audience,
        recipient_count: recipCount,
        status: 'draft',
      })
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: '#0F0F0F', border: '1px solid #2A2A2A',
    borderRadius: 8, color: '#FFF',
    fontSize: 14, fontFamily: 'Inter, sans-serif',
    outline: 'none', padding: '10px 12px',
  }

  const selectedAudience = AUDIENCES.find(a => a.value === audience)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Name */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          NOMBRE INTERNO
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ej: Apertura Panamá Capital"
          style={inp}
        />
      </div>

      {/* Subject */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
          ASUNTO DEL EMAIL
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Ej: 🏆 Quest abre en Panamá Capital · 2 de Mayo"
          style={inp}
        />
      </div>

      {/* Audience */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
          AUDIENCIA
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {AUDIENCES.map(a => (
            <button
              key={a.value}
              onClick={() => setAudience(a.value)}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: audience === a.value ? `${a.color}20` : '#1A1A1A',
                color: audience === a.value ? a.color : '#6B7280',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                outline: audience === a.value ? `1px solid ${a.color}60` : '1px solid #2A2A2A',
                transition: 'all 0.15s',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        {/* Recipient count */}
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: '#0F0F0F', border: '1px solid #1A1A1A',
          fontSize: 12, color: '#9CA3AF',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {loadingRcpt ? (
            <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid #374151', borderTopColor: '#6B7280', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} /> Calculando...</>
          ) : (
            <>
              <span style={{ color: selectedAudience?.color ?? '#A78BFA', fontWeight: 700, fontSize: 14 }}>
                {recipCount ?? '—'}
              </span>
              {' '}contactos recibirían este email
            </>
          )}
        </div>
      </div>

      {/* HTML body */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>
            CONTENIDO HTML
          </label>
          <button
            onClick={loadAperturaTemplate}
            disabled={htmlLoading}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none',
              background: 'rgba(139,92,246,0.15)',
              color: htmlLoading ? '#6B7280' : '#A78BFA',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {htmlLoading ? '⏳ Cargando...' : '⚡ Cargar template apertura'}
          </button>
        </div>

        {htmlBody ? (
          <div style={{
            background: '#0F0F0F', border: '1px solid #1F1F1F', borderRadius: 8,
            padding: '12px 14px',
          }}>
            {/* Size indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#4ADE80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ HTML cargado
                <span style={{ color: '#4B5563', fontWeight: 400 }}>
                  ({(new Blob([htmlBody]).size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const win = window.open('', '_blank')
                    win.document.write(htmlBody)
                    win.document.close()
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #2A2A2A',
                    background: 'transparent', color: '#A78BFA', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  👁 Preview
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([htmlBody], { type: 'text/html' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `${name || 'campaign'}.html`
                    a.click()
                  }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid #2A2A2A',
                    background: 'transparent', color: '#60A5FA', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  ↓ Descargar
                </button>
                <button
                  onClick={() => setHtmlBody('')}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)',
                    background: 'rgba(239,68,68,0.06)', color: '#F87171', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
            {/* First 3 lines preview */}
            <pre style={{
              fontSize: 10, color: '#374151', lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 60, overflow: 'hidden',
              margin: 0, fontFamily: 'monospace',
            }}>
              {htmlBody.slice(0, 200)}…
            </pre>
          </div>
        ) : (
          <div style={{
            background: '#0A0A0A', border: '1px dashed #2A2A2A', borderRadius: 8,
            padding: '24px 16px', textAlign: 'center',
            color: '#4B5563', fontSize: 13,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin HTML todavía</div>
            <div style={{ fontSize: 12 }}>Usá el botón "Cargar template apertura" o pegá tu HTML</div>
          </div>
        )}

        {/* Raw textarea (collapsible) */}
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: '#4B5563', cursor: 'pointer', userSelect: 'none', marginBottom: 6 }}>
            Editar HTML directamente
          </summary>
          <textarea
            value={htmlBody}
            onChange={e => setHtmlBody(e.target.value)}
            placeholder="Pega el HTML completo del email aquí..."
            rows={10}
            style={{ ...inp, resize: 'vertical', fontSize: 11, fontFamily: 'monospace' }}
          />
        </details>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#F87171', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'transparent', border: '1px solid #2A2A2A',
            color: '#6B7280', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 2, padding: '11px 0', borderRadius: 10,
            background: saving ? '#1A1A1A' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            border: 'none', color: saving ? '#4B5563' : '#FFF',
            fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {saving ? 'Guardando…' : '💾 Guardar borrador'}
        </button>
      </div>

      {/* Send notice */}
      <div style={{
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
        color: '#92400E', fontSize: 11, lineHeight: 1.5,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>🚧</span>
        <span style={{ color: '#D97706' }}>
          <strong>Envío no activado.</strong> Las campañas se guardan como borrador en Supabase. El envío real se configurará con Resend o SendGrid cuando estés listo para lanzar.
        </span>
      </div>
    </div>
  )
}

// ── Main exported component ───────────────────
export default function EmailMarketingScreen() {
  const [campaigns,   setCampaigns]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [view,        setView]        = useState('list') // 'list' | 'form'
  const [editing,     setEditing]     = useState(null)  // campaign object or null (new)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getEmailCampaigns()
      .then(setCampaigns)
      .catch(e => setError(e.message || 'Error al cargar campañas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    await saveEmailCampaign(data)
    setView('list')
    setEditing(null)
    load()
  }

  const handleDelete = async (id) => {
    await deleteEmailCampaign(id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  const handleEdit = (campaign) => {
    setEditing(campaign)
    setView('form')
  }

  // ── Form view ──
  if (view === 'form') {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
          paddingBottom: 14, borderBottom: '1px solid #1A1A1A',
        }}>
          <button
            onClick={() => { setView('list'); setEditing(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 18, padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>
            {editing ? 'Editar campaña' : 'Nueva campaña'}
          </span>
        </div>
        <CampaignForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setView('list'); setEditing(null) }}
        />
      </>
    )
  }

  // ── List view ──
  return (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em' }}>
          CAMPAÑAS · {campaigns.length}
        </div>
        <button
          onClick={() => { setEditing(null); setView('form') }}
          style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            color: '#FFF', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          + Nueva campaña
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <div style={{ fontSize: 15, color: '#4B5563', fontWeight: 600 }}>Sin campañas guardadas</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Creá tu primera campaña con el template de apertura</div>
        </div>
      )}

      {/* Campaign list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {campaigns.map(c => (
          <CampaignCard
            key={c.id}
            campaign={c}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Info box */}
      {campaigns.length > 0 && (
        <div style={{
          marginTop: 20, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
          fontSize: 12, color: '#60A5FA', lineHeight: 1.6,
        }}>
          💡 Los borradores se guardan en Supabase. Para enviar, se necesita conectar un proveedor de email (Resend, SendGrid).
        </div>
      )}
    </>
  )
}
