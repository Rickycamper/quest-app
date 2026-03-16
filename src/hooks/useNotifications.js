// ─────────────────────────────────────────────
// QUEST — useNotifications hook
// ─────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import {
  getNotifications, markNotificationRead,
  markAllNotificationsRead, subscribeToNotifications
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
      setNotifications(prev => [payload.new, ...prev])
    })
    return () => channel.unsubscribe()
  }, [user])

  const markRead = async (id) => {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
    await markNotificationRead(id)
  }

  const markAll = async () => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markRead, markAll, reload: load }
}
