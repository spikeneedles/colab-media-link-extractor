import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Sparkle, 
  Plus, 
  Trash, 
  CheckCircle, 
  Warning,
  Copy,
  Play,
  Lightbulb,
  MagicWand,
  Code,
  X
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { 
  generatePatternFromExamples, 
  generatePatternWithAI,
  testPattern,
  optimizePattern,
  explainPattern,
  type PatternExample,
  type GeneratedPattern
} from '@/lib/patternGenerator'
import { RabbitLoader, RabbitThinking } from '@/components/AnimatedRabbit'

export function PatternGenerator() {
  const [examples, setExamples] = useState<PatternExample[]>([])
  const [newExampleUrl, setNewExampleUrl] = useState('')
  const [newExampleShouldMatch, setNewExampleShouldMatch] = useState(true)
  const [generatedPattern, setGeneratedPattern] = useState<GeneratedPattern | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [useAI, setUseAI] = useState(true)
  const [context, setContext] = useState('')
  const [testUrls, setTestUrls] = useState('')
  const [testResults, setTestResults] = useState<{ url: string; matches: boolean; error?: string }[]>([])

  const examplePresets = {
    xtreamCodes: {
      name: 'Xtream Codes API',
      examples: [
        { url: 'http://example.tv:8080/player_api.php?username=user123&password=pass456&type=m3u_plus', shouldMatch: true },
        { url: 'http://provider.com/player_api.php?username=test&password=test123', shouldMatch: true },
        { url: 'http://regular-website.com/api/data', shouldMatch: false }
      ],
      context: 'Match Xtream Codes IPTV API URLs with username/password authentication'
    },
    hls: {
      name: 'HLS Streams (.m3u8)',
      examples: [
        { url: 'https://cdn.example.com/live/channel1/720p/playlist.m3u8', shouldMatch: true },
        { url: 'http://stream.tv/hls/movie-1080p.m3u8', shouldMatch: true },
        { url: 'https://example.com/video.mp4', shouldMatch: false }
      ],
      context: 'Match HLS streaming URLs with .m3u8 extension and quality indicators'
    },
    github: {
      name: 'GitHub IPTV Lists',
      examples: [
        { url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u', shouldMatch: true },
        { url: 'https://github.com/free-iptv/free-iptv/raw/main/playlist.m3u8', shouldMatch: true },
        { url: 'https://github.com/user/repo', shouldMatch: false }
      ],
      context: 'Match GitHub raw content URLs for IPTV playlists'
    },
    rtmp: {
      name: 'RTMP Streams',
      examples: [
        { url: 'rtmp://live.example.com:1935/live/stream123', shouldMatch: true },
        { url: 'rtmps://secure.stream.tv/app/channel', shouldMatch: true },
        { url: 'http://example.com/video.mp4', shouldMatch: false }
      ],
      context: 'Match RTMP/RTMPS streaming protocol URLs'
    }
  }

  const loadPreset = useCallback((preset: keyof typeof examplePresets) => {
    const presetData = examplePresets[preset]
    setExamples(presetData.examples)
    setContext(presetData.context)
    setUseAI(true)
    toast.success(`Loaded "${presetData.name}" examples`)
  }, [])

  const addExample = useCallback(() => {
    if (!newExampleUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    try {
      new URL(newExampleUrl)
    } catch {
      toast.error('Please enter a valid URL')
      return
    }

    setExamples(prev => [
      ...prev,
      { url: newExampleUrl.trim(), shouldMatch: newExampleShouldMatch }
    ])
    setNewExampleUrl('')
    toast.success(`Added ${newExampleShouldMatch ? 'matching' : 'non-matching'} example`)
  }, [newExampleUrl, newExampleShouldMatch])

  const removeExample = useCallback((index: number) => {
    setExamples(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleGeneratePattern = useCallback(async () => {
    if (examples.length === 0) {
      toast.error('Please add at least one example URL')
      return
    }

    const matchingCount = examples.filter(e => e.shouldMatch).length
    if (matchingCount === 0) {
      toast.error('Please add at least one matching example URL')
      return
    }

    setIsGenerating(true)
    toast.loading('Generating pattern...', { id: 'pattern-generation' })

    try {
      let pattern: GeneratedPattern
      
      if (useAI) {
        pattern = await generatePatternWithAI(examples, context || undefined)
        toast.success('AI pattern generated successfully!', { id: 'pattern-generation' })
      } else {
        pattern = generatePatternFromExamples(examples)
        toast.success('Pattern generated successfully!', { id: 'pattern-generation' })
      }

      setGeneratedPattern(pattern)
    } catch (error) {
      console.error('Pattern generation error:', error)
      toast.error('Failed to generate pattern', { id: 'pattern-generation' })
    } finally {
      setIsGenerating(false)
    }
  }, [examples, useAI, context])

  const handleTestPattern = useCallback(() => {
    if (!generatedPattern) {
      toast.error('Please generate a pattern first')
      return
    }

    const urls = testUrls.split('\n').filter(url => url.trim())
    if (urls.length === 0) {
      toast.error('Please enter URLs to test')
      return
    }

    const results = testPattern(generatedPattern.regex, urls)
    setTestResults(results)
    
    const matchCount = results.filter(r => r.matches).length
    toast.success(`Tested ${results.length} URLs: ${matchCount} matched, ${results.length - matchCount} didn't match`)
  }, [generatedPattern, testUrls])

  const handleOptimizePattern = useCallback(() => {
    if (!generatedPattern) {
      toast.error('Please generate a pattern first')
      return
    }

    const { optimized, improvements } = optimizePattern(generatedPattern.regex)
    
    if (optimized !== generatedPattern.regex) {
      setGeneratedPattern({
        ...generatedPattern,
        regex: optimized,
        suggestions: [...generatedPattern.suggestions, ...improvements]
      })
      toast.success(`Pattern optimized: ${improvements.length} improvements made`)
    } else {
      toast.info('Pattern is already optimized')
    }
  }, [generatedPattern])

  const copyPattern = useCallback(() => {
    if (!generatedPattern) return
    
    navigator.clipboard.writeText(generatedPattern.regex).then(() => {
      toast.success('Pattern copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy pattern')
    })
  }, [generatedPattern])

  const loadFromCurrentScan = useCallback((urls: string[]) => {
    if (urls.length === 0) {
      toast.error('No URLs in current scan')
      return
    }

    const newExamples: PatternExample[] = urls.slice(0, 10).map(url => ({
      url,
      shouldMatch: true
    }))

    setExamples(newExamples)
    toast.success(`Loaded ${newExamples.length} examples from scan`)
  }, [])

  const explanation = generatedPattern ? explainPattern(generatedPattern.regex) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MagicWand size={24} className="text-accent" weight="fill" />
        <h3 className="text-lg font-bold text-foreground">AI Pattern Generator</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate intelligent regex patterns that understand streaming provider patterns. AI mode analyzes Xtream Codes, HLS, DASH, RTMP, GitHub playlists, CDN patterns, and more. Add matching and non-matching examples for best results.
      </p>

      <Alert className="border-accent/30 bg-accent/5 mb-4">
        <Sparkle size={16} className="text-accent" weight="fill" />
        <AlertDescription className="text-foreground text-sm">
          <strong>AI Mode (Recommended):</strong> Enable AI below for smart pattern generation that understands IPTV providers, streaming protocols, authentication patterns, quality indicators, and dynamic tokens. Perfect for complex URL patterns!
        </AlertDescription>
      </Alert>

      <Card className="bg-card border-border p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Example URLs</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-accent/30 text-accent">
                {examples.length} examples
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1 w-full mb-1">
                <Lightbulb size={14} className="text-accent" />
                <span>Quick start with presets:</span>
              </div>
              <Button
                onClick={() => loadPreset('xtreamCodes')}
                variant="outline"
                size="sm"
                className="text-xs border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
              >
                Xtream Codes
              </Button>
              <Button
                onClick={() => loadPreset('hls')}
                variant="outline"
                size="sm"
                className="text-xs border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
              >
                HLS Streams
              </Button>
              <Button
                onClick={() => loadPreset('github')}
                variant="outline"
                size="sm"
                className="text-xs border-green-500/30 hover:bg-green-500/10 text-green-400"
              >
                GitHub Playlists
              </Button>
              <Button
                onClick={() => loadPreset('rtmp')}
                variant="outline"
                size="sm"
                className="text-xs border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
              >
                RTMP Streams
              </Button>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter example URL (e.g., http://example.com/video.m3u8)"
                value={newExampleUrl}
                onChange={(e) => setNewExampleUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addExample()
                  }
                }}
                className="flex-1 font-mono text-sm"
              />
              <div className="flex gap-1">
                <Button
                  onClick={() => setNewExampleShouldMatch(true)}
                  variant={newExampleShouldMatch ? 'default' : 'outline'}
                  size="sm"
                  className={newExampleShouldMatch ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-border'}
                  title="Should match"
                >
                  <CheckCircle size={16} weight="fill" />
                </Button>
                <Button
                  onClick={() => setNewExampleShouldMatch(false)}
                  variant={!newExampleShouldMatch ? 'default' : 'outline'}
                  size="sm"
                  className={!newExampleShouldMatch ? 'bg-red-500 hover:bg-red-600 text-white' : 'border-border'}
                  title="Should NOT match"
                >
                  <X size={16} weight="bold" />
                </Button>
              </div>
              <Button
                onClick={addExample}
                variant="outline"
                size="sm"
                className="border-accent/30 hover:bg-accent/10 text-accent"
              >
                <Plus size={16} />
              </Button>
            </div>

            {examples.length > 0 ? (
              <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-3">
                <div className="space-y-2">
                  {examples.map((example, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-start gap-2 p-2 rounded hover:bg-accent/10 transition-colors group"
                    >
                      <div className="shrink-0 mt-0.5">
                        {example.shouldMatch ? (
                          <CheckCircle size={16} className="text-green-500" weight="fill" />
                        ) : (
                          <X size={16} className="text-red-500" weight="bold" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 font-mono text-xs break-all text-foreground">
                        {example.url}
                      </div>
                      <Button
                        onClick={() => removeExample(index)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash size={14} />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <Alert className="border-muted bg-muted/30">
                <AlertDescription className="text-muted-foreground text-sm text-center">
                  No examples added yet. Add URLs that should match (green ✓) and URLs that shouldn't match (red ✗) to train the pattern.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-ai"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="use-ai" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                <Sparkle size={16} className="text-accent" weight="fill" />
                Use AI for smarter pattern generation
              </label>
            </div>

            {useAI && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Textarea
                  placeholder="Optional: Provide context about what you're trying to match (e.g., 'Match all M3U8 streams from provider X that contain HD quality')"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
              </motion.div>
            )}
          </div>

          <Button
            onClick={handleGeneratePattern}
            disabled={isGenerating || examples.length === 0}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isGenerating ? (
              <>
                <RabbitLoader size={20} />
                <span className="ml-2">Generating Pattern...</span>
              </>
            ) : (
              <>
                <MagicWand size={20} weight="fill" />
                <span className="ml-2">Generate Pattern</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {generatedPattern && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="bg-card border-accent/30 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Code size={18} className="text-accent" />
                  Generated Pattern
                </h4>
                <div className="flex gap-2">
                  <Badge 
                    variant="outline" 
                    className={`${
                      generatedPattern.confidence >= 80 
                        ? 'border-green-500/30 text-green-500' 
                        : generatedPattern.confidence >= 60
                        ? 'border-yellow-500/30 text-yellow-500'
                        : 'border-red-500/30 text-red-500'
                    }`}
                  >
                    {generatedPattern.confidence}% confidence
                  </Badge>
                  <Button
                    onClick={copyPattern}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 hover:bg-accent/20"
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    onClick={handleOptimizePattern}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 hover:bg-accent/20"
                    title="Optimize pattern"
                  >
                    <Sparkle size={14} weight="fill" />
                  </Button>
                </div>
              </div>

              <div className="bg-primary/30 rounded p-3 font-mono text-sm text-foreground break-all border border-border">
                {generatedPattern.regex}
              </div>

              <div className="text-sm text-muted-foreground">
                {generatedPattern.description}
              </div>

              {generatedPattern.suggestions.length > 0 && (
                <Alert className="border-accent/30 bg-accent/5">
                  <Lightbulb size={16} className="text-accent" />
                  <AlertDescription>
                    <div className="text-sm font-semibold text-foreground mb-2">Suggestions:</div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {generatedPattern.suggestions.map((suggestion, i) => (
                        <li key={i}>• {suggestion}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="test" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="test">Test Pattern</TabsTrigger>
                  <TabsTrigger value="explain">Explanation</TabsTrigger>
                </TabsList>

                <TabsContent value="test" className="space-y-3">
                  <Textarea
                    placeholder="Enter URLs to test (one per line)"
                    value={testUrls}
                    onChange={(e) => setTestUrls(e.target.value)}
                    className="font-mono text-sm min-h-[100px]"
                  />
                  
                  <Button
                    onClick={handleTestPattern}
                    variant="outline"
                    className="w-full border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <Play size={16} weight="fill" className="mr-2" />
                    Test Pattern
                  </Button>

                  {testResults.length > 0 && (
                    <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-3">
                      <div className="space-y-2">
                        {testResults.map((result, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 p-2 rounded text-sm"
                          >
                            <div className="shrink-0 mt-0.5">
                              {result.error ? (
                                <Warning size={16} className="text-yellow-500" weight="fill" />
                              ) : result.matches ? (
                                <CheckCircle size={16} className="text-green-500" weight="fill" />
                              ) : (
                                <X size={16} className="text-muted-foreground" weight="bold" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs break-all text-foreground">
                                {result.url}
                              </div>
                              {result.error && (
                                <div className="text-xs text-red-500 mt-1">
                                  Error: {result.error}
                                </div>
                              )}
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`shrink-0 text-xs ${
                                result.matches 
                                  ? 'border-green-500/30 text-green-500' 
                                  : 'border-muted-foreground/30 text-muted-foreground'
                              }`}
                            >
                              {result.matches ? 'Match' : 'No Match'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="explain" className="space-y-3">
                  {explanation && (
                    <div className="space-y-3">
                      <Alert className="border-accent/30 bg-accent/5">
                        <AlertDescription className="text-sm text-foreground">
                          {explanation.overall}
                        </AlertDescription>
                      </Alert>

                      {explanation.streamingInsights && explanation.streamingInsights.length > 0 && (
                        <Alert className="border-purple-500/30 bg-purple-500/5">
                          <Sparkle size={16} className="text-purple-400" weight="fill" />
                          <AlertDescription>
                            <div className="text-sm font-semibold text-foreground mb-2">Streaming Provider Insights:</div>
                            <ul className="space-y-1 text-xs text-purple-200">
                              {explanation.streamingInsights.map((insight, i) => (
                                <li key={i}>• {insight}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="bg-primary/30 rounded p-3 border border-border">
                        <div className="text-xs font-semibold text-foreground mb-2">Pattern Breakdown:</div>
                        <div className="space-y-2">
                          {explanation.parts.map((part, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <code className="font-mono text-accent shrink-0 bg-accent/10 px-1 rounded">
                                {part.pattern}
                              </code>
                              <span className="text-muted-foreground">{part.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
