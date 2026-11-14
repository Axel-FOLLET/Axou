// Provides the logged-in user to the whole application, through the React context.
import { useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import { apiFetch } from './api.js'

export default function AuthProvider({ children }) {
  // null = nobody known, including during the initial load.
  const [user, setUser] = useState(null)
    // On first render only ([]): ask the server who is logged in.
    useEffect(() => {
        async function fetchUser() {
            try {
                const { ok, data } = await apiFetch('/api/auth/me')
                // Any response other than 200 leaves user as null: the page behaves
                // as if nobody were logged in.
                if (ok) {
                    setUser(data)
                }
            } catch (error) {
                // Server stopped or unreadable response: the application stays usable, logged out.
                console.error('Error fetching user data:', error)
            }
        }

        fetchUser()
    }, [])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}