// Onglet « Publier une nouvelle offre » : champs repris du contrat d'API (table ads).
import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { useNavigate } from 'react-router'

// Nom français des champs obligatoires, pour traduire « Missing field: <nom> ».
const fieldLabels = { title: 'le titre', short_description: 'la description courte', category_id: 'la catégorie' }

export default function RecruiterNewOfferPage() {
  // Suggestions de saisie : les lieux et contrats déjà présents dans les annonces ouvertes.
  const [suggestions, setSuggestions] = useState({ location: [], contract_type: [] })
  // Catégories proposées dans la liste déroulante (obligatoires pour publier).
  const [categories, setCategories] = useState([])
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', short_description: '', category_id: '', description: '', salary: '', location: '', working_time: '', contract_type: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Une fois : même calcul que la barre de recherche (components/SearchBar.jsx).
  useEffect(() => {
    async function loadSuggestions() {
      const { ok, data } = await apiFetch('/api/ads')
      // Sans réponse, les champs restent de la saisie libre.
      if (!ok) return
      const values = (key) => [...new Set(data.map((ad) => ad[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
      setSuggestions({ location: values('location'), contract_type: values('contract_type') })
    }
    async function loadCategories() {
      const { ok, status, data, error } = await apiFetch('/api/categories')
      if (ok) setCategories(data)
      else console.error('Error fetching categories:', status, error)
    }
    loadCategories()
    loadSuggestions()
  }, [])

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    // Jamais company_id ni contact_id : le serveur les lit dans la session.
    // Les champs facultatifs vides ne partent pas ; category_id et salary sont des nombres.
    const body = {}
    for (const [field, value] of Object.entries(form)) {
      if (value.trim() !== '') body[field] = value
    }
    if (body.category_id) body.category_id = Number(body.category_id)
    if (body.salary) body.salary = Number(body.salary)

    setSaveError('')
    setSaving(true)
    const { ok, status, error } = await apiFetch('/api/recruiter/ads', { method: 'POST', body })
    setSaving(false)
    if (ok) {
      navigate('/recruteur/postes')
      return
    }
    const missing = error?.startsWith('Missing field: ') ? error.slice('Missing field: '.length) : null
    if (missing) setSaveError(`Merci de renseigner ${fieldLabels[missing] ?? missing}.`)
    else if (error === 'Unknown category_id') setSaveError("Cette catégorie n'existe plus.")
    else setSaveError("Impossible de publier l'offre pour le moment.")
    console.error('Error creating ad:', status, error)
  }

  return (
    <>
      <h1>Publier une nouvelle offre</h1>
      <p>Décrivez le poste à pourvoir.</p>

      {/* noValidate : les messages du navigateur seront remplacés par les nôtres, en français.
          form-columns (forms.css) : champs courts par paires, descriptions sur toute la ligne. */}
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

          {/* list : suggestions proposées, une autre valeur reste possible (le contrat d'API n'impose pas de liste). */}
          <label>
            Lieu
            <input type="text" name="location" list="suggestions-location" value={form.location} onChange={handleChange} />
          </label>

          <label>
            Temps de travail
            <input type="text" name="working_time" value={form.working_time} onChange={handleChange} />
          </label>

          <label>
            Type de contrat
            <input type="text" name="contract_type" list="suggestions-contract" value={form.contract_type} onChange={handleChange} />
          </label>
        </fieldset>

        <datalist id="suggestions-location">
          {suggestions.location.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="suggestions-contract">
          {suggestions.contract_type.map((value) => <option key={value} value={value} />)}
        </datalist>

        {saveError && <p role="alert" className="field-wide">{saveError}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>Publier</button>
        </div>
      </form>
    </>
  )
}
