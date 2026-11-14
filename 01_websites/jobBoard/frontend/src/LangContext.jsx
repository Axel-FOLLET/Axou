// The language context alone, in its own file (like AuthContext): LangProvider fills it,
// the pages read it through useLang() (lang.js).
import { createContext } from 'react'

// French by default: the value received by a component that reads the context outside the Provider.
export const LangContext = createContext({ lang: 'fr', setLang: () => {} })
