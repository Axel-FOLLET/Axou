// Page d'accueil : le titre, puis la barre de recherche d'emploi avec les deux offres les plus récentes à sa droite.
import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { apiFetch } from '../api.js'
import SearchBar from '../components/SearchBar.jsx'

export default function HomePage() {
  // Les deux offres les plus récentes : la liste reste vide tant que l'appel n'a pas répondu.
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Une seule fois, au chargement : per_page=2 suffit, l'API trie déjà de la plus récente à la plus ancienne.
  useEffect(() => {
    async function loadRecent() {
      try {
        const { ok, data, error: apiError } = await apiFetch('/api/ads?page=1&per_page=2')
        if (!ok) {
          throw new Error(apiError)
        }
        setRecent(data)
      } catch (err) {
        // Détail technique dans la console, message lisible pour le visiteur.
        console.error(err)
        setError('Offres récentes indisponibles pour le moment.')
      } finally {
        setLoading(false)
      }
    }
    loadRecent()
  }, [])

  return (
    <div className="page">
      {/* Titre seul, précédé d'un grand vide : un seul message à la fois. */}
      <h1 className="home-title">
        Votre carrière,
        <br />
        traitée avec soin.
      </h1>

      {/* Sans encadré : la recherche à gauche, les deux offres récentes à droite, en liste discrète. */}
      <div className="home-row">
        {/* La recherche et ses filtres ouvrent la page des offres (components/SearchBar.jsx). */}
        <SearchBar />

        <section className="recent-offers" aria-labelledby="recent-offers-title">
          <h2 id="recent-offers-title">Récemment publiées</h2>
          {loading && <p>Chargement…</p>}
          {error && <p>{error}</p>}
          {/* Aucune annonce ouverte : on renvoie vers la liste plutôt que d'afficher une case vide. */}
          {!loading && !error && recent.length === 0 && (
            <p>Aucune offre pour le moment.</p>
          )}
          {/* Chaque ligne ouvre la page des offres filtrée sur ce titre (q cherche dans le titre). */}
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
          <Link className="recent-offers-all" to="/offres">Toutes les offres</Link>
        </section>
      </div>
    </div>
  )
}
