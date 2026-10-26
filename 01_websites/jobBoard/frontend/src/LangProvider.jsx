// Fournit la langue de l'interface (fr ou en) à toute l'application.
import { useEffect, useState } from 'react'
import { LangContext } from './LangContext'

const STORAGE_KEY = 'yia-lang'

// Langue au chargement : ?lang= dans l'adresse (liens de démo du portfolio anglais),
// sinon le dernier choix de ce navigateur, sinon le français.
function initialLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (fromUrl === 'fr' || fromUrl === 'en') return fromUrl
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

export default function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang)

  // À chaque changement : attribut lang de la page (lecteurs d'écran, api.js) et choix mémorisé.
  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Stockage indisponible (navigation privée) : la langue vaut pour cette visite seulement.
    }
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}
