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
        attributes: Array.isArray(product.attributes) ? product.attributes.map(attr => 
            `${attr.name || ''}: ${Array.isArray(attr.options) ? attr.options.join(', ') : ''}`
        ).join('; ') : '',
        variations: Array.isArray(product.variations) ? product.variations.length : 0,
        date_created: product.date_created || '',
        date_modified: product.date_modified || ''
    };
}

// Helper function to make API requests
async function makeRequest(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Function to scrape products
async function scrapeProducts(categories = []) {
    try {
        const baseUrl = window.location.origin;
        const products = [];
        let page = 1;
        let hasMore = true;
        let progress = 0;

        while (hasMore) {
            const endpoint = `${baseUrl}/wp-json/wc/store/products?page=${page}&per_page=100`;
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
                .map(product => ({
                    id: product.id,
                    name: product.name,
                    description: product.description?.replace(/<[^>]*>/g, '').trim() || '',
                    price: product.prices?.price_html || product.prices?.price || '',
                    regular_price: product.prices?.regular_price || '',
                    sale_price: product.prices?.sale_price || '',
                    on_sale: product.on_sale || false,
                    images: product.images?.map(img => img.src).join(', ') || '',
                    categories: product.categories?.map(cat => cat.name).join(', ') || '',
                    url: product.permalink || ''
                }));

            products.push(...processedProducts);
            
            // Calculate and send progress
            progress = Math.min(100, Math.round((products.length / 387) * 100));
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                progress: progress
            });
            
            if (data.length < 100) {
                hasMore = false;
            } else {
                page++;
            }

            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return products;
    } catch (error) {
        console.error('Error scraping products:', error);
        throw error;
    }
}

// Function to scrape categories
async function scrapeCategories() {
    try {
        const baseUrl = window.location.origin;
        const categories = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const endpoint = `${baseUrl}/wp-json/wc/store/products/categories?page=${page}&per_page=100`;
            const data = await makeRequest(endpoint);
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                hasMore = false;
                break;
            }

            categories.push(...data.map(category => ({
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description?.replace(/<[^>]*>/g, '').trim() || '',
                count: category.count || 0,
                image: category.image?.src || null
            })));
            
            if (data.length < 100) {
                hasMore = false;
            } else {
                page++;
            }
        }

        return categories;
    } catch (error) {
        console.error('Error scraping categories:', error);
        throw error;
    }
}

// Message listener for popup commands
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScraping') {
        const categories = request.categories.map(cat => cat.toLowerCase());
        
        scrapeProducts(categories)
            .then(products => {
                sendResponse({ 
                    success: true, 
                    products: Array.from(products.entries())
                });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
            
        return true; // Will respond asynchronously
    }
});

// Log when content script is loaded
console.log('WooCommerce Scraper content script loaded');
