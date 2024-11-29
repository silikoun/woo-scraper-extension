import axios from 'axios';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ora from 'ora';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WooScraper {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.consumerKey = process.env.CONSUMER_KEY;
        this.consumerSecret = process.env.CONSUMER_SECRET;
        this.categories = new Map();
        this.rateLimitDelay = parseInt(process.env.RATE_LIMIT_DELAY) || 1000;
        this.batchSize = parseInt(process.env.BATCH_SIZE) || 100;
        this.resultsDir = path.join(__dirname, 'results');
    }

    async initialize() {
        const spinner = ora('Initializing scraper...').start();
        try {
            await this.createResultsDirectory();
            await this.fetchCategories();
            spinner.succeed('Scraper initialized successfully');
            this.displayCategories();
        } catch (error) {
            spinner.fail('Failed to initialize scraper');
            throw error;
        }
    }

    async createResultsDirectory() {
        try {
            await fs.mkdir(this.resultsDir, { recursive: true });
        } catch (error) {
            console.error(chalk.red('Error creating results directory:'), error);
            throw error;
        }
    }

    async fetchCategories() {
        try {
            // First try: WordPress REST API
            const response = await axios.get(`${this.baseUrl}/wp-json/wp/v2/categories`);
            const categories = this.deduplicateCategories(response.data);
            categories.forEach(category => {
                if (category.count > 0) { // Only include categories with products
                    this.categories.set(category.id, {
                        id: category.id,
                        name: category.name.rendered || category.name,
                        count: category.count,
                        slug: category.slug
                    });
                }
            });
        } catch (error) {
            console.warn(chalk.yellow('Warning: WordPress API failed, falling back to HTML scraping'));
            try {
                // Fallback: Scrape categories from HTML
                const response = await axios.get(`${this.baseUrl}/shop/`);
                const $ = cheerio.load(response.data);
                
                let categoryId = 1;
                $('.product-category').each((_, element) => {
                    const name = $(element).find('h2.woocommerce-loop-category__title').text().trim();
                    const countMatch = name.match(/\((\d+)\)/);
                    const count = countMatch ? parseInt(countMatch[1]) : 0;
                    const cleanName = name.replace(/\(\d+\)/, '').trim();
                    
                    if (count > 0) {
                        this.categories.set(categoryId, {
                            id: categoryId,
                            name: cleanName,
                            count: count,
                            slug: cleanName.toLowerCase().replace(/\s+/g, '-')
                        });
                        categoryId++;
                    }
                });

                if (this.categories.size === 0) {
                    // Try alternative HTML structure
                    $('.wc-block-product-categories-list-item').each((_, element) => {
                        const name = $(element).text().trim();
                        const countMatch = name.match(/\((\d+)\)/);
                        const count = countMatch ? parseInt(countMatch[1]) : 0;
                        const cleanName = name.replace(/\(\d+\)/, '').trim();
                        
                        if (count > 0) {
                            this.categories.set(categoryId, {
                                id: categoryId,
                                name: cleanName,
                                count: count,
                                slug: cleanName.toLowerCase().replace(/\s+/g, '-')
                            });
                            categoryId++;
                        }
                    });
                }
            } catch (scrapeError) {
                console.error(chalk.red('Error scraping categories from HTML:'), scrapeError);
                throw scrapeError;
            }
        }

        if (this.categories.size === 0) {
            throw new Error('No categories found using any available method');
        }
    }

    deduplicateCategories(categories) {
        const seen = new Set();
        return categories.filter(category => {
            const duplicate = seen.has(category.id);
            seen.add(category.id);
            return !duplicate;
        });
    }

    displayCategories() {
        console.log(chalk.cyan('\nAvailable Categories:'));
        for (const [id, category] of this.categories) {
            console.log(chalk.white(`${id}: ${category.name} (${category.count} products)`));
        }
    }

    async scrapeProducts(selectedCategories = []) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = path.join(this.resultsDir, `products_${timestamp}.json`);
        const products = [];
        const categories = selectedCategories.length > 0 ? 
            selectedCategories : 
            Array.from(this.categories.keys());

        const progressBar = new cliProgress.SingleBar({
            format: 'Scraping Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Products',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591'
        });

        let totalProducts = 0;
        for (const categoryId of categories) {
            const category = this.categories.get(categoryId);
            if (category) {
                totalProducts += category.count;
            }
        }

        progressBar.start(totalProducts, 0);
        let scrapedCount = 0;

        for (const categoryId of categories) {
            try {
                const category = this.categories.get(categoryId);
                if (!category) continue;

                let page = 1;
                let hasMore = true;

                while (hasMore) {
                    try {
                        // First try: WordPress REST API
                        const response = await axios.get(`${this.baseUrl}/wp-json/wp/v2/product`, {
                            params: {
                                categories: categoryId,
                                per_page: this.batchSize,
                                page: page
                            }
                        });

                        const categoryProducts = response.data.map(product => ({
                            id: product.id,
                            name: product.title.rendered || product.title,
                            description: product.content.rendered || product.content,
                            excerpt: product.excerpt.rendered || product.excerpt,
                            slug: product.slug,
                            status: product.status,
                            link: product.link,
                            category: category.name,
                            // Add any additional fields available in the API response
                        }));

                        products.push(...categoryProducts);
                        scrapedCount += categoryProducts.length;
                        progressBar.update(scrapedCount);

                        // Check if there are more pages
                        const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
                        hasMore = page < totalPages;
                        page++;
                    } catch (error) {
                        // If API fails, try HTML scraping
                        try {
                            const response = await axios.get(`${this.baseUrl}/product-category/${category.slug}/page/${page}`);
                            const $ = cheerio.load(response.data);
                            const productElements = $('.product');

                            if (productElements.length === 0) {
                                hasMore = false;
                                break;
                            }

                            productElements.each((_, element) => {
                                const $product = $(element);
                                const name = $product.find('.woocommerce-loop-product__title').text().trim();
                                const price = $product.find('.price').text().trim();
                                const image = $product.find('img').attr('src');
                                const link = $product.find('a').attr('href');

                                products.push({
                                    id: products.length + 1,
                                    name,
                                    price,
                                    image,
                                    link,
                                    category: category.name
                                });
                            });

                            scrapedCount += productElements.length;
                            progressBar.update(scrapedCount);

                            hasMore = productElements.length === this.batchSize;
                            page++;
                        } catch (scrapeError) {
                            if (scrapeError.response && scrapeError.response.status === 404) {
                                hasMore = false;
                            } else {
                                console.error(chalk.red(`Error scraping products for category ${category.name}:`), scrapeError);
                            }
                            break;
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
                }
            } catch (error) {
                console.error(chalk.red(`\nError processing category ${categoryId}:`), error);
                continue;
            }
        }

        progressBar.stop();

        try {
            await fs.writeFile(resultsFile, JSON.stringify(products, null, 2));
            console.log(chalk.green(`\nSuccessfully saved ${products.length} products to ${resultsFile}`));
        } catch (error) {
            console.error(chalk.red('\nError saving results:'), error);
            throw error;
        }

        return products;
    }
}

export default WooScraper;
