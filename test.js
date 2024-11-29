const axios = require('axios');

class WooCommerceScraper {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.productsPerPage = 100;
        this.timeout = 30000;
        this.axiosConfig = {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: this.timeout
        };
    }

    async validateSite() {
        try {
            const endpoints = [
                '/wp-json/wc/store/products',
                '/wp-json/wc/store/products/categories'
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(this.baseUrl + endpoint, this.axiosConfig);
                    if (response.status === 200) {
                        console.log(`✓ Endpoint ${endpoint} is valid`);
                        return true;
                    }
                } catch (e) {
                    console.log(`✗ Endpoint ${endpoint} failed:`, e.message);
                }
            }
            return false;
        } catch (error) {
            console.error('Validation error:', error.message);
            return false;
        }
    }

    async searchProducts(query, options = {}) {
        try {
            console.log(`Searching for products with query: "${query}"`);
            const params = new URLSearchParams({
                search: query,
                page: options.page || 1,
                per_page: options.per_page || this.productsPerPage,
                order: options.order || 'desc',
                orderby: options.orderby || 'relevance'
            });

            if (options.category) {
                params.append('category', options.category);
            }

            if (options.min_price) {
                params.append('min_price', options.min_price);
            }

            if (options.max_price) {
                params.append('max_price', options.max_price);
            }

            const endpoint = `${this.baseUrl}/wp-json/wc/store/products?${params.toString()}`;
            const response = await axios.get(endpoint, this.axiosConfig);
            const products = response.data;

            const mappedProducts = products.map(this._mapProduct);
            console.log(`Found ${mappedProducts.length} products matching "${query}"`);
            return mappedProducts;
        } catch (error) {
            console.error('Search error:', error.message);
            throw error;
        }
    }

    async getProductById(productId) {
        try {
            console.log(`Fetching product with ID: ${productId}`);
            const endpoint = `${this.baseUrl}/wp-json/wc/store/products/${productId}`;
            const response = await axios.get(endpoint, this.axiosConfig);
            const product = this._mapProduct(response.data);
            console.log(`Successfully fetched product: ${product.name}`);
            return product;
        } catch (error) {
            console.error(`Error fetching product ${productId}:`, error.message);
            throw error;
        }
    }

    async getProductsByCategory(categoryId, options = {}) {
        try {
            console.log(`Fetching products for category ID: ${categoryId}`);
            const params = new URLSearchParams({
                category: categoryId,
                page: options.page || 1,
                per_page: options.per_page || this.productsPerPage,
                order: options.order || 'desc',
                orderby: options.orderby || 'date'
            });

            const endpoint = `${this.baseUrl}/wp-json/wc/store/products?${params.toString()}`;
            const response = await axios.get(endpoint, this.axiosConfig);
            const products = response.data;

            const mappedProducts = products.map(this._mapProduct);
            console.log(`Found ${mappedProducts.length} products in category ${categoryId}`);
            return mappedProducts;
        } catch (error) {
            console.error(`Error fetching products for category ${categoryId}:`, error.message);
            throw error;
        }
    }

    async scrapeProducts() {
        try {
            let page = 1;
            let allProducts = [];
            let hasMore = true;

            while (hasMore) {
                console.log(`Fetching products page ${page}...`);
                const endpoint = `${this.baseUrl}/wp-json/wc/store/products?page=${page}&per_page=${this.productsPerPage}`;
                const response = await axios.get(endpoint, this.axiosConfig);
                const products = response.data;

                if (!Array.isArray(products) || products.length === 0) {
                    hasMore = false;
                    break;
                }

                const mappedProducts = products.map(this._mapProduct);
                allProducts.push(...mappedProducts);
                console.log(`Found ${mappedProducts.length} products on page ${page}`);

                if (products.length < this.productsPerPage) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            console.log(`Total products found: ${allProducts.length}`);
            return allProducts;
        } catch (error) {
            console.error('Error scraping products:', error.message);
            throw error;
        }
    }

    async scrapeCategories() {
        try {
            console.log('Fetching categories...');
            const endpoint = `${this.baseUrl}/wp-json/wc/store/products/categories`;
            const response = await axios.get(endpoint, this.axiosConfig);
            const categories = response.data;

            const mappedCategories = categories.map(category => ({
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description?.replace(/<[^>]*>/g, '').trim() || '',
                count: category.count || 0,
                parent: category.parent || 0,
                image: category.image?.src || ''
            }));

            console.log(`Total categories found: ${mappedCategories.length}`);
            return mappedCategories;
        } catch (error) {
            console.error('Error scraping categories:', error.message);
            throw error;
        }
    }

    _mapProduct(product) {
        return {
            id: product.id,
            name: product.name,
            type: product.type,
            status: product.status,
            featured: product.featured,
            catalog_visibility: product.catalog_visibility,
            description: product.description?.replace(/<[^>]*>/g, '').trim() || '',
            short_description: product.short_description?.replace(/<[^>]*>/g, '').trim() || '',
            sku: product.sku || '',
            price: product.prices?.price || '',
            regular_price: product.prices?.regular_price || '',
            sale_price: product.prices?.sale_price || '',
            on_sale: product.on_sale || false,
            stock_status: product.stock_status || '',
            stock_quantity: product.stock_quantity || 0,
            categories: product.categories?.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug
            })) || [],
            tags: product.tags?.map(tag => ({
                id: tag.id,
                name: tag.name,
                slug: tag.slug
            })) || [],
            attributes: product.attributes?.map(attr => ({
                id: attr.id,
                name: attr.name,
                options: attr.options || []
            })) || [],
            images: product.images?.map(img => ({
                id: img.id,
                src: img.src,
                alt: img.alt
            })) || [],
            variations: product.variations || [],
            permalink: product.permalink || '',
            date_created: product.date_created || '',
            date_modified: product.date_modified || ''
        };
    }
}

// Test function
async function testScraper(url) {
    console.log('Testing WooCommerce Scraper');
    console.log('Target URL:', url);
    console.log('-'.repeat(50));

    const scraper = new WooCommerceScraper(url);

    try {
        // Test site validation
        console.log('\nValidating site...');
        const isValid = await scraper.validateSite();
        console.log('Site is valid:', isValid);
        
        if (!isValid) {
            console.log('Skipping scraping as site is not valid');
            return;
        }

        // Test search functionality
        console.log('\nTesting search functionality...');
        const searchResults = await scraper.searchProducts('shirt', {
            per_page: 5,
            orderby: 'popularity'
        });
        console.log('Search results:', searchResults.length);
        console.log('Sample search result:', JSON.stringify(searchResults[0]?.name, null, 2));

        // Test getting product by ID
        if (searchResults.length > 0) {
            const productId = searchResults[0].id;
            console.log(`\nFetching product details for ID: ${productId}`);
            const product = await scraper.getProductById(productId);
            console.log('Product details:', JSON.stringify(product.name, null, 2));
        }

        // Test getting products by category
        console.log('\nFetching categories...');
        const categories = await scraper.scrapeCategories();
        if (categories.length > 0) {
            const categoryId = categories[0].id;
            console.log(`\nFetching products for category ID: ${categoryId}`);
            const categoryProducts = await scraper.getProductsByCategory(categoryId, {
                per_page: 5
            });
            console.log(`Found ${categoryProducts.length} products in category`);
            console.log('Sample category product:', JSON.stringify(categoryProducts[0]?.name, null, 2));
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Example usage
const testUrl = process.argv[2] || 'https://demo.woothemes.com/storefront';
testScraper(testUrl);
