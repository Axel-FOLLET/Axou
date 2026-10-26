// Onglet « Modifier l'annonce » : même formulaire que « Nouvelle offre », prérempli avec l'annonce.
import { useState, useEffect } from 'react'
import { apiFetch } from '../api.js'
import { Link, useParams } from 'react-router'
import { useLang } from '../lang.js'

// Nom français et anglais des champs obligatoires, pour traduire « Missing field: <nom> ».
const fieldLabels = {
  title: { fr: 'le titre', en: 'the title' },
  short_description: { fr: 'la description courte', en: 'the short description' },
  category_id: { fr: 'la catégorie', en: 'the category' },
}

export default function RecruiterEditOfferPage() {
  const { t, lang } = useLang()
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
  // Message gardé en { fr, en } : l'effet ne dépend pas de la langue, l'affichage choisit.
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
        setLoadError({ fr: "Cette annonce n'existe pas ou n'appartient pas à votre entreprise.", en: 'This job offer does not exist or does not belong to your company.' })
        return
      }
      if (!categoriesResult.ok || !adResult.ok || !ownResult.ok) {
        setLoadError({ fr: 'Impossible de charger cette annonce pour le moment.', en: 'Unable to load this job offer right now.' })
        console.error('Error loading ad:', adResult.status, adResult.error)
        return
      }
      const data = adResult.data
      // Une annonce clôturée se lit encore (GET public) mais ne se modifie plus : le serveur répondrait 409.
      if (data.status === 'closed') {
        setLoadError({ fr: 'Une annonce clôturée ne peut plus être modifiée.', en: 'A closed job offer can no longer be edited.' })
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
      setSaveError(t('Aucune modification à enregistrer.', 'No changes to save.'))
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
      const label = fieldLabels[missing]?.[lang] ?? missing
      if (missing) setSaveError(t(`Merci de renseigner ${label}.`, `Please fill in ${label}.`))
      else if (error === 'Unknown category_id') setSaveError(t("Cette catégorie n'existe plus.", 'This category no longer exists.'))
      else if (status === 404) setSaveError(t("Cette annonce n'existe pas ou n'appartient pas à votre entreprise.", 'This job offer does not exist or does not belong to your company.'))
      else if (error === 'Ad is closed') setSaveError(t('Une annonce clôturée ne peut plus être modifiée.', 'A closed job offer can no longer be edited.'))
      else setSaveError(t("Impossible d'enregistrer pour le moment.", 'Unable to save right now.'))
      console.error('Error updating ad:', status, error)
    }
  }

  return (
    <>
      {/* Flèche de retour vers « Mes postes », comme sur la page des candidatures : quitter sans enregistrer.
          Flèche seule (button-link) : aria-label et title donnent la destination. */}
      <p className="back-link">
        <Link className="button-link" to="/recruteur/postes" aria-label={t('Retour à Mes postes', 'Back to My positions')} title={t('Retour à Mes postes', 'Back to My positions')}>←</Link>
      </p>
      <h1>{t("Modifier l'annonce", 'Edit the job offer')}</h1>

      {loadError ? (
        <p role="alert">{loadError[lang]}</p>
      ) : (
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

            <label>
              {t('Lieu', 'Location')}
              <input type="text" name="location" value={form.location} onChange={handleChange} />
            </label>

            <label>
              {t('Temps de travail', 'Working time')}
              <input type="text" name="working_time" value={form.working_time} onChange={handleChange} />
            </label>

            <label>
              {t('Type de contrat', 'Contract type')}
              <input type="text" name="contract_type" value={form.contract_type} onChange={handleChange} />
            </label>
          </fieldset>

          {saveError && <p role="alert" className="field-wide">{saveError}</p>}
          {saved && <p role="status" className="field-wide">{t('Modifications enregistrées.', 'Changes saved.')}</p>}
          <div className="form-actions">
            <button type="submit" disabled={saving || initialForm === null}>{t('Enregistrer', 'Save')}</button>
          </div>
        </form>
      )}
    </>
  )
}
