// Provides the interface language (fr or en) to the whole application.
import { useEffect, useState } from 'react'
import { LangContext } from './LangContext'

const STORAGE_KEY = 'yia-lang'

// Language at load: ?lang= in the address (demo links from the English portfolio),
// otherwise this browser's last choice, otherwise French.
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

  // On every change: the page's lang attribute (screen readers, api.js) and the remembered choice.
  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Storage unavailable (private browsing): the language only applies to this visit.
    }
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}
