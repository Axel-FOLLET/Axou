// Card of a job offer: summary always visible, details and application on demand.
import { useState } from 'react'
import Form from './Form'
import { apiFetch } from '../api.js'
import { useLang, dataLabel } from '../lang.js'

// "2026-10-08 18:15:02" (UTC, as returned by SQLite) -> "8 October 2026", as in ApplicationsPage.jsx.
function formatDate(value, locale) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function JobOffer({ id, company, title, shortDescription, location, contractType, isNew }) {
  const { t, lang, locale } = useLang()
  // Details and form closed at the start.
  const [showDetails, setShowDetails] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // details at null = the details have not been requested from the API yet.
  const [details, setDetails] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const willOpen = !showDetails
    // Toggle open/closed right away, without waiting for the server.
    setShowDetails(willOpen)
    // Network call only when opening, if the details are neither already received nor in progress.
    if (willOpen && details === null && !loading) {
      setLoading(true)
      setError(null)
      try {
        const { ok, data, error: apiError } = await apiFetch(`/api/ads/${id}`)
        if (!ok) {
          throw new Error(apiError)
        }
        setDetails(data)
      } catch (err) {
        // Technical detail in the console, readable message for the visitor.
        console.error(err)
        setError(t("Nous n'arrivons pas à charger les détails pour le moment. Merci de réessayer dans quelques instants.", 'We cannot load the details at the moment. Please try again in a few moments.'))
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="job-offer">
      {/* The position is the card title; the company, above it, as a small line.
          The title is a button: it opens and closes the details, which avoids a second button per card. */}
      {/* Badge at the top right of the card, out of the flow: it shifts no text (isNew computed by JobBoardPage). */}
      {isNew && <span className="badge-new">{t('Nouveau', 'New')}</span>}
      <p className="offer-company">{company}</p>
      <h2>
        <button type="button" className="offer-title" aria-expanded={showDetails} onClick={handleClick}>{title}</button>
      </h2>
      <p>{shortDescription}</p>
      {/* Location and contract on one line of text, separated by a middle dot; absent if not provided. */}
      {(location || contractType) && (
        <p className="offer-meta">{[location, dataLabel(contractType, lang)].filter(Boolean).join(' · ')}</p>
      )}
      {/* A single action per card: applying. */}
      <div className="offer-actions">
        <button onClick={() => setShowForm(!showForm)}>{showForm ? t('Annuler', 'Cancel') : t('Postuler', 'Apply')}</button>
      </div>
      {showForm && <Form id={id} onClose={() => setShowForm(false)} />}
      {showDetails && loading && <p>{t('Chargement des informations complémentaires…', 'Loading further details…')}</p>}
      {showDetails && error && <p>{error}</p>}
      {/* Open AND received: otherwise details.description would crash on null. */}
      {showDetails && details && (
        <div className="offer-details">
          <p className="description">{details.description}</p>
          {/* Space before €, following French usage. The contract is already shown in the pills. */}
          <p>{details.salary ? t(`Salaire : ${details.salary.toLocaleString(locale)} € brut par an`, `Salary: €${details.salary.toLocaleString(locale)} gross per year`) : t('Salaire non communiqué', 'Salary not disclosed')}</p>
          {details.working_time && <p>{t('Temps de travail : ', 'Working time: ')}{dataLabel(details.working_time, lang)}</p>}
          {details.category && <p>{t('Catégorie : ', 'Category: ')}{details.category}</p>}
          <p>{t('Publiée le ', 'Published on ')}{formatDate(details.created_at, locale)}</p>
        </div>
      )}
    </div>
  )
}
