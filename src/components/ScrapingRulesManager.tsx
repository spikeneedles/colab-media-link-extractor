import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { 
  Code, Lightning, Plus, Trash, Copy, Download, Upload, Play, Warning, 
  CheckCircle, Clock, ArrowRight, CaretRight, CaretDown, PencilSimple, 
  X, FloppyDisk, ArrowCounterClockwise, Sparkle, Eye, List
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import { 
  ScrapingRule, 
  WaitCondition, 
  JavaScriptAction, 
  ExtractionRule,
  createDefaultRule,
  PRESET_RULES,
  validateRule,
  exportRuleSet,
  importRuleSet,
  matchRuleToUrl
} from '@/lib/scrapingRules'

export function ScrapingRulesManager() {
  const [customRules, setCustomRules] = useKV<ScrapingRule[]>('scraping-custom-rules', [])
  const [selectedRule, setSelectedRule] = useState<ScrapingRule | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']))
  const [testUrl, setTestUrl] = useState('')
  const [matchedRule, setMatchedRule] = useState<ScrapingRule | null>(null)

  const allRules = [...PRESET_RULES, ...(customRules || [])]

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }, [])

  const handleCreateNew = useCallback(() => {
    setSelectedRule(createDefaultRule())
    setShowEditor(true)
  }, [])

  const handleEditRule = useCallback((rule: ScrapingRule) => {
    setSelectedRule({ ...rule })
    setShowEditor(true)
  }, [])

  const handleDuplicateRule = useCallback((rule: ScrapingRule) => {
    const duplicated: ScrapingRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${rule.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setCustomRules(prev => [...(prev || []), duplicated])
    toast.success('Rule duplicated')
  }, [setCustomRules])

  const handleDeleteRule = useCallback((ruleId: string) => {
    setCustomRules(prev => (prev || []).filter(r => r.id !== ruleId))
    toast.success('Rule deleted')
  }, [setCustomRules])

  const handleSaveRule = useCallback(() => {
    if (!selectedRule) return

    const errors = validateRule(selectedRule)
    if (errors.length > 0) {
      toast.error(`Validation failed: ${errors[0]}`)
      return
    }

    selectedRule.updatedAt = new Date()

    setCustomRules(prev => {
      const existing = (prev || []).find(r => r.id === selectedRule.id)
      if (existing) {
        return (prev || []).map(r => r.id === selectedRule.id ? selectedRule : r)
      } else {
        return [...(prev || []), selectedRule]
      }
    })

    toast.success('Rule saved')
    setShowEditor(false)
    setSelectedRule(null)
  }, [selectedRule, setCustomRules])

  const handleImportPreset = useCallback((preset: ScrapingRule) => {
    const imported: ScrapingRule = {
      ...preset,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${preset.name} (Imported)`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setCustomRules(prev => [...(prev || []), imported])
    toast.success('Preset imported')
  }, [setCustomRules])

  const handleExportRules = useCallback(() => {
    const ruleSet = exportRuleSet(customRules || [], 'Custom Scraping Rules')
    const blob = new Blob([JSON.stringify(ruleSet, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scraping-rules-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Rules exported')
  }, [customRules])

  const handleImportRules = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ruleSet = importRuleSet(e.target?.result as string)
        setCustomRules(prev => [...(prev || []), ...ruleSet.rules])
        toast.success(`Imported ${ruleSet.rules.length} rules`)
      } catch (error) {
        toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    reader.readAsText(file)
  }, [setCustomRules])

  const handleTestUrl = useCallback(() => {
    if (!testUrl.trim()) {
      toast.error('Please enter a URL to test')
      return
    }

    const matched = matchRuleToUrl(testUrl, allRules)
    setMatchedRule(matched)
    
    if (matched) {
      toast.success(`Matched rule: ${matched.name}`)
    } else {
      toast.info('No matching rule found for this URL')
    }
  }, [testUrl, allRules])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightning size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Advanced Scraping Rules</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure custom scraping rules with JavaScript execution, element waiting, and advanced extraction patterns. Rules are matched to URLs and executed automatically during crawling.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleCreateNew}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={16} className="mr-2" />
          Create New Rule
        </Button>
        <Button
          onClick={() => setShowPresets(true)}
          variant="outline"
          className="border-accent/30 hover:bg-accent/10 text-accent"
        >
          <Sparkle size={16} className="mr-2" />
          Browse Presets ({PRESET_RULES.length})
        </Button>
        <Button
          onClick={handleExportRules}
          variant="outline"
          className="border-border"
          disabled={!customRules || customRules.length === 0}
        >
          <Download size={16} className="mr-2" />
          Export Rules
        </Button>
        <Button
          onClick={() => document.getElementById('import-rules-input')?.click()}
          variant="outline"
          className="border-border"
        >
          <Upload size={16} className="mr-2" />
          Import Rules
        </Button>
        <input
          id="import-rules-input"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportRules}
        />
      </div>

      <Card className="bg-card border-border p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Test URL Matching</h4>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a URL to test which rule would match..."
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleTestUrl}
              variant="outline"
              className="border-accent/30 hover:bg-accent/10 text-accent"
            >
              <Play size={16} className="mr-2" />
              Test
            </Button>
          </div>
          {matchedRule && (
            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-sm">
                <CheckCircle size={16} className="inline mr-2 text-accent" weight="fill" />
                <strong>Matched:</strong> {matchedRule.name}
                {matchedRule.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{matchedRule.description}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
          {testUrl && !matchedRule && matchedRule !== null && (
            <Alert className="border-muted-foreground/30 bg-muted/5">
              <AlertDescription className="text-sm">
                <Warning size={16} className="inline mr-2 text-muted-foreground" />
                No matching rule found. Consider creating a custom rule for this domain.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>

      <Tabs defaultValue="custom" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-primary/30">
          <TabsTrigger value="custom">
            Custom Rules ({customRules?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="presets">
            Preset Rules ({PRESET_RULES.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="mt-4">
          {!customRules || customRules.length === 0 ? (
            <Card className="bg-card border-border p-8">
              <div className="text-center text-muted-foreground space-y-3">
                <Code size={48} className="mx-auto opacity-50" />
                <p className="text-sm">No custom rules yet. Create one to get started!</p>
              </div>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {customRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={handleEditRule}
                    onDuplicate={handleDuplicateRule}
                    onDelete={handleDeleteRule}
                    isCustom={true}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="presets" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {PRESET_RULES.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={handleEditRule}
                  onDuplicate={handleDuplicateRule}
                  onImport={handleImportPreset}
                  isCustom={false}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {showEditor && selectedRule && (
        <RuleEditor
          rule={selectedRule}
          onChange={setSelectedRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowEditor(false)
            setSelectedRule(null)
          }}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        />
      )}
    </div>
  )
}

function RuleCard({
  rule,
  onEdit,
  onDuplicate,
  onDelete,
  onImport,
  isCustom
}: {
  rule: ScrapingRule
  onEdit: (rule: ScrapingRule) => void
  onDuplicate: (rule: ScrapingRule) => void
  onDelete?: (id: string) => void
  onImport?: (rule: ScrapingRule) => void
  isCustom: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-foreground">{rule.name}</h4>
            {!rule.enabled && (
              <Badge variant="outline" className="text-xs border-muted-foreground/30">
                Disabled
              </Badge>
            )}
            {rule.priority && (
              <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                Priority: {rule.priority}
              </Badge>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {rule.domain && (
              <Badge variant="outline" className="text-xs">
                <Code size={12} className="mr-1" />
                {rule.domain}
              </Badge>
            )}
            {rule.urlPattern && (
              <Badge variant="outline" className="text-xs">
                Pattern: {rule.urlPattern.substring(0, 30)}...
              </Badge>
            )}
            {rule.extractionRules.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {rule.extractionRules.length} extraction rules
              </Badge>
            )}
            {rule.waitConditions && rule.waitConditions.length > 0 && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                <Clock size={12} className="mr-1" />
                {rule.waitConditions.length} wait conditions
              </Badge>
            )}
            {rule.preActions && rule.preActions.length > 0 && (
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                <Lightning size={12} className="mr-1" />
                {rule.preActions.length} pre-actions
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {!isCustom && onImport && (
            <Button
              onClick={() => onImport(rule)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
              title="Import to custom rules"
            >
              <Download size={16} />
            </Button>
          )}
          <Button
            onClick={() => onEdit(rule)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
            title="Edit"
          >
            {isCustom ? <PencilSimple size={16} /> : <Eye size={16} />}
          </Button>
          <Button
            onClick={() => onDuplicate(rule)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
            title="Duplicate"
          >
            <Copy size={16} />
          </Button>
          {isCustom && onDelete && (
            <Button
              onClick={() => onDelete(rule.id)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-destructive/20 text-destructive"
              title="Delete"
            >
              <Trash size={16} />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function RuleEditor({
  rule,
  onChange,
  onSave,
  onCancel,
  expandedSections,
  onToggleSection
}: {
  rule: ScrapingRule
  onChange: (rule: ScrapingRule) => void
  onSave: () => void
  onCancel: () => void
  expandedSections: Set<string>
  onToggleSection: (section: string) => void
}) {
  const updateRule = useCallback((updates: Partial<ScrapingRule>) => {
    onChange({ ...rule, ...updates })
  }, [rule, onChange])

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code size={20} className="text-accent" />
            Edit Scraping Rule
          </DialogTitle>
          <DialogDescription>
            Configure custom JavaScript execution, element waiting, and extraction patterns
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            <SectionHeader
              title="Basic Settings"
              section="basic"
              expanded={expandedSections.has('basic')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('basic') && (
              <div className="space-y-3 pl-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Rule Name</label>
                  <Input
                    value={rule.name}
                    onChange={(e) => updateRule({ name: e.target.value })}
                    placeholder="My Custom Rule"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea
                    value={rule.description || ''}
                    onChange={(e) => updateRule({ description: e.target.value })}
                    placeholder="What does this rule do?"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Domain</label>
                    <Input
                      value={rule.domain || ''}
                      onChange={(e) => updateRule({ domain: e.target.value })}
                      placeholder="example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Priority</label>
                    <Input
                      type="number"
                      value={rule.priority || 0}
                      onChange={(e) => updateRule({ priority: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">URL Pattern (Regex)</label>
                  <Input
                    value={rule.urlPattern || ''}
                    onChange={(e) => updateRule({ urlPattern: e.target.value })}
                    placeholder=".*playlist.*"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={rule.enabled}
                    onCheckedChange={(checked) => updateRule({ enabled: checked as boolean })}
                  />
                  <label className="text-sm font-medium text-foreground">Enabled</label>
                </div>
              </div>
            )}

            <SectionHeader
              title="Wait Conditions"
              section="wait"
              expanded={expandedSections.has('wait')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('wait') && (
              <WaitConditionsEditor
                conditions={rule.waitConditions || []}
                onChange={(conditions) => updateRule({ waitConditions: conditions })}
              />
            )}

            <SectionHeader
              title="Pre-Actions (JavaScript)"
              section="preActions"
              expanded={expandedSections.has('preActions')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('preActions') && (
              <JavaScriptActionsEditor
                actions={rule.preActions || []}
                onChange={(actions) => updateRule({ preActions: actions })}
              />
            )}

            <SectionHeader
              title="Extraction Rules"
              section="extraction"
              expanded={expandedSections.has('extraction')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('extraction') && (
              <ExtractionRulesEditor
                rules={rule.extractionRules}
                onChange={(extractionRules) => updateRule({ extractionRules })}
              />
            )}

            <SectionHeader
              title="Post-Actions (JavaScript)"
              section="postActions"
              expanded={expandedSections.has('postActions')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('postActions') && (
              <JavaScriptActionsEditor
                actions={rule.postActions || []}
                onChange={(actions) => updateRule({ postActions: actions })}
              />
            )}

            <SectionHeader
              title="Pagination"
              section="pagination"
              expanded={expandedSections.has('pagination')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('pagination') && (
              <PaginationEditor
                pagination={rule.pagination}
                onChange={(pagination) => updateRule({ pagination })}
              />
            )}

            <SectionHeader
              title="Authentication"
              section="auth"
              expanded={expandedSections.has('auth')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('auth') && (
              <AuthenticationEditor
                authentication={rule.authentication}
                onChange={(authentication) => updateRule({ authentication })}
              />
            )}

            <SectionHeader
              title="Rate Limiting"
              section="rateLimit"
              expanded={expandedSections.has('rateLimit')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('rateLimit') && (
              <RateLimitEditor
                rateLimit={rule.rateLimit}
                onChange={(rateLimit) => updateRule({ rateLimit })}
              />
            )}

            <SectionHeader
              title="Error Handling"
              section="errorHandling"
              expanded={expandedSections.has('errorHandling')}
              onToggle={onToggleSection}
            />
            {expandedSections.has('errorHandling') && (
              <ErrorHandlingEditor
                errorHandling={rule.errorHandling}
                onChange={(errorHandling) => updateRule({ errorHandling })}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onCancel} variant="outline" className="border-border">
            <X size={16} className="mr-2" />
            Cancel
          </Button>
          <Button onClick={onSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <FloppyDisk size={16} className="mr-2" />
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SectionHeader({
  title,
  section,
  expanded,
  onToggle
}: {
  title: string
  section: string
  expanded: boolean
  onToggle: (section: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(section)}
      className="flex items-center gap-2 w-full text-left hover:text-accent transition-colors"
    >
      {expanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
      <span className="font-semibold text-foreground">{title}</span>
    </button>
  )
}

function WaitConditionsEditor({
  conditions,
  onChange
}: {
  conditions: WaitCondition[]
  onChange: (conditions: WaitCondition[]) => void
}) {
  const addCondition = () => {
    onChange([...conditions, { type: 'selector', selector: '', timeout: 10000 }])
  }

  const updateCondition = (index: number, updates: Partial<WaitCondition>) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], ...updates } as WaitCondition
    onChange(updated)
  }

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 pl-4">
      {conditions.map((condition, index) => (
        <Card key={index} className="bg-card/50 border-border p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Select
                value={condition.type}
                onValueChange={(value) => updateCondition(index, { type: value as any })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selector">CSS Selector</SelectItem>
                  <SelectItem value="xpath">XPath</SelectItem>
                  <SelectItem value="text">Text Content</SelectItem>
                  <SelectItem value="url">URL Pattern</SelectItem>
                  <SelectItem value="networkIdle">Network Idle</SelectItem>
                  <SelectItem value="delay">Delay</SelectItem>
                  <SelectItem value="function">Custom Function</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => removeCondition(index)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
              >
                <Trash size={16} />
              </Button>
            </div>
            
            {condition.type === 'selector' && (
              <Input
                placeholder="e.g., .content-loaded"
                value={condition.selector || ''}
                onChange={(e) => updateCondition(index, { selector: e.target.value })}
                className="font-mono text-sm"
              />
            )}
            {condition.type === 'xpath' && (
              <Input
                placeholder="e.g., //div[@class='content']"
                value={condition.xpath || ''}
                onChange={(e) => updateCondition(index, { xpath: e.target.value })}
                className="font-mono text-sm"
              />
            )}
            {condition.type === 'text' && (
              <Input
                placeholder="Text to wait for"
                value={condition.text || ''}
                onChange={(e) => updateCondition(index, { text: e.target.value })}
              />
            )}
            {condition.type === 'url' && (
              <Input
                placeholder="URL pattern (regex)"
                value={condition.pattern || ''}
                onChange={(e) => updateCondition(index, { pattern: e.target.value })}
                className="font-mono text-sm"
              />
            )}
            {condition.type === 'delay' && (
              <Input
                type="number"
                placeholder="Milliseconds"
                value={condition.ms || ''}
                onChange={(e) => updateCondition(index, { ms: parseInt(e.target.value) || 0 })}
              />
            )}
            {condition.type === 'function' && (
              <Textarea
                placeholder="return new Promise((resolve) => { ... })"
                value={condition.code || ''}
                onChange={(e) => updateCondition(index, { code: e.target.value })}
                className="font-mono text-sm"
                rows={4}
              />
            )}
            
            {condition.type !== 'delay' && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Timeout (ms)"
                  value={condition.timeout || ''}
                  onChange={(e) => updateCondition(index, { timeout: parseInt(e.target.value) || undefined })}
                />
              </div>
            )}
          </div>
        </Card>
      ))}
      <Button
        onClick={addCondition}
        variant="outline"
        size="sm"
        className="w-full border-accent/30 text-accent"
      >
        <Plus size={16} className="mr-2" />
        Add Wait Condition
      </Button>
    </div>
  )
}

function JavaScriptActionsEditor({
  actions,
  onChange
}: {
  actions: JavaScriptAction[]
  onChange: (actions: JavaScriptAction[]) => void
}) {
  const addAction = () => {
    onChange([...actions, { type: 'execute', code: '' }])
  }

  const updateAction = (index: number, updates: Partial<JavaScriptAction>) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 pl-4">
      {actions.map((action, index) => (
        <Card key={index} className="bg-card/50 border-border p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Select
                value={action.type}
                onValueChange={(value) => updateAction(index, { type: value as any })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="execute">Execute Code</SelectItem>
                  <SelectItem value="click">Click Element</SelectItem>
                  <SelectItem value="scroll">Scroll</SelectItem>
                  <SelectItem value="fill">Fill Input</SelectItem>
                  <SelectItem value="select">Select Option</SelectItem>
                  <SelectItem value="hover">Hover Element</SelectItem>
                  <SelectItem value="wait">Wait</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => removeAction(index)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
              >
                <Trash size={16} />
              </Button>
            </div>
            
            {['click', 'hover', 'fill', 'select'].includes(action.type) && (
              <Input
                placeholder="CSS Selector"
                value={action.selector || ''}
                onChange={(e) => updateAction(index, { selector: e.target.value })}
                className="font-mono text-sm"
              />
            )}
            
            {['fill', 'select'].includes(action.type) && (
              <Input
                placeholder="Value to input"
                value={action.value || ''}
                onChange={(e) => updateAction(index, { value: e.target.value })}
              />
            )}
            
            {['execute', 'scroll'].includes(action.type) && (
              <Textarea
                placeholder="JavaScript code to execute"
                value={action.code || ''}
                onChange={(e) => updateAction(index, { code: e.target.value })}
                className="font-mono text-sm"
                rows={6}
              />
            )}
            
            <Input
              type="number"
              placeholder="Wait after (ms)"
              value={action.waitAfter || ''}
              onChange={(e) => updateAction(index, { waitAfter: parseInt(e.target.value) || undefined })}
            />
          </div>
        </Card>
      ))}
      <Button
        onClick={addAction}
        variant="outline"
        size="sm"
        className="w-full border-accent/30 text-accent"
      >
        <Plus size={16} className="mr-2" />
        Add JavaScript Action
      </Button>
    </div>
  )
}

function ExtractionRulesEditor({
  rules,
  onChange
}: {
  rules: ExtractionRule[]
  onChange: (rules: ExtractionRule[]) => void
}) {
  const addRule = () => {
    onChange([...rules, { name: '', selector: '', multiple: true, required: false }])
  }

  const updateRule = (index: number, updates: Partial<ExtractionRule>) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], ...updates }
    onChange(updated)
  }

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 pl-4">
      {rules.map((rule, index) => (
        <Card key={index} className="bg-card/50 border-border p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Input
                placeholder="Rule name (e.g., media_links)"
                value={rule.name}
                onChange={(e) => updateRule(index, { name: e.target.value })}
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={() => removeRule(index)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive ml-2"
              >
                <Trash size={16} />
              </Button>
            </div>
            
            <Input
              placeholder="CSS Selector (e.g., a[href])"
              value={rule.selector || ''}
              onChange={(e) => updateRule(index, { selector: e.target.value })}
              className="font-mono text-sm"
            />
            
            <Input
              placeholder="XPath (optional)"
              value={rule.xpath || ''}
              onChange={(e) => updateRule(index, { xpath: e.target.value })}
              className="font-mono text-sm"
            />
            
            <Input
              placeholder="Regex pattern (optional)"
              value={rule.regex || ''}
              onChange={(e) => updateRule(index, { regex: e.target.value })}
              className="font-mono text-sm"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Attribute (e.g., href)"
                value={rule.attribute || ''}
                onChange={(e) => updateRule(index, { attribute: e.target.value })}
                className="font-mono text-sm"
              />
              <Input
                placeholder="Transform (optional)"
                value={rule.transform || ''}
                onChange={(e) => updateRule(index, { transform: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={rule.multiple}
                  onCheckedChange={(checked) => updateRule(index, { multiple: checked as boolean })}
                />
                <label className="text-sm text-foreground">Multiple results</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={rule.required}
                  onCheckedChange={(checked) => updateRule(index, { required: checked as boolean })}
                />
                <label className="text-sm text-foreground">Required</label>
              </div>
            </div>
          </div>
        </Card>
      ))}
      <Button
        onClick={addRule}
        variant="outline"
        size="sm"
        className="w-full border-accent/30 text-accent"
      >
        <Plus size={16} className="mr-2" />
        Add Extraction Rule
      </Button>
    </div>
  )
}

function PaginationEditor({
  pagination,
  onChange
}: {
  pagination?: ScrapingRule['pagination']
  onChange: (pagination: ScrapingRule['pagination']) => void
}) {
  const enabled = pagination?.enabled ?? false

  return (
    <div className="space-y-3 pl-4">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onChange({
            ...pagination,
            enabled: checked as boolean
          })}
        />
        <label className="text-sm font-medium text-foreground">Enable pagination</label>
      </div>
      
      {enabled && (
        <>
          <Input
            placeholder="Next page selector (e.g., .next-page)"
            value={pagination?.nextSelector || ''}
            onChange={(e) => onChange({ ...pagination, enabled: true, nextSelector: e.target.value })}
            className="font-mono text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Max pages"
              value={pagination?.maxPages || ''}
              onChange={(e) => onChange({ ...pagination, enabled: true, maxPages: parseInt(e.target.value) || undefined })}
            />
            <Input
              type="number"
              placeholder="Wait between pages (ms)"
              value={pagination?.waitBetweenPages || ''}
              onChange={(e) => onChange({ ...pagination, enabled: true, waitBetweenPages: parseInt(e.target.value) || undefined })}
            />
          </div>
        </>
      )}
    </div>
  )
}

function AuthenticationEditor({
  authentication,
  onChange
}: {
  authentication?: ScrapingRule['authentication']
  onChange: (authentication: ScrapingRule['authentication']) => void
}) {
  const type = authentication?.type ?? 'none'

  return (
    <div className="space-y-3 pl-4">
      <Select
        value={type}
        onValueChange={(value) => onChange({ ...authentication, type: value as any })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Authentication</SelectItem>
          <SelectItem value="basic">Basic Auth</SelectItem>
          <SelectItem value="form">Form Login</SelectItem>
          <SelectItem value="custom">Custom Code</SelectItem>
        </SelectContent>
      </Select>
      
      {type === 'basic' && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Username"
            value={authentication?.username || ''}
            onChange={(e) => onChange({ ...authentication, type: 'basic', username: e.target.value })}
          />
          <Input
            type="password"
            placeholder="Password"
            value={authentication?.password || ''}
            onChange={(e) => onChange({ ...authentication, type: 'basic', password: e.target.value })}
          />
        </div>
      )}
      
      {type === 'form' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Username"
              value={authentication?.username || ''}
              onChange={(e) => onChange({ ...authentication, type: 'form', username: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Password"
              value={authentication?.password || ''}
              onChange={(e) => onChange({ ...authentication, type: 'form', password: e.target.value })}
            />
          </div>
          <Input
            placeholder="Username field selector"
            value={authentication?.formSelectors?.usernameField || ''}
            onChange={(e) => onChange({ 
              ...authentication, 
              type: 'form',
              formSelectors: { 
                ...authentication?.formSelectors, 
                usernameField: e.target.value 
              }
            })}
            className="font-mono text-sm"
          />
          <Input
            placeholder="Password field selector"
            value={authentication?.formSelectors?.passwordField || ''}
            onChange={(e) => onChange({ 
              ...authentication, 
              type: 'form',
              formSelectors: { 
                ...authentication?.formSelectors, 
                passwordField: e.target.value 
              }
            })}
            className="font-mono text-sm"
          />
          <Input
            placeholder="Submit button selector"
            value={authentication?.formSelectors?.submitButton || ''}
            onChange={(e) => onChange({ 
              ...authentication, 
              type: 'form',
              formSelectors: { 
                ...authentication?.formSelectors, 
                submitButton: e.target.value 
              }
            })}
            className="font-mono text-sm"
          />
        </>
      )}
      
      {type === 'custom' && (
        <Textarea
          placeholder="Custom authentication code"
          value={authentication?.customCode || ''}
          onChange={(e) => onChange({ ...authentication, type: 'custom', customCode: e.target.value })}
          className="font-mono text-sm"
          rows={6}
        />
      )}
    </div>
  )
}

function RateLimitEditor({
  rateLimit,
  onChange
}: {
  rateLimit?: ScrapingRule['rateLimit']
  onChange: (rateLimit: ScrapingRule['rateLimit']) => void
}) {
  return (
    <div className="space-y-3 pl-4">
      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          Requests per second: {rateLimit?.requestsPerSecond || 1}
        </label>
        <Slider
          value={[rateLimit?.requestsPerSecond || 1]}
          onValueChange={(value) => onChange({ ...rateLimit, requestsPerSecond: value[0] })}
          min={1}
          max={10}
          step={1}
        />
      </div>
      <Input
        type="number"
        placeholder="Delay between requests (ms)"
        value={rateLimit?.delayBetweenRequests || ''}
        onChange={(e) => onChange({ ...rateLimit, delayBetweenRequests: parseInt(e.target.value) || undefined })}
      />
    </div>
  )
}

function ErrorHandlingEditor({
  errorHandling,
  onChange
}: {
  errorHandling?: ScrapingRule['errorHandling']
  onChange: (errorHandling: ScrapingRule['errorHandling']) => void
}) {
  return (
    <div className="space-y-3 pl-4">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Retries"
          value={errorHandling?.retries || ''}
          onChange={(e) => onChange({ ...errorHandling, retries: parseInt(e.target.value) || undefined })}
        />
        <Input
          type="number"
          placeholder="Retry delay (ms)"
          value={errorHandling?.retryDelay || ''}
          onChange={(e) => onChange({ ...errorHandling, retryDelay: parseInt(e.target.value) || undefined })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={errorHandling?.ignoreErrors ?? false}
          onCheckedChange={(checked) => onChange({ ...errorHandling, ignoreErrors: checked as boolean })}
        />
        <label className="text-sm font-medium text-foreground">Ignore errors and continue</label>
      </div>
    </div>
  )
}
