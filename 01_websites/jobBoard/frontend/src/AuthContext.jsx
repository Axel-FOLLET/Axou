// Le contexte seul, dans son propre fichier : AuthProvider le remplit, les pages le lisent.
import { createContext } from 'react'

// null par défaut : valeur reçue par un composant qui lirait le contexte hors du Provider.
export const AuthContext = createContext(null)