// "Post a new job offer" tab: fields taken from the API contract (ads table).
import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { useNavigate } from 'react-router'
import { useLang } from '../lang.js'

// French and English names of the required fields, to translate "Missing field: <name>".
const fieldLabels = {
  title: { fr: 'le titre', en: 'the title' },
  short_description: { fr: 'la description courte', en: 'the short description' },
  category_id: { fr: 'la catégorie', en: 'the category' },
}

export default function RecruiterNewOfferPage() {
  const { t, lang } = useLang()
  // Input suggestions: the locations and contracts already present in the open job offers.
  const [suggestions, setSuggestions] = useState({ location: [], contract_type: [] })
  // Categories offered in the drop-down list (required to post).
  const [categories, setCategories] = useState([])
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', short_description: '', category_id: '', description: '', salary: '', location: '', working_time: '', contract_type: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Once: same computation as the search bar (components/SearchBar.jsx).
  useEffect(() => {
    async function loadSuggestions() {
      const { ok, data } = await apiFetch('/api/ads')
      // Without a response, the fields stay free input.
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
    // Never company_id or contact_id: the server reads them from the session.
    // Empty optional fields are not sent; category_id and salary are numbers.
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
    const label = fieldLabels[missing]?.[lang] ?? missing
    if (missing) setSaveError(t(`Merci de renseigner ${label}.`, `Please fill in ${label}.`))
    else if (error === 'Unknown category_id') setSaveError(t("Cette catégorie n'existe plus.", 'This category no longer exists.'))
    else setSaveError(t("Impossible de publier l'offre pour le moment.", 'Unable to post the job offer right now.'))
    console.error('Error creating ad:', status, error)
  }

  return (
    <>
      <h1>{t('Publier une nouvelle offre', 'Post a new job offer')}</h1>
      <p>{t('Décrivez le poste à pourvoir.', 'Describe the position to fill.')}</p>

      {/* noValidate: the browser's messages will be replaced by our own, in the chosen language.
          form-columns (forms.css): short fields in pairs, descriptions on the whole line. */}
      <form className="form-columns" noValidate onSubmit={handleSubmit}>
        <fieldset>
          <legend>{t('Le poste', 'The position')}</legend>
          <label className="field-wide">
            {t('Titre', 'Title')}
            <input type="text" name="title" value={form.title} onChange={handleChange} />
          </label>

          <label className="field-wide">
            {t('Description courte', 'Short description')}
            <input type="text" name="short_description" value={form.short_description} onChange={handleChange} />
          </label>

          <label className="field-wide">
            {t('Catégorie', 'Category')}
            <select name="category_id" value={form.category_id} onChange={handleChange}>
              <option value="" disabled>{t('Choisissez une catégorie', 'Choose a category')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label className="field-wide">
            {t('Description', 'Description')}
            <textarea name="description" value={form.description} onChange={handleChange} />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('Conditions', 'Terms')}</legend>
          <label>
            {t('Salaire annuel brut', 'Gross annual salary')}
            <input type="number" name="salary" min="0" value={form.salary} onChange={handleChange} />
          </label>

          {/* list: suggestions offered, another value remains possible (the API contract does not impose a list). */}
          <label>
            {t('Lieu', 'Location')}
            <input type="text" name="location" list="suggestions-location" value={form.location} onChange={handleChange} />
          </label>

          <label>
            {t('Temps de travail', 'Working time')}
            <input type="text" name="working_time" value={form.working_time} onChange={handleChange} />
          </label>

          <label>
            {t('Type de contrat', 'Contract type')}
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
          <button type="submit" disabled={saving}>{t('Publier', 'Post')}</button>
        </div>
      </form>
    </>
  )
}
