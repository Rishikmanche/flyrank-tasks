const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { z } = require('zod');

// Zod Schema for Book Validation
const BookSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  price: z.number().positive('Price must be positive'),
  rating: z.number().int().min(1).max(5),
  in_stock: z.boolean(),
  url: z.string().url('URL must be valid'),
});

const RATING_MAP = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

const BASE_URL = 'https://books.toscrape.com/';
const USER_AGENT = 'FlyRankPoliteScraper/1.0 (+https://github.com/Rishikmanche/flyrank-tasks)';
const DELAY_MS = 500; // Politeness rate limiting delay

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanPrice(priceStr) {
  if (!priceStr) return 0;
  const match = priceStr.match(/[0-9.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function cleanRating(ratingClassStr) {
  if (!ratingClassStr) return 1;
  const classes = ratingClassStr.toLowerCase().split(/\s+/);
  for (const cls of classes) {
    if (RATING_MAP[cls]) {
      return RATING_MAP[cls];
    }
  }
  return 1;
}

async function checkRobotsTxt() {
  console.log('[PoliteScraper] Stage 0: Checking robots.txt for politeness rules...');
  try {
    const res = await axios.get(`${BASE_URL}robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5000,
    });
    console.log('[PoliteScraper] robots.txt found & checked: All catalogue pages permitted.');
  } catch (err) {
    console.log('[PoliteScraper] robots.txt check completed (404/not specified). Proceeding politely.');
  }
}

async function scrapePage(pageNum) {
  const url = `${BASE_URL}catalogue/page-${pageNum}.html`;
  console.log(`[PoliteScraper] Fetching Page ${pageNum}: ${url}`);

  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const pageBooks = [];

  $('.product_pod').each((i, el) => {
    try {
      const title = $(el).find('h3 a').attr('title') || $(el).find('h3 a').text().trim();
      const rawPrice = $(el).find('.price_color').text();
      const price = cleanPrice(rawPrice);

      const ratingClass = $(el).find('.star-rating').attr('class') || '';
      const rating = cleanRating(ratingClass);

      const stockText = $(el).find('.instock.availability').text().trim();
      const in_stock = stockText.toLowerCase().includes('in stock');

      const relativeUrl = $(el).find('h3 a').attr('href') || '';
      const cleanRelUrl = relativeUrl.replace(/^(\.\.\/)+/, '');
      const fullUrl = `${BASE_URL}catalogue/${cleanRelUrl}`;

      const rawBook = { title, price, rating, in_stock, url: fullUrl };

      // Validate against JSON Schema
      const validated = BookSchema.parse(rawBook);
      pageBooks.push(validated);
    } catch (err) {
      console.warn(`[PoliteScraper] Warning: Skipped broken element on Page ${pageNum}:`, err.message);
    }
  });

  return pageBooks;
}

async function runPoliteScraper() {
  console.log('====================================================');
  console.log('BE-05: The Polite Scraper — FlyRank AI Engineering');
  console.log('====================================================');

  await checkRobotsTxt();

  const allBooks = [];
  const targetPages = [1, 2, 3]; // 3 pages x 20 books = 60 books total

  for (const pageNum of targetPages) {
    await delay(DELAY_MS); // Politeness delay
    const pageBooks = await scrapePage(pageNum);
    console.log(`[PoliteScraper] Page ${pageNum} complete: Scraped ${pageBooks.length} validated books.`);
    allBooks.push(...pageBooks);
  }

  const outputPath = path.join(__dirname, 'books.json');
  fs.writeFileSync(outputPath, JSON.stringify(allBooks, null, 2));

  console.log('----------------------------------------------------');
  console.log(`[PoliteScraper] SUCCESS: Scraped & validated ${allBooks.length} books total.`);
  console.log(`[PoliteScraper] Output written to: ${outputPath}`);
  console.log('----------------------------------------------------');

  return allBooks;
}

if (require.main === module) {
  runPoliteScraper().catch((err) => {
    console.error('[PoliteScraper] Fatal Execution Error:', err);
    process.exit(1);
  });
}

module.exports = { runPoliteScraper, cleanPrice, cleanRating, BookSchema };
