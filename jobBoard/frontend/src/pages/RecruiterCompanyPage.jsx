// Onglet « Mon entreprise » : modification des informations de l'entreprise.
// Champs repris du contrat d'API (table companies) ; l'enregistrement passe par PATCH /api/recruiter/company.
import { useEffect, useState } from 'react'
import { apiFetch } from '../api.js'

export default function RecruiterCompanyPage() {
  // company : la fiche reçue du serveur ; form : ce que le recruteur est en train de saisir.
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
    // Seuls les champs modifiés partent ; le SIREN n'est jamais envoyé (le serveur répondrait 400).
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
      if (error === 'No fields to update') setSaveError('Aucune modification à enregistrer.')
      else if (error === 'Missing field: name') setSaveError("Le nom de l'entreprise est obligatoire.")
      else setSaveError("Impossible d'enregistrer pour le moment.")
      console.error('Error updating company:', status, error)
    }
  }

  return (
    <>
      <h1>Mon entreprise</h1>
      <p>Modifiez ici les informations vues par les candidats.</p>
      {loadError && <p>Impossible de charger votre entreprise pour le moment.</p>}

      {/* noValidate : les messages du navigateur seront remplacés par les nôtres, en français.
          form-columns (forms.css) : champs courts par paires, description sur toute la ligne. */}
      <form className="form-columns" noValidate onSubmit={handleSubmit}>
        <label>
          Nom
          <input type="text" name="name" value={form.name} onChange={handleChange} />
        </label>

        <label>
          SIREN
          <input type="text" name="siren" value={company?.siren ?? ''} readOnly />
        </label>

        <label className="field-wide">
          Description
          <textarea name="description" value={form.description} onChange={handleChange} />
        </label>

        <label>
          Lieu
          <input type="text" name="location" value={form.location} onChange={handleChange} />
        </label>

        <label>
          Site web
          <input type="url" name="website" value={form.website} onChange={handleChange} />
        </label>

        {saveError && <p role="alert" className="field-wide">{saveError}</p>}
        {saved && <p role="status" className="field-wide">Modifications enregistrées.</p>}

        {/* Désactivé tant que la fiche n'est pas chargée : sans elle, impossible de savoir ce qui a changé. */}
        <div className="form-actions">
          <button type="submit" disabled={company === null || saving}>Enregistrer</button>
        </div>
      </form>
    </>
  )
}
