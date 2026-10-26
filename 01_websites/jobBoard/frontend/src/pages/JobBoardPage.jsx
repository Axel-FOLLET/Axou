import JobOffer from '../components/AddJobOffer.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Filtres de l'adresse transmis tels quels à l'API (docs/contrat_api.md, filtres de GET /api/ads).
const API_FILTERS = ['q', 'contract_type', 'location']

// Une annonce publiée depuis moins de NEW_DAYS jours affiche le badge « Nouveau » et passe le filtre des nouveautés.
const NEW_DAYS = 7

// created_at de l'API ("2026-10-08 18:15:02", UTC) -> vrai si l'annonce a moins de NEW_DAYS jours.
function isNewOffer(createdAt, now) {
  // Écart en millisecondes, converti en jours (1000 ms × 60 s × 60 min × 24 h).
  const ageInDays = (now - new Date(createdAt.replace(' ', 'T') + 'Z')) / (1000 * 60 * 60 * 24)
  return ageInDays < NEW_DAYS
}

// liste les annonces publiées, récupérées depuis /api/ads.
export default function JobBoardPage() {
  const { t } = useLang()
  // Liste vide au départ, puis remplie par l'appel réseau ci-dessous.
  const [offers, setOffers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // Case « Nouvelles annonces uniquement » : le tri se fait ici, sur la liste déjà reçue.
  const [onlyNew, setOnlyNew] = useState(false)
  // Heure lue une seule fois, au premier affichage : un affichage de React doit toujours donner le même résultat.
  const [now] = useState(() => Date.now())
  // ?q=…&contract_type=…&location=… viennent de la barre de recherche (accueil ou cette page).
  const [searchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const apiParams = new URLSearchParams()
  for (const name of API_FILTERS) {
    const value = searchParams.get(name)
    if (value) apiParams.set(name, value)
  }
  // Texte simple (« q=dev&location=Paris ») : l'effet ne repart que s'il change.
  const apiQuery = apiParams.toString()
  // « Salaire minimum » du menu de la barre (?min_salary=…), trié ici comme la case des nouveautés ;
  // 0 : tous les salaires. Une annonce sans salaire (salary à null) est masquée dès qu'un minimum est choisi.
  const minSalary = Number(searchParams.get('min_salary')) || 0
  const shownOffers = offers
    .filter((offer) => !onlyNew || isNewOffer(offer.created_at, now))
    .filter((offer) => minSalary === 0 || (offer.salary !== null && offer.salary >= minSalary))

  // À chaque changement de recherche ou de filtre : on redemande la liste à l'API.
  useEffect(() => {
    async function loadOffers() {
      setLoading(true)
      setError(null)
      try {
        const path = apiQuery === '' ? '/api/ads' : `/api/ads?${apiQuery}`
        const { ok, data, error: apiError } = await apiFetch(path)
        if (!ok) {
          throw new Error(apiError)
        }
        setOffers(data)
      } catch (err) {
        // Détail technique pour nous dans la console (F12), message lisible pour le visiteur.
        console.error(err)
        // Le message est traduit à l'affichage, dans la langue courante.
        setError(true)
      } finally {
        // Dans tous les cas : on sort de l'état « chargement ».
        setLoading(false)
      }
    }
    loadOffers()
  }, [apiQuery])

  return (
    <div className="page offers-page">
      {/* Titre de page ordinaire, plus petit que celui de l'accueil : les résultats remontent. */}
      <h1>{t("Offres d'emploi", 'Job offers')}</h1>

      {/* key : la barre est recréée quand l'adresse change (min_salary compris), ses champs reprennent donc la recherche affichée. */}
      <SearchBar key={searchParams.toString()} />

      <label className="new-filter">
        <input type="checkbox" checked={onlyNew} onChange={(event) => setOnlyNew(event.target.checked)} />
        {t('Nouvelles annonces uniquement', 'New job offers only')}
      </label>

      {/* Trois affichages possibles, dans cet ordre : chargement, erreur, puis la liste. La barre reste visible. */}
      {loading && <p>{t('Chargement…', 'Loading…')}</p>}
      {!loading && error && <p>{t("Nous n'arrivons pas à charger les offres pour le moment. Merci de réessayer dans quelques instants.", 'We cannot load the job offers at the moment. Please try again in a few moments.')}</p>}
      {!loading && !error && (
        <>
          {/* Recherche ou filtres en cours : on rappelle le texte cherché et le nombre de résultats. */}
          {(apiQuery !== '' || onlyNew || minSalary !== 0) && shownOffers.length > 0 && (
            <p className="results-count">
              {shownOffers.length} {t(`offre${shownOffers.length > 1 ? 's' : ''}`, `job offer${shownOffers.length > 1 ? 's' : ''}`)}
              {search !== '' ? t(` pour « ${search} »`, ` for "${search}"`) : t(' pour ces filtres', ' for these filters')}
            </p>
          )}
          {shownOffers.length === 0 && <p>{t('Aucune offre ne correspond à cette recherche.', 'No job offers match this search.')}</p>}
          {/* Une carte par annonce ; key sert à React seul, d'où id en plus. */}
          <div className="offers-grid">
            {shownOffers.map((offer) => (
              <JobOffer
                key={offer.id}
                id={offer.id}
                company={offer.company}
                title={offer.title}
                shortDescription={offer.short_description}
                location={offer.location}
                contractType={offer.contract_type}
                isNew={isNewOffer(offer.created_at, now)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
