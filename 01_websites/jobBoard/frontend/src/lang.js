// useLang() : la langue courante, de quoi la changer, et t(fr, en) qui renvoie le texte de la langue choisie.
// locale sert au formatage des dates et des nombres (toLocaleDateString, Intl...).
import { useContext } from 'react'
import { LangContext } from './LangContext'

export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  const t = (fr, en) => (lang === 'en' ? en : fr)
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  return { lang, setLang, t, locale }
}

// Types de contrat et temps de travail des annonces : des données saisies en français.
// En anglais, on traduit à l'affichage les valeurs connues ; une autre valeur s'affiche telle quelle.
// La valeur envoyée à l'API (filtres, formulaires) ne change pas.
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
