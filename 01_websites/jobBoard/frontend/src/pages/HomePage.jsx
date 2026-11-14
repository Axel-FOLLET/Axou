// Home page: the title, then the job search bar with the two most recent offers on its right.
import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { apiFetch } from '../api.js'
import SearchBar from '../components/SearchBar.jsx'
import { useLang } from '../lang.js'

export default function HomePage() {
  const { t } = useLang()
  // The two most recent offers: the list stays empty until the call has answered.
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Once, at load: per_page=2 is enough, the API already sorts from the most recent to the oldest.
  useEffect(() => {
    async function loadRecent() {
      try {
        const { ok, data, error: apiError } = await apiFetch('/api/ads?page=1&per_page=2')
        if (!ok) {
          throw new Error(apiError)
        }
        setRecent(data)
      } catch (err) {
        // Technical detail in the console, readable message for the visitor.
        console.error(err)
        // The message is translated at display time, in the current language.
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadRecent()
  }, [])

  return (
    <div className="page">
      {/* Title alone, preceded by a large empty space: one message at a time. */}
      <h1 className="home-title">
        {t('Votre carrière,', 'Your career,')}
        <br />
        {t('traitée avec soin.', 'handled with care.')}
      </h1>

      {/* No frame: search on the left, the two recent offers on the right, as a discreet list. */}
      <div className="home-row">
        {/* The search and its filters open the offers page (components/SearchBar.jsx). */}
        <SearchBar />

        <section className="recent-offers" aria-labelledby="recent-offers-title">
          <h2 id="recent-offers-title">{t('Récemment publiées', 'Recently published')}</h2>
          {loading && <p>{t('Chargement…', 'Loading…')}</p>}
          {error && <p>{t('Offres récentes indisponibles pour le moment.', 'Recent job offers are unavailable at the moment.')}</p>}
          {/* No open job offer: point to the list rather than showing an empty box. */}
          {!loading && !error && recent.length === 0 && (
            <p>{t('Aucune offre pour le moment.', 'No job offers at the moment.')}</p>
          )}
          {/* Each line opens the offers page filtered on this title (q searches in the title). */}
          <ul>
            {recent.map((offer) => (
              <li key={offer.id}>
                <Link to={`/offres?q=${encodeURIComponent(offer.title)}`}>
                  <span className="recent-offer-title">{offer.title}</span>
                  <span className="recent-offer-meta">{[offer.company, offer.location].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="recent-offers-all" to="/offres">{t('Toutes les offres', 'All job offers')}</Link>
        </section>
      </div>
    </div>
  )
}
