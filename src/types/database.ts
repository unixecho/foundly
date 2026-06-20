// ============================================================
// Foundly — Database Types
// Auto-generate the real version with:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// This file is a hand-written approximation for bootstrapping.
// ============================================================

export type TagStatus = 'unactivated' | 'active' | 'deactivated'
export type CaseStatus = 'open' | 'in_progress' | 'resolved' | 'archived'
export type CaseActor = 'system' | 'owner' | 'finder'

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  recovery_email: string | null
  notify_email: boolean
  created_at: string
}

/** Computed view — what finders see ("John D.") */
export interface UserFinderName {
  id: string
  first_name: string
  last_name: string
  finder_display_name: string
}

export interface Item {
  id: string
  owner_id: string
  name: string
  description: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  serial: string
  item_id: string | null
  owner_id: string | null
  status: TagStatus
  activation_token: string | null
  activated_at: string | null
  created_at: string
}

export interface RecoveryCase {
  id: string
  tag_id: string
  owner_id: string
  status: CaseStatus
  finder_name: string | null
  finder_email: string | null
  finder_phone: string | null
  finder_message: string | null
  finder_location_lat: number | null
  finder_location_lng: number | null
  finder_location_label: string | null
  opened_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface CaseEvent {
  id: string
  case_id: string
  actor: CaseActor
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

// ---- Join types (used in queries that JOIN tables) ----

export interface RecoveryCaseWithTag extends RecoveryCase {
  tags: Pick<Tag, 'serial' | 'status'> & {
    items: Pick<Item, 'name' | 'photo_url'> | null
  }
}

export interface TagWithItem extends Tag {
  items: Item | null
  users: Pick<User, 'display_name'> | null
}
