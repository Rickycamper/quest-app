// ─────────────────────────────────────────────
// QUEST — useNotifications hook
// ─────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import {
  getNotifications, markNotificationRead,
  markAllNotificationsRead, subscribeToNotifications, supabase
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = await getNotifications()
      setNotifications(data || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = subscribeToNotifications(user.id, (payload) => {
      const notif = { ...payload.new }
      // Realtime returns jsonb as string — parse it
      if (typeof notif.meta === 'string') {
        try { notif.meta = JSON.parse(notif.meta) } catch { notif.meta = {} }
      }
      setNotifications(prev => [notif, ...prev])
    })
    return () => supabase.removeChannel(channel)
  }, [user])

  const markRead = async (id) => {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
    await markNotificationRead(id)
  }

  const markAll = async () => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }

  // Update local state immediately when a match notification is responded to,
  // so the PENDIENTE buttons disappear without waiting for a reload.
  const markResponded = (id, status) => {
    setNotifications(ns => ns.map(n => {
      if (n.id !== id) return n
      const m = typeof n.meta === 'string' ? (() => { try { return JSON.parse(n.meta) } catch { return {} } })() : (n.meta || {})
      return { ...n, read: true, meta: { ...m, status } }
    }))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markRead, markAll, markResponded, reload: load }
}
