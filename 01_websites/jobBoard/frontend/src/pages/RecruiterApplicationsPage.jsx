// Candidatures reçues pour une annonce du recruteur (GET /api/recruiter/ads/<id>/applications), avec leur CV,
// clôture de l'annonce (POST /api/recruiter/ads/<id>/closure)
// et refus d'un seul candidat (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> "8 octobre 2026" (ou "8 October 2026" avec locale en-GB)
function formatDate(value, locale) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

// Statuts de l'API traduits pour l'écran.
const STATUS_LABELS = {
  pending: { fr: 'En attente', en: 'Pending' },
  accepted: { fr: 'Retenue', en: 'Accepted' },
  rejected: { fr: 'Non retenue', en: 'Rejected' },
}

// Refus de la clôture traduits pour l'écran (messages du contrat).
const CLOSURE_ERRORS = {
  'Ad already closed': { fr: 'Cette annonce est déjà clôturée.', en: 'This job offer is already closed.' },
  'Application does not belong to this ad': { fr: 'Cette candidature ne correspond pas à l\'annonce. Rechargez la page.', en: 'This application does not match the job offer. Reload the page.' },
}

const CLOSURE_CONFIRM = {
  fr: 'Clôturer l\'annonce ? Chaque candidat recevra un e-mail, et l\'annonce ne pourra plus être modifiée.',
  en: 'Close the job offer? Each candidate will receive an email, and the job offer can no longer be edited.',
}

// Refus d'une seule candidature (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
const REJECTION_ERRORS = {
  'Ad already closed': { fr: 'Cette annonce est déjà clôturée.', en: 'This job offer is already closed.' },
  'Application not found': { fr: 'Cette candidature n\'existe plus. Rechargez la page.', en: 'This application no longer exists. Reload the page.' },
  'Application already processed': { fr: 'Cette candidature a déjà reçu une réponse.', en: 'This application has already received a reply.' },
}

export default function RecruiterApplicationsPage() {
  const { t, lang, locale } = useLang()
  // id de l'annonce, lu dans l'URL /recruteur/postes/:id/candidatures.
  const { id } = useParams()
  const [applications, setApplications] = useState([])
  // null tant que rien n'a échoué, sinon 'not-found' (404 Ad not found) ou 'other'.
  const [loadError, setLoadError] = useState(null)
  // Statut de l'annonce ('open' ou 'closed'), lu avec GET /api/ads/<id> ; null tant qu'il est inconnu.
  const [adStatus, setAdStatus] = useState(null)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  // Augmenté après une clôture réussie : relance le chargement de la liste et du statut.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function fetchApplications() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads/' + id + '/applications')
      if (ok) {
        setApplications(data)
        setLoadError(null)
      } else {
        // Seul le 404 du contrat désigne une annonce inconnue ou d'une autre entreprise.
        setLoadError(status === 404 && error === 'Ad not found' ? 'not-found' : 'other')
        console.error('Error fetching recruiter applications:', status, error)
      }

      // GET /api/ads/<id> renvoie status, y compris pour une annonce fermée.
      const ad = await apiFetch('/api/ads/' + id)
      setAdStatus(ad.ok ? ad.data.status : null)
    }
    fetchApplications()
  }, [id, reloadKey])

  // acceptedId : candidature retenue (bouton « Retenir ce candidat »),
  // ou null pour clôturer sans retenir personne (bouton « Clôturer l'annonce ») : toutes les candidatures sont refusées.
  async function handleClose(acceptedId) {
    setCloseError('')

    if (!window.confirm(CLOSURE_CONFIRM[lang])) return

    // Sans candidat retenu, l'API attend un corps vide ; sinon, la candidature retenue.
    const body = acceptedId === null ? {} : { accepted_application_id: acceptedId }

    setClosing(true)
    const { ok, status, error } = await apiFetch('/api/recruiter/ads/' + id + '/closure', { method: 'POST', body })
    setClosing(false)

    if (ok) {
      // Recharger : les statuts passent à « Retenue » et « Non retenue », les boutons disparaissent.
      setReloadKey((key) => key + 1)
      return
    }

    setCloseError(CLOSURE_ERRORS[error]?.[lang] ?? t('Impossible de clôturer l\'annonce pour le moment.', 'Unable to close the job offer right now.'))
    console.error('Closure refused:', status, error)
  }

  // Refuse un seul candidat : l'annonce reste ouverte, le candidat reçoit l'e-mail « non retenu ».
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
      // L'API renvoie la candidature à jour : seule cette ligne change.
      setApplications((list) => list.map((item) => (item.id === data.id ? data : item)))
      return
    }

    setCloseError(REJECTION_ERRORS[error]?.[lang] ?? t('Impossible de refuser cette candidature pour le moment.', 'Unable to reject this application right now.'))
    console.error('Rejection refused:', status, error)
  }

  // La clôture n'est proposée que pour une annonce de l'entreprise, chargée sans erreur, encore ouverte.
  const canClose = loadError === null && adStatus === 'open'

  return (
    <section>
      {/* Bouton flèche de retour vers « Mes postes », toujours visible, même quand l'annonce est introuvable.
          Flèche seule (button-link) : aria-label et title donnent la destination. */}
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
        // Tableau comme en administration, dans le cadre .table-scroll (admin.css) ; styles dans recruiter.css.
        <div className="table-scroll" role="region" aria-label={t('Candidatures reçues', 'Applications received')} tabIndex={0}>
          <table className="candidatures-table">
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
              {/* Ordre de l'API conservé : de la plus ancienne à la plus récente. */}
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.first_name} {application.last_name}</td>
                  <td><a href={`mailto:${application.email}`}>{application.email}</a></td>
                  <td>{application.phone ?? '—'}</td>
                  {/* Message coupé sur une ligne ; le texte entier s'affiche au survol. */}
                  <td className="cell-clip" title={application.message}>{application.message}</td>
                  {/* Le PDF se télécharge directement depuis l'API (même origine grâce au proxy, cookie compris). */}
                  <td>
                    {application.has_cv ? (
                      <a href={`/api/recruiter/ads/${id}/applications/${application.id}/cv`} download>{t('Télécharger', 'Download')}</a>
                    ) : '—'}
                  </td>
                  <td>{formatDate(application.created_at, locale)}</td>
                  <td>{STATUS_LABELS[application.status]?.[lang] ?? application.status}</td>
                  {/* Annonce ouverte, candidature en attente : « Retenir ce candidat » clôture l'annonce en le retenant
                      (bleu, action positive), « Refuser » ne refuse que lui (rouge). Colonne collée à droite (recruiter.css). */}
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

      {/* Clôture sans candidat retenu, avec ou sans candidatures : toutes les candidatures sont refusées.
          Rouge (button-danger, comme « Supprimer » en administration) : action définitive. */}
      {canClose && (
        <button className="button-danger" type="button" disabled={closing} onClick={() => handleClose(null)}>
          {t("Clôturer l'annonce", 'Close the job offer')}
        </button>
      )}
      {closeError && <p role="alert">{closeError}</p>}
    </section>
  )
}
