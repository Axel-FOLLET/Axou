// Job search bar (home and offers page): free text, and filters folded under a hamburger button placed inside the frame.
// The search opens /offres with the fields filled in the address; values already searched are taken back from it.
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang, dataLabel } from '../lang.js'

// Filters of GET /api/ads offered here (docs/contrat_api.md). The API's category filter is not offered in the bar.
const FILTERS = [
  { name: 'contract_type', label: { fr: 'Type de contrat', en: 'Contract type' } },
  { name: 'location', label: { fr: 'Lieu', en: 'Location' } },
]

// Choices of "Minimum salary" (gross annual salary, in euros). This filter goes into the address (min_salary)
// but not to the API: JobBoardPage.jsx filters the list already received.
const SALARY_STEPS = [20000, 30000, 40000, 50000]

// The input area follows the height of the text: height to auto, then the real height of the content.
function resize(textarea) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

export default function SearchBar() {
  const { t, lang, locale } = useLang()
  const navigate = useNavigate()
  // Initial values read from the address: a search already made stays displayed.
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [filters, setFilters] = useState({
    contract_type: searchParams.get('contract_type') ?? '',
    location: searchParams.get('location') ?? '',
    min_salary: searchParams.get('min_salary') ?? '',
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Choices of the lists: the values present in the open job offers.
  const [options, setOptions] = useState({ contract_type: [], location: [] })
  const textareaRef = useRef(null)

  // Field already filled on arrival: adjust it right away to the height of its text.
  useEffect(() => {
    resize(textareaRef.current)
  }, [])

  // Once: all the open job offers, to list the contracts and locations that exist.
  useEffect(() => {
    async function loadOptions() {
      const { ok, data } = await apiFetch('/api/ads')
      // Without a response, the lists only keep "All": the text search remains possible.
      if (!ok) return
      // Set removes duplicates, filter(Boolean) removes empty values; French alphabetical sort.
      const values = (key) => [...new Set(data.map((ad) => ad[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
      setOptions({ contract_type: values('contract_type'), location: values('location') })
    }
    loadOptions()
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    // Only the filled fields go into the address: /offres with nothing shows all the offers.
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

  // Enter starts the search, Shift+Enter allows writing on a second line.
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSearch(event)
    }
  }

  // Value coming from the address but absent from the job offers: keep it in the list so that it stays displayed.
  function choices(name) {
    const value = filters[name]
    return value === '' || options[name].includes(value) ? options[name] : [value, ...options[name]]
  }

  const activeCount = FILTERS.filter(({ name }) => filters[name] !== '').length + (filters.min_salary !== '' ? 1 : 0)

  return (
    // noValidate: an empty field simply opens the full list, with no browser message.
    <form className="home-search" onSubmit={handleSearch} noValidate role="search">
      <label htmlFor="home-search-input">{t('Quel poste recherchez-vous ?', 'What position are you looking for?')}</label>
      {/* The frame surrounds the field and the arrow: it grows with the text, like a compose box. */}
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
        {/* Hamburger button inside the frame, left of the arrow; the number of active filters is shown on its corner. */}
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="search-filters"
          aria-label={t(`Filtres${activeCount > 0 ? `, ${activeCount} actif${activeCount > 1 ? 's' : ''}` : ''}`, `Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`)}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          {/* Hamburger drawn with the same stroke as the arrow. */}
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 6h12M4 10h12M4 14h12" />
          </svg>
          {activeCount > 0 && <span className="filters-count" aria-hidden="true">{activeCount}</span>}
        </button>

        {/* Right arrow: the label stays readable by a screen reader thanks to aria-label. */}
        <button type="submit" className="home-search-submit" aria-label={t('Lancer la recherche', 'Search')}>
          {/* Drawn icon rather than the → character, whose position depends on the font: it stays centered. */}
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
              {/* Computed key [name]: only the modified filter changes, the others are copied. */}
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
