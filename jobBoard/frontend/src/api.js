/*
 * Appelle l'API et renvoie toujours la même forme de résultat, sans jamais lever
 * d'exception :
 *   ok     : true si le code HTTP est un succès
 *   status : le code HTTP, ou 0 si le serveur est injoignable
 *   data   : le corps JSON, ou null s'il n'y en a pas
 *   error  : le message renvoyé par l'API en cas de refus, sinon ''
 *   total  : l'en-tête X-Total-Count, ou null s'il est absent
 */

// api.js n'est pas un composant : il lit la langue sur l'attribut lang de la page, tenu à jour par LangProvider.
function inEnglish() {
  return document.documentElement.lang === 'en'
}

export async function apiFetch(path, { body, headers, ...options } = {}) {
  // credentials : le cookie de session accompagne chaque appel, y compris côté administration.
  const init = { credentials: 'include', ...options, headers: { ...headers } }

  // Un FormData (envoi d'un fichier, comme le CV) part tel quel : le navigateur écrit lui-même
  // l'en-tête multipart. Un autre corps JavaScript est converti en JSON ; sans corps, aucun en-tête de type.
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json', ...init.headers }
    init.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, init)
  } catch {
    // Serveur arrêté ou coupure réseau : status 0 distingue ce cas d'un refus de l'API.
    return { ok: false, status: 0, data: null, error: inEnglish() ? 'Server unreachable.' : 'Serveur injoignable.', total: null, retryAfter: null }
  }

  // 204 : succès sans contenu (suppression réussie), il n'y a rien à lire dans la réponse.
  if (response.status === 204) {
    return { ok: true, status: 204, data: null, error: '', total: null, retryAfter: null }
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Réponse vide ou illisible : data reste null, le code appelant se fie à status.
  }

  // En cas de refus, l'API renvoie toujours {"error": "..."}.
  const message = typeof data?.error === 'string' ? data.error : `${inEnglish() ? 'Error' : 'Erreur'} ${response.status}`
  // X-Total-Count : nombre total de lignes, utilisé par la pagination de l'administration.
  const totalHeader = response.headers.get('X-Total-Count')
  // Retry-After : secondes d'attente renvoyées avec un 429 (trop de tentatives de connexion).
  const retryAfterHeader = response.headers.get('Retry-After')

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? '' : message,
    total: totalHeader === null ? null : Number(totalHeader),
    retryAfter: retryAfterHeader === null ? null : Number(retryAfterHeader),
  }
}
