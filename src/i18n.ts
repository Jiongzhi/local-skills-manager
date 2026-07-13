import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const LANG_KEY = 'lang'

// 默认跟随系统语言:中文系统 → zh,其余一律回退英文。
function detectLanguage(): Language {
  const stored = localStorage.getItem(LANG_KEY)
  if (stored === 'en' || stored === 'zh') return stored
  const system = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase()
  return system.startsWith('zh') ? 'zh' : 'en'
}

export function setLanguage(language: Language) {
  localStorage.setItem(LANG_KEY, language)
  void i18n.changeLanguage(language)
}

const resources = {
  en: {
    translation: {
      app: {
        title: 'Skills Manager',
        subtitle: 'Manage local skills for Codex and Claude Code',
      },
      common: {
        refresh: 'Refresh',
        cancel: 'Cancel',
        delete: 'Delete',
        disable: 'Disable',
        restore: 'Restore',
        listSeparator: ', ',
      },
      theme: {
        toggle: 'Switch theme',
        system: 'System theme',
        light: 'Light theme',
        dark: 'Dark theme',
      },
      language: {
        toggle: 'Switch language',
      },
      search: {
        placeholder: 'Search skills by name or description…',
        clear: 'Clear search',
      },
      filter: {
        allSource: 'All sources',
        all: 'All',
        enabled: 'Enabled',
        disabled: 'Disabled',
      },
      list: {
        scanning: 'Scanning skills…',
        selected: '{{count}} / {{total}} selected',
        total_one: '{{count}} item',
        total_other: '{{count}} items',
        selectAll: 'Select all',
      },
      empty: {
        noneTitle: 'No skills found',
        noneHint: 'Put skills under ~/.codex/skills or ~/.claude/skills, then refresh',
        noMatchTitle: 'No matching skills',
        noMatchHint: 'Try adjusting the search keyword or filters',
        clearFilters: 'Clear filters',
      },
      bulk: {
        selected: '{{count}} selected',
        clearSelection: 'Clear selection',
      },
      row: {
        missingSkillMd: 'Missing SKILL.md',
        select: 'Select {{name}}',
        openLocation: 'Open file location',
        delete: 'Delete {{name}}',
        enableAria: 'Enable {{name}}',
        disableAria: 'Disable {{name}}',
      },
      dialog: {
        deleteTitle: 'Confirm deletion',
        deleteBody_one:
          '{{count}} skill will be moved to the system trash; you can restore it from there if needed.',
        deleteBody_other:
          '{{count}} skills will be moved to the system trash; you can restore them from there if needed.',
      },
      notice: {
        loadFailed: 'Failed to load skills: {{reason}}',
        operateFailed: 'Operation failed: {{reason}}',
        openLocationFailed: 'Unable to open file location',
      },
      summary: {
        disableSuccess: 'Disabled {{count}}',
        restoreSuccess: 'Restored {{count}}',
        deleteSuccess: 'Deleted {{count}}',
        skipped: 'skipped {{count}}',
        failed: 'failed {{count}} ({{reason}})',
        nothing: 'No skills to operate on',
      },
      errors: {
        permission_denied: 'No access permission, please check folder permissions',
        io_error: 'File operation failed',
        not_found: 'Skill does not exist or its state changed',
        restore_conflict: 'A skill with the same name already exists, cannot restore',
        abnormal_skill: 'Abnormal skill (missing SKILL.md), skipped',
        unknown: 'Unknown error',
      },
    },
  },
  zh: {
    translation: {
      app: {
        title: 'Skills Manager',
        subtitle: '管理 Codex 与 Claude Code 的本地技能',
      },
      common: {
        refresh: '刷新',
        cancel: '取消',
        delete: '删除',
        disable: '禁用',
        restore: '恢复',
        listSeparator: ',',
      },
      theme: {
        toggle: '切换主题',
        system: '跟随系统',
        light: '浅色主题',
        dark: '深色主题',
      },
      language: {
        toggle: '切换语言',
      },
      search: {
        placeholder: '搜索技能名称或描述…',
        clear: '清空搜索',
      },
      filter: {
        allSource: '全部来源',
        all: '全部',
        enabled: '已启用',
        disabled: '已禁用',
      },
      list: {
        scanning: '正在扫描技能…',
        selected: '已选 {{count}} / {{total}} 项',
        total_one: '共 {{count}} 项',
        total_other: '共 {{count}} 项',
        selectAll: '全选',
      },
      empty: {
        noneTitle: '未找到任何技能',
        noneHint: '将技能放入 ~/.codex/skills 或 ~/.claude/skills 后点击刷新',
        noMatchTitle: '没有匹配的技能',
        noMatchHint: '试试调整搜索关键词或筛选条件',
        clearFilters: '清除筛选',
      },
      bulk: {
        selected: '已选 {{count}} 项',
        clearSelection: '取消选择',
      },
      row: {
        missingSkillMd: '缺少 SKILL.md',
        select: '选择 {{name}}',
        openLocation: '打开文件位置',
        delete: '删除 {{name}}',
        enableAria: '启用 {{name}}',
        disableAria: '禁用 {{name}}',
      },
      dialog: {
        deleteTitle: '确认删除',
        deleteBody_one: '将把 {{count}} 个技能移入系统回收站,如有需要可从回收站还原。',
        deleteBody_other: '将把 {{count}} 个技能移入系统回收站,如有需要可从回收站还原。',
      },
      notice: {
        loadFailed: '加载技能失败:{{reason}}',
        operateFailed: '操作失败:{{reason}}',
        openLocationFailed: '无法打开文件位置',
      },
      summary: {
        disableSuccess: '成功禁用 {{count}} 项',
        restoreSuccess: '成功恢复 {{count}} 项',
        deleteSuccess: '成功删除 {{count}} 项',
        skipped: '跳过 {{count}} 项',
        failed: '失败 {{count}} 项({{reason}})',
        nothing: '没有可操作的技能',
      },
      errors: {
        permission_denied: '没有访问权限,请检查文件夹权限',
        io_error: '文件操作失败',
        not_found: '技能不存在或状态已变化',
        restore_conflict: '同名技能已存在,无法恢复',
        abnormal_skill: '异常技能(缺少 SKILL.md),已跳过',
        unknown: '未知错误',
      },
    },
  },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
})

export default i18n
