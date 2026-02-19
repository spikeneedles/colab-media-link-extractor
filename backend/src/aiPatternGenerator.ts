/**
 * @deprecated This backend pattern generator has been migrated to the frontend.
 * Pattern generation now uses Gemini AI via Spark on the frontend (src/lib/patternGenerator.ts).
 * This file is kept for reference only and is no longer used.
 * 
 * Migration: All AI pattern generation now happens in the browser using
 * the existing Spark framework integration with Gemini 2.5 Flash.
 */

import * as fs from "fs";
import { URL } from "url";

interface PatternAnalysis {
  id: string;
  name: string;
  description: string;
  category: "url-filter" | "scraping-rule" | "pagination-rule" | "provider-preset" | "crawl-config";
  pattern: string | object;
  tags: string[];
  exampleUrls: string[];
  confidence: number;
  commonTraits: string[];
  protocol?: string;
  domain?: string;
  fileExtension?: string;
}

interface AnalysisCluster {
  cluster: PatternAnalysis[];
  commonality: string;
  confidence: number;
}

export class AIPatternGenerator {
  private collectedUrls: string[] = [];
  private analysisCache: Map<string, PatternAnalysis> = new Map();

  constructor() {
    console.warn('AIPatternGenerator is deprecated. Use frontend pattern generator instead.')
  }

  /**
   * Add a URL to the learning pool
   */
  addUrl(url: string): void {
    if (!this.collectedUrls.includes(url)) {
      this.collectedUrls.push(url);
    }
  }

  /**
   * Batch add multiple URLs
   */
  addUrls(urls: string[]): void {
    urls.forEach((url) => this.addUrl(url));
  }

  /**
   * Pre-process URLs into clusters based on common traits
   */
  private clusterUrls(): AnalysisCluster[] {
    const clusters: Map<string, string[]> = new Map();

    for (const url of this.collectedUrls) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname || "unknown";
        const protocol = urlObj.protocol || "unknown";
        const pathExtension =
          url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1] || "no-ext";

        // Create cluster keys from common traits
        const clusterKey = `${protocol}//${domain}/*.${pathExtension}`;

        if (!clusters.has(clusterKey)) {
          clusters.set(clusterKey, []);
        }
        clusters.get(clusterKey)!.push(url);
      } catch (error) {
        // Skip invalid URLs
        console.warn(`Invalid URL skipped: ${url}`);
      }
    }

    const result: AnalysisCluster[] = [];
    for (const [commonality, urls] of clusters.entries()) {
      if (urls.length >= 2) {
        // Only create cluster if it has multiple URLs
        result.push({
          cluster: urls.map((u) => ({ url: u })) as unknown as PatternAnalysis[],
          commonality,
          confidence: Math.min(1, urls.length / this.collectedUrls.length),
        });
      }
    }

    return result;
  }

  /**
   * @deprecated This method is no longer used. Pattern generation moved to frontend.
   */
  async analyzeAndGeneratePatterns(): Promise<PatternAnalysis[]> {
    console.warn("Pattern generation has been moved to the frontend. Use src/lib/patternGenerator.ts instead.");
    return [];
  }

  /**
   * Get statistics about collected URLs
   */
  getStats() {
    return {
      totalUrls: this.collectedUrls.length,
      uniqueDomains: new Set(
        this.collectedUrls.map((u) => {
          try {
            return new URL(u).hostname;
          } catch {
            return "invalid";
          }
        })
      ).size,
      fileExtensions: this.getFileExtensions(),
      protocols: this.getProtocols(),
    };
  }

  private getFileExtensions(): Record<string, number> {
    const extensions: Record<string, number> = {};
    for (const url of this.collectedUrls) {
      const ext = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1] || "no-ext";
      extensions[ext] = (extensions[ext] || 0) + 1;
    }
    return extensions;
  }

  private getProtocols(): Record<string, number> {
    const protocols: Record<string, number> = {};
    for (const url of this.collectedUrls) {
      try {
        const protocol = new URL(url).protocol.replace(":", "");
        protocols[protocol] = (protocols[protocol] || 0) + 1;
      } catch {
        protocols["invalid"] = (protocols["invalid"] || 0) + 1;
      }
    }
    return protocols;
  }

  /**
   * Save generated patterns to JSON file
   */
  async savePatterns(patterns: PatternAnalysis[], filePath: string): Promise<void> {
    const existing = this.loadPatternsFromFile(filePath);
    const merged = [...existing.patterns, ...patterns];

    const updated = {
      version: "1.0.0",
      metadata: {
        type: "ai-generated",
        lastUpdated: new Date().toISOString(),
        totalPatterns: merged.length,
        description: "AI-generated patterns learned from all URLs processed",
        learningStats: this.getStats(),
      },
      patterns: merged,
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  }

  /**
   * Load patterns from JSON file
   */
  private loadPatternsFromFile(filePath: string): {
    metadata: Record<string, any>;
    patterns: PatternAnalysis[];
  } {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return { metadata: {}, patterns: [] };
    }
  }

  /**
   * Clear collected URLs
   */
  clearCollectedUrls(): void {
    this.collectedUrls = [];
  }

  /**
   * Get all collected URLs
   */
  getCollectedUrls(): string[] {
    return [...this.collectedUrls];
  }
}

export default AIPatternGenerator;
