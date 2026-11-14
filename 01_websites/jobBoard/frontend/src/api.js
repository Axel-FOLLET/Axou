/*
 * Calls the API and always returns the same result shape, never throwing
 * an exception:
 *   ok     : true if the HTTP status is a success
 *   status : the HTTP status, or 0 if the server is unreachable
 *   data   : the JSON body, or null if there is none
 *   error  : the message returned by the API on a refusal, otherwise ''
 *   total  : the X-Total-Count header, or null if absent
 */

// api.js is not a component: it reads the language from the page's lang attribute, kept up to date by LangProvider.
function inEnglish() {
  return document.documentElement.lang === 'en'
}

export async function apiFetch(path, { body, headers, ...options } = {}) {
  // credentials: the session cookie goes with every call, administration included.
  const init = { credentials: 'include', ...options, headers: { ...headers } }

  // A FormData (a file upload, like the CV) is sent as is: the browser writes the multipart
  // header itself. Any other JavaScript body is converted to JSON; with no body, no content-type header.
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
    // Server stopped or network cut: status 0 tells this apart from a refusal by the API.
    return { ok: false, status: 0, data: null, error: inEnglish() ? 'Server unreachable.' : 'Serveur injoignable.', total: null, retryAfter: null }
  }

  // 204: success with no content (deletion succeeded), there is nothing to read in the response.
  if (response.status === 204) {
    return { ok: true, status: 204, data: null, error: '', total: null, retryAfter: null }
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // Empty or unreadable response: data stays null, the calling code relies on status.
  }

  // On a refusal, the API always returns {"error": "..."}.
  const message = typeof data?.error === 'string' ? data.error : `${inEnglish() ? 'Error' : 'Erreur'} ${response.status}`
  // X-Total-Count: total number of rows, used by the administration pagination.
  const totalHeader = response.headers.get('X-Total-Count')
  // Retry-After: seconds to wait, returned with a 429 (too many login attempts).
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
