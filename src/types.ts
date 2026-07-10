export type SkillSource = 'codex' | 'claude'

export type SkillState = 'enabled' | 'disabled'

export type Operation = 'disable' | 'restore' | 'delete'

export interface SkillRecord {
  id: string
  source: SkillSource
  state: SkillState
  directoryName: string
  path: string
  name: string
  description: string
  reason: string | null
}

export type Outcome = 'succeeded' | 'skipped' | 'failed'

export interface ItemResult {
  id: string
  outcome: Outcome
  code?: string
}

export interface OperationSummary {
  operation: Operation
  items: ItemResult[]
}
