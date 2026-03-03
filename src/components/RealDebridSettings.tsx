import { useState, useEffect, useCallback } from 'react'
import { Lightning, CheckCircle, XCircle, ArrowClockwise, Copy, Play } from '@phosphor-icons/react'

const API = 'http://localhost:3002'

interface RDUser {
  username: string
  email: string
  expiration: string
  premium: number
  type: string
}

interface RDStatus {
  connected: boolean
  configured: boolean
  user?: RDUser
  error?: string
}

interface RDTorrent {
  id: string
  filename: string
  status: string
  progress: number
  links?: string[]
  added: string
}

interface Props {
  onPlay?: (url: string, title?: string) => void
}

export function RealDebridSettings({ onPlay }: Props) {
  const [status, setStatus] = useState<RDStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [torrents, setTorrents] = useState<RDTorrent[]>([])
  const [loadingTorrents, setLoadingTorrents] = useState(false)
  const [unrestrictLink, setUnrestrictLink] = useState('')
  const [unrestrictResult, setUnrestrictResult] = useState<string | null>(null)
  const [unrestrictError, setUnrestrictError] = useState<string | null>(null)
  const [unrestrictLoading, setUnrestrictLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/realdebrid/status`)
      setStatus(await r.json())
    } catch {
      setStatus({ connected: false, configured: false, error: 'Backend unreachable' })
    }
  }, [])

  const fetchTorrents = useCallback(async () => {
    setLoadingTorrents(true)
    try {
      const r = await fetch(`${API}/api/realdebrid/torrents`)
      if (r.ok) setTorrents(await r.json())
    } catch { /* ignore */ }
    setLoadingTorrents(false)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])
  useEffect(() => {
    if (status?.connected) fetchTorrents()
  }, [status?.connected, fetchTorrents])

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch(`${API}/api/realdebrid/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setSaveError(data.error || 'Save failed'); return }
      setApiKey('')
      await fetchStatus()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUnrestrict = async () => {
    if (!unrestrictLink.trim()) return
    setUnrestrictLoading(true)
    setUnrestrictResult(null)
    setUnrestrictError(null)
    try {
      const r = await fetch(`${API}/api/realdebrid/unrestrict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: unrestrictLink.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setUnrestrictError(data.error || 'Failed'); return }
      setUnrestrictResult(data.streamUrl)
    } catch (e: any) {
      setUnrestrictError(e.message)
    } finally {
      setUnrestrictLoading(false)
    }
  }

  const expiryDate = status?.user?.expiration ? new Date(status.user.expiration) : null
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000) : null

  return (
    <div className="p-4 space-y-6 text-sm text-white max-w-2xl mx-auto">

      {/* Connection status banner */}
      <div className={`rounded-lg p-4 flex items-start gap-3 ${status?.connected ? 'bg-green-900/40 border border-green-700' : 'bg-red-900/30 border border-red-800'}`}>
        {status?.connected
          ? <CheckCircle size={22} className="text-green-400 flex-shrink-0 mt-0.5" weight="fill" />
          : <XCircle size={22} className="text-red-400 flex-shrink-0 mt-0.5" weight="fill" />}
        <div>
          {status?.connected ? (
            <>
              <p className="font-semibold text-green-300">Connected to Real-Debrid</p>
              {status.user && (
                <p className="text-green-400/80 text-xs mt-0.5">
                  {status.user.username} · {status.user.type} ·{' '}
                  {daysLeft !== null ? (
                    <span className={daysLeft < 7 ? 'text-yellow-400' : ''}>
                      {daysLeft > 0 ? `${daysLeft}d remaining` : 'Expired'}
                    </span>
                  ) : status.user.expiration}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-red-300">
                {status?.configured ? 'Connection failed' : 'Not configured'}
              </p>
              {status?.error && <p className="text-red-400/70 text-xs mt-0.5">{status.error}</p>}
            </>
          )}
        </div>
        <button onClick={fetchStatus} className="ml-auto p-1 hover:text-white text-white/50">
          <ArrowClockwise size={16} />
        </button>
      </div>

      {/* API Key configuration */}
      <div className="space-y-2">
        <label className="block font-semibold text-white/80">
          Real-Debrid API Key
          <a
            href="https://real-debrid.com/apitoken"
            target="_blank"
            rel="noreferrer"
            className="ml-2 text-xs text-blue-400 hover:underline"
          >
            Get your key →
          </a>
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={status?.configured ? '••••••••••••••••••••• (already set)' : 'Paste your API key here'}
            className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save & Test'}
          </button>
        </div>
        {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
        {status?.connected && (
          <p className="text-green-400/70 text-xs">✓ Key is valid and saved to .env</p>
        )}
      </div>

      {/* Quick unrestrict tool */}
      <div className="space-y-2">
        <p className="font-semibold text-white/80">Quick Unrestrict / Resolve</p>
        <p className="text-white/50 text-xs">Paste a magnet link, torrent URL, or hoster link (Rapidgator, 1fichier, etc.)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={unrestrictLink}
            onChange={e => setUnrestrictLink(e.target.value)}
            placeholder="magnet:?xt=urn:btih:… or https://rapidgator.net/…"
            className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 text-xs"
          />
          <button
            onClick={handleUnrestrict}
            disabled={!status?.connected || !unrestrictLink.trim() || unrestrictLoading}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-1.5"
          >
            <Lightning size={14} weight="fill" />
            {unrestrictLoading ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
        {unrestrictError && <p className="text-red-400 text-xs">{unrestrictError}</p>}
        {unrestrictResult && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-3 py-2">
            <p className="flex-1 text-green-300 text-xs font-mono truncate">{unrestrictResult}</p>
            <button
              onClick={() => navigator.clipboard.writeText(unrestrictResult)}
              className="text-white/40 hover:text-white flex-shrink-0"
            >
              <Copy size={14} />
            </button>
            {onPlay && (
              <button
                onClick={() => onPlay(unrestrictResult, 'RD Stream')}
                className="text-green-400 hover:text-green-300 flex-shrink-0 flex items-center gap-1"
              >
                <Play size={14} weight="fill" />
                <span className="text-xs">Play</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active torrents list */}
      {status?.connected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white/80">Active Torrents ({torrents.length})</p>
            <button
              onClick={fetchTorrents}
              disabled={loadingTorrents}
              className="text-white/40 hover:text-white"
            >
              <ArrowClockwise size={15} className={loadingTorrents ? 'animate-spin' : ''} />
            </button>
          </div>
          {torrents.length === 0 ? (
            <p className="text-white/30 text-xs">No active torrents</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {torrents.map((t) => (
                <div key={t.id} className="bg-white/5 border border-white/10 rounded p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white/90 truncate text-xs">{t.filename}</p>
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                      t.status === 'downloaded' ? 'bg-green-800 text-green-300' :
                      t.status === 'downloading' ? 'bg-blue-800 text-blue-300' :
                      'bg-white/10 text-white/50'
                    }`}>{t.status}</span>
                  </div>
                  {t.status === 'downloading' && (
                    <div className="w-full bg-white/10 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all"
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                  )}
                  {t.status === 'downloaded' && t.links && t.links.length > 0 && onPlay && (
                    <button
                      onClick={() => onPlay(t.links![0], t.filename)}
                      className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1 mt-1"
                    >
                      <Play size={12} weight="fill" /> Play first stream
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
