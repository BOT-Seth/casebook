/**
 * "Mohammed Altaie" → "Mohammed A.". The leaderboard never shows more than
 * this. Shared by the server (which writes leaderboard rows) and Settings
 * (which shows you what others will see).
 */
export function publicName(full: unknown): string {
  const parts = typeof full === 'string' ? full.trim().split(/\s+/).filter(Boolean) : []
  if (parts.length === 0) return 'Anonymous'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}
