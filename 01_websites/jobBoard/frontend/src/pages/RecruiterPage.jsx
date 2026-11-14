// Recruiter home: the three most popular positions, then the three positions
// where a candidate has been waiting for a reply for more than two weeks.
import { Link } from 'react-router'
import { getMostAppliedPositions, getPositionsWithoutReply } from '../recruiterSelection.js'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Server date (UTC, "YYYY-MM-DD HH:MM:SS") displayed in the chosen language, as in RecruiterApplicationsPage.jsx.
function formatDate(value, locale) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RecruiterPage() {
  const { t, locale } = useLang()
  // Job offers of the logged-in recruiter's company (the server reads it from the session).
  const [positions, setPositions] = useState([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    async function fetchPositions() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads')
      if (ok) {
        setPositions(data)
      } else {
        // 401 and 403 are handled by RecruiterLayout; here, a general message.
        setLoadError(true)
        console.error('Error fetching recruiter ads:', status, error)
      }
    }
    fetchPositions()
  }, [])

  const mostApplied = getMostAppliedPositions(positions)
  const withoutReply = getPositionsWithoutReply(positions)

  return (
    <>
      <h1>{t('Espace recruteur', 'Recruiter area')}</h1>
      {loadError && <p>{t('Impossible de charger vos postes pour le moment.', 'Unable to load your positions right now.')}</p>}

      {/* Two columns side by side, each with its stacked position cards; the titles share
          the same grid row (recruiter.css): the cards start at the same height. */}
      <div className="recruiter-overview">
        <section>
          <h2>{t('Postes les plus sollicités', 'Most popular positions')}</h2>
          {mostApplied.length === 0 ? (
            <p>{t('Aucune candidature pour le moment.', 'No applications yet.')}</p>
          ) : (
            <ul className="overview-list">
              {mostApplied.map((position) => (
                <li key={position.id} className="overview-card">
                  {/* The whole card leads to the position's applications (accept or reject). */}
                  <Link to={`/recruteur/postes/${position.id}/candidatures`}>
                    <strong title={position.title}>{position.title}</strong>
                    {/* French plural from 2; in English, singular for 1 only (0 applications, 1 application). */}
                    <span>{t(
                      `${position.applications_count} candidature${position.applications_count > 1 ? 's' : ''}`,
                      `${position.applications_count} application${position.applications_count === 1 ? '' : 's'}`,
                    )}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>{t('Candidats sans réponse depuis plus de deux semaines', 'Candidates without a reply for over two weeks')}</h2>
          {withoutReply.length === 0 ? (
            <p>{t("Aucun candidat n'attend de réponse depuis plus de deux semaines.", 'No candidate has been waiting for a reply for over two weeks.')}</p>
          ) : (
            <ul className="overview-list">
              {withoutReply.map((position) => (
                <li key={position.id} className="overview-card">
                  <Link to={`/recruteur/postes/${position.id}/candidatures`}>
                    <strong title={position.title}>{position.title}</strong>
                    <span>{t('En attente depuis le', 'Pending since')} {formatDate(position.oldest_unanswered_at, locale)}</span>
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
