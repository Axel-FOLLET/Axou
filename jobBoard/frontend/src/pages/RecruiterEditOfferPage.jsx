// Onglet « Modifier l'annonce » : même formulaire que « Nouvelle offre », prérempli avec l'annonce.
import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { Link, useParams } from 'react-router'

// Nom français des champs obligatoires, pour traduire « Missing field: <nom> ».
const fieldLabels = { title: 'le titre', short_description: 'la description courte', category_id: 'la catégorie' }

export default function RecruiterEditOfferPage() {
  // id lu dans l'adresse /recruteur/postes/:id/modifier
  const { id } = useParams()
  const [categories, setCategories] = useState([])
  // Valeurs du formulaire au chargement : on n'enverra que les champs qui en diffèrent.
  const [initialForm, setInitialForm] = useState(null)
  const [form, setForm] = useState({ title: '', short_description: '', category_id: '', description: '', salary: '', location: '', working_time: '', contract_type: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  // Annonce impossible à modifier (introuvable, clôturée, serveur indisponible) : message à la place du formulaire.
  const [loadError, setLoadError] = useState('')

  // À l'arrivée sur la page (et si l'id de l'adresse change) : catégories puis annonce.
  useEffect(() => {
    async function loadAd() {
      const categoriesResult = await apiFetch('/api/categories')
      const adResult = await apiFetch(`/api/ads/${id}`)
      // GET /api/ads/<id> est public : la liste de l'entreprise dit si l'annonce lui appartient.
      const ownResult = await apiFetch('/api/recruiter/ads')
      const isOwn = ownResult.ok && ownResult.data.some((item) => String(item.id) === id)
      if (adResult.status === 404 || (ownResult.ok && !isOwn)) {
        setLoadError("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.")
        return
      }
      if (!categoriesResult.ok || !adResult.ok || !ownResult.ok) {
        setLoadError('Impossible de charger cette annonce pour le moment.')
        console.error('Error loading ad:', adResult.status, adResult.error)
        return
      }
      const data = adResult.data
      // Une annonce clôturée se lit encore (GET public) mais ne se modifie plus : le serveur répondrait 409.
      if (data.status === 'closed') {
        setLoadError('Une annonce clôturée ne peut plus être modifiée.')
        return
      }
      // L'API renvoie le nom de la catégorie : on retrouve son id dans la liste.
      const category = categoriesResult.data.find((item) => item.name === data.category)
      setCategories(categoriesResult.data)
      // null (champ vide en base) devient '' : un champ de formulaire attend du texte.
      const values = {
        title: data.title,
        short_description: data.short_description,
        category_id: category ? String(category.id) : '',
        description: data.description ?? '',
        salary: data.salary === null ? '' : String(data.salary),
        location: data.location ?? '',
        working_time: data.working_time ?? '',
        contract_type: data.contract_type ?? '',
      }
      setInitialForm(values)
      setForm(values)
    }
    loadAd()
  }, [id])

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaveError('')
    setSaved(false)
    // Seuls les champs différents du chargement partent à l'API.
    const changes = {}
    for (const field of Object.keys(form)) {
      if (form[field] !== initialForm[field]) changes[field] = form[field]
    }
    // Rien de changé : pas d'appel à l'API.
    if (Object.keys(changes).length === 0) {
      setSaveError('Aucune modification à enregistrer.')
      return
    }
    // category_id et salary sont des nombres ; un salaire effacé devient null (non communiqué).
    if (changes.category_id) changes.category_id = Number(changes.category_id)
    if ('salary' in changes) changes.salary = changes.salary === '' ? null : Number(changes.salary)
    setSaving(true)
    const { ok, status, error } = await apiFetch(`/api/recruiter/ads/${id}`, { method: 'PATCH', body: changes })
    setSaving(false)
    if (ok) {
      // Les valeurs enregistrées deviennent la nouvelle référence de comparaison.
      setInitialForm(form)
      setSaved(true)
    } else {
      const missing = error?.startsWith('Missing field: ') ? error.slice('Missing field: '.length) : null
      if (missing) setSaveError(`Merci de renseigner ${fieldLabels[missing] ?? missing}.`)
      else if (error === 'Unknown category_id') setSaveError("Cette catégorie n'existe plus.")
      else if (status === 404) setSaveError("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.")
      else if (error === 'Ad is closed') setSaveError('Une annonce clôturée ne peut plus être modifiée.')
      else setSaveError("Impossible d'enregistrer pour le moment.")
      console.error('Error updating ad:', status, error)
    }
  }

  return (
    <>
      {/* Flèche de retour vers « Mes postes », comme sur la page des candidatures : quitter sans enregistrer.
          Flèche seule (button-link) : aria-label et title donnent la destination. */}
      <p className="back-link">
        <Link className="button-link" to="/recruteur/postes" aria-label="Retour à Mes postes" title="Retour à Mes postes">←</Link>
      </p>
      <h1>Modifier l'annonce</h1>

      {loadError ? (
        <p role="alert">{loadError}</p>
      ) : (
        <form className="form-columns" noValidate onSubmit={handleSubmit}>
          <fieldset>
            <legend>Le poste</legend>
            <label className="field-wide">
              Titre
              <input type="text" name="title" value={form.title} onChange={handleChange} />
            </label>

            <label className="field-wide">
              Description courte
              <input type="text" name="short_description" value={form.short_description} onChange={handleChange} />
            </label>

            <label className="field-wide">
              Catégorie
              <select name="category_id" value={form.category_id} onChange={handleChange}>
                <option value="" disabled>Choisissez une catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>

            <label className="field-wide">
              Description
              <textarea name="description" value={form.description} onChange={handleChange} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Conditions</legend>
            <label>
              Salaire annuel brut
              <input type="number" name="salary" min="0" value={form.salary} onChange={handleChange} />
            </label>

            <label>
              Lieu
              <input type="text" name="location" value={form.location} onChange={handleChange} />
            </label>

            <label>
              Temps de travail
              <input type="text" name="working_time" value={form.working_time} onChange={handleChange} />
            </label>

            <label>
              Type de contrat
              <input type="text" name="contract_type" value={form.contract_type} onChange={handleChange} />
            </label>
          </fieldset>

          {saveError && <p role="alert" className="field-wide">{saveError}</p>}
          {saved && <p role="status" className="field-wide">Modifications enregistrées.</p>}
          <div className="form-actions">
            <button type="submit" disabled={saving || initialForm === null}>Enregistrer</button>
          </div>
        </form>
      )}
    </>
  )
}
