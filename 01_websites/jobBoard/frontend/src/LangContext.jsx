// Le contexte de langue seul, dans son propre fichier (comme AuthContext) : LangProvider le remplit,
// les pages le lisent par useLang() (lang.js).
import { createContext } from 'react'

// Français par défaut : valeur reçue par un composant qui lirait le contexte hors du Provider.
export const LangContext = createContext({ lang: 'fr', setLang: () => {} })
