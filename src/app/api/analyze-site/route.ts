import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  try {
    // Step 1: Fetch homepage HTML
    const baseUrl = new URL(url).origin
    const homepageHtml = await fetchPage(url)
    if (!homepageHtml) {
      return NextResponse.json({ error: 'Could not fetch the website' }, { status: 400 })
    }

    // Step 2: Try to discover products — check common e-commerce patterns
    const productData = await discoverProducts(baseUrl, homepageHtml)

    // Step 3: Send to Claude for analysis
    const analysis = await analyzeWithClaude(url, homepageHtml, productData)

    return NextResponse.json(analysis)
  } catch (err) {
    console.error('Site analysis error:', err)
    return NextResponse.json({ error: 'Failed to analyze site', detail: String(err) }, { status: 500 })
  }
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HoversBot/1.0; media-plan-generator)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Trim to ~50k chars to stay within Claude context limits
    return html.slice(0, 50000)
  } catch {
    return null
  }
}

interface ProductData {
  productUrls: string[]
  prices: number[]
  mrpPrices: number[]
  productNames: string[]
  categories: string[]
  sitemapProductCount: number | null
}

async function discoverProducts(baseUrl: string, homepageHtml: string): Promise<ProductData> {
  const result: ProductData = {
    productUrls: [],
    prices: [],
    mrpPrices: [],
    productNames: [],
    categories: [],
    sitemapProductCount: null,
  }

  // Try sitemap first for product count
  const sitemapCount = await countSitemapProducts(baseUrl)
  if (sitemapCount !== null) {
    result.sitemapProductCount = sitemapCount
  }

  // Extract product URLs from homepage (common patterns: /products/, /collections/)
  const productUrlPattern = /href=["']((?:https?:\/\/[^"']*)?\/(?:products?|shop|collections?)\/[^"'#?]*)/gi
  const matches = homepageHtml.matchAll(productUrlPattern)
  const urls = new Set<string>()
  for (const m of matches) {
    let productUrl = m[1]
    if (productUrl.startsWith('/')) productUrl = baseUrl + productUrl
    urls.add(productUrl)
  }
  result.productUrls = [...urls].slice(0, 20) // cap at 20

  // Fetch a few product pages to extract prices
  const productPages = result.productUrls.slice(0, 5)
  const priceResults = await Promise.all(productPages.map(async (pUrl) => {
    const html = await fetchPage(pUrl)
    if (!html) return null
    return extractPriceData(html)
  }))

  for (const pr of priceResults) {
    if (!pr) continue
    if (pr.sellingPrice) result.prices.push(pr.sellingPrice)
    if (pr.mrpPrice) result.mrpPrices.push(pr.mrpPrice)
    if (pr.productName) result.productNames.push(pr.productName)
    if (pr.category) result.categories.push(pr.category)
  }

  return result
}

async function countSitemapProducts(baseUrl: string): Promise<number | null> {
  try {
    // Try common sitemap locations
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_products_1.xml`, // Shopify pattern
      `${baseUrl}/product-sitemap.xml`,     // WooCommerce pattern
    ]

    for (const sUrl of sitemapUrls) {
      const res = await fetch(sUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HoversBot/1.0)' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const xml = await res.text()

      // Count <loc> entries that look like product URLs
      const locMatches = xml.match(/<loc>[^<]*\/products?\/[^<]*<\/loc>/gi)
      if (locMatches && locMatches.length > 0) {
        return locMatches.length
      }

      // If it's a sitemap index, count total URLs as rough estimate
      const allLocs = xml.match(/<loc>/gi)
      if (allLocs && allLocs.length > 5) {
        return allLocs.length
      }
    }
    return null
  } catch {
    return null
  }
}

function extractPriceData(html: string): {
  sellingPrice: number | null
  mrpPrice: number | null
  productName: string | null
  category: string | null
} {
  let sellingPrice: number | null = null
  let mrpPrice: number | null = null
  let productName: string | null = null
  let category: string | null = null

  // Try JSON-LD structured data first (most reliable)
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const m of jsonLdMatch) {
      try {
        const jsonStr = m.replace(/<\/?script[^>]*>/gi, '')
        const data = JSON.parse(jsonStr)
        const product = data['@type'] === 'Product' ? data : data['@graph']?.find((g: Record<string, string>) => g['@type'] === 'Product')
        if (product) {
          productName = product.name || null
          category = product.category || null
          const offers = product.offers
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers
            sellingPrice = parseFloat(offer.price) || null
            // Some sites put MRP in a separate field
            if (offer.highPrice) mrpPrice = parseFloat(offer.highPrice) || null
          }
        }
      } catch { /* ignore malformed JSON-LD */ }
    }
  }

  // Fallback: regex for Indian price patterns (₹1,234 or Rs. 1234)
  if (!sellingPrice) {
    const pricePattern = /(?:₹|Rs\.?\s*|INR\s*)[\s]*([\d,]+(?:\.\d{2})?)/gi
    const prices: number[] = []
    let pm
    while ((pm = pricePattern.exec(html)) !== null) {
      const p = parseFloat(pm[1].replace(/,/g, ''))
      if (p > 50 && p < 500000) prices.push(p) // reasonable product price range
    }
    if (prices.length >= 2) {
      // Usually the lower price is selling, higher is MRP
      prices.sort((a, b) => a - b)
      sellingPrice = prices[0]
      if (prices[1] > prices[0]) mrpPrice = prices[1]
    } else if (prices.length === 1) {
      sellingPrice = prices[0]
    }
  }

  // Try to get product name from OG tag or title
  if (!productName) {
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    if (ogTitle) productName = ogTitle[1]
  }

  return { sellingPrice, mrpPrice, productName, category }
}

async function analyzeWithClaude(url: string, homepageHtml: string, productData: ProductData) {
  // Strip HTML to text-ish content for Claude (meta tags + visible text hints)
  const metaTags = extractMetaTags(homepageHtml)
  const visibleText = homepageHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)

  const prompt = `Analyze this Indian e-commerce website and extract the following information. Return ONLY valid JSON, no explanation.

URL: ${url}

Meta Tags:
${JSON.stringify(metaTags, null, 2)}

Page Text (first 5000 chars):
${visibleText}

Product Data Found:
- Product URLs found: ${productData.productUrls.length}
- Sitemap product count: ${productData.sitemapProductCount ?? 'unknown'}
- Product names: ${productData.productNames.join(', ') || 'none extracted'}
- Selling prices: ${productData.prices.join(', ') || 'none extracted'}
- MRP prices: ${productData.mrpPrices.join(', ') || 'none extracted'}
- Categories: ${productData.categories.join(', ') || 'none extracted'}

Return this JSON structure:
{
  "brandName": "extracted brand name",
  "industry": "one of: fashion, skincare, fmcg, accessories, health, electronics, education, jewelry, lifestyle",
  "estimatedSkuCount": number or null,
  "estimatedAov": number in INR or null,
  "estimatedAvgDiscount": number between 0-1 (e.g. 0.15 for 15% avg discount) or null,
  "estimatedGrossMargin": number between 0-1 or null,
  "marginReasoning": "brief explanation of margin estimate",
  "industryReasoning": "brief explanation of industry classification",
  "brandDescription": "one-line description of what the brand sells",
  "priceRange": { "min": number, "max": number } or null,
  "targetAudience": "brief description of target customer"
}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { error: 'Could not parse Claude response', raw: text }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      ...parsed,
      productUrlsFound: productData.productUrls.length,
      sitemapProductCount: productData.sitemapProductCount,
      pricesExtracted: productData.prices,
      source: 'claude-site-analysis',
    }
  } catch {
    return { error: 'Invalid JSON from Claude', raw: text }
  }
}

function extractMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {}

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) tags.title = titleMatch[1].trim()

  // Meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  if (descMatch) tags.description = descMatch[1]

  // OG tags
  const ogPatterns = [
    { key: 'og:title', regex: /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i },
    { key: 'og:description', regex: /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i },
    { key: 'og:site_name', regex: /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i },
    { key: 'og:type', regex: /<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i },
  ]
  for (const { key, regex } of ogPatterns) {
    const match = html.match(regex)
    if (match) tags[key] = match[1]
  }

  // Keywords
  const kwMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)
  if (kwMatch) tags.keywords = kwMatch[1]

  return tags
}
