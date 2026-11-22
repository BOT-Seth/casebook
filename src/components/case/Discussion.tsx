/**
 * Per-case discussion, built on DeepSpace's messaging feature
 * (`npx deepspace add messaging`): channels, messages, threads and reactions,
 * all real-time.
 *
 * Each case gets one public channel ("case-<id>"), stored in the app room.
 * Its messages live in their own room (`chat:<channelId>`), so a busy case
 * thread doesn't load into every other page.
 *
 * Spoilers: the tab only opens once you've finished the case. That is a UI
 * gate, not a security boundary: the bundled channels are public by design
 * (decision #13), and a spoiler isn't a security issue.
 */

import { RecordScope } from 'deepspace'
import { useChatChannel } from '../messaging/hooks/useChatChannel'
import { MessageList } from '../messaging/chat/MessageList'
import { messagingSchemas } from '../../schemas/messaging-schema'

export function CaseDiscussion({ caseId, caseTitle }: { caseId: string; caseTitle: string }) {
  const { channelId, status } = useChatChannel(`case-${caseId}`)

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Compare approaches with others who finished <span className="text-foreground">{caseTitle}</span>. Everyone here has
        already seen the answer.
      </p>
      <div className="flex h-[min(560px,70vh)] flex-col overflow-hidden rounded-lg border border-border bg-background">
        {status !== 'ready' || !channelId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Opening discussion…</div>
        ) : (
          <RecordScope roomId={`chat:${channelId}`} schemas={messagingSchemas}>
            <MessageList channelId={channelId} />
          </RecordScope>
        )}
      </div>
    </div>
  )
}
