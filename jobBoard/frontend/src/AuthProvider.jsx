// Fournit l'utilisateur connecté à toute l'application, via le contexte React.
import { useState, useEffect } from 'react'
import { AuthContext } from './AuthContext'
import { apiFetch } from './api.js'

export default function AuthProvider({ children }) {
  // null = personne de connu, y compris pendant le chargement initial.
  const [user, setUser] = useState(null)
    // Au premier affichage seulement ([]) : on demande au serveur qui est connecté.
    useEffect(() => {
        async function fetchUser() {
            try {
                const { ok, data } = await apiFetch('/api/auth/me')
                // Toute réponse autre que 200 laisse user à null : la page se comporte
                // comme si personne n'était connecté.
                if (ok) {
                    setUser(data)
                }
            } catch (error) {
                // Serveur arrêté ou réponse illisible : l'application reste utilisable, déconnectée.
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