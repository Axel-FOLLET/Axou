// "My company" tab: editing the company information.
// Fields taken from the API contract (companies table); saving goes through PATCH /api/recruiter/company.
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

export default function RecruiterCompanyPage() {
  const { t } = useLang()
  // company: the record received from the server; form: what the recruiter is typing.
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', location: '', website: '' })
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function fetchCompany() {
      const { ok, status, data, error } = await apiFetch('/api/recruiter/company')
      if (ok) {
        setCompany(data)
        setForm({ name: data.name ?? '', description: data.description ?? '', location: data.location ?? '', website: data.website ?? '' })
      } else {
        setLoadError(true)
        console.error('Error fetching company:', status, error)
      }
    }
    fetchCompany()
  }, [])

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    // Only the modified fields are sent; the SIREN is never sent (the server would answer 400).
    const changes = {}
    for (const field of Object.keys(form)) {
      if (form[field] !== (company[field] ?? '')) changes[field] = form[field]
    }
    setSaveError('')
    setSaved(false)
    setSaving(true)
    const { ok, status, data, error } = await apiFetch('/api/recruiter/company', { method: 'PATCH', body: changes })
    setSaving(false)
    if (ok) {
      setCompany(data)
      setSaved(true)
    } else {
      if (error === 'No fields to update') setSaveError(t('Aucune modification à enregistrer.', 'No changes to save.'))
      else if (error === 'Missing field: name') setSaveError(t("Le nom de l'entreprise est obligatoire.", 'The company name is required.'))
      else setSaveError(t("Impossible d'enregistrer pour le moment.", 'Unable to save right now.'))
      console.error('Error updating company:', status, error)
    }
  }

  return (
    <>
      <h1>{t('Mon entreprise', 'My company')}</h1>
      <p>{t('Modifiez ici les informations vues par les candidats.', 'Edit the information candidates see here.')}</p>
      {loadError && <p>{t('Impossible de charger votre entreprise pour le moment.', 'Unable to load your company right now.')}</p>}

      {/* noValidate: the browser's messages will be replaced by our own, in the chosen language.
          form-columns (forms.css): short fields in pairs, description on the whole line. */}
      <form className="form-columns" noValidate onSubmit={handleSubmit}>
        <label>
          {t('Nom', 'Name')}
          <input type="text" name="name" value={form.name} onChange={handleChange} />
        </label>

        <label>
          SIREN
          <input type="text" name="siren" value={company?.siren ?? ''} readOnly />
        </label>

        <label className="field-wide">
          {t('Description', 'Description')}
          <textarea name="description" value={form.description} onChange={handleChange} />
        </label>

        <label>
          {t('Lieu', 'Location')}
          <input type="text" name="location" value={form.location} onChange={handleChange} />
        </label>

        <label>
          {t('Site web', 'Website')}
          <input type="url" name="website" value={form.website} onChange={handleChange} />
        </label>

        {saveError && <p role="alert" className="field-wide">{saveError}</p>}
        {saved && <p role="status" className="field-wide">{t('Modifications enregistrées.', 'Changes saved.')}</p>}

        {/* Disabled until the record is loaded: without it, there is no way to know what changed. */}
        <div className="form-actions">
          <button type="submit" disabled={company === null || saving}>{t('Enregistrer', 'Save')}</button>
        </div>
      </form>
    </>
  )
}
