import { createContext, useContext } from 'react'

export const GuestContext = createContext({ isGuest: false, requireAuth: (fn) => fn?.() })
export const useGuest = () => useContext(GuestContext)
