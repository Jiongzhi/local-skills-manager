import { useCallback, useEffect, useMemo, useState } from 'react'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  AlertTriangle,
  ArchiveRestore,
  CircleOff,
  FolderOpen,
  Loader2,
  PackageOpen,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { errorCode, listSkills, operateSkills } from './api'
import type { Operation, OperationSummary, SkillRecord } from './types'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Segmented } from './components/ui/segmented'
import { cn } from './lib/utils'

type SourceFilter = 'all' | 'codex' | 'claude'
type StateFilter = 'all' | 'enabled' | 'disabled'

interface Notice {
  kind: 'success' | 'error' | 'info'
  text: string
}

const ERROR_MESSAGES: Record<string, string> = {
  permission_denied: '没有访问权限,请检查文件夹权限',
  io_error: '文件操作失败',
  not_found: '技能不存在或状态已变化',
  restore_conflict: '同名技能已存在,无法恢复',
  abnormal_skill: '异常技能(缺少 SKILL.md),已跳过',
  unknown: '未知错误',
}

function isAbnormal(skill: SkillRecord) {
  return skill.reason === 'abnormal_skill'
}

function summarize(summary: OperationSummary): Notice {
  const ok = summary.items.filter((item) => item.outcome === 'succeeded').length
  const skipped = summary.items.filter((item) => item.outcome === 'skipped').length
  const failed = summary.items.filter((item) => item.outcome === 'failed')

  const verb =
    summary.operation === 'disable' ? '禁用' : summary.operation === 'restore' ? '恢复' : '删除'
  const parts: string[] = []
  if (ok > 0) parts.push(`成功${verb} ${ok} 项`)
  if (skipped > 0) parts.push(`跳过 ${skipped} 项`)
  if (failed.length > 0) {
    const firstCode = failed[0].code ?? 'unknown'
    parts.push(`失败 ${failed.length} 项(${ERROR_MESSAGES[firstCode] ?? firstCode})`)
  }
  return {
    kind: failed.length > 0 ? 'error' : ok > 0 ? 'success' : 'info',
    text: parts.join(',') || '没有可操作的技能',
  }
}

function App() {
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
        (a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, 'zh'),
      )
      setSkills(records)
      const ids = new Set(records.map((record) => record.id))
      setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))))
    } catch (error) {
      setSkills([])
      setNotice({
        kind: 'error',
        text: `加载技能失败:${ERROR_MESSAGES[errorCode(error)] ?? errorCode(error)}`,
      })
    } finally {
      setLoading(false)
    }
  }, [])

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
      setNotice(summarize(summary))
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
        text: `操作失败:${ERROR_MESSAGES[errorCode(error)] ?? errorCode(error)}`,
      })
    } finally {
      setBusy(false)
    }
  }

  async function openLocation(path: string) {
    try {
      await revealItemInDir(path)
    } catch {
      setNotice({ kind: 'error', text: '无法打开文件位置' })
    }
  }

  const hasAnySkill = (skills?.length ?? 0) > 0

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 border-b bg-card px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold leading-tight">Skills Manager</h1>
          <p className="text-xs text-muted-foreground">
            管理 Codex 与 Claude Code 的本地技能
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </Button>
      </header>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 px-6 pb-3 pt-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索技能名称或描述…"
            className="pl-9 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label="清空搜索"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Segmented
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[
            { value: 'all', label: '全部来源' },
            { value: 'codex', label: 'Codex' },
            { value: 'claude', label: 'Claude' },
          ]}
        />
        <Segmented
          value={stateFilter}
          onChange={setStateFilter}
          options={[
            { value: 'all', label: '全部', count: counts.all },
            { value: 'enabled', label: '已启用', count: counts.enabled },
            { value: 'disabled', label: '已禁用', count: counts.disabled },
          ]}
        />
      </div>

      {/* 列表 */}
      <main className="flex-1 overflow-y-auto px-6 pb-28">
        {loading && skills === null ? (
          <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在扫描技能…
          </div>
        ) : !hasAnySkill ? (
          <EmptyState
            title="未找到任何技能"
            hint="将技能放入 ~/.codex/skills 或 ~/.claude/skills 后点击刷新"
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="没有匹配的技能" hint="试试调整搜索关键词或筛选条件">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('')
                setSourceFilter('all')
                setStateFilter('all')
              }}
            >
              清除筛选
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
                aria-label="全选"
              />
              <span>
                {someVisibleSelected
                  ? `已选 ${selectable.filter((skill) => selected.has(skill.id)).length} / ${selectable.length} 项`
                  : `共 ${filtered.length} 项`}
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
          <span className="text-sm font-medium tabular-nums">已选 {selected.size} 项</span>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setSelected(new Set())}
            aria-label="取消选择"
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
            禁用 {selectedEnabled.length > 0 && selectedEnabled.length}
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
            恢复 {selectedDisabled.length > 0 && selectedDisabled.length}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => setPendingDelete([...selected])}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
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
            aria-label="关闭提示"
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
              <h2 className="text-base font-semibold">确认删除</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              将把 {pendingDelete.length} 个技能移入系统回收站,如有需要可从回收站还原。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
                取消
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
                删除
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
        aria-label={`选择 ${skill.name}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{skill.name}</span>
          <Badge variant="outline" className="capitalize">
            {skill.source}
          </Badge>
          {skill.state === 'enabled' ? (
            <Badge variant="success">已启用</Badge>
          ) : (
            <Badge variant="secondary">已禁用</Badge>
          )}
          {abnormal && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3" />
              缺少 SKILL.md
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {skill.description || skill.path}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!abnormal &&
          (skill.state === 'enabled' ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onDisable}>
              <CircleOff className="h-3.5 w-3.5" />
              禁用
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
              <ArchiveRestore className="h-3.5 w-3.5" />
              恢复
            </Button>
          ))}
        <Button variant="ghost" size="iconSm" onClick={onOpen} aria-label="打开文件位置">
          <FolderOpen className="h-4 w-4" />
        </Button>
        {!abnormal && (
          <Button
            variant="ghost"
            size="iconSm"
            disabled={busy}
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`删除 ${skill.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
