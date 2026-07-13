import type { OperationSummary, SkillRecord } from './types'

// 仅用于在浏览器 dev 模式(无 Tauri 后端)下预览 UI 效果。
// 打包进桌面应用时 `invoke` 可用,不会走到这些假数据。

export const MOCK_SKILLS: SkillRecord[] = [
  {
    id: 'codex:enabled:pdf-toolkit',
    source: 'codex',
    state: 'enabled',
    directoryName: 'pdf-toolkit',
    path: '/Users/demo/.codex/skills/pdf-toolkit',
    name: 'PDF Toolkit',
    description: '合并、拆分、加水印以及从 PDF 中提取文本与表格。',
    reason: null,
  },
  {
    id: 'codex:enabled:sql-explain',
    source: 'codex',
    state: 'enabled',
    directoryName: 'sql-explain',
    path: '/Users/demo/.codex/skills/sql-explain',
    name: 'SQL Explain',
    description: '解释慢查询执行计划并给出索引优化建议。',
    reason: null,
  },
  {
    id: 'codex:disabled:legacy-scraper',
    source: 'codex',
    state: 'disabled',
    directoryName: 'legacy-scraper',
    path: '/Users/demo/Library/Application Support/skills-manager/codex/legacy-scraper',
    name: 'Legacy Scraper',
    description: '旧版网页抓取脚本,已被 fetch-cli 取代。',
    reason: null,
  },
  {
    id: 'claude:enabled:docx',
    source: 'claude',
    state: 'enabled',
    directoryName: 'docx',
    path: '/Users/demo/.claude/skills/docx',
    name: 'Word 文档',
    description: '创建、读取、编辑 Word 文档(.docx),支持目录、页眉与图片替换。',
    reason: null,
  },
  {
    id: 'claude:enabled:dataviz',
    source: 'claude',
    state: 'enabled',
    directoryName: 'dataviz',
    path: '/Users/demo/.claude/skills/dataviz',
    name: 'Data Visualization',
    description: '生成风格统一、明暗主题自适应且符合无障碍规范的图表与仪表盘。',
    reason: null,
  },
  {
    id: 'claude:disabled:pptx',
    source: 'claude',
    state: 'disabled',
    directoryName: 'pptx',
    path: '/Users/demo/Library/Application Support/skills-manager/claude/pptx',
    name: 'PowerPoint 演示',
    description: '创建与编辑幻灯片、演讲者备注以及模板(.potx)。',
    reason: null,
  },
  {
    id: 'claude:enabled:broken-skill',
    source: 'claude',
    state: 'enabled',
    directoryName: 'broken-skill',
    path: '/Users/demo/.claude/skills/broken-skill',
    name: 'broken-skill',
    description: '',
    reason: 'abnormal_skill',
  },
]

let store: SkillRecord[] = MOCK_SKILLS.map((skill) => ({ ...skill }))

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function mockListSkills(): SkillRecord[] {
  return store.map((skill) => ({ ...skill }))
}

export function mockOperate(
  operation: OperationSummary['operation'],
  ids: string[],
): OperationSummary {
  const idSet = new Set(ids)
  const items: OperationSummary['items'] = []

  store = store.flatMap((skill) => {
    if (!idSet.has(skill.id)) return [skill]

    if (skill.reason === 'abnormal_skill') {
      items.push({ id: skill.id, outcome: 'skipped', code: 'abnormal_skill' })
      return [skill]
    }

    if (operation === 'delete') {
      items.push({ id: skill.id, outcome: 'succeeded' })
      return []
    }

    const nextState = operation === 'disable' ? 'disabled' : 'enabled'
    if (skill.state === nextState) {
      items.push({ id: skill.id, outcome: 'failed', code: 'not_found' })
      return [skill]
    }

    items.push({ id: skill.id, outcome: 'succeeded' })
    return [
      {
        ...skill,
        state: nextState,
        id: `${skill.source}:${nextState}:${skill.directoryName}`,
      },
    ]
  })

  return { operation, items }
}
