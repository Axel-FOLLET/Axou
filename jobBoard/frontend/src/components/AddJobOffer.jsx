// Carte d'une annonce : résumé toujours visible, détail et candidature à la demande.
import { useState } from 'react'
import Form from './Form'
import { apiFetch } from '../api.js'

// "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> "8 octobre 2026", comme dans ApplicationsPage.jsx.
function formatDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function JobOffer({ id, company, title, shortDescription, location, contractType, isNew }) {
  // Détail et formulaire fermés au départ.
  const [showDetails, setShowDetails] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // details à null = le détail n'a pas encore été demandé à l'API.
  const [details, setDetails] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const willOpen = !showDetails
    // Ouvert ↔ fermé tout de suite, sans attendre le serveur.
    setShowDetails(willOpen)
    // Appel réseau seulement à l'ouverture, si le détail n'est ni déjà reçu ni en cours.
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
        // Détail technique dans la console, message lisible pour le visiteur.
        console.error(err)
        setError("Nous n'arrivons pas à charger les détails pour le moment. Merci de réessayer dans quelques instants.")
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="job-offer">
      {/* Le poste est le titre de la carte ; l'entreprise, au-dessus, en petite ligne.
          Le titre est un bouton : il ouvre et referme le détail, ce qui évite un deuxième bouton par carte. */}
      {/* Badge en haut à droite de la carte, hors du flux : il ne décale aucun texte (isNew calculé par JobBoardPage). */}
      {isNew && <span className="badge-new">Nouveau</span>}
      <p className="offer-company">{company}</p>
      <h2>
        <button type="button" className="offer-title" aria-expanded={showDetails} onClick={handleClick}>{title}</button>
      </h2>
      <p>{shortDescription}</p>
      {/* Lieu et contrat sur une ligne de texte, séparés par un point médian ; absents s'ils ne sont pas renseignés. */}
      {(location || contractType) && (
        <p className="offer-meta">{[location, contractType].filter(Boolean).join(' · ')}</p>
      )}
      {/* Une seule action par carte : la candidature. */}
      <div className="offer-actions">
        <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Annuler' : 'Postuler'}</button>
      </div>
      {showForm && <Form id={id} onClose={() => setShowForm(false)} />}
      {showDetails && loading && <p>Chargement des informations complémentaires…</p>}
      {showDetails && error && <p>{error}</p>}
      {/* Ouvert ET reçu : sinon details.description planterait sur null. */}
      {showDetails && details && (
        <div className="offer-details">
          <p className="description">{details.description}</p>
          {/* Espace avant €, selon l'usage français. Le contrat figure déjà dans les pastilles. */}
          <p>{details.salary ? `Salaire : ${details.salary.toLocaleString('fr-FR')} € brut par an` : 'Salaire non communiqué'}</p>
          {details.working_time && <p>Temps de travail : {details.working_time}</p>}
          {details.category && <p>Catégorie : {details.category}</p>}
          <p>Publiée le {formatDate(details.created_at)}</p>
        </div>
      )}
    </div>
  )
}
