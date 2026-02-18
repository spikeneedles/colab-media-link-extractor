import Anthropic from "@anthropic-ai/sdk";
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
  private client: Anthropic;
  private collectedUrls: string[] = [];
  private analysisCache: Map<string, PatternAnalysis> = new Map();

  constructor() {
    this.client = new Anthropic();
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
   * Analyze URL clusters with Claude AI to generate patterns
   */
  async analyzeAndGeneratePatterns(): Promise<PatternAnalysis[]> {
    if (this.collectedUrls.length < 3) {
      console.warn("Need at least 3 URLs to generate meaningful patterns");
      return [];
    }

    const clusters = this.clusterUrls();
    const generatedPatterns: PatternAnalysis[] = [];

    for (const clusterGroup of clusters) {
      try {
        const response = await (this.client as any).messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Analyze this cluster of URLs and generate a regex pattern that matches them all.

Cluster commonality: ${clusterGroup.commonality}
URLs: ${clusterGroup.cluster.map((p: any) => p.url || p.exampleUrls?.[0]).join(", ")}

You MUST respond with ONLY valid JSON, no markdown, no explanation. Structure:
{
  "regex": "/^pattern$/",
  "name": "Short descriptive name",
  "description": "What this pattern matches",
  "tags": ["tag1", "tag2"],
  "confidence": 0.85,
  "category": "url-filter"
}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === "text") {
          try {
            const parsed = JSON.parse(content.text);

            const pattern: PatternAnalysis = {
              id: `ai-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: parsed.name || "AI Generated Pattern",
              description: parsed.description || "Generated from URL analysis",
              category: parsed.category || "url-filter",
              pattern: parsed.regex || "/^pattern$/",
              tags: parsed.tags || ["ai-generated"],
              exampleUrls: clusterGroup.cluster.map((p: any) => p.url || p.exampleUrls?.[0]).filter(Boolean) as string[],
              confidence: parsed.confidence || 0.75,
              commonTraits: [clusterGroup.commonality],
            };

            generatedPatterns.push(pattern);
          } catch (parseError) {
            console.warn("Failed to parse AI response:", content.text);
          }
        }
      } catch (error) {
        console.error("Error analyzing cluster:", error);
      }
    }

    return generatedPatterns;
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
