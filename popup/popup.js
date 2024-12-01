// Global state variables for managing the application
let products = [];              // Stores all fetched products
let collections = [];          // Stores all fetched collections
let currentPage = 1;           // Current page number for product pagination
let itemsPerPage = 12;         // Number of products to display per page
let totalPages = 1;            // Total number of pages for pagination
let selectedProducts = new Set();    // Set of selected product IDs
let selectedCollections = new Set(); // Set of selected collection IDs
let activeTab = 'productsTab';       // Currently active tab
let isLoading = false;               // Loading state flag

// Platform detection state for multi-platform support
let detectedPlatform = null;
const PLATFORM = {
    WOOCOMMERCE: 'woocommerce',
    SHOPIFY: 'shopify',
    UNKNOWN: 'unknown'
};

/**
 * Logs a message to the terminal with optional type and icon
 * @param {string} message - The message to log
 * @param {string} type - Message type (info, success, error, warning)
 * @param {string} icon - Material icon name to display
 */
function log(message, type = 'info', icon = '') {
    const logContainer = document.querySelector('.log-container');
    const logContent = document.querySelector('.log-content');
    
    if (!logContainer || !logContent) return;
    
    // Show the log container if it's hidden
    logContainer.style.display = 'block';
    
    // Create log entry
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    // Add icon if provided
    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-icons';
        iconSpan.textContent = icon;
        entry.appendChild(iconSpan);
    }
    
    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    entry.appendChild(messageSpan);
    
    // Add to container
    logContent.appendChild(entry);
    
    // Scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        entry.style.opacity = '0';
        setTimeout(() => {
            entry.remove();
            // Hide container if no more entries
            if (logContent.children.length === 0) {
                logContainer.style.display = 'none';
            }
        }, 300);
    }, 5000);
}

// Clear logs
document.getElementById('clearButton')?.addEventListener('click', () => {
    const logContent = document.querySelector('.log-content');
    const logContainer = document.querySelector('.log-container');
    if (logContent) {
        logContent.innerHTML = '';
        logContainer.style.display = 'none';
    }
    
    // Also clear products and update display
    products = [];
    selectedProducts.clear();
    displayProducts();
    updateSelectedCount();
    updateButtonStates();
});

/**
 * Clears all messages from the terminal
 */
function clearTerminal() {
    const terminal = document.getElementById('terminalContent');
    if (terminal) {
        terminal.innerHTML = '';
    }
}

/**
 * Updates the pagination UI based on current page and total pages
 */
function updatePagination() {
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

/**
 * Updates the state of action buttons based on selections
 */
function updateButtonStates() {
    const exportBtn = document.getElementById('exportSelected');
    const activeTab = document.querySelector('.tab-btn.active');
    
    if (exportBtn) {
        if (activeTab?.id === 'productsTab') {
            exportBtn.disabled = selectedProducts.size === 0;
        } else if (activeTab?.id === 'collectionsTab') {
            exportBtn.disabled = selectedCollections.size === 0;
        }
    }
}

/**
 * Updates the selected count display
 */
function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    if (!countElement) return;

    const activeTab = document.querySelector('.tab-btn.active');
    const count = activeTab?.id === 'productsTab' ? 
        selectedProducts.size : 
        selectedCollections.size;

    countElement.textContent = count;
}

/**
 * Initializes all button event listeners
 */
function initializeButtons() {
    // Initialize export button
    const exportBtn = document.getElementById('exportSelected');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const modal = document.getElementById('exportModal');
            const activeTab = document.querySelector('.tab-btn.active');
            const selectedSet = activeTab?.id === 'productsTab' ? selectedProducts : selectedCollections;
            
            if (selectedSet.size === 0) {
                log('Please select items to export', 'warning', 'warning');
                return;
            }
            
            if (modal) {
                modal.style.display = 'block';
                const countElement = document.getElementById('exportCount');
                const typeElement = document.getElementById('exportType');
                if (countElement) {
                    countElement.textContent = selectedSet.size;
                }
                if (typeElement) {
                    typeElement.textContent = activeTab?.id === 'productsTab' ? 'products' : 'collections';
                }
            }
        });
    }

    // Initialize Select All button
    const selectAllBtn = document.getElementById('selectAll');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active');
            const checkboxes = document.querySelectorAll('.card-checkbox');
            const selectedSet = activeTab?.id === 'productsTab' ? selectedProducts : selectedCollections;
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                selectedSet.add(checkbox.dataset.id);
            });
            
            updateSelectedCount();
            updateButtonStates();
            log('Selected all items', 'info', 'select_all');
        });
    }

    // Initialize Invert Selection button
    const invertBtn = document.getElementById('invertSelection');
    if (invertBtn) {
        invertBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active');
            const checkboxes = document.querySelectorAll('.card-checkbox');
            const selectedSet = activeTab?.id === 'productsTab' ? selectedProducts : selectedCollections;
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    selectedSet.add(checkbox.dataset.id);
                } else {
                    selectedSet.delete(checkbox.dataset.id);
                }
            });
            
            updateSelectedCount();
            updateButtonStates();
            log('Inverted selection', 'info', 'swap_horiz');
        });
    }

    // Initialize checkbox event listeners
    document.addEventListener('change', (event) => {
        if (event.target.classList.contains('card-checkbox')) {
            const checkbox = event.target;
            const activeTab = document.querySelector('.tab-btn.active');
            const selectedSet = activeTab?.id === 'productsTab' ? selectedProducts : selectedCollections;
            
            if (checkbox.checked) {
                selectedSet.add(checkbox.dataset.id);
                log(`Selected ${checkbox.dataset.type}: ${checkbox.dataset.id}`, 'info', 'check_circle');
            } else {
                selectedSet.delete(checkbox.dataset.id);
                log(`Deselected ${checkbox.dataset.type}: ${checkbox.dataset.id}`, 'info', 'remove_circle');
            }
            
            updateSelectedCount();
            updateButtonStates();
        }
    });

    // Initialize pagination buttons
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            filterProducts();
            updatePagination();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            filterProducts();
            updatePagination();
        }
    });

    // Initialize filter inputs
    document.getElementById('searchInput')?.addEventListener('input', filterProducts);
    document.getElementById('categoryFilter')?.addEventListener('change', filterProducts);
    document.getElementById('stockFilter')?.addEventListener('change', filterProducts);
    document.getElementById('sortSelect')?.addEventListener('change', filterProducts);
}

/**
 * Detects the platform (WooCommerce or Shopify) based on the provided base URL
 * @param {string} baseUrl - The base URL of the platform
 * @returns {string} The detected platform (woocommerce, shopify, or unknown)
 */
async function detectPlatform(baseUrl) {
    try {
        // Try WooCommerce detection first
        const wooResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products`);
        if (wooResponse.ok) {
            log('WooCommerce platform detected', 'success', 'check_circle');
            return PLATFORM.WOOCOMMERCE;
        }

        // Try alternative WooCommerce endpoint
        const wooAltResponse = await fetch(`${baseUrl}/wp-json/wc/v3/products`);
        if (wooAltResponse.ok) {
            log('WooCommerce platform detected (alternative endpoint)', 'success', 'check_circle');
            return PLATFORM.WOOCOMMERCE;
        }

        // Try Shopify detection
        const shopifyResponse = await fetch(`${baseUrl}/products.json`);
        if (shopifyResponse.ok) {
            log('Shopify platform detected', 'success', 'check_circle');
            return PLATFORM.SHOPIFY;
        }

        throw new Error('Unable to detect platform');
    } catch (error) {
        log('Platform detection failed', 'error', 'error');
        return PLATFORM.UNKNOWN;
    }
}

/**
 * Scrapes products from the detected platform
 */
async function scrapeProducts() {
    try {
        setLoading(true);
        clearTerminal();
        log('Starting product scrape...', 'info', 'hourglass_empty');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('No active tab found');

        const baseUrl = new URL(tab.url).origin;
        log(`Target URL: ${baseUrl}`, 'info', 'link');

        // Detect platform if not already detected
        if (!detectedPlatform) {
            detectedPlatform = await detectPlatform(baseUrl);
        }

        if (detectedPlatform === PLATFORM.UNKNOWN) {
            throw new Error('Unsupported platform');
        }

        let fetchedProducts = [];
        if (detectedPlatform === PLATFORM.WOOCOMMERCE) {
            fetchedProducts = await scrapeWooCommerceProducts(baseUrl);
        } else if (detectedPlatform === PLATFORM.SHOPIFY) {
            fetchedProducts = await scrapeShopifyProducts(baseUrl);
        }

        products = fetchedProducts;
        totalPages = Math.ceil(products.length / itemsPerPage);
        currentPage = 1;

        log(`Successfully scraped ${products.length} products`, 'success', 'check_circle');
        filterProducts();
        updatePagination();

    } catch (error) {
        log(`Error: ${error.message}`, 'error', 'error');
        console.error('Scraping error:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Scrapes WooCommerce products from the provided base URL
 * @param {string} baseUrl - The base URL of the WooCommerce platform
 * @returns {array} The scraped WooCommerce products
 */
async function scrapeWooCommerceProducts(baseUrl) {
    const results = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100; // Maximum allowed by WooCommerce API

    while (hasMore) {
        try {
            // Try WooCommerce Store API first
            const storeUrl = `${baseUrl}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
            const response = await fetch(storeUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // If Store API fails, try WordPress REST API
                    const wpUrl = `${baseUrl}/wp-json/wp/v2/product?per_page=${perPage}&page=${page}&_embed`;
                    const wpResponse = await fetch(wpUrl, {
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    if (!wpResponse.ok) {
                        throw new Error(`Failed to fetch products. Status: ${wpResponse.status}`);
                    }

                    const wpProducts = await wpResponse.json();
                    const processedProducts = wpProducts.map(product => {
                        const priceInfo = extractPrice(product);
                        const images = [];
                        
                        // Get featured image
                        if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
                            images.push(product._embedded['wp:featuredmedia'][0].source_url);
                        }
                        
                        // Get gallery images from meta
                        if (product.meta?.gallery_images) {
                            try {
                                const galleryImages = JSON.parse(product.meta.gallery_images);
                                images.push(...galleryImages.filter(url => url));
                            } catch (e) {
                                console.warn('Failed to parse gallery images:', e);
                            }
                        }

                        return {
                            id: product.id,
                            name: product.title?.rendered || '',
                            ...priceInfo,
                            description: product.content?.rendered || '',
                            short_description: product.excerpt?.rendered || '',
                            sku: product.meta?.sku || '',
                            stock_status: product.meta?.stock_status || '',
                            images: images,
                            image_urls: images.join('\n'), // Add a separate field for CSV export
                            categories: product._embedded?.['wp:term']?.[0]?.map(term => term.name) || []
                        };
                    });
                    results.push(...processedProducts);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                const products = await response.json();
                if (products.length === 0) {
                    hasMore = false;
                    break;
                }

                const processedProducts = products.map(product => {
                    const priceInfo = extractPrice(product);
                    const images = (product.images || []).map(img => img.src).filter(url => url);

                    return {
                        id: product.id,
                        name: product.name,
                        ...priceInfo,
                        description: product.description || '',
                        short_description: product.short_description || '',
                        sku: product.sku || '',
                        stock_status: product.stock_status || '',
                        images: images,
                        image_urls: images.join('\n'), // Add a separate field for CSV export
                        categories: product.categories?.map(cat => cat.name) || []
                    };
                });
                
                results.push(...processedProducts);
            }
            
            log(`Fetched ${results.length} products...`, 'info', 'download');
            
            // Check if we have more pages from headers
            const totalPages = parseInt(response.headers.get('X-WP-TotalPages')) || 1;
            hasMore = page < totalPages;
            page++;
            
            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error('Error fetching products:', error);
            log(`Error fetching products: ${error.message}`, 'error', 'error');
            break;
        }
    }

    return results;
}

/**
 * Scrapes Shopify products from the provided base URL
 * @param {string} baseUrl - The base URL of the Shopify platform
 * @returns {array} The scraped Shopify products
 */
async function scrapeShopifyProducts(baseUrl) {
    try {
        const response = await fetch(`${baseUrl}/products.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch Shopify products');
        }

        const data = await response.json();
        return data.products || [];

    } catch (error) {
        throw new Error(`Shopify scraping failed: ${error.message}`);
    }
}

/**
 * Scrapes collections from the detected platform
 */
async function scrapeCollectionsWithUI() {
    try {
        setLoading(true);
        clearTerminal();
        log('Starting collection scrape...', 'info', 'hourglass_empty');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('No active tab found');

        const baseUrl = new URL(tab.url).origin;
        log(`Target URL: ${baseUrl}`, 'info', 'link');

        // Get the collections from the page content
        collections = await scrapeWooCommerceCollections(baseUrl);
        
        if (!collections || collections.length === 0) {
            throw new Error('No collections found. Make sure you are on a WooCommerce store page with product categories.');
        }

        log(`Successfully scraped ${collections.length} collections`, 'success', 'check_circle');
        
        // Switch to collections tab and update UI
        const collectionsTab = document.getElementById('collectionsTab');
        const collectionsContent = document.getElementById('collectionsContent');
        if (collectionsTab && collectionsContent) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            collectionsTab.classList.add('active');
            collectionsContent.classList.add('active');
        }

        displayCollections();
        updateButtonStates();
        updateSelectedCount();

    } catch (error) {
        log(`Error: ${error.message}`, 'error', 'error');
        console.error('Collection scraping error:', error);
    } finally {
        setLoading(false);
    }
}

/**
 * Scrapes WooCommerce collections from the provided base URL
 * @param {string} baseUrl - The base URL of the WooCommerce platform
 * @returns {array} The scraped WooCommerce collections
 */
async function scrapeWooCommerceCollections(baseUrl) {
    try {
        log(`Fetching collections from ${baseUrl}`, 'info', 'link');

        // Try WooCommerce REST API v3 first
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories?per_page=100`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                return data.map(category => ({
                    id: category.id,
                    name: category.name,
                    count: category.count || 0,
                    description: category.description || '',
                    slug: category.slug || '',
                    parent: category.parent || 0
                }));
            }
        } catch (error) {
            log('WC REST API v3 not available, trying Store API...', 'info', 'sync');
        }

        // Try WooCommerce Store API
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/categories?per_page=100`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                return data.map(category => ({
                    id: category.id,
                    name: category.name,
                    count: category.count || 0,
                    description: category.description || '',
                    slug: category.slug || '',
                    parent: category.parent || 0
                }));
            }
        } catch (error) {
            log('WC Store API not available, trying WordPress API...', 'info', 'sync');
        }

        // Try WordPress REST API as last resort
        const response = await fetch(`${baseUrl}/wp-json/wp/v2/product_cat?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data.map(category => ({
                id: category.id,
                name: category.name || '',
                count: category.count || 0,
                description: category.description || '',
                slug: category.slug || '',
                parent: category.parent || 0
            }));
        }

        throw new Error('No compatible API endpoints found');
    } catch (error) {
        throw new Error(`Failed to fetch collections: ${error.message}`);
    }
}

/**
 * Displays the scraped products in the UI
 */
function displayProducts() {
    console.log('Displaying products:', products.length);
    const container = document.getElementById('productsGrid');
    if (!container) {
        log('Products container not found', 'error', 'error');
        return;
    }

    container.innerHTML = '';

    if (!products || products.length === 0) {
        log('No products found to display', 'warning', 'warning');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No products found';
        container.appendChild(emptyMessage);
        return;
    }

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, products.length);
    const displayedProducts = products.slice(startIdx, endIdx);

    console.log(`Displaying products ${startIdx + 1} to ${endIdx} of ${products.length}`);

    displayedProducts.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });

    log(`Displayed ${displayedProducts.length} products`, 'success', 'check_circle');
    updatePagination();
    updateSelectedCount();
}

/**
 * Creates a product card element for the provided product
 * @param {object} product - The product data
 * @returns {HTMLElement} The product card element
 */
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'card product-card';
    card.dataset.id = product.id;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'card-checkbox';
    checkbox.dataset.id = product.id;
    checkbox.dataset.type = 'product';
    checkbox.checked = selectedProducts.has(product.id);

    // Image section
    const img = document.createElement('img');
    img.className = 'product-image';
    img.src = product.images?.[0] || 'placeholder.png';
    img.alt = product.name;
    img.onerror = function() {
        this.src = 'placeholder.png';
    };

    // Info section
    const info = document.createElement('div');
    info.className = 'product-info';

    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = product.name;

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = formatPrice(product.price);

    // Category section
    const category = document.createElement('div');
    category.className = 'product-category';
    category.innerHTML = `
        <span class="material-icons">category</span>
        ${product.categories?.[0] || 'Uncategorized'}
    `;

    // Footer section
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const sku = document.createElement('div');
    sku.className = 'product-sku';
    sku.textContent = product.sku || 'No SKU';

    footer.appendChild(sku);

    // Assemble card
    info.appendChild(title);
    info.appendChild(price);
    info.appendChild(category);

    card.appendChild(checkbox);
    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(footer);

    return card;
}

/**
 * Formats a price value with currency symbol
 * @param {number|string|object} price - The price to format
 * @param {string} currency - The currency symbol (default: $)
 * @returns {string} The formatted price
 */
function formatPrice(price, currency = '$') {
    if (!price && price !== 0) return '';
    
    // Handle price object from WooCommerce Store API
    if (typeof price === 'object') {
        if (price.raw) {
            return currency + normalizePrice(price.raw).toFixed(2);
        }
        if (price.value) {
            return currency + normalizePrice(price.value).toFixed(2);
        }
        return '';
    }
    
    // Handle numeric values
    if (typeof price === 'number' || !isNaN(price)) {
        return currency + parseFloat(price).toFixed(2);
    }
    
    // Handle price string that might include currency
    if (typeof price === 'string') {
        // Remove currency symbols and any non-numeric characters except decimal point
        const numericStr = price.replace(/[^0-9.]/g, '');
        const parsedPrice = parseFloat(numericStr);
        if (!isNaN(parsedPrice)) {
            return currency + parsedPrice.toFixed(2);
        }
    }
    
    return '';
}

/**
 * Detects if a price value is likely in minor units (cents) and converts if needed
 * @param {number|string} price - The price to check
 * @returns {number} Normalized price in major units (dollars)
 */
function normalizePrice(price) {
    if (!price && price !== 0) return '';
    
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) return '';
    
    // If price is suspiciously large (over 1000) and has no decimal points,
    // it's likely in cents and needs conversion
    if (numericPrice > 1000 && Number.isInteger(numericPrice)) {
        return numericPrice / 100;
    }
    
    return numericPrice;
}

/**
 * Extracts numeric price from various price formats
 * @param {object} product - The product object from API
 * @returns {object} Formatted price information
 */
function extractPrice(product) {
    let price = '';
    let regular_price = '';
    let sale_price = '';

    // Handle WooCommerce Store API v1 format
    if (product.prices) {
        const rawPrice = product.prices.price;
        const rawRegularPrice = product.prices.regular_price;
        const rawSalePrice = product.prices.sale_price;

        if (typeof rawPrice === 'object') {
            price = rawPrice.raw ? normalizePrice(rawPrice.raw) : rawPrice.value ? normalizePrice(rawPrice.value) : '';
        } else {
            price = normalizePrice(rawPrice);
        }

        if (typeof rawRegularPrice === 'object') {
            regular_price = rawRegularPrice.raw ? normalizePrice(rawRegularPrice.raw) : rawRegularPrice.value ? normalizePrice(rawRegularPrice.value) : '';
        } else {
            regular_price = normalizePrice(rawRegularPrice);
        }

        if (typeof rawSalePrice === 'object') {
            sale_price = rawSalePrice.raw ? normalizePrice(rawSalePrice.raw) : rawSalePrice.value ? normalizePrice(rawSalePrice.value) : '';
        } else {
            sale_price = normalizePrice(rawSalePrice);
        }
    }
    // Handle WooCommerce REST API v3 format
    else if (product.price) {
        // Try to extract numeric value from price strings
        const extractNumericPrice = (priceStr) => {
            if (!priceStr) return '';
            // Remove currency symbols and any non-numeric characters except decimal point
            const numericStr = priceStr.replace(/[^0-9.]/g, '');
            return normalizePrice(numericStr);
        };

        price = extractNumericPrice(product.price);
        regular_price = extractNumericPrice(product.regular_price);
        sale_price = extractNumericPrice(product.sale_price);
    }
    // Handle WordPress REST API format
    else if (product.meta) {
        const extractMetaPrice = (metaPrice) => {
            if (!metaPrice) return '';
            // Handle both numeric and string values
            if (typeof metaPrice === 'number') return normalizePrice(metaPrice);
            // Remove currency symbols and any non-numeric characters except decimal point
            const numericStr = metaPrice.replace(/[^0-9.]/g, '');
            return normalizePrice(numericStr);
        };

        price = extractMetaPrice(product.meta.price);
        regular_price = extractMetaPrice(product.meta.regular_price);
        sale_price = extractMetaPrice(product.meta.sale_price);
    }

    // Format prices with currency symbol
    return {
        price: formatPrice(price),
        regular_price: formatPrice(regular_price),
        sale_price: formatPrice(sale_price)
    };
}

/**
 * Displays the scraped collections in the UI
 */
function displayCollections() {
    const container = document.getElementById('collectionsContent');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (!collections.length) {
        container.innerHTML = '<div class="empty-state">No collections found. Try scraping first.</div>';
        return;
    }

    // Create collections grid
    const grid = document.createElement('div');
    grid.className = 'grid';

    collections.forEach(collection => {
        const card = createCollectionCard(collection);
        grid.appendChild(card);
    });

    container.appendChild(grid);
    updateSelectedCount();
}

/**
 * Creates a collection card element for the provided collection
 * @param {object} collection - The collection data
 * @returns {HTMLElement} The collection card element
 */
function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'card collection-card';
    card.dataset.id = collection.id;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'card-checkbox';
    checkbox.dataset.id = collection.id;
    checkbox.dataset.type = 'collection';
    checkbox.checked = selectedCollections.has(collection.id);

    const info = document.createElement('div');
    info.className = 'collection-info';

    const title = document.createElement('h3');
    title.className = 'collection-title';
    title.textContent = collection.name;

    const count = document.createElement('div');
    count.className = 'collection-count';
    count.innerHTML = `
        <span class="material-icons">inventory_2</span>
        ${collection.count} products
    `;

    const description = document.createElement('p');
    description.className = 'collection-description';
    description.textContent = collection.description || 'No description available';

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const slug = document.createElement('div');
    slug.className = 'collection-slug';
    slug.textContent = collection.slug;

    footer.appendChild(slug);

    info.appendChild(title);
    info.appendChild(count);
    if (collection.description) {
        info.appendChild(description);
    }

    card.appendChild(checkbox);
    card.appendChild(info);
    card.appendChild(footer);

    return card;
}

/**
 * Creates a loading skeleton card
 * @returns {HTMLElement} The skeleton card element
 */
function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-card loading-skeleton';

    const image = document.createElement('div');
    image.className = 'skeleton-image loading-skeleton';

    const content = document.createElement('div');
    content.className = 'skeleton-content';

    const title = document.createElement('div');
    title.className = 'skeleton-title loading-skeleton';

    const price = document.createElement('div');
    price.className = 'skeleton-price loading-skeleton';

    content.appendChild(title);
    content.appendChild(price);

    card.appendChild(image);
    card.appendChild(content);

    return card;
}

/**
 * Shows loading state in the grid
 * @param {string} containerId - The ID of the container element
 * @param {number} count - Number of skeleton cards to show
 */
function showLoadingState(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const loadingGrid = document.createElement('div');
    loadingGrid.className = 'grid-loading';

    for (let i = 0; i < count; i++) {
        loadingGrid.appendChild(createSkeletonCard());
    }

    container.innerHTML = '';
    container.appendChild(loadingGrid);
}

/**
 * Displays the empty state message
 * @param {string} containerId - The ID of the container element
 * @param {string} message - The message to display
 * @param {string} icon - The material icon name
 */
function showEmptyState(containerId, message, icon = 'inventory') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-message';
    emptyState.innerHTML = `
        <span class="material-icons">${icon}</span>
        <p>${message}</p>
    `;

    container.innerHTML = '';
    container.appendChild(emptyState);
}

/**
 * Filters products based on search term, category, and stock status
 */
function filterProducts() {
    const searchInput = document.getElementById('searchInput');
    const searchBy = document.getElementById('searchBy');
    const stockSelect = document.getElementById('stockStatus');
    const priceRange = document.getElementById('priceRange');
    const sortSelect = document.getElementById('sortBy');

    if (!searchInput || !searchBy || !stockSelect || !priceRange || !sortSelect) {
        console.warn('Filter elements not found');
        return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    const searchField = searchBy.value;
    const stockFilter = stockSelect.value;
    const priceFilter = priceRange.value;
    const sortBy = sortSelect.value;

    let filteredProducts = [...products];

    // Apply search filter
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => {
            if (searchField === 'all') {
                return (
                    product.name.toLowerCase().includes(searchTerm) ||
                    (product.sku && product.sku.toLowerCase().includes(searchTerm)) ||
                    (product.description && product.description.toLowerCase().includes(searchTerm))
                );
            } else if (searchField === 'title') {
                return product.name.toLowerCase().includes(searchTerm);
            } else if (searchField === 'sku') {
                return product.sku && product.sku.toLowerCase().includes(searchTerm);
            } else if (searchField === 'description') {
                return product.description && product.description.toLowerCase().includes(searchTerm);
            }
            return false;
        });
    }

    // Apply stock filter
    if (stockFilter !== 'all') {
        filteredProducts = filteredProducts.filter(product => {
            if (stockFilter === 'instock') {
                return product.inStock;
            } else {
                return !product.inStock;
            }
        });
    }

    // Apply price filter
    if (priceFilter !== 'all') {
        filteredProducts = filteredProducts.filter(product => {
            const price = parseFloat(product.price);
            switch (priceFilter) {
                case 'under10':
                    return price < 10;
                case '10to50':
                    return price >= 10 && price <= 50;
                case '50to100':
                    return price > 50 && price <= 100;
                case 'over100':
                    return price > 100;
                default:
                    return true;
            }
        });
    }

    // Apply sorting
    filteredProducts = sortProducts(filteredProducts, sortBy);

    // Update display
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) {
        console.warn('Products grid element not found');
        return;
    }

    productsGrid.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<div class="no-results">No products found</div>';
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);

    console.log(`Displaying products ${startIndex + 1} to ${endIndex} of ${filteredProducts.length}`);

    // Display products
    productsToShow.forEach(product => {
        const card = createProductCard(product);
        productsGrid.appendChild(card);
    });

    // Update total pages
    totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    updatePagination();
}

function sortProducts(products, sortBy) {
    return [...products].sort((a, b) => {
        switch (sortBy) {
            case 'price_asc':
                return parseFloat(a.price) - parseFloat(b.price);
            case 'price_desc':
                return parseFloat(b.price) - parseFloat(a.price);
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            case 'sku_asc':
                return (a.sku || '').localeCompare(b.sku || '');
            case 'sku_desc':
                return (b.sku || '').localeCompare(a.sku || '');
            case 'stock_asc':
                return (a.stockQuantity || 0) - (b.stockQuantity || 0);
            case 'stock_desc':
                return (b.stockQuantity || 0) - (a.stockQuantity || 0);
            default:
                return 0;
        }
    });
}

/**
 * Sets up event listeners for tab buttons
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const contentId = tab.id.replace('Tab', 'Content');
            document.getElementById(contentId)?.classList.add('active');

            // Clear selections when switching tabs
            if (tab.id === 'productsTab') {
                selectedCollections.clear();
            } else if (tab.id === 'collectionsTab') {
                selectedProducts.clear();
            }
            updateButtonStates();
            updateSelectedCount();
        });
    });
}

/**
 * Switches to the specified tab
 * @param {string} tabId - The ID of the tab to switch to
 */
function switchTab(tabId) {
    // Update active tab
    activeTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

/**
 * Sets up the export modal functionality
 */
function setupExportModal() {
    const modal = document.getElementById('exportModal');
    const closeBtn = modal?.querySelector('.close-button');
    const confirmBtn = document.getElementById('confirmExport');
    const exportFieldsContainer = document.getElementById('exportFields');

    if (!modal) return;

    // Close modal when clicking close button
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Update field options when modal is shown
    const exportBtn = document.getElementById('exportSelected');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active');
            const selectedSet = activeTab?.id === 'productsTab' ? selectedProducts : selectedCollections;

            if (!selectedSet || selectedSet.size === 0) {
                log('Please select items to export', 'warning', 'warning');
                return;
            }

            // Update field options based on the active tab
            if (exportFieldsContainer) {
                const fields = activeTab?.id === 'productsTab' ? PRODUCT_FIELDS : COLLECTION_FIELDS;
                exportFieldsContainer.innerHTML = fields.map(field => `
                    <label class="field-option">
                        <input type="checkbox" 
                               name="export_field" 
                               value="${field.id}" 
                               ${field.default ? 'checked' : ''}>
                        ${field.label}
                    </label>
                `).join('');
            }

            modal.style.display = 'block';

            // Update count in modal
            const countElement = document.getElementById('exportCount');
            const typeElement = document.getElementById('exportType');
            if (countElement) {
                countElement.textContent = selectedSet.size;
            }
            if (typeElement) {
                typeElement.textContent = activeTab?.id === 'productsTab' ? 'products' : 'collections';
            }
        });
    }

    // Handle export confirmation
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const activeTab = document.querySelector('.tab-btn.active');
            if (!activeTab) {
                log('No active tab found', 'error', 'error');
                return;
            }

            const selectedSet = activeTab.id === 'productsTab' ? selectedProducts : selectedCollections;
            const allItems = activeTab.id === 'productsTab' ? products : collections;

            if (!selectedSet || selectedSet.size === 0) {
                log('No items selected for export', 'warning', 'warning');
                return;
            }

            try {
                // Get selected fields
                const selectedFields = Array.from(document.querySelectorAll('input[name="export_field"]:checked'))
                    .map(checkbox => checkbox.value);

                if (selectedFields.length === 0) {
                    throw new Error('Please select at least one field to export');
                }

                const selectedItems = Array.from(selectedSet)
                    .map(id => allItems.find(item => String(item.id) === String(id)))
                    .filter(item => item != null)
                    .map(item => {
                        const exportItem = {};
                        selectedFields.forEach(field => {
                            exportItem[field] = item[field];
                        });
                        return exportItem;
                    });

                if (selectedItems.length === 0) {
                    throw new Error('No valid items found for export');
                }

                await exportToCSV(selectedItems, selectedFields);
                modal.style.display = 'none';
                log('Export completed successfully', 'success', 'check_circle');
            } catch (error) {
                log(`Export failed: ${error.message}`, 'error', 'error');
                console.error('Export error:', error);
            }
        };
    }
}

// Field definitions for export
const PRODUCT_FIELDS = [
    { id: 'id', label: 'ID', default: true },
    { id: 'name', label: 'Name', default: true },
    { id: 'price', label: 'Price', default: true },
    { id: 'regular_price', label: 'Regular Price', default: false },
    { id: 'sale_price', label: 'Sale Price', default: false },
    { id: 'sku', label: 'SKU', default: true },
    { id: 'stock_status', label: 'Stock Status', default: true },
    { id: 'description', label: 'Description', default: false },
    { id: 'short_description', label: 'Short Description', default: false },
    { id: 'categories', label: 'Categories', default: true },
    { id: 'image_urls', label: 'Image URLs', default: true } // Changed from 'images' to 'image_urls'
];

const COLLECTION_FIELDS = [
    { id: 'id', label: 'ID', default: true },
    { id: 'name', label: 'Name', default: true },
    { id: 'description', label: 'Description', default: true },
    { id: 'slug', label: 'Slug', default: false },
    { id: 'count', label: 'Product Count', default: true }
];

async function exportToCSV(items, fields) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('No items to export');
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
        throw new Error('No fields selected for export');
    }

    // Create CSV content
    const csvContent = [
        // Header row
        fields.join(','),
        // Data rows
        ...items.map(item => 
            fields.map(field => {
                let value = item[field];
                
                // Handle special cases
                if (field === 'price' || field === 'regular_price' || field === 'sale_price') {
                    value = typeof value === 'object' ? value?.amount || '' : value;
                } else if (field === 'stock_status') {
                    value = value || 'outofstock';
                } else if (field === 'categories') {
                    value = Array.isArray(value) ? value.map(cat => cat.name || cat).join(';') : '';
                } else if (field === 'image_urls') {
                    // Use the pre-formatted image_urls field
                    value = item.image_urls || '';
                } else if (field === 'description' || field === 'short_description') {
                    // Remove HTML tags and normalize whitespace
                    value = value ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                }

                // Convert to string and escape if needed
                value = String(value || '');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const type = fields.includes('price') ? 'products' : 'collections';
    const filename = `${type}_export_${timestamp}.csv`;
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Sets the loading state of the UI
 * @param {boolean} loading - Whether the UI is in a loading state
 */
function setLoading(loading) {
    isLoading = loading;
    const scrapeButton = document.getElementById('scrapeButton');
    const loadingIcon = document.querySelector('.logo-animation .material-icons.secondary');
    
    if (scrapeButton) {
        scrapeButton.disabled = loading;
        scrapeButton.style.cursor = loading ? 'wait' : 'pointer';
    }
    
    if (loadingIcon) {
        loadingIcon.style.animation = loading ? 'spin 1s linear infinite' : 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupExportModal();
    
    // Set up tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding content
            const contentId = button.id.replace('Tab', 'Content');
            document.getElementById(contentId)?.classList.add('active');

            // Clear selections when switching tabs
            if (button.id === 'productsTab') {
                selectedCollections.clear();
            } else if (button.id === 'collectionsTab') {
                selectedProducts.clear();
            }
            updateButtonStates();
            updateSelectedCount();
        });
    });

    // Initialize scrape button
    const scrapeButton = document.getElementById('scrapeButton');
    if (scrapeButton) {
        scrapeButton.addEventListener('click', async () => {
            if (isLoading) return;
            
            try {
                setLoading(true);
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab.id === 'productsTab') {
                    await scrapeProducts();
                } else if (activeTab.id === 'collectionsTab') {
                    await scrapeCollectionsWithUI();
                }
            } catch (error) {
                log(`Error: ${error.message}`, 'error', 'error');
                console.error('Scraping error:', error);
            } finally {
                setLoading(false);
            }
        });
    }

    // Initialize other UI elements
    initializeButtons();
    updateButtonStates();
});
