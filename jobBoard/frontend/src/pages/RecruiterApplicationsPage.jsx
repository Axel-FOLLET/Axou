// Candidatures reçues pour une annonce du recruteur (GET /api/recruiter/ads/<id>/applications), avec leur CV,
// clôture de l'annonce (POST /api/recruiter/ads/<id>/closure)
// et refus d'un seul candidat (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { apiFetch } from '../api.js'

// "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> "8 octobre 2026"
function formatDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Statuts de l'API traduits pour l'écran.
const STATUS_LABELS = { pending: 'En attente', accepted: 'Retenue', rejected: 'Non retenue' }

// Refus de la clôture traduits pour l'écran (messages du contrat).
const CLOSURE_ERRORS = {
  'Ad already closed': 'Cette annonce est déjà clôturée.',
  'Application does not belong to this ad': 'Cette candidature ne correspond pas à l\'annonce. Rechargez la page.',
}

const CLOSURE_CONFIRM = 'Clôturer l\'annonce ? Chaque candidat recevra un e-mail, et l\'annonce ne pourra plus être modifiée.'

// Refus d'une seule candidature (POST /api/recruiter/ads/<id>/applications/<application_id>/rejection).
const REJECTION_ERRORS = {
  'Ad already closed': 'Cette annonce est déjà clôturée.',
  'Application not found': 'Cette candidature n\'existe plus. Rechargez la page.',
  'Application already processed': 'Cette candidature a déjà reçu une réponse.',
}

export default function RecruiterApplicationsPage() {
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

    if (!window.confirm(CLOSURE_CONFIRM)) return

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

    setCloseError(CLOSURE_ERRORS[error] ?? 'Impossible de clôturer l\'annonce pour le moment.')
    console.error('Closure refused:', status, error)
  }

  // Refuse un seul candidat : l'annonce reste ouverte, le candidat reçoit l'e-mail « non retenu ».
  async function handleReject(application) {
    setCloseError('')

    if (!window.confirm(`Refuser la candidature de ${application.first_name} ${application.last_name} ? Le candidat recevra un e-mail.`)) return

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

    setCloseError(REJECTION_ERRORS[error] ?? 'Impossible de refuser cette candidature pour le moment.')
    console.error('Rejection refused:', status, error)
  }

  // La clôture n'est proposée que pour une annonce de l'entreprise, chargée sans erreur, encore ouverte.
  const canClose = loadError === null && adStatus === 'open'

  return (
    <section>
      {/* Bouton flèche de retour vers « Mes postes », toujours visible, même quand l'annonce est introuvable.
          Flèche seule (button-link) : aria-label et title donnent la destination. */}
      <p className="back-link">
        <Link className="button-link" to="/recruteur/postes" aria-label="Retour à Mes postes" title="Retour à Mes postes">←</Link>
      </p>
      <h1>Candidatures reçues</h1>

      {loadError === 'not-found' ? (
        <p>Cette annonce n'existe pas ou n'appartient pas à votre entreprise.</p>
      ) : loadError === 'other' ? (
        <p>Impossible de charger les candidatures pour le moment.</p>
      ) : applications.length === 0 ? (
        <p>Aucune candidature pour cette annonce pour le moment.</p>
      ) : (
        // Tableau comme en administration, dans le cadre .table-scroll (admin.css) ; styles dans recruiter.css.
        <div className="table-scroll" role="region" aria-label="Candidatures reçues" tabIndex={0}>
          <table className="candidatures-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Téléphone</th>
                <th>Message</th>
                <th>CV</th>
                <th>Envoyée le</th>
                <th>Statut</th>
                {canClose && <th className="col-actions"><span className="visually-hidden">Actions</span></th>}
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
                      <a href={`/api/recruiter/ads/${id}/applications/${application.id}/cv`} download>Télécharger</a>
                    ) : '—'}
                  </td>
                  <td>{formatDate(application.created_at)}</td>
                  <td>{STATUS_LABELS[application.status] ?? application.status}</td>
                  {/* Annonce ouverte, candidature en attente : « Retenir ce candidat » clôture l'annonce en le retenant
                      (bleu, action positive), « Refuser » ne refuse que lui (rouge). Colonne collée à droite (recruiter.css). */}
                  {canClose && (
                    <td className="col-actions">
                      {application.status === 'pending' && (
                        <div className="row-actions">
                          <button type="button" disabled={closing} onClick={() => handleClose(application.id)}>
                            Retenir ce candidat
                          </button>
                          <button className="button-danger" type="button" disabled={closing} onClick={() => handleReject(application)}>
                            Refuser
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
          Clôturer l'annonce
        </button>
      )}
      {closeError && <p role="alert">{closeError}</p>}
    </section>
  )
}
