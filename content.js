// Helper function to extract data from API response
function extractProductData(product) {
    return {
        id: product.id || '',
        name: product.name || '',
        type: product.type || '',
        status: product.status || '',
        description: (product.description || '').replace(/<[^>]*>/g, '').trim(),
        short_description: (product.short_description || '').replace(/<[^>]*>/g, '').trim(),
        sku: product.sku || '',
        price: product.price || '',
        regular_price: product.regular_price || '',
        sale_price: product.sale_price || '',
        stock_status: product.stock_status || '',
        stock_quantity: product.stock_quantity || 0,
        categories: Array.isArray(product.categories) ? product.categories.map(cat => cat.name || '').join(', ') : '',
        tags: Array.isArray(product.tags) ? product.tags.map(tag => tag.name || '').join(', ') : '',
        images: Array.isArray(product.images) ? product.images.map(img => img.src || '').join(', ') : '',
        url: product.permalink || ''
    };
}

// Helper function to make API requests
async function makeRequest(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Function to fetch all available categories
async function fetchCategories() {
    try {
        const baseUrl = window.location.origin;
        const categories = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const endpoint = `${baseUrl}/wp-json/wc/v3/products/categories?page=${page}&per_page=100`;
            const data = await makeRequest(endpoint);
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                hasMore = false;
                break;
            }

            categories.push(...data.map(category => ({
                id: category.id,
                name: category.name,
                slug: category.slug,
                count: category.count
            })));
            
            if (data.length < 100) {
                hasMore = false;
            } else {
                page++;
            }

            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return categories;
    } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
    }
}

// Function to scrape products
async function scrapeProducts(categories = []) {
    try {
        const baseUrl = window.location.origin;
        const products = new Set();
        let page = 1;
        let hasMore = true;
        let totalProducts = 0;

        // First request to get total number of products
        const firstEndpoint = `${baseUrl}/wp-json/wc/v3/products?page=1&per_page=100`;
        const firstResponse = await fetch(firstEndpoint);
        totalProducts = parseInt(firstResponse.headers.get('X-WP-Total') || '0');

        while (hasMore) {
            const endpoint = `${baseUrl}/wp-json/wc/v3/products?page=${page}&per_page=100`;
            const data = await makeRequest(endpoint);
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                hasMore = false;
                break;
            }

            const processedProducts = data
                .filter(product => {
                    if (categories.length === 0) return true;
                    return product.categories?.some(cat => 
                        categories.includes(cat.name.toLowerCase())
                    );
                })
                .map(extractProductData);

            processedProducts.forEach(product => products.add(product));
            
            const progress = Math.min(100, Math.round((products.size / totalProducts) * 100));
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                progress: progress,
                currentCount: products.size,
                totalCount: totalProducts
            });
            
            if (data.length < 100) {
                hasMore = false;
            } else {
                page++;
            }

            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return Array.from(products);
    } catch (error) {
        console.error('Error scraping products:', error);
        throw error;
    }
}

// Message listener for popup commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCategories') {
        fetchCategories()
            .then(categories => {
                sendResponse({ 
                    success: true, 
                    categories: categories 
                });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
        return true;
    }
    
    if (request.action === 'startScraping') {
        const categories = request.categories.map(cat => cat.toLowerCase());
        
        scrapeProducts(categories)
            .then(products => {
                sendResponse({ 
                    success: true, 
                    products: products
                });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
        return true;
    }
});

// Log when content script is loaded
console.log('WooCommerce Scraper content script loaded');
