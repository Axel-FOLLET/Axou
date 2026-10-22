// Accueil du recruteur : les trois postes les plus répondus, puis les trois postes
// dont un candidat attend une réponse depuis plus de deux semaines.
import { Link } from 'react-router'
import { postesLesPlusRepondus, postesSansReponse } from '../recruiterSelection.js'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

// Date du serveur (UTC, « AAAA-MM-JJ HH:MM:SS ») affichée en français, comme dans RecruiterApplicationsPage.jsx.
function formatDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RecruiterPage() {
  // Annonces de l'entreprise du recruteur connecté (le serveur la lit dans la session).
  const [postes, setPostes] = useState([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    async function fetchPostes() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads')
      if (ok) {
        setPostes(data)
      } else {
        // 401 et 403 sont gérés par RecruiterLayout ; ici, un message général.
        setLoadError(true)
        console.error('Error fetching recruiter ads:', status, error)
      }
    }
    fetchPostes()
  }, [])

  const plusRepondus = postesLesPlusRepondus(postes)
  const sansReponse = postesSansReponse(postes)

  return (
    <>
      <h1>Espace recruteur</h1>
      {loadError && <p>Impossible de charger vos postes pour le moment.</p>}

      {/* Deux colonnes côte à côte, chacune avec ses cartes de postes empilées ; les titres partagent
          la même ligne de grille (recruiter.css) : les cartes commencent à la même hauteur. */}
      <div className="recruiter-overview">
        <section>
          <h2>Postes les plus sollicités</h2>
          {plusRepondus.length === 0 ? (
            <p>Aucune candidature pour le moment.</p>
          ) : (
            <ul className="overview-list">
              {plusRepondus.map((poste) => (
                <li key={poste.id} className="overview-card">
                  {/* Toute la carte mène aux candidatures du poste (retenir ou refuser). */}
                  <Link to={`/recruteur/postes/${poste.id}/candidatures`}>
                    <strong title={poste.title}>{poste.title}</strong>
                    <span>{poste.applications_count} candidature{poste.applications_count > 1 ? 's' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Candidats sans réponse depuis plus de deux semaines</h2>
          {sansReponse.length === 0 ? (
            <p>Aucun candidat n'attend de réponse depuis plus de deux semaines.</p>
          ) : (
            <ul className="overview-list">
              {sansReponse.map((poste) => (
                <li key={poste.id} className="overview-card">
                  <Link to={`/recruteur/postes/${poste.id}/candidatures`}>
                    <strong title={poste.title}>{poste.title}</strong>
                    <span>En attente depuis le {formatDate(poste.oldest_unanswered_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p><Link to="/recruteur/postes">Voir tous mes postes</Link></p>
    </>
  )
}
