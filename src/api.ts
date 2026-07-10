import { invoke } from '@tauri-apps/api/core'
import type { Operation, OperationSummary, SkillRecord } from './types'

export interface CommandError {
  code: string
}

export function listSkills(): Promise<SkillRecord[]> {
  return invoke<SkillRecord[]>('list_skills')
}

export function operateSkills(
  operation: Operation,
  ids: string[],
): Promise<OperationSummary> {
  return invoke<OperationSummary>('operate_skills', { operation, ids })
}

export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as CommandError).code)
  }
  return 'unknown'
}
