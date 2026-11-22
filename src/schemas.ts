/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { attemptsSchema } from './schemas/attempts-schema'
import { leaderboardSchema } from './schemas/leaderboard-schema'
import { messagingSchemas } from './schemas/messaging-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  attemptsSchema,
  leaderboardSchema,
  // Per-case Discuss tab: channels live here; messages live in chat:<channelId> rooms.
  ...messagingSchemas,
]
