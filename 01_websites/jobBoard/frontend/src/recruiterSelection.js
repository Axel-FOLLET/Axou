// Selection of the positions highlighted on the recruiter home page.

// We ask the back end for these data:
//   { id, title, applications_count, oldest_unanswered_at }
// ...
// These two fields are returned by GET /api/recruiter/ads (backend/routes/recruiter.py): see docs/contrat_api.md.


// Two weeks, expressed in milliseconds.
const NO_REPLY_DELAY_MS = 14 * 24 * 60 * 60 * 1000

/**
 * The positions that received the most applications, from the most to the least applied-to.
 * limit = 3: only the first three are shown.
 */
export function getMostAppliedPositions(positions, limit = 3) {
  return [...positions]
    .filter((position) => (position.applications_count ?? 0) > 0)
    .sort((a, b) => b.applications_count - a.applications_count)
    .slice(0, limit)
}

/**
 * The positions where a candidate has been waiting for a reply for more than two weeks,
 * from the oldest to the most recent. Three are shown: the next ones do not appear,
 * but as soon as a position is handled it leaves the list and the next one takes its place.
 */
export function getPositionsWithoutReply(positions, now = Date.now(), limit = 3) {
  return [...positions]
    .filter((position) => {
      if (!position.oldest_unanswered_at) return false
      // "2026-10-08 18:15:02" (UTC, as returned by SQLite) -> usable date.
      const waitingSince = new Date(position.oldest_unanswered_at.replace(' ', 'T') + 'Z').getTime()
      return now - waitingSince > NO_REPLY_DELAY_MS
    })
    .sort((a, b) => a.oldest_unanswered_at.localeCompare(b.oldest_unanswered_at))
    .slice(0, limit)
}
