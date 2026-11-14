// "My positions" tab: the company's job offers in two tables, open then closed.
import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// API statuses (ads.status) translated for the screen.
const STATUS_LABELS = { open: { fr: 'Ouvert', en: 'Open' }, closed: { fr: 'Fermé', en: 'Closed' } }

// Table of job offers: position (link to its applications), number of applications, status.
// applications_count and status come from GET /api/recruiter/ads.
// onDelete is passed only to the table of open job offers: only it has the Edit / Delete column.
function PositionsTable({ positions, closed = false, onDelete, deleting }) {
  const { t, lang } = useLang()
  return (
    <div className="table-scroll">
      <table className={`positions-table${closed ? ' positions-table-closed' : ''}`}>
        <thead>
          <tr>
            <th>{t('Poste', 'Position')}</th>
            <th>{t('Candidatures', 'Applications')}</th>
            <th>{t('Statut', 'Status')}</th>
            {onDelete && <th className="col-actions"><span className="visually-hidden">{t('Actions', 'Actions')}</span></th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.id}>
              <td><Link to={`/recruteur/postes/${position.id}/candidatures`}>{position.title}</Link></td>
              <td>{position.applications_count}</td>
              <td>{STATUS_LABELS[position.status]?.[lang] ?? position.status}</td>
              {onDelete && (
                <td className="col-actions">
                  <div className="row-actions">
                    <Link className="button-link" to={`/recruteur/postes/${position.id}/modifier`}>{t('Modifier', 'Edit')}</Link>
                    {/* A job offer that has applications is closed, not deleted (the server would answer 409). */}
                    {position.applications_count === 0 && (
                      <button className="button-danger" type="button" disabled={deleting} onClick={() => onDelete(position)}>
                        {t('Supprimer', 'Delete')}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RecruiterOffersPage() {
  const { t } = useLang()
  // All the company's job offers, open and closed.
  const [positions, setPositions] = useState([])
  const [loadError, setLoadError] = useState(false)
  // Changing reloadKey restarts the loading of the list (after a 404 on deletion).
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function fetchPositions() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads')
      if (ok) {
        setPositions(data)
      } else {
        setLoadError(true)
        console.error('Error fetching recruiter ads:', status, error)
      }
    }
    fetchPositions()
  }, [reloadKey])

  async function handleDelete(position) {
    if (!window.confirm(t(`Supprimer l'annonce « ${position.title} » ? Cette action est définitive.`, `Delete the job offer "${position.title}"? This action cannot be undone.`))) return
    setDeleteError('')
    setDeleting(true)
    const { status, error } = await apiFetch(`/api/recruiter/ads/${position.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (status === 204) {
      // The job offer disappears from the list without reloading.
      setPositions(positions.filter((item) => item.id !== position.id))
      return
    }
    if (error === 'Ad has applications') {
      setDeleteError(t('Cette annonce a déjà reçu des candidatures : clôturez-la plutôt que de la supprimer.', 'This job offer has already received applications: close it instead of deleting it.'))
    } else if (status === 404) {
      // Job offer already deleted or from another company: the list is out of date, reload it.
      setDeleteError(t("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.", 'This job offer does not exist or does not belong to your company.'))
      setReloadKey(reloadKey + 1)
    } else {
      setDeleteError(t("Impossible de supprimer l'annonce pour le moment.", 'Unable to delete the job offer right now.'))
    }
    console.error('Error deleting ad:', status, error)
  }

  // A closed job offer leaves the first table for "My closed positions".
  const openPositions = positions.filter((position) => position.status !== 'closed')
  const closedPositions = positions.filter((position) => position.status === 'closed')

  return (
    <>
      <h1>{t('Mes postes', 'My positions')}</h1>

      {deleteError && <p role="alert">{deleteError}</p>}

      {/* On error, "not posted yet" would be false: show the error instead. */}
      {loadError ? (
        <p>{t('Impossible de charger vos postes pour le moment.', 'Unable to load your positions right now.')}</p>
      ) : positions.length === 0 ? (
        <p>{t("Vous n'avez pas encore publié de poste.", 'You have not posted any position yet.')}</p>
      ) : openPositions.length === 0 ? (
        <p>{t('Aucun poste ouvert pour le moment.', 'No open positions at the moment.')}</p>
      ) : (
        <PositionsTable positions={openPositions} onDelete={handleDelete} deleting={deleting} />
      )}

      <p><Link to="/recruteur/nouvelle-offre">{t('Publier une nouvelle offre', 'Post a new job offer')}</Link></p>

      {/* Second table, greyed out, only if there are closed job offers. */}
      {closedPositions.length > 0 && (
        <>
          <h2>{t('Mes postes clôturés', 'My closed positions')}</h2>
          <PositionsTable positions={closedPositions} closed />
        </>
      )}
    </>
  )
}
