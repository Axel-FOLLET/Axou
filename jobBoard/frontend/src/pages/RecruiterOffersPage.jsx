// Onglet « Mes postes » : les annonces de l'entreprise en deux tableaux, ouvertes puis clôturées.
import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

// Statuts de l'API (ads.status) traduits pour l'écran.
const STATUS_LABELS = { open: 'Ouvert', closed: 'Fermé' }

// Tableau d'annonces : poste (lien vers ses candidatures), nombre de candidatures, statut.
// applications_count et status viennent de GET /api/recruiter/ads.
// onDelete n'est passé qu'au tableau des annonces ouvertes : lui seul a la colonne Modifier / Supprimer.
function PostesTable({ postes, closed = false, onDelete, deleting }) {
  return (
    <div className="table-scroll">
      <table className={`postes-table${closed ? ' postes-table-closed' : ''}`}>
        <thead>
          <tr>
            <th>Poste</th>
            <th>Candidatures</th>
            <th>Statut</th>
            {onDelete && <th className="col-actions"><span className="visually-hidden">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {postes.map((poste) => (
            <tr key={poste.id}>
              <td><Link to={`/recruteur/postes/${poste.id}/candidatures`}>{poste.title}</Link></td>
              <td>{poste.applications_count}</td>
              <td>{STATUS_LABELS[poste.status] ?? poste.status}</td>
              {onDelete && (
                <td className="col-actions">
                  <div className="row-actions">
                    <Link className="button-link" to={`/recruteur/postes/${poste.id}/modifier`}>Modifier</Link>
                    {/* Une annonce qui a des candidatures se clôture, elle ne se supprime pas (le serveur répondrait 409). */}
                    {poste.applications_count === 0 && (
                      <button className="button-danger" type="button" disabled={deleting} onClick={() => onDelete(poste)}>
                        Supprimer
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
    if (!window.confirm(`Supprimer l'annonce « ${poste.title} » ? Cette action est définitive.`)) return
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
      setDeleteError('Cette annonce a déjà reçu des candidatures : clôturez-la plutôt que de la supprimer.')
    } else if (status === 404) {
      // Annonce déjà supprimée ou d'une autre entreprise : la liste n'est plus à jour, on la recharge.
      setDeleteError("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.")
      setReloadKey(reloadKey + 1)
    } else {
      setDeleteError("Impossible de supprimer l'annonce pour le moment.")
    }
    console.error('Error deleting ad:', status, error)
  }

  // Une annonce clôturée quitte le premier tableau pour « Mes postes clôturés ».
  const ouverts = postes.filter((poste) => poste.status !== 'closed')
  const clotures = postes.filter((poste) => poste.status === 'closed')

  return (
    <>
      <h1>Mes postes</h1>

      {deleteError && <p role="alert">{deleteError}</p>}

      {/* En cas d'erreur, « pas encore publié » serait faux : on affiche l'erreur à la place. */}
      {loadError ? (
        <p>Impossible de charger vos postes pour le moment.</p>
      ) : postes.length === 0 ? (
        <p>Vous n'avez pas encore publié de poste.</p>
      ) : ouverts.length === 0 ? (
        <p>Aucun poste ouvert pour le moment.</p>
      ) : (
        <PostesTable postes={ouverts} onDelete={handleDelete} deleting={deleting} />
      )}

      <p><Link to="/recruteur/nouvelle-offre">Publier une nouvelle offre</Link></p>

      {/* Second tableau, grisé, seulement s'il y a des annonces fermées. */}
      {clotures.length > 0 && (
        <>
          <h2>Mes postes clôturés</h2>
          <PostesTable postes={clotures} closed />
        </>
      )}
    </>
  )
}
