// Accueil du recruteur : les trois postes les plus répondus, puis les trois postes
// dont un candidat attend une réponse depuis plus de deux semaines.
import { Link } from 'react-router'
import { postesLesPlusRepondus, postesSansReponse } from '../recruiterSelection.js'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Date du serveur (UTC, « AAAA-MM-JJ HH:MM:SS ») affichée dans la langue choisie, comme dans RecruiterApplicationsPage.jsx.
function formatDate(value, locale) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RecruiterPage() {
  const { t, locale } = useLang()
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
      <h1>{t('Espace recruteur', 'Recruiter area')}</h1>
      {loadError && <p>{t('Impossible de charger vos postes pour le moment.', 'Unable to load your positions right now.')}</p>}

      {/* Deux colonnes côte à côte, chacune avec ses cartes de postes empilées ; les titres partagent
          la même ligne de grille (recruiter.css) : les cartes commencent à la même hauteur. */}
      <div className="recruiter-overview">
        <section>
          <h2>{t('Postes les plus sollicités', 'Most popular positions')}</h2>
          {plusRepondus.length === 0 ? (
            <p>{t('Aucune candidature pour le moment.', 'No applications yet.')}</p>
          ) : (
            <ul className="overview-list">
              {plusRepondus.map((poste) => (
                <li key={poste.id} className="overview-card">
                  {/* Toute la carte mène aux candidatures du poste (retenir ou refuser). */}
                  <Link to={`/recruteur/postes/${poste.id}/candidatures`}>
                    <strong title={poste.title}>{poste.title}</strong>
                    {/* Pluriel français dès 2 ; en anglais, singulier pour 1 seulement (0 applications, 1 application). */}
                    <span>{t(
                      `${poste.applications_count} candidature${poste.applications_count > 1 ? 's' : ''}`,
                      `${poste.applications_count} application${poste.applications_count === 1 ? '' : 's'}`,
                    )}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>{t('Candidats sans réponse depuis plus de deux semaines', 'Candidates without a reply for over two weeks')}</h2>
          {sansReponse.length === 0 ? (
            <p>{t("Aucun candidat n'attend de réponse depuis plus de deux semaines.", 'No candidate has been waiting for a reply for over two weeks.')}</p>
          ) : (
            <ul className="overview-list">
              {sansReponse.map((poste) => (
                <li key={poste.id} className="overview-card">
                  <Link to={`/recruteur/postes/${poste.id}/candidatures`}>
                    <strong title={poste.title}>{poste.title}</strong>
                    <span>{t('En attente depuis le', 'Pending since')} {formatDate(poste.oldest_unanswered_at, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p><Link to="/recruteur/postes">{t('Voir tous mes postes', 'See all my positions')}</Link></p>
    </>
  )
}
