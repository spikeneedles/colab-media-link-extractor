import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { 
  Heart, 
  CheckCircle, 
  Warning, 
  XCircle, 
  Clock, 
  Database,
  Cpu,
  HardDrive,
  ChartLine,
  Shield,
  Calendar,
  Desktop,
  ArrowClockwise,
  Plus,
  X,
  Lock,
  LockOpen,
  ShieldWarning
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface SSLCertificateInfo {
  subject: {
    CN?: string
    O?: string
    OU?: string
    C?: string
  }
  issuer: {
    CN?: string
    O?: string
    C?: string
  }
  validFrom: string
  validTo: string
  daysRemaining: number
  isValid: boolean
  isExpired: boolean
  isExpiringSoon: boolean
  serialNumber: string
  fingerprint: string
  fingerprint256: string
  subjectAltNames?: string[]
}

interface SSLHealth {
  status: 'valid' | 'expiring' | 'expired' | 'invalid' | 'unavailable'
  certificates: SSLCertificateInfo[]
  warnings: string[]
  errors: string[]
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: {
    api: ServiceHealth
    database: ServiceHealth
    crawler: ServiceHealth
    ssl?: SSLHealth
  }
  system: SystemHealth
  metrics: MetricsData
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  lastCheck: string
  message?: string
  details?: Record<string, any>
}

interface SystemHealth {
  memory: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  cpu: {
    loadAverage: number[]
    coresCount: number
  }
  process: {
    pid: number
    uptime: number
    memoryUsage: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
  }
}

interface MetricsData {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  totalLinksScanned: number
  averageJobDuration: number
  requestsPerMinute: number
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function HealthCheckMonitor() {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [sslDomains, setSslDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchHealthData = useCallback(async () => {
    setIsLoading(true)
    try {
      const queryParams = sslDomains.length > 0 
        ? `?${sslDomains.map(d => `ssl_domains=${encodeURIComponent(d)}`).join('&')}`
        : ''
      
      const response = await fetch(`${API_BASE_URL}/api/health${queryParams}`)
      const data = await response.json()
      setHealthData(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch health data:', error)
      toast.error('Failed to fetch health data')
    } finally {
      setIsLoading(false)
    }
  }, [sslDomains])

  useEffect(() => {
    fetchHealthData()
  }, [fetchHealthData])

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchHealthData()
      }, refreshInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, fetchHealthData])

  const handleAddDomain = useCallback(() => {
    if (newDomain.trim() && !sslDomains.includes(newDomain.trim())) {
      setSslDomains(prev => [...prev, newDomain.trim()] as string[])
      setNewDomain('')
      toast.success(`Added ${newDomain} for SSL monitoring`)
    }
  }, [newDomain, sslDomains])

  const handleRemoveDomain = useCallback((domain: string) => {
    setSslDomains(prev => prev.filter(d => d !== domain) as string[])
    toast.success(`Removed ${domain} from SSL monitoring`)
  }, [])

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

    return parts.join(' ')
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'valid':
        return <CheckCircle size={20} weight="fill" className="text-green-500" />
      case 'degraded':
      case 'expiring':
        return <Warning size={20} weight="fill" className="text-yellow-500" />
      case 'unhealthy':
      case 'down':
      case 'expired':
      case 'invalid':
        return <XCircle size={20} weight="fill" className="text-red-500" />
      default:
        return <ChartLine size={20} className="text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'valid':
        return 'border-green-500/30 text-green-500'
      case 'degraded':
      case 'expiring':
        return 'border-yellow-500/30 text-yellow-500'
      case 'unhealthy':
      case 'down':
      case 'expired':
      case 'invalid':
        return 'border-red-500/30 text-red-500'
      default:
        return 'border-border text-muted-foreground'
    }
  }

  if (!healthData) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <Heart size={24} className="animate-pulse" />
          <span>Loading health check data...</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Heart size={32} className="text-accent" weight="fill" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">System Health Monitor</h2>
              <p className="text-sm text-muted-foreground">
                Real-time status and SSL certificate monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchHealthData}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent"
            >
              <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              className={autoRefresh ? 'bg-accent text-accent-foreground' : 'border-border'}
            >
              <ChartLine size={16} className={autoRefresh ? 'animate-pulse' : ''} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-primary/30 border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Overall Status</span>
              {getStatusIcon(healthData.status)}
            </div>
            <Badge variant="outline" className={`text-sm uppercase ${getStatusColor(healthData.status)}`}>
              {healthData.status}
            </Badge>
          </Card>

          <Card className="bg-primary/30 border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <Clock size={20} className="text-accent" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatUptime(healthData.uptime)}
            </div>
          </Card>

          <Card className="bg-primary/30 border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Version</span>
              <Desktop size={20} className="text-accent" />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              v{healthData.version}
            </div>
          </Card>

          <Card className="bg-primary/30 border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Environment</span>
              <ChartLine size={20} className="text-accent" />
            </div>
            <Badge variant="outline" className="text-sm border-accent/30 text-accent uppercase">
              {healthData.environment}
            </Badge>
          </Card>
        </div>

        <Separator className="bg-border my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield size={20} className="text-accent" />
            Services Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/30 border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Desktop size={18} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">API</span>
                </div>
                {getStatusIcon(healthData.services.api.status)}
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {healthData.services.api.message}
              </div>
              {healthData.services.api.responseTime && (
                <Badge variant="outline" className="text-xs">
                  {healthData.services.api.responseTime}ms
                </Badge>
              )}
            </Card>

            <Card className="bg-primary/30 border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Storage</span>
                </div>
                {getStatusIcon(healthData.services.database.status)}
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {healthData.services.database.message}
              </div>
              {healthData.services.database.details && (
                <Badge variant="outline" className="text-xs">
                  {healthData.services.database.details.jobsStored} jobs
                </Badge>
              )}
            </Card>

            <Card className="bg-primary/30 border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ChartLine size={18} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Crawler</span>
                </div>
                {getStatusIcon(healthData.services.crawler.status)}
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {healthData.services.crawler.message}
              </div>
              {healthData.services.crawler.details && (
                <Badge variant="outline" className="text-xs">
                  {healthData.services.crawler.details.activeJobs} active
                </Badge>
              )}
            </Card>
          </div>
        </div>

        <Separator className="bg-border my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cpu size={20} className="text-accent" />
            System Resources
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-primary/30 border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardDrive size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-foreground">Memory Usage</span>
                </div>
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                  {healthData.system.memory.usagePercent}%
                </Badge>
              </div>
              <Progress value={healthData.system.memory.usagePercent} className="h-2 mb-2" />
              <div className="text-xs text-muted-foreground">
                {formatBytes(healthData.system.memory.used)} / {formatBytes(healthData.system.memory.total)}
              </div>
            </Card>

            <Card className="bg-primary/30 border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-accent" />
                  <span className="text-sm font-semibold text-foreground">CPU Load</span>
                </div>
                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                  {healthData.system.cpu.coresCount} cores
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Load Average: {healthData.system.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}
              </div>
            </Card>
          </div>
        </div>

        <Separator className="bg-border my-6" />

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ChartLine size={20} className="text-accent" />
            Performance Metrics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-accent">{healthData.metrics.totalJobs}</div>
              <div className="text-xs text-muted-foreground">Total Jobs</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-green-500">{healthData.metrics.completedJobs}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-yellow-500">{healthData.metrics.activeJobs}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-red-500">{healthData.metrics.failedJobs}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-accent">{healthData.metrics.totalLinksScanned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Links Scanned</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-accent">{healthData.metrics.averageJobDuration}s</div>
              <div className="text-xs text-muted-foreground">Avg Duration</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-accent">{healthData.metrics.requestsPerMinute}</div>
              <div className="text-xs text-muted-foreground">Requests/Min</div>
            </Card>

            <Card className="bg-primary/30 border-border p-3">
              <div className="text-2xl font-bold text-accent">{healthData.system.process.pid}</div>
              <div className="text-xs text-muted-foreground">Process ID</div>
            </Card>
          </div>
        </div>

        {lastUpdate && (
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Last updated: {lastUpdate.toLocaleTimeString()}
            {autoRefresh && ` • Auto-refresh every ${refreshInterval}s`}
          </div>
        )}
      </Card>

      <Card className="bg-card border-border p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={24} className="text-accent" weight="fill" />
              <h3 className="text-xl font-bold text-foreground">SSL Certificate Monitoring</h3>
            </div>
            {healthData.services.ssl && getStatusIcon(healthData.services.ssl.status)}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com or https://example.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddDomain()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleAddDomain}
              disabled={!newDomain.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus size={18} />
            </Button>
          </div>

          {sslDomains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sslDomains.map((domain) => (
                <Badge
                  key={domain}
                  variant="outline"
                  className="border-accent/30 text-accent flex items-center gap-1"
                >
                  {domain}
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {healthData.services.ssl && (
            <>
              {healthData.services.ssl.certificates.length > 0 && (
                <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
                  <div className="space-y-4">
                    {healthData.services.ssl.certificates.map((cert, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Card className="bg-card border-border p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {cert.isValid ? (
                                  <LockOpen size={20} className="text-green-500" weight="fill" />
                                ) : cert.isExpired ? (
                                  <ShieldWarning size={20} className="text-red-500" weight="fill" />
                                ) : (
                                  <Lock size={20} className="text-yellow-500" weight="fill" />
                                )}
                                <span className="font-semibold text-foreground">
                                  {cert.subject.CN || 'Unknown'}
                                </span>
                              </div>
                              {cert.subject.O && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  Organization: {cert.subject.O}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={getStatusColor(
                                cert.isValid ? 'valid' : cert.isExpired ? 'expired' : 'invalid'
                              )}
                            >
                              {cert.isValid ? 'Valid' : cert.isExpired ? 'Expired' : 'Invalid'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Issued By:</span>
                              <div className="text-foreground font-mono">{cert.issuer.CN}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Valid From:</span>
                              <div className="text-foreground font-mono">
                                {new Date(cert.validFrom).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expires:</span>
                              <div className="text-foreground font-mono">
                                {new Date(cert.validTo).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Days Remaining:</span>
                              <div className={`font-mono font-bold ${
                                cert.isExpired ? 'text-red-500' : 
                                cert.isExpiringSoon ? 'text-yellow-500' : 
                                'text-green-500'
                              }`}>
                                {cert.daysRemaining} days
                              </div>
                            </div>
                          </div>

                          {cert.subjectAltNames && cert.subjectAltNames.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="text-xs text-muted-foreground mb-1">
                                Subject Alternative Names:
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {cert.subjectAltNames.slice(0, 5).map((name, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {name}
                                  </Badge>
                                ))}
                                {cert.subjectAltNames.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{cert.subjectAltNames.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-1">Fingerprint (SHA-1):</div>
                            <div className="font-mono text-xs text-foreground break-all">
                              {cert.fingerprint}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {healthData.services.ssl.warnings.length > 0 && (
                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <Warning size={16} className="text-yellow-500" weight="fill" />
                  <AlertDescription>
                    <div className="text-sm font-semibold text-foreground mb-2">Warnings:</div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {healthData.services.ssl.warnings.map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {healthData.services.ssl.errors.length > 0 && (
                <Alert className="border-red-500/30 bg-red-500/5">
                  <XCircle size={16} className="text-red-500" weight="fill" />
                  <AlertDescription>
                    <div className="text-sm font-semibold text-foreground mb-2">Errors:</div>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {healthData.services.ssl.errors.map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {healthData.services.ssl.certificates.length === 0 && 
               healthData.services.ssl.errors.length === 0 && (
                <Alert className="border-accent/30 bg-accent/5">
                  <AlertDescription className="text-foreground text-sm">
                    <Lock size={14} className="inline mr-1" />
                    Add domains above to monitor SSL certificate validity and expiration dates.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {!healthData.services.ssl && sslDomains.length > 0 && (
            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-foreground text-sm">
                <Lock size={14} className="inline mr-1" />
                Click refresh to check SSL certificates for the added domains.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>
    </div>
  )
}
