import JobOffer from '../components/AddJobOffer.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Address filters passed as is to the API (docs/contrat_api.md, filters of GET /api/ads).
const API_FILTERS = ['q', 'contract_type', 'location']

// A job offer published less than NEW_DAYS days ago shows the "New" badge and passes the new-offers filter.
const NEW_DAYS = 7

// created_at from the API ("2026-10-08 18:15:02", UTC) -> true if the job offer is less than NEW_DAYS days old.
function isNewOffer(createdAt, now) {
  // Difference in milliseconds, converted to days (1000 ms × 60 s × 60 min × 24 h).
  const ageInDays = (now - new Date(createdAt.replace(' ', 'T') + 'Z')) / (1000 * 60 * 60 * 24)
  return ageInDays < NEW_DAYS
}

// Lists the published job offers, fetched from /api/ads.
export default function JobBoardPage() {
  const { t } = useLang()
  // Empty list at the start, then filled by the network call below.
  const [offers, setOffers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // "New job offers only" checkbox: filtering is done here, on the list already received.
  const [onlyNew, setOnlyNew] = useState(false)
  // Time read once, at the first render: a React render must always give the same result.
  const [now] = useState(() => Date.now())
  // ?q=…&contract_type=…&location=… come from the search bar (home or this page).
  const [searchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const apiParams = new URLSearchParams()
  for (const name of API_FILTERS) {
    const value = searchParams.get(name)
    if (value) apiParams.set(name, value)
  }
  // Plain text ("q=dev&location=Paris"): the effect only restarts if it changes.
  const apiQuery = apiParams.toString()
  // "Minimum salary" from the bar's menu (?min_salary=…), filtered here like the new-offers checkbox;
  // 0: all salaries. A job offer without a salary (salary at null) is hidden as soon as a minimum is chosen.
  const minSalary = Number(searchParams.get('min_salary')) || 0
  const shownOffers = offers
    .filter((offer) => !onlyNew || isNewOffer(offer.created_at, now))
    .filter((offer) => minSalary === 0 || (offer.salary !== null && offer.salary >= minSalary))

  // On every change of search or filter: ask the API for the list again.
  useEffect(() => {
    async function loadOffers() {
      setLoading(true)
      setError(null)
      try {
        const path = apiQuery === '' ? '/api/ads' : `/api/ads?${apiQuery}`
        const { ok, data, error: apiError } = await apiFetch(path)
        if (!ok) {
          throw new Error(apiError)
        }
        setOffers(data)
      } catch (err) {
        // Technical detail for us in the console (F12), readable message for the visitor.
        console.error(err)
        // The message is translated at display time, in the current language.
        setError(true)
      } finally {
        // In all cases: leave the "loading" state.
        setLoading(false)
      }
    }
    loadOffers()
  }, [apiQuery])

  return (
    <div className="page offers-page">
      {/* Ordinary page title, smaller than the home one: the results move up. */}
      <h1>{t("Offres d'emploi", 'Job offers')}</h1>

      {/* key: the bar is recreated when the address changes (min_salary included), so its fields take back the displayed search. */}
      <SearchBar key={searchParams.toString()} />

      <label className="new-filter">
        <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
        {t('Nouvelles annonces uniquement', 'New job offers only')}
      </label>

      {/* Three possible displays, in this order: loading, error, then the list. The bar stays visible. */}
      {loading && <p>{t('Chargement…', 'Loading…')}</p>}
      {!loading && error && <p>{t("Nous n'arrivons pas à charger les offres pour le moment. Merci de réessayer dans quelques instants.", 'We cannot load the job offers at the moment. Please try again in a few moments.')}</p>}
      {!loading && !error && (
        <>
          {/* Search or filters in progress: recall the searched text and the number of results. */}
          {(apiQuery !== '' || onlyNew || minSalary !== 0) && shownOffers.length > 0 && (
            <p className="results-count">
              {shownOffers.length} {t(`offre${shownOffers.length > 1 ? 's' : ''}`, `job offer${shownOffers.length > 1 ? 's' : ''}`)}
              {search !== '' ? t(` pour « ${search} »`, ` for "${search}"`) : t(' pour ces filtres', ' for these filters')}
            </p>
          )}
          {shownOffers.length === 0 && <p>{t('Aucune offre ne correspond à cette recherche.', 'No job offers match this search.')}</p>}
          {/* One card per job offer; key is for React only, hence id in addition. */}
          <div className="offers-grid">
            {shownOffers.map((offer) => (
              <JobOffer
                key={offer.id}
                id={offer.id}
                company={offer.company}
                title={offer.title}
                shortDescription={offer.short_description}
                location={offer.location}
                contractType={offer.contract_type}
                isNew={isNewOffer(offer.created_at, now)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
