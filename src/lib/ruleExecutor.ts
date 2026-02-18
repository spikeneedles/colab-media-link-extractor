import { 
  ScrapingRule, 
  WaitCondition, 
  JavaScriptAction, 
  ExtractionRule,
  DEFAULT_WAIT_TIMEOUT,
  validateRule
} from './scrapingRules'
import { extractLinks } from './linkExtractor'

export type ExecutionResult = {
  success: boolean
  extractedData: Record<string, any>
  links: string[]
  errors: string[]
  timing: {
    waitTime: number
    preActionsTime: number
    extractionTime: number
    postActionsTime: number
    totalTime: number
  }
}

export type BrowserContext = {
  evaluate: (code: string) => Promise<any>
  waitFor: (condition: WaitCondition) => Promise<void>
  click: (selector: string) => Promise<void>
  fill: (selector: string, value: string) => Promise<void>
  select: (selector: string, value: string) => Promise<void>
  scroll: (x: number, y: number) => Promise<void>
  hover: (selector: string) => Promise<void>
  getContent: () => Promise<string>
  getCookies: () => Promise<Array<{name: string, value: string}>>
  setCookies: (cookies: Array<{name: string, value: string, domain?: string}>) => Promise<void>
  setHeaders: (headers: Record<string, string>) => Promise<void>
  screenshot: (options?: any) => Promise<Buffer>
}

class RuleExecutor {
  private browser: BrowserContext | null = null
  
  setBrowser(browser: BrowserContext) {
    this.browser = browser
  }
  
  async executeRule(rule: ScrapingRule, url: string): Promise<ExecutionResult> {
    if (!this.browser) {
      throw new Error('Browser context not set. Call setBrowser() first.')
    }
    
    const validationErrors = validateRule(rule)
    if (validationErrors.length > 0) {
      return {
        success: false,
        extractedData: {},
        links: [],
        errors: validationErrors,
        timing: {
          waitTime: 0,
          preActionsTime: 0,
          extractionTime: 0,
          postActionsTime: 0,
          totalTime: 0
        }
      }
    }
    
    const startTime = Date.now()
    const timing = {
      waitTime: 0,
      preActionsTime: 0,
      extractionTime: 0,
      postActionsTime: 0,
      totalTime: 0
    }
    const errors: string[] = []
    
    try {
      if (rule.cookies) {
        await this.browser.setCookies(rule.cookies)
      }
      
      if (rule.headers) {
        await this.browser.setHeaders(rule.headers)
      }
      
      if (rule.waitConditions) {
        const waitStart = Date.now()
        for (const condition of rule.waitConditions) {
          try {
            await this.executeWaitCondition(condition)
          } catch (error) {
            errors.push(`Wait condition failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
        timing.waitTime = Date.now() - waitStart
      }
      
      if (rule.preActions) {
        const preStart = Date.now()
        for (const action of rule.preActions) {
          try {
            await this.executeAction(action)
          } catch (error) {
            errors.push(`Pre-action failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
        timing.preActionsTime = Date.now() - preStart
      }
      
      const extractStart = Date.now()
      const extractedData: Record<string, any> = {}
      const allLinks: string[] = []
      
      const htmlContent = await this.browser.getContent()
      
      for (const extraction of rule.extractionRules) {
        try {
          const result = await this.executeExtraction(extraction, htmlContent)
          extractedData[extraction.name] = result
          
          if (Array.isArray(result)) {
            result.forEach(item => {
              if (typeof item === 'string' && this.isValidUrl(item)) {
                allLinks.push(item)
              }
            })
          } else if (typeof result === 'string' && this.isValidUrl(result)) {
            allLinks.push(result)
          }
        } catch (error) {
          if (extraction.required) {
            errors.push(`Required extraction "${extraction.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }
      
      const textLinks = extractLinks(htmlContent)
      textLinks.forEach(link => {
        if (!allLinks.includes(link)) {
          allLinks.push(link)
        }
      })
      
      timing.extractionTime = Date.now() - extractStart
      
      if (rule.postActions) {
        const postStart = Date.now()
        for (const action of rule.postActions) {
          try {
            const result = await this.executeAction(action)
            if (Array.isArray(result)) {
              result.forEach(item => {
                if (typeof item === 'string' && this.isValidUrl(item) && !allLinks.includes(item)) {
                  allLinks.push(item)
                }
              })
            }
          } catch (error) {
            errors.push(`Post-action failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
        timing.postActionsTime = Date.now() - postStart
      }
      
      timing.totalTime = Date.now() - startTime
      
      return {
        success: errors.length === 0,
        extractedData,
        links: [...new Set(allLinks)],
        errors,
        timing
      }
    } catch (error) {
      timing.totalTime = Date.now() - startTime
      return {
        success: false,
        extractedData: {},
        links: [],
        errors: [`Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        timing
      }
    }
  }
  
  private async executeWaitCondition(condition: WaitCondition): Promise<void> {
    if (!this.browser) throw new Error('Browser context not set')
    
    const timeout = ('timeout' in condition ? condition.timeout : undefined) || DEFAULT_WAIT_TIMEOUT
    
    switch (condition.type) {
      case 'selector':
        await this.browser.evaluate(`
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for selector: ${condition.selector}')), ${timeout});
            
            const check = () => {
              const element = document.querySelector('${condition.selector}');
              if (element) {
                clearTimeout(timeout);
                resolve(true);
              } else {
                setTimeout(check, 100);
              }
            };
            
            check();
          });
        `)
        break
        
      case 'xpath':
        await this.browser.evaluate(`
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for xpath: ${condition.xpath}')), ${timeout});
            
            const check = () => {
              const result = document.evaluate('${condition.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              if (result.singleNodeValue) {
                clearTimeout(timeout);
                resolve(true);
              } else {
                setTimeout(check, 100);
              }
            };
            
            check();
          });
        `)
        break
        
      case 'text':
        await this.browser.evaluate(`
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for text: ${condition.text}')), ${timeout});
            
            const check = () => {
              if (document.body.textContent.includes('${condition.text}')) {
                clearTimeout(timeout);
                resolve(true);
              } else {
                setTimeout(check, 100);
              }
            };
            
            check();
          });
        `)
        break
        
      case 'url':
        await this.browser.evaluate(`
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for URL pattern: ${condition.pattern}')), ${timeout});
            const pattern = new RegExp('${condition.pattern}');
            
            const check = () => {
              if (pattern.test(window.location.href)) {
                clearTimeout(timeout);
                resolve(true);
              } else {
                setTimeout(check, 100);
              }
            };
            
            check();
          });
        `)
        break
        
      case 'networkIdle':
        await this.browser.evaluate(`
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(true), ${timeout});
            let activeRequests = 0;
            let idleTimer = null;
            
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              activeRequests++;
              return originalFetch.apply(this, args).finally(() => {
                activeRequests--;
                checkIdle();
              });
            };
            
            const originalXHR = window.XMLHttpRequest;
            const XHRProxy = new Proxy(originalXHR, {
              construct: function(target, args) {
                const xhr = new target(...args);
                const originalOpen = xhr.open;
                const originalSend = xhr.send;
                
                xhr.open = function(...openArgs) {
                  activeRequests++;
                  return originalOpen.apply(this, openArgs);
                };
                
                xhr.send = function(...sendArgs) {
                  xhr.addEventListener('loadend', () => {
                    activeRequests--;
                    checkIdle();
                  });
                  return originalSend.apply(this, sendArgs);
                };
                
                return xhr;
              }
            });
            window.XMLHttpRequest = XHRProxy;
            
            function checkIdle() {
              if (idleTimer) clearTimeout(idleTimer);
              
              if (activeRequests === 0) {
                idleTimer = setTimeout(() => {
                  clearTimeout(timeout);
                  resolve(true);
                }, 500);
              }
            }
            
            checkIdle();
          });
        `)
        break
        
      case 'delay':
        await new Promise(resolve => setTimeout(resolve, condition.ms))
        break
        
      case 'function':
        if (condition.code) {
          await this.browser.evaluate(`
            return (async () => {
              ${condition.code}
            })();
          `)
        }
        break
    }
  }
  
  private async executeAction(action: JavaScriptAction): Promise<any> {
    if (!this.browser) throw new Error('Browser context not set')
    
    let result: any
    
    switch (action.type) {
      case 'execute':
        if (action.code) {
          result = await this.browser.evaluate(`
            return (async () => {
              ${action.code}
            })();
          `)
        }
        break
        
      case 'click':
        if (action.selector) {
          await this.browser.click(action.selector)
        }
        break
        
      case 'scroll':
        if (action.code) {
          await this.browser.evaluate(action.code)
        } else if (action.selector) {
          await this.browser.evaluate(`
            const element = document.querySelector('${action.selector}');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          `)
        }
        break
        
      case 'fill':
        if (action.selector && action.value) {
          await this.browser.fill(action.selector, action.value)
        }
        break
        
      case 'select':
        if (action.selector && action.value) {
          await this.browser.select(action.selector, action.value)
        }
        break
        
      case 'hover':
        if (action.selector) {
          await this.browser.hover(action.selector)
        }
        break
        
      case 'wait':
        if (action.condition) {
          await this.executeWaitCondition(action.condition)
        }
        break
    }
    
    if (action.waitAfter) {
      await new Promise(resolve => setTimeout(resolve, action.waitAfter))
    }
    
    return result
  }
  
  private async executeExtraction(extraction: ExtractionRule, htmlContent: string): Promise<any> {
    if (!this.browser) throw new Error('Browser context not set')
    
    if (extraction.selector) {
      return await this.browser.evaluate(`
        const elements = document.querySelectorAll('${extraction.selector}');
        const results = [];
        
        elements.forEach(el => {
          let value;
          ${extraction.attribute ? `
            value = el.getAttribute('${extraction.attribute}');
          ` : `
            value = el.textContent || el.innerText;
          `}
          
          if (value) {
            ${extraction.transform ? `
              value = (${extraction.transform})(value);
            ` : ''}
            
            results.push(value);
          }
        });
        
        return ${extraction.multiple ? 'results' : 'results[0] || null'};
      `)
    }
    
    if (extraction.xpath) {
      return await this.browser.evaluate(`
        const result = document.evaluate('${extraction.xpath}', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const results = [];
        
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          let value;
          ${extraction.attribute ? `
            value = node.getAttribute('${extraction.attribute}');
          ` : `
            value = node.textContent || node.innerText;
          `}
          
          if (value) {
            ${extraction.transform ? `
              value = (${extraction.transform})(value);
            ` : ''}
            
            results.push(value);
          }
        }
        
        return ${extraction.multiple ? 'results' : 'results[0] || null'};
      `)
    }
    
    if (extraction.regex) {
      const regex = new RegExp(extraction.regex, 'g')
      const matches = htmlContent.match(regex)
      
      if (!matches) {
        return extraction.multiple ? [] : null
      }
      
      let results = Array.from(matches)
      
      if (extraction.transform) {
        try {
          const transformFn = eval(`(${extraction.transform})`)
          results = results.map(transformFn)
        } catch (error) {
          console.error('Transform function error:', error)
        }
      }
      
      return extraction.multiple ? results : results[0] || null
    }
    
    return extraction.multiple ? [] : null
  }
  
  private isValidUrl(str: string): boolean {
    try {
      if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('rtsp://') && !str.startsWith('rtmp://')) {
        return false
      }
      new URL(str)
      return true
    } catch {
      return false
    }
  }
}

export const ruleExecutor = new RuleExecutor()

export async function executeRuleWithRetry(
  rule: ScrapingRule,
  url: string,
  browser: BrowserContext
): Promise<ExecutionResult> {
  const maxRetries = rule.errorHandling?.retries || 1
  const retryDelay = rule.errorHandling?.retryDelay || 2000
  
  ruleExecutor.setBrowser(browser)
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await ruleExecutor.executeRule(rule, url)
      
      if (result.success || rule.errorHandling?.ignoreErrors) {
        return result
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          extractedData: {},
          links: [],
          errors: [`All ${maxRetries} attempts failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          timing: {
            waitTime: 0,
            preActionsTime: 0,
            extractionTime: 0,
            postActionsTime: 0,
            totalTime: 0
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
  
  return {
    success: false,
    extractedData: {},
    links: [],
    errors: ['Maximum retries exceeded'],
    timing: {
      waitTime: 0,
      preActionsTime: 0,
      extractionTime: 0,
      postActionsTime: 0,
      totalTime: 0
    }
  }
}
