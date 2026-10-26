// Choix des postes mis en avant sur l'accueil du recruteur.

// On demande des données au back :
//   { id, title, applications_count, oldest_unanswered_at }
// ...
// Ces deux champs sont renvoyés par GET /api/recruiter/ads (backend/routes/recruiter.py) : voir docs/contrat_api.md.


// Deux semaines, exprimées en millisecondes.
const DELAI_SANS_REPONSE = 14 * 24 * 60 * 60 * 1000

/**
 * Les postes qui ont reçu le plus de candidatures, du plus répondu au moins répondu.
 * limit = 3 : seuls les trois premiers sont affichés.
 */
export function postesLesPlusRepondus(postes, limit = 3) {
  return [...postes]
    .filter((poste) => (poste.applications_count ?? 0) > 0)
    .sort((a, b) => b.applications_count - a.applications_count)
    .slice(0, limit)
}

/**
 * Les postes dont un candidat attend une réponse depuis plus de deux semaines,
 * du plus ancien au plus récent. On en affiche trois : les suivants n'apparaissent pas,
 * mais dès qu'un poste est traité il quitte la liste et celui d'après prend sa place.
 */
export function postesSansReponse(postes, maintenant = Date.now(), limit = 3) {
  return [...postes]
    .filter((poste) => {
      if (!poste.oldest_unanswered_at) return false
      // "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> date utilisable.
      const attenteDepuis = new Date(poste.oldest_unanswered_at.replace(' ', 'T') + 'Z').getTime()
      return maintenant - attenteDepuis > DELAI_SANS_REPONSE
    })
    .sort((a, b) => a.oldest_unanswered_at.localeCompare(b.oldest_unanswered_at))
    .slice(0, limit)
}
