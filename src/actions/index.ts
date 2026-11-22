/**
 * Server actions — POST /api/actions/<name>, caller's JWT verified first.
 *
 * Action tools run with RBAC OFF (see src/server/action-routes.ts), so every
 * action here re-checks ownership itself before touching a record.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { coachRecall, CoachError } from '../server/coach'
import type { CaseRow } from '../schemas/cases-schema'

const MAX_RECALL = 8_000

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Grade a drill answer against the case's own model approach.
   * params: { caseId: string, recall: string }
   * → { grade, covered[], missed[], feedback }
   *
   * Why an action and not a client-side call: the model answer (`approach`)
   * should be compared on the server, and the LLM call is billed to the
   * caller by forwarding their JWT — the app owner never pays for a stranger's
   * practice session.
   */
  coachRecall: async ({ userId, params, tools, env, callerJwt }) => {
    const caseId = typeof params.caseId === 'string' ? params.caseId : ''
    const recall = typeof params.recall === 'string' ? params.recall.trim() : ''
    if (!caseId) return { success: false, error: 'caseId is required' }
    if (!recall) return { success: false, error: 'Write what you remember first.' }
    if (recall.length > MAX_RECALL) {
      return { success: false, error: `Keep it under ${MAX_RECALL} characters.` }
    }

    const got = await tools.get('cases', caseId)
    if (!got.success) return { success: false, error: 'Case not found' }
    const { record } = got.data as unknown as { record: { createdBy: string; data: CaseRow } }
    // RBAC is off for action tools — this line is the authorization.
    if (record.createdBy !== userId) return { success: false, error: 'Case not found' }

    try {
      const verdict = await coachRecall(env, callerJwt, record.data, recall)
      return { success: true, data: verdict }
    } catch (err) {
      const message = err instanceof CoachError ? err.message : 'The coach is unavailable right now.'
      console.error(`[coachRecall] ${err instanceof Error ? err.message : String(err)}`)
      return { success: false, error: message }
    }
  },
}
