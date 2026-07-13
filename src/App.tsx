import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  AlertTriangle,
  ArchiveRestore,
  CircleOff,
  FolderOpen,
  Languages,
  Loader2,
  Monitor,
  Moon,
  PackageOpen,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import type { TFunction } from 'i18next'
import { errorCode, listSkills, operateSkills } from './api'
import { setLanguage } from './i18n'
import { useTheme } from './lib/theme'
import type { Operation, OperationSummary, SkillRecord } from './types'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Segmented } from './components/ui/segmented'
import { Switch } from './components/ui/switch'
import { SourceIcon } from './components/source-icon'
import { cn } from './lib/utils'

type SourceFilter = 'all' | 'codex' | 'claude'
type StateFilter = 'all' | 'enabled' | 'disabled'

interface Notice {
  kind: 'success' | 'error' | 'info'
  text: string
}

function isAbnormal(skill: SkillRecord) {
  return skill.reason === 'abnormal_skill'
}

function errorText(t: TFunction, code: string) {
  return t([`errors.${code}`, 'errors.unknown'])
}

function summarize(summary: OperationSummary, t: TFunction): Notice {
  const ok = summary.items.filter((item) => item.outcome === 'succeeded').length
  const skipped = summary.items.filter((item) => item.outcome === 'skipped').length
  const failed = summary.items.filter((item) => item.outcome === 'failed')

  const successKey =
    summary.operation === 'disable'
      ? 'summary.disableSuccess'
      : summary.operation === 'restore'
        ? 'summary.restoreSuccess'
        : 'summary.deleteSuccess'

  const parts: string[] = []
  if (ok > 0) parts.push(t(successKey, { count: ok }))
  if (skipped > 0) parts.push(t('summary.skipped', { count: skipped }))
  if (failed.length > 0) {
    const firstCode = failed[0].code ?? 'unknown'
    parts.push(
      t('summary.failed', { count: failed.length, reason: errorText(t, firstCode) }),
    )
  }
  return {
    kind: failed.length > 0 ? 'error' : ok > 0 ? 'success' : 'info',
    text: parts.join(t('common.listSeparator')) || t('summary.nothing'),
  }
}

function App() {
  const { t, i18n } = useTranslation()
  const { theme, cycleTheme } = useTheme()
  const [skills, setSkills] = useState<SkillRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const records = await listSkills()
      records.sort(
        (a, b) =>
          a.source.localeCompare(b.source) ||
          a.directoryName.localeCompare(b.directoryName, 'zh'),
      )
      setSkills(records)
      const ids = new Set(records.map((record) => record.id))
      setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))))
    } catch (error) {
      setSkills([])
      setNotice({
        kind: 'error',
        text: t('notice.loadFailed', { reason: errorText(t, errorCode(error)) }),
      })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const filtered = useMemo(() => {
    if (!skills) return []
    const keyword = query.trim().toLowerCase()
    return skills.filter((skill) => {
      if (sourceFilter !== 'all' && skill.source !== sourceFilter) return false
      if (stateFilter !== 'all' && skill.state !== stateFilter) return false
      if (!keyword) return true
      return (
        skill.name.toLowerCase().includes(keyword) ||
        skill.directoryName.toLowerCase().includes(keyword) ||
        skill.description.toLowerCase().includes(keyword)
      )
    })
  }, [skills, query, sourceFilter, stateFilter])

  const counts = useMemo(() => {
    const bySource = skills?.filter(
      (skill) => sourceFilter === 'all' || skill.source === sourceFilter,
    )
    return {
      all: bySource?.length ?? 0,
      enabled: bySource?.filter((skill) => skill.state === 'enabled').length ?? 0,
      disabled: bySource?.filter((skill) => skill.state === 'disabled').length ?? 0,
    }
  }, [skills, sourceFilter])

  const selectable = useMemo(() => filtered.filter((skill) => !isAbnormal(skill)), [filtered])
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((skill) => selected.has(skill.id))
  const someVisibleSelected = selectable.some((skill) => selected.has(skill.id))

  const selectedRecords = useMemo(
    () => (skills ?? []).filter((skill) => selected.has(skill.id)),
    [skills, selected],
  )
  const selectedEnabled = selectedRecords.filter((skill) => skill.state === 'enabled')
  const selectedDisabled = selectedRecords.filter((skill) => skill.state === 'disabled')

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const skill of selectable) next.delete(skill.id)
      } else {
        for (const skill of selectable) next.add(skill.id)
      }
      return next
    })
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runOperation(operation: Operation, ids: string[]) {
    if (ids.length === 0 || busy) return
    setBusy(true)
    try {
      const summary = await operateSkills(operation, ids)
      setNotice(summarize(summary, t))
      const succeeded = new Set(
        summary.items
          .filter((item) => item.outcome === 'succeeded')
          .map((item) => item.id),
      )
      setSelected((prev) => new Set([...prev].filter((id) => !succeeded.has(id))))
      await load()
    } catch (error) {
      setNotice({
        kind: 'error',
        text: t('notice.operateFailed', { reason: errorText(t, errorCode(error)) }),
      })
    } finally {
      setBusy(false)
    }
  }

  async function openLocation(path: string) {
    try {
      await revealItemInDir(path)
    } catch {
      setNotice({ kind: 'error', text: t('notice.openLocationFailed') })
    }
  }

  const hasAnySkill = (skills?.length ?? 0) > 0
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 border-b bg-card px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold leading-tight">{t('app.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('app.subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setLanguage(i18n.language.startsWith('zh') ? 'en' : 'zh')}
          title={t('language.toggle')}
          aria-label={t('language.toggle')}
        >
          <Languages className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={cycleTheme}
          title={t(`theme.${theme}`)}
          aria-label={t('theme.toggle')}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </header>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 px-6 pb-3 pt-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t('search.placeholder')}
            className="pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={t('search.clear')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Segmented
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: 'all', label: t('filter.allSource') },
            { value: 'codex', label: 'Codex' },
            { value: 'claude', label: 'Claude' },
          ]}
        />
        <Segmented
          value={stateFilter}
          onChange={setStateFilter}
          options={[
            { value: 'all', label: t('filter.all'), count: counts.all },
            { value: 'enabled', label: t('filter.enabled'), count: counts.enabled },
            { value: 'disabled', label: t('filter.disabled'), count: counts.disabled },
          ]}
        />
      </div>

      {/* 列表 */}
      <main className="flex-1 overflow-y-auto px-6 pb-28">
        {loading && skills === null ? (
          <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('list.scanning')}
          </div>
        ) : !hasAnySkill ? (
          <EmptyState title={t('empty.noneTitle')} hint={t('empty.noneHint')} />
        ) : filtered.length === 0 ? (
          <EmptyState title={t('empty.noMatchTitle')} hint={t('empty.noMatchHint')}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('')
                setSourceFilter('all')
                setStateFilter('all')
              }}
            >
              {t('empty.clearFilters')}
            </Button>
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={
                  allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false
                }
                onCheckedChange={toggleAll}
                disabled={selectable.length === 0}
                aria-label={t('list.selectAll')}
              />
              <span>
                {someVisibleSelected
                  ? t('list.selected', {
                      count: selectable.filter((skill) => selected.has(skill.id)).length,
                      total: selectable.length,
                    })
                  : t('list.total', { count: filtered.length })}
              </span>
            </div>
            <ul className="divide-y">
              {filtered.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  checked={selected.has(skill.id)}
                  busy={busy}
                  onToggle={() => toggleOne(skill.id)}
                  onDisable={() => void runOperation('disable', [skill.id])}
                  onRestore={() => void runOperation('restore', [skill.id])}
                  onDelete={() => setPendingDelete([skill.id])}
                  onOpen={() => void openLocation(skill.path)}
                />
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium tabular-nums">
            {t('bulk.selected', { count: selected.size })}
          </span>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setSelected(new Set())}
            aria-label={t('bulk.clearSelection')}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || selectedEnabled.length === 0}
            onClick={() =>
              void runOperation(
                'disable',
                selectedEnabled.map((skill) => skill.id),
              )
            }
          >
            <CircleOff className="h-3.5 w-3.5" />
            {t('common.disable')} {selectedEnabled.length > 0 && selectedEnabled.length}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || selectedDisabled.length === 0}
            onClick={() =>
              void runOperation(
                'restore',
                selectedDisabled.map((skill) => skill.id),
              )
            }
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            {t('common.restore')} {selectedDisabled.length > 0 && selectedDisabled.length}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => setPendingDelete([...selected])}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete')}
          </Button>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* 操作结果提示 */}
      {notice && (
        <div
          className={cn(
            'fixed right-6 top-16 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
            notice.kind === 'success' &&
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            notice.kind === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
            notice.kind === 'info' && 'bg-card text-foreground',
          )}
        >
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="mt-0.5 opacity-60 hover:opacity-100"
            aria-label={t('bulk.clearSelection')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 删除确认 */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-base font-semibold">{t('dialog.deleteTitle')}</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {t('dialog.deleteBody', { count: pendingDelete.length })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const ids = pendingDelete
                  setPendingDelete(null)
                  void runOperation('delete', ids)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillRow({
  skill,
  checked,
  busy,
  onToggle,
  onDisable,
  onRestore,
  onDelete,
  onOpen,
}: {
  skill: SkillRecord
  checked: boolean
  busy: boolean
  onToggle: () => void
  onDisable: () => void
  onRestore: () => void
  onDelete: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const abnormal = isAbnormal(skill)
  return (
    <li
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
        checked && 'bg-accent/60 hover:bg-accent/60',
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        disabled={abnormal}
        aria-label={t('row.select', { name: skill.directoryName })}
      />
      <SourceIcon source={skill.source} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{skill.directoryName}</span>
          {abnormal && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3" />
              {t('row.missingSkillMd')}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {skill.description || skill.path}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={onOpen}
          aria-label={t('row.openLocation')}
          className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        {!abnormal && (
          <Button
            variant="ghost"
            size="iconSm"
            disabled={busy}
            onClick={onDelete}
            className="text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={t('row.delete', { name: skill.directoryName })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {!abnormal && (
          <Switch
            checked={skill.state === 'enabled'}
            disabled={busy}
            onCheckedChange={(next) => (next ? onRestore() : onDisable())}
            aria-label={
              skill.state === 'enabled'
                ? t('row.disableAria', { name: skill.directoryName })
                : t('row.enableAria', { name: skill.directoryName })
            }
            className="ml-1"
          />
        )}
      </div>
    </li>
  )
}

function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

export default App
