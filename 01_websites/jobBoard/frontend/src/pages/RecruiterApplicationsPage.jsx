// Applications received for a recruiter's job offer (GET /api/recruiter/ads/<id>/applications), with their CV,
// closing of the job offer (POST /api/recruiter/ads/<id>/closure)
// and rejection of a single candidate (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// "2026-10-08 18:15:02" (UTC, as returned by SQLite) -> "8 octobre 2026" (or "8 October 2026" with the en-GB locale)
function formatDate(value, locale) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

// API statuses translated for the screen.
const STATUS_LABELS = {
  pending: { fr: 'En attente', en: 'Pending' },
  accepted: { fr: 'Retenue', en: 'Accepted' },
  rejected: { fr: 'Non retenue', en: 'Rejected' },
}

// Closure refusals translated for the screen (messages of the contract).
const CLOSURE_ERRORS = {
  'Ad already closed': { fr: 'Cette annonce est déjà clôturée.', en: 'This job offer is already closed.' },
  'Application does not belong to this ad': { fr: 'Cette candidature ne correspond pas à l\'annonce. Rechargez la page.', en: 'This application does not match the job offer. Reload the page.' },
}

const CLOSURE_CONFIRM = {
  fr: 'Clôturer l\'annonce ? Chaque candidat recevra un e-mail, et l\'annonce ne pourra plus être modifiée.',
  en: 'Close the job offer? Each candidate will receive an email, and the job offer can no longer be edited.',
}

// Rejection of a single application (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
const REJECTION_ERRORS = {
  'Ad already closed': { fr: 'Cette annonce est déjà clôturée.', en: 'This job offer is already closed.' },
  'Application not found': { fr: 'Cette candidature n\'existe plus. Rechargez la page.', en: 'This application no longer exists. Reload the page.' },
  'Application already processed': { fr: 'Cette candidature a déjà reçu une réponse.', en: 'This application has already received a reply.' },
}

export default function RecruiterApplicationsPage() {
  const { t, lang, locale } = useLang()
  // id of the job offer, read from the URL /recruteur/postes/:id/candidatures.
  const { id } = useParams()
  const [applications, setApplications] = useState([])
  // null while nothing has failed, otherwise 'not-found' (404 Ad not found) or 'other'.
  const [loadError, setLoadError] = useState(null)
  // Status of the job offer ('open' or 'closed'), read with GET /api/ads/<id>; null while unknown.
  const [adStatus, setAdStatus] = useState(null)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  // Incremented after a successful closure: restarts the loading of the list and of the status.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function fetchApplications() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads/' + id + '/applications')
      if (ok) {
        setApplications(data)
        setLoadError(null)
      } else {
        // Only the 404 of the contract means an unknown job offer or one from another company.
        setLoadError(status === 404 && error === 'Ad not found' ? 'not-found' : 'other')
        console.error('Error fetching recruiter applications:', status, error)
      }

      // GET /api/ads/<id> returns status, including for a closed job offer.
      const ad = await apiFetch('/api/ads/' + id)
      setAdStatus(ad.ok ? ad.data.status : null)
    }
    fetchApplications()
  }, [id, reloadKey])

  // acceptedId: accepted application (button "Accept this candidate"),
  // or null to close without accepting anybody (button "Close the job offer"): all the applications are rejected.
  async function handleClose(acceptedId) {
    setCloseError('')

    if (!window.confirm(CLOSURE_CONFIRM[lang])) return

    // Without an accepted candidate, the API expects an empty body; otherwise, the accepted application.
    const body = acceptedId === null ? {} : { accepted_application_id: acceptedId }

    setClosing(true)
    const { ok, status, error } = await apiFetch('/api/recruiter/ads/' + id + '/closure', { method: 'POST', body })
    setClosing(false)

    if (ok) {
      // Reload: the statuses become "Accepted" and "Rejected", the buttons disappear.
      setReloadKey((key) => key + 1)
      return
    }

    setCloseError(CLOSURE_ERRORS[error]?.[lang] ?? t('Impossible de clôturer l\'annonce pour le moment.', 'Unable to close the job offer right now.'))
    console.error('Closure refused:', status, error)
  }

  // Rejects a single candidate: the job offer stays open, the candidate receives the "rejected" email.
  async function handleReject(application) {
    setCloseError('')

    if (!window.confirm(t(
      `Refuser la candidature de ${application.first_name} ${application.last_name} ? Le candidat recevra un e-mail.`,
      `Reject the application from ${application.first_name} ${application.last_name}? The candidate will receive an email.`,
    ))) return

    setClosing(true)
    const { ok, status, data, error } = await apiFetch(
      '/api/recruiter/ads/' + id + '/applications/' + application.id + '/rejection',
      { method: 'POST' },
    )
    setClosing(false)

    if (ok) {
      // The API returns the updated application: only this row changes.
      setApplications((list) => list.map((item) => (item.id === data.id ? data : item)))
      return
    }

    setCloseError(REJECTION_ERRORS[error]?.[lang] ?? t('Impossible de refuser cette candidature pour le moment.', 'Unable to reject this application right now.'))
    console.error('Rejection refused:', status, error)
  }

  // Closing is offered only for a job offer of the company, loaded without error, still open.
  const canClose = loadError === null && adStatus === 'open'

  return (
    <section>
      {/* Back arrow to "My positions", always visible, even when the job offer is not found.
          Arrow alone (button-link): aria-label and title give the destination. */}
      <p className="back-link">
        <Link className="button-link" to="/recruteur/postes" aria-label={t('Retour à Mes postes', 'Back to My positions')} title={t('Retour à Mes postes', 'Back to My positions')}>←</Link>
      </p>
      <h1>{t('Candidatures reçues', 'Applications received')}</h1>

      {loadError === 'not-found' ? (
        <p>{t("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.", 'This job offer does not exist or does not belong to your company.')}</p>
      ) : loadError === 'other' ? (
        <p>{t('Impossible de charger les candidatures pour le moment.', 'Unable to load the applications right now.')}</p>
      ) : applications.length === 0 ? (
        <p>{t('Aucune candidature pour cette annonce pour le moment.', 'No applications for this job offer yet.')}</p>
      ) : (
        // Table like in administration, in the .table-scroll frame (admin.css); styles in recruiter.css.
        <div className="table-scroll" role="region" aria-label={t('Candidatures reçues', 'Applications received')} tabIndex={0}>
          <table className="applications-table">
            <thead>
              <tr>
                <th>{t('Nom', 'Name')}</th>
                <th>{t('E-mail', 'Email')}</th>
                <th>{t('Téléphone', 'Phone number')}</th>
                <th>{t('Message', 'Message')}</th>
                <th>CV</th>
                <th>{t('Envoyée le', 'Sent on')}</th>
                <th>{t('Statut', 'Status')}</th>
                {canClose && <th className="col-actions"><span className="visually-hidden">{t('Actions', 'Actions')}</span></th>}
              </tr>
            </thead>
            <tbody>
              {/* API order kept: from the oldest to the most recent. */}
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.first_name} {application.last_name}</td>
                  <td><a href={`mailto:${application.email}`}>{application.email}</a></td>
                  <td>{application.phone ?? '—'}</td>
                  {/* Message cut to one line; the whole text shows on hover. */}
                  <td className="cell-clip" title={application.message}>{application.message}</td>
                  {/* The PDF is downloaded directly from the API (same origin thanks to the proxy, cookie included). */}
                  <td>
                    {application.has_cv ? (
                      <a href={`/api/recruiter/ads/${id}/applications/${application.id}/cv`} download>{t('Télécharger', 'Download')}</a>
                    ) : '—'}
                  </td>
                  <td>{formatDate(application.created_at, locale)}</td>
                  <td>{STATUS_LABELS[application.status]?.[lang] ?? application.status}</td>
                  {/* Job offer open, application pending: "Accept this candidate" closes the job offer by accepting them
                      (blue, positive action), "Reject" rejects only them (red). Column stuck to the right (recruiter.css). */}
                  {canClose && (
                    <td className="col-actions">
                      {application.status === 'pending' && (
                        <div className="row-actions">
                          <button type="button" disabled={closing} onClick={() => handleClose(application.id)}>
                            {t('Retenir ce candidat', 'Accept this candidate')}
                          </button>
                          <button className="button-danger" type="button" disabled={closing} onClick={() => handleReject(application)}>
                            {t('Refuser', 'Reject')}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Closing without an accepted candidate, with or without applications: all the applications are rejected.
          Red (button-danger, like "Delete" in administration): definitive action. */}
      {canClose && (
        <button className="button-danger" type="button" disabled={closing} onClick={() => handleClose(null)}>
          {t("Clôturer l'annonce", 'Close the job offer')}
        </button>
      )}
      {closeError && <p role="alert">{closeError}</p>}
    </section>
  )
}
