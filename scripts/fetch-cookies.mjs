#!/usr/bin/env node
/**
 * fetch-cookies.mjs
 *
 * Launches a visible (headed) stealth browser, navigates to a URL,
 * waits for Cloudflare to be solved (auto or manually), then prints
 * the cookies in JSON format ready to paste into SILAS Cookie Manager.
 *
 * Usage (run from repo root):
 *   node scripts/fetch-cookies.mjs https://www.eporner.com
 *   node scripts/fetch-cookies.mjs https://www.eporner.com --post
 *
 * Flags:
 *   --post    Automatically POST cookies to the SILAS backend (:3002)
 *   --wait N  Seconds to wait for CF challenge (default: 30)
 *
 * Note: puppeteer-extra is installed in ./backend/node_modules
 */

import { createRequire }  from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

// Resolve puppeteer-extra from backend/node_modules
const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '../backend')
const _require   = createRequire(path.join(backendDir, 'package.json'))

const puppeteerExtra = _require('puppeteer-extra')
const StealthPlugin  = _require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())

const args     = process.argv.slice(2)
const rawUrl   = args.find(a => !a.startsWith('--'))
const postFlag = args.includes('--post')
const waitIdx  = args.indexOf('--wait')
const waitSecs = waitIdx !== -1 ? parseInt(args[waitIdx + 1], 10) : 30

if (!rawUrl) {
  console.error('Usage: node scripts/fetch-cookies.mjs <url> [--post] [--wait <seconds>]')
  process.exit(1)
}

const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
const domain    = new URL(targetUrl).hostname

console.log(`\n🍪  Cookie Harvester — ${domain}`)
console.log(`    Waiting up to ${waitSecs}s for Cloudflare challenge to clear...\n`)

const browser = await puppeteerExtra.launch({
  headless: false,   // visible window — user can solve CAPTCHA if needed
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1280,800',
    '--start-maximized',
  ],
  defaultViewport: null,  // use window size instead of viewport
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

// Navigate — domcontentloaded fires quickly, then we wait manually for CF JS to run
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 0 }).catch(err => {
  console.log('  (nav note:', err.message?.split('\n')[0], ')')
})

// Give CF JS challenge 8 seconds to execute and set cookies
console.log('  Waiting for page JS to execute...')
await new Promise(r => setTimeout(r, 8000))

// Poll for cf_clearance cookie, print page title so we know what's happening
let cfCookie = null
const deadline = Date.now() + waitSecs * 1000

while (Date.now() < deadline) {
  const cookies = await page.cookies()
  cfCookie = cookies.find(c => c.name === 'cf_clearance')
  if (cfCookie) break
  const title = await page.title().catch(() => '?')
  process.stdout.write(`\r  🔍 ${cookies.length} cookies | page: "${title.substring(0, 60)}" | ${Math.ceil((deadline - Date.now()) / 1000)}s left  `)
  await new Promise(r => setTimeout(r, 2000))
}
process.stdout.write('\n')

const allCookies = await page.cookies()
await browser.close()

if (allCookies.length === 0) {
  console.error('\n❌  No cookies found. The site may have blocked the request.')
  process.exit(1)
}

if (!cfCookie) {
  console.warn('\n⚠️   cf_clearance not found — Cloudflare challenge may not have been solved.')
  console.warn('    Tip: Increase --wait or solve the CAPTCHA manually in the browser window.')
}

// Format for SILAS cookie manager (JSON array)
const cookieJson = JSON.stringify(
  allCookies.map(({ name, value, domain: d, path: p, httpOnly, secure }) =>
    ({ name, value, domain: d, path: p, httpOnly, secure })
  ), null, 2
)

console.log('\n✅  Cookies captured:\n')
console.log(cookieJson)
console.log(`\n    Total: ${allCookies.length} cookies for ${domain}`)

if (cfCookie) {
  console.log(`\n🔑  cf_clearance: ${cfCookie.value.slice(0, 50)}...`)
}

// --post: send cookies directly to SILAS backend
if (postFlag) {
  const backendUrl = process.env.VITE_BACKEND_URL ?? 'http://localhost:3002'
  const endpoint   = `${backendUrl}/api/site-crawler/cookies/${encodeURIComponent(domain)}`
  console.log(`\n📤  POSTing cookies to ${endpoint} ...`)
  try {
    const res  = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cookies: allCookies.map(({ name, value }) => ({ name, value })) }),
    })
    const data = await res.json()
    if (res.ok) {
      console.log(`✅  Saved ${data.count} cookies for ${data.domain}`)
      console.log('    Start a crawl and SILAS will use them automatically.')
    } else {
      console.error('❌  Backend error:', data.error)
    }
  } catch (err) {
    console.error('❌  Could not reach backend:', err.message)
    console.log('    Copy the JSON above and paste it into the Cookie Manager in the UI.')
  }
}

