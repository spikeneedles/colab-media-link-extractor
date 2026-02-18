import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  Zap,
  Eye,
  Copy,
  Trash2,
  ChevronDown,
  Tag,
  Star,
  Brain,
} from 'lucide-react'

interface Pattern {
  id: string
  name: string
  description: string
  category: 'url-filter' | 'scraping-rule' | 'pagination-rule' | 'provider-preset' | 'crawl-config'
  pattern: string | object
  tags: string[]
  exampleUrls: string[]
  confidence: number
  createdBy: string
  createdAt: string
}

interface PatternLibrary {
  version: string
  metadata: {
    type: 'human-created' | 'ai-generated'
    lastUpdated: string
    totalPatterns: number
    description: string
  }
  patterns: Pattern[]
}

const categoryColors: Record<string, string> = {
  'url-filter': 'bg-blue-100 text-blue-800',
  'scraping-rule': 'bg-green-100 text-green-800',
  'pagination-rule': 'bg-purple-100 text-purple-800',
  'provider-preset': 'bg-orange-100 text-orange-800',
  'crawl-config': 'bg-red-100 text-red-800',
}

const categoryIcons: Record<string, React.ReactNode> = {
  'url-filter': '🔗',
  'scraping-rule': '🕷️',
  'pagination-rule': '📑',
  'provider-preset': '🏢',
  'crawl-config': '🤖',
}

export function PatternManager() {
  const [humanPatterns, setHumanPatterns] = useState<Pattern[]>([])
  const [aiPatterns, setAiPatterns] = useState<Pattern[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'human' | 'ai' | 'all'>('all')
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null)
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiStats, setAiStats] = useState({
    totalUrls: 0,
    uniqueDomains: 0,
    fileExtensions: {},
    protocols: {},
  })

  // Load patterns on mount
  useEffect(() => {
    loadPatterns()
  }, [])

  const loadPatterns = async () => {
    try {
      // Load human-created patterns
      const humanResp = await fetch('/data/patterns-human.json')
      const humanData: PatternLibrary = await humanResp.json()
      setHumanPatterns(humanData.patterns)

      // Load AI-generated patterns
      const aiResp = await fetch('/data/patterns-ai-generated.json')
      const aiData: PatternLibrary = await aiResp.json()
      setAiPatterns(aiData.patterns)
      setAiStats((aiData.metadata as any).learningStats || {})
    } catch (error) {
      console.error('Failed to load patterns:', error)
    }
  }

  const getAllPatterns = () => {
    const all = [...humanPatterns, ...aiPatterns]
    return all.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = !selectedCategory || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }

  const getDisplayPatterns = () => {
    const all = getAllPatterns()
    if (activeTab === 'human') return all.filter((p) => humanPatterns.includes(p))
    if (activeTab === 'ai') return all.filter((p) => aiPatterns.includes(p))
    return all
  }

  const handleSelectPattern = (patternId: string) => {
    const newSelected = new Set(selectedPatterns)
    if (newSelected.has(patternId)) {
      newSelected.delete(patternId)
    } else {
      newSelected.add(patternId)
    }
    setSelectedPatterns(newSelected)
  }

  const handleDeletePattern = (patternId: string) => {
    if (humanPatterns.find((p) => p.id === patternId)) {
      setHumanPatterns(humanPatterns.filter((p) => p.id !== patternId))
    } else {
      setAiPatterns(aiPatterns.filter((p) => p.id !== patternId))
    }
  }

  const handleExportPatterns = () => {
    const selected = getDisplayPatterns().filter((p) => selectedPatterns.has(p.id))
    const dataStr = JSON.stringify(selected, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    const exportFileDefaultName = `patterns-${Date.now()}.json`
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const displayPatterns = getDisplayPatterns()
  const stats = {
    total: displayPatterns.length,
    urlFilters: displayPatterns.filter((p) => p.category === 'url-filter').length,
    scrapingRules: displayPatterns.filter((p) => p.category === 'scraping-rule').length,
    paginationRules: displayPatterns.filter((p) => p.category === 'pagination-rule').length,
    providerPresets: displayPatterns.filter((p) => p.category === 'provider-preset').length,
    crawlConfigs: displayPatterns.filter((p) => p.category === 'crawl-config').length,
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-2">
              Pattern Manager
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Manage and discover URL patterns for media extraction
            </p>
          </div>
          <button
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Brain className="w-5 h-5" />
            AI Generator
          </button>
        </div>

        {/* AI Generator Panel */}
        {showAIGenerator && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 mb-6 border border-indigo-200 dark:border-indigo-900">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              AI Pattern Generator
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-neutral-50 dark:bg-neutral-700 p-4 rounded">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">URLs Analyzed</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {aiStats.totalUrls || 0}
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700 p-4 rounded">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Unique Domains</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {aiStats.uniqueDomains || 0}
                </p>
              </div>
            </div>
            <button className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition">
              Generate New Patterns from Collected URLs
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Total Patterns</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Human Created</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">{humanPatterns.length}</p>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">AI Generated</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">{aiPatterns.length}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 mb-6 border border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-3 w-5 h-5 text-neutral-400" />
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                <option value="url-filter">URL Filters</option>
                <option value="scraping-rule">Scraping Rules</option>
                <option value="pagination-rule">Pagination Rules</option>
                <option value="provider-preset">Provider Presets</option>
                <option value="crawl-config">Crawl Configs</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-neutral-200 dark:border-neutral-700">
            {(['human', 'ai', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium capitalize transition ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {tab === 'human' && '👤 Community'}
                {tab === 'ai' && '🤖 AI Generated'}
                {tab === 'all' && '📚 All'}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        {selectedPatterns.size > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-6 flex items-center justify-between border border-indigo-200 dark:border-indigo-800">
            <p className="text-indigo-900 dark:text-indigo-100">
              {selectedPatterns.size} pattern{selectedPatterns.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleExportPatterns}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Download className="w-4 h-4" />
              Export Selected
            </button>
          </div>
        )}

        {/* Patterns Grid */}
        <div className="grid gap-4">
          {displayPatterns.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <Search className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-600 dark:text-neutral-400">No patterns found</p>
            </div>
          ) : (
            displayPatterns.map((pattern) => (
              <div
                key={pattern.id}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition"
                  onClick={() => setExpandedPatternId(
                    expandedPatternId === pattern.id ? null : pattern.id
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedPatterns.has(pattern.id)}
                        onChange={() => handleSelectPattern(pattern.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                          {categoryIcons[pattern.category]}
                          {pattern.name}
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                          {pattern.description}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-neutral-400 transition ${
                        expandedPatternId === pattern.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColors[pattern.category]}`}>
                      {pattern.category}
                    </span>
                    <div className="flex items-center gap-1">
                      {Array(5).fill(0).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < Math.round(pattern.confidence * 5)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-neutral-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs text-neutral-600 dark:text-neutral-400 ml-2">
                        {Math.round(pattern.confidence * 100)}% confidence
                      </span>
                    </div>
                    {aiPatterns.includes(pattern) && (
                      <span className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                        <Brain className="w-3 h-3" />
                        AI Generated
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPatternId === pattern.id && (
                  <div className="bg-neutral-50 dark:bg-neutral-700/50 border-t border-neutral-200 dark:border-neutral-700 p-4">
                    {/* Tags */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pattern.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Pattern Content */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                        Pattern
                      </p>
                      <pre className="bg-neutral-900 dark:bg-neutral-900 text-neutral-100 p-3 rounded text-xs overflow-x-auto">
                        {typeof pattern.pattern === 'string'
                          ? pattern.pattern
                          : JSON.stringify(pattern.pattern, null, 2)}
                      </pre>
                    </div>

                    {/* Example URLs */}
                    {pattern.exampleUrls.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                          Example URLs
                        </p>
                        <ul className="space-y-1">
                          {pattern.exampleUrls.slice(0, 3).map((url, i) => (
                            <li key={i} className="text-xs text-neutral-600 dark:text-neutral-400 break-all">
                              • {url}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded hover:bg-neutral-300 dark:hover:bg-neutral-500 transition text-sm">
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default PatternManager
