// Barre de recherche des offres (accueil et page des offres) : texte libre, et filtres repliés sous un bouton hamburger placé dans le cadre.
// La recherche ouvre /offres avec les champs remplis dans l'adresse ; les valeurs déjà cherchées y sont reprises.
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang, dataLabel } from '../lang.js'

// Filtres de GET /api/ads proposés ici (docs/contrat_api.md). Le filtre par catégorie de l'API n'est pas proposé dans la barre.
const FILTERS = [
  { name: 'contract_type', label: { fr: 'Type de contrat', en: 'Contract type' } },
  { name: 'location', label: { fr: 'Lieu', en: 'Location' } },
]

// Choix de « Salaire minimum » (salaire annuel brut, en euros). Ce filtre va dans l'adresse (min_salary)
// mais pas à l'API : JobBoardPage.jsx trie la liste déjà reçue.
const SALARY_STEPS = [20000, 30000, 40000, 50000]

// La zone de saisie suit la hauteur du texte : height à auto, puis la hauteur réelle du contenu.
function resize(textarea) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

export default function SearchBar() {
  const { t, lang, locale } = useLang()
  const navigate = useNavigate()
  // Valeurs de départ lues dans l'adresse : une recherche déjà faite reste affichée.
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = useState({
    contract_type: searchParams.get('contract_type') ?? '',
    location: searchParams.get('location') ?? '',
    min_salary: searchParams.get('min_salary') ?? '',
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Choix des listes : les valeurs présentes dans les annonces ouvertes.
  const [options, setOptions] = useState({ contract_type: [], location: [] })
  const textareaRef = useRef(null)

  // Champ déjà rempli à l'arrivée : on l'ajuste tout de suite à la hauteur de son texte.
  useEffect(() => {
    resize(textareaRef.current)
  }, [])

  // Une fois : toutes les annonces ouvertes, pour lister les contrats et les lieux qui existent.
  useEffect(() => {
    async function loadOptions() {
      const { ok, data } = await apiFetch('/api/ads')
      // Sans réponse, les listes gardent seulement « Tous » : la recherche par texte reste possible.
      if (!ok) return
      // Set retire les doublons, filter(Boolean) les valeurs vides ; tri alphabétique français.
      const values = (key) => [...new Set(data.map((ad) => ad[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
      setOptions({ contract_type: values('contract_type'), location: values('location') })
    }
    loadOptions()
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    // Seuls les champs remplis vont dans l'adresse : /offres sans rien affiche toutes les offres.
    const params = new URLSearchParams()
    const text = query.trim()
    if (text !== '') params.set('q', text)
    for (const { name } of FILTERS) {
      if (filters[name] !== '') params.set(name, filters[name])
    }
    if (filters.min_salary !== '') params.set('min_salary', filters.min_salary)
    const queryString = params.toString()
    setFiltersOpen(false)
    navigate(queryString === '' ? '/offres' : `/offres?${queryString}`)
  }

  function handleChange(event) {
    setQuery(event.target.value)
    resize(event.target)
  }

  // Entrée lance la recherche, Maj+Entrée laisse écrire sur une deuxième ligne.
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSearch(event)
    }
  }

  // Valeur venue de l'adresse mais absente des annonces : on la garde dans la liste pour qu'elle reste affichée.
  function choices(name) {
    const value = filters[name]
    return value === '' || options[name].includes(value) ? options[name] : [value, ...options[name]]
  }

  const activeCount = FILTERS.filter(({ name }) => filters[name] !== '').length + (filters.min_salary !== '' ? 1 : 0)

  return (
    // noValidate : un champ vide ouvre simplement la liste complète, sans message du navigateur.
    <form className="home-search" onSubmit={handleSearch} noValidate role="search">
      <label htmlFor="home-search-input">{t('Quel poste recherchez-vous ?', 'What position are you looking for?')}</label>
      {/* Le cadre entoure le champ et la flèche : il grandit avec le texte, comme une zone de composition. */}
      <div className="home-search-box">
        <textarea
          ref={textareaRef}
          id="home-search-input"
          name="q"
          rows={1}
          placeholder={t('Développeur, data, alternance…', 'Developer, data, work-study…')}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {/* Bouton hamburger dans le cadre, à gauche de la flèche ; le nombre de filtres actifs s'affiche sur son coin. */}
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="search-filters"
          aria-label={t(`Filtres${activeCount > 0 ? `, ${activeCount} actif${activeCount > 1 ? 's' : ''}` : ''}`, `Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`)}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {/* Hamburger dessiné du même trait que la flèche. */}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 6h12M4 10h12M4 14h12" />
          </svg>
          {activeCount > 0 && <span className="filters-count" aria-hidden="true">{activeCount}</span>}
        </button>

        {/* Flèche vers la droite : le libellé reste lisible par un lecteur d'écran grâce à aria-label. */}
        <button type="submit" className="home-search-submit" aria-label={t('Lancer la recherche', 'Search')}>
          {/* Icône dessinée plutôt que le caractère →, dont la position dépend de la police : elle reste centrée. */}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10h12M11 5l5 5-5 5" />
          </svg>
        </button>
      </div>

      {filtersOpen && (
        <div id="search-filters" className="search-filters">
          {FILTERS.map(({ name, label }) => (
            <label key={name}>
              {label[lang]}
              {/* Clé calculée [name] : seul le filtre modifié change, les autres sont recopiés. */}
              <select name={name} value={filters[name]} onChange={(event) => setFilters({ ...filters, [name]: event.target.value })}>
                <option value="">{t('Tous', 'All')}</option>
                {choices(name).map((value) => (
                  <option key={value} value={value}>{name === 'contract_type' ? dataLabel(value, lang) : value}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            {t('Salaire minimum', 'Minimum salary')}
            <select name="min_salary" value={filters.min_salary} onChange={(event) => setFilters({ ...filters, min_salary: event.target.value })}>
              <option value="">{t('Tous', 'All')}</option>
              {SALARY_STEPS.map((step) => (
                <option key={step} value={step}>{t(`${step.toLocaleString(locale)} €`, `€${step.toLocaleString(locale)}`)}</option>
              ))}
            </select>
          </label>
          <button type="button" className="button-danger" onClick={() => setFilters({ contract_type: '', location: '', min_salary: '' })}>
            {t('Effacer les filtres', 'Clear filters')}
          </button>
        </div>
      )}
    </form>
  )
}
