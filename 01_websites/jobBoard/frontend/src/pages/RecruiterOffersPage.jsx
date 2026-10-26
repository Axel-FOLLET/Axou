// Onglet « Mes postes » : les annonces de l'entreprise en deux tableaux, ouvertes puis clôturées.
import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Statuts de l'API (ads.status) traduits pour l'écran.
const STATUS_LABELS = { open: { fr: 'Ouvert', en: 'Open' }, closed: { fr: 'Fermé', en: 'Closed' } }

// Tableau d'annonces : poste (lien vers ses candidatures), nombre de candidatures, statut.
// applications_count et status viennent de GET /api/recruiter/ads.
// onDelete n'est passé qu'au tableau des annonces ouvertes : lui seul a la colonne Modifier / Supprimer.
function PostesTable({ postes, closed = false, onDelete, deleting }) {
  const { t, lang } = useLang()
  return (
    <div className="table-scroll">
      <table className={`postes-table${closed ? ' postes-table-closed' : ''}`}>
        <thead>
          <tr>
            <th>{t('Poste', 'Position')}</th>
            <th>{t('Candidatures', 'Applications')}</th>
            <th>{t('Statut', 'Status')}</th>
            {onDelete && <th className="col-actions"><span className="visually-hidden">{t('Actions', 'Actions')}</span></th>}
          </tr>
        </thead>
        <tbody>
          {postes.map((poste) => (
            <tr key={poste.id}>
              <td><Link to={`/recruteur/postes/${poste.id}/candidatures`}>{poste.title}</Link></td>
              <td>{poste.applications_count}</td>
              <td>{STATUS_LABELS[poste.status]?.[lang] ?? poste.status}</td>
              {onDelete && (
                <td className="col-actions">
                  <div className="row-actions">
                    <Link className="button-link" to={`/recruteur/postes/${poste.id}/modifier`}>{t('Modifier', 'Edit')}</Link>
                    {/* Une annonce qui a des candidatures se clôture, elle ne se supprime pas (le serveur répondrait 409). */}
                    {poste.applications_count === 0 && (
                      <button className="button-danger" type="button" disabled={deleting} onClick={() => onDelete(poste)}>
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
  // Toutes les annonces de l'entreprise, ouvertes et fermées.
  const [postes, setPostes] = useState([])
  const [loadError, setLoadError] = useState(false)
  // Changer reloadKey relance le chargement de la liste (après un 404 à la suppression).
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function fetchPostes() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/ads')
      if (ok) {
        setPostes(data)
      } else {
        setLoadError(true)
        console.error('Error fetching recruiter ads:', status, error)
      }
    }
    fetchPostes()
  }, [reloadKey])

  async function handleDelete(poste) {
    if (!window.confirm(t(`Supprimer l'annonce « ${poste.title} » ? Cette action est définitive.`, `Delete the job offer "${poste.title}"? This action cannot be undone.`))) return
    setDeleteError('')
    setDeleting(true)
    const { status, error } = await apiFetch(`/api/recruiter/ads/${poste.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (status === 204) {
      // L'annonce disparaît de la liste sans recharger.
      setPostes(postes.filter((item) => item.id !== poste.id))
      return
    }
    if (error === 'Ad has applications') {
      setDeleteError(t('Cette annonce a déjà reçu des candidatures : clôturez-la plutôt que de la supprimer.', 'This job offer has already received applications: close it instead of deleting it.'))
    } else if (status === 404) {
      // Annonce déjà supprimée ou d'une autre entreprise : la liste n'est plus à jour, on la recharge.
      setDeleteError(t("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.", 'This job offer does not exist or does not belong to your company.'))
      setReloadKey(reloadKey + 1)
    } else {
      setDeleteError(t("Impossible de supprimer l'annonce pour le moment.", 'Unable to delete the job offer right now.'))
    }
    console.error('Error deleting ad:', status, error)
  }

  // Une annonce clôturée quitte le premier tableau pour « Mes postes clôturés ».
  const ouverts = postes.filter((poste) => poste.status !== 'closed')
  const clotures = postes.filter((poste) => poste.status === 'closed')

  return (
    <>
      <h1>{t('Mes postes', 'My positions')}</h1>

      {deleteError && <p role="alert">{deleteError}</p>}

      {/* En cas d'erreur, « pas encore publié » serait faux : on affiche l'erreur à la place. */}
      {loadError ? (
        <p>{t('Impossible de charger vos postes pour le moment.', 'Unable to load your positions right now.')}</p>
      ) : postes.length === 0 ? (
        <p>{t("Vous n'avez pas encore publié de poste.", 'You have not posted any position yet.')}</p>
      ) : ouverts.length === 0 ? (
        <p>{t('Aucun poste ouvert pour le moment.', 'No open positions at the moment.')}</p>
      ) : (
        <PostesTable postes={ouverts} onDelete={handleDelete} deleting={deleting} />
      )}

      <p><Link to="/recruteur/nouvelle-offre">{t('Publier une nouvelle offre', 'Post a new job offer')}</Link></p>

      {/* Second tableau, grisé, seulement s'il y a des annonces fermées. */}
      {clotures.length > 0 && (
        <>
          <h2>{t('Mes postes clôturés', 'My closed positions')}</h2>
          <PostesTable postes={clotures} closed />
        </>
      )}
    </>
  )
}
