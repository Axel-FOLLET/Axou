// useLang(): the current language, a way to change it, and t(fr, en), which returns the text of the chosen language.
// locale is used to format dates and numbers (toLocaleDateString, Intl...).
import { useContext } from 'react'
import { LangContext } from './LangContext'

export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  const t = (fr, en) => (lang === 'en' ? en : fr)
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  return { lang, setLang, t, locale }
}

// Contract types and working time of job offers: data entered in French.
// In English, the known values are translated at display time; any other value is shown as is.
// The value sent to the API (filters, forms) does not change.
const DATA_LABELS_EN = {
  CDI: 'Permanent',
  CDD: 'Fixed-term',
  Stage: 'Internship',
  Alternance: 'Work-study',
  Freelance: 'Freelance',
  Intérim: 'Temporary',
  'Temps plein': 'Full-time',
  'Temps partiel': 'Part-time',
}

export function dataLabel(value, lang) {
  return lang === 'en' ? DATA_LABELS_EN[value] ?? value : value
}
