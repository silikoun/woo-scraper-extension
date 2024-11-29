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
    let terminal = document.getElementById('terminalContent');
    
    // If terminal doesn't exist, create it
    if (!terminal) {
        const container = document.querySelector('.content');
        if (!container) {
            console.error('Container element not found');
            return;
        }
        
        const terminalDiv = document.createElement('div');
        terminalDiv.className = 'terminal';
        
        terminal = document.createElement('div');
        terminal.id = 'terminalContent';
        terminal.className = 'terminal-content';
        
        terminalDiv.appendChild(terminal);
        container.appendChild(terminalDiv);
    }

    // Create a new terminal line
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    
    // Format timestamp in 12-hour format
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });
    const iconSpan = icon ? `<span class="material-icons terminal-icon">${icon}</span>` : '';
    
    // Construct and append the message
    line.innerHTML = `${iconSpan}[${timestamp}] ${message}`;
    terminal.appendChild(line);
    
    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
}

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
 * Updates the pagination UI based on current page and total pages
 */
function updatePagination() {
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) {
        console.warn('Pagination element not found');
        return;
    }
    
    paginationElement.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Platform Detection
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

// Scraping Functions
/**
 * Scrapes products from the detected platform
 */
async function scrapeProducts() {
    try {
        showLoading(true);
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
        displayProducts();
        updatePagination();

    } catch (error) {
        log(`Error: ${error.message}`, 'error', 'error');
        console.error('Scraping error:', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Scrapes WooCommerce products from the provided base URL
 * @param {string} baseUrl - The base URL of the WooCommerce platform
 * @returns {array} The scraped WooCommerce products
 */
async function scrapeWooCommerceProducts(baseUrl) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            throw new Error('No active tab found');
        }

        log(`Fetching products from ${baseUrl}`, 'info', 'link');

        // Try WooCommerce REST API v3 first
        try {
            const v3Response = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (v3Response.ok) {
                const data = await v3Response.json();
                return data.map(product => ({
                    id: product.id,
                    name: product.name,
                    price: product.price || product.regular_price || '0',
                    description: product.description || '',
                    sku: product.sku || '',
                    inStock: product.in_stock,
                    images: product.images?.map(img => img.src) || []
                }));
            }
        } catch (error) {
            log('WC REST API v3 not available, trying Store API...', 'info', 'sync');
        }

        // Try WooCommerce Store API
        try {
            const storeResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?per_page=100`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (storeResponse.ok) {
                const data = await storeResponse.json();
                return data.map(product => ({
                    id: product.id,
                    name: product.name,
                    price: product.prices?.price || product.prices?.regular_price || '0',
                    description: product.description || '',
                    sku: product.sku || '',
                    inStock: product.is_in_stock,
                    images: product.images?.map(img => img.src) || []
                }));
            }
        } catch (error) {
            log('WC Store API not available, trying WordPress API...', 'info', 'sync');
        }

        // Try WordPress REST API as last resort
        const wpResponse = await fetch(`${baseUrl}/wp-json/wp/v2/product?per_page=100&_embed`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        if (wpResponse.ok) {
            const data = await wpResponse.json();
            return data.map(product => ({
                id: product.id,
                name: product.title?.rendered || 'Untitled Product',
                price: '0',
                description: product.content?.rendered || '',
                sku: '',
                inStock: true,
                images: [product._embedded?.['wp:featuredmedia']?.[0]?.source_url].filter(Boolean)
            }));
        }

        throw new Error('No compatible API endpoints found');
    } catch (error) {
        throw new Error(`WooCommerce scraping failed: ${error.message}`);
    }
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
async function scrapeCollections() {
    try {
        showLoading(true);
        clearTerminal();
        log('Starting collections scrape...', 'info', 'hourglass_empty');

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

        let fetchedCollections = [];
        if (detectedPlatform === PLATFORM.WOOCOMMERCE) {
            fetchedCollections = await scrapeWooCommerceCollections(baseUrl);
        } else if (detectedPlatform === PLATFORM.SHOPIFY) {
            fetchedCollections = await scrapeShopifyCollections(baseUrl);
        }

        collections = fetchedCollections;
        log(`Successfully scraped ${collections.length} collections`, 'success', 'check_circle');
        displayCollections();

    } catch (error) {
        log(`Error: ${error.message}`, 'error', 'error');
        console.error('Collections scraping error:', error);
    } finally {
        showLoading(false);
    }
}

/**
 * Scrapes WooCommerce collections from the provided base URL
 * @param {string} baseUrl - The base URL of the WooCommerce platform
 * @returns {array} The scraped WooCommerce collections
 */
async function scrapeWooCommerceCollections(baseUrl) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            throw new Error('No active tab found');
        }

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
 * Scrapes Shopify collections from the provided base URL
 * @param {string} baseUrl - The base URL of the Shopify platform
 * @returns {array} The scraped Shopify collections
 */
async function scrapeShopifyCollections(baseUrl) {
    try {
        const response = await fetch(`${baseUrl}/collections.json`);
        if (!response.ok) {
            throw new Error('Failed to fetch Shopify collections');
        }

        const data = await response.json();
        return data.collections || [];

    } catch (error) {
        throw new Error(`Shopify collections scraping failed: ${error.message}`);
    }
}

/**
 * Scrapes a single product by ID
 * @param {number} productId - The ID of the product to scrape
 * @returns {Promise<Object>} The scraped product data
 */
async function scrapeProduct(productId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            throw new Error('No active tab found');
        }

        const baseUrl = new URL(tab.url).origin;
        log(`Fetching product ${productId}`, 'info', 'shopping_cart');

        // Try WooCommerce REST API v3 first
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                return {
                    id: product.id,
                    name: product.name,
                    price: product.price || product.regular_price || '0',
                    description: product.description || '',
                    sku: product.sku || '',
                    inStock: product.in_stock,
                    images: product.images?.map(img => img.src) || []
                };
            }
        } catch (error) {
            log('Trying alternative endpoint...', 'info', 'sync');
        }

        // Try WooCommerce Store API
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                return {
                    id: product.id,
                    name: product.name,
                    price: product.prices?.price || product.prices?.regular_price || '0',
                    description: product.description || '',
                    sku: product.sku || '',
                    inStock: product.is_in_stock,
                    images: product.images?.map(img => img.src) || []
                };
            }
        } catch (error) {
            log('Product not found', 'error', 'error');
            return null;
        }
    } catch (error) {
        log(`Failed to scrape product ${productId}: ${error.message}`, 'error', 'error');
        return null;
    }
}

/**
 * Scrapes all products from a collection
 * @param {number} collectionId - The ID of the collection to scrape
 * @returns {Promise<Array>} The scraped products
 */
async function scrapeCollection(collectionId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) {
            throw new Error('No active tab found');
        }

        const baseUrl = new URL(tab.url).origin;
        const collection = collections.find(c => c.id === collectionId);
        log(`Fetching products from collection: ${collection?.name || collectionId}`, 'info', 'folder_open');

        // Try WooCommerce REST API v3 first
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products?category=${collectionId}&per_page=100`);
            if (response.ok) {
                const products = await response.json();
                return products.map(product => ({
                    id: product.id,
                    name: product.name,
                    price: product.price || product.regular_price || '0',
                    description: product.description || '',
                    sku: product.sku || '',
                    inStock: product.in_stock,
                    images: product.images?.map(img => img.src) || []
                }));
            }
        } catch (error) {
            log('Trying alternative endpoint...', 'info', 'sync');
        }

        // Try WooCommerce Store API
        const response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?category=${collectionId}&per_page=100`);
        if (response.ok) {
            const products = await response.json();
            return products.map(product => ({
                id: product.id,
                name: product.name,
                price: product.prices?.price || product.prices?.regular_price || '0',
                description: product.description || '',
                sku: product.sku || '',
                inStock: product.is_in_stock,
                images: product.images?.map(img => img.src) || []
            }));
        }

        throw new Error(`Failed to fetch products for collection ${collectionId}`);
    } catch (error) {
        log(`Failed to scrape collection ${collectionId}: ${error.message}`, 'error', 'error');
        return [];
    }
}

/**
 * Processes raw WooCommerce collection data into a standardized format
 * @param {array} rawCollections - The raw WooCommerce collection data
 * @returns {array} The processed WooCommerce collections
 */
function processCollections(rawCollections) {
    if (!Array.isArray(rawCollections)) {
        console.error('Collections data is not an array:', rawCollections);
        throw new Error('Invalid collections data format');
    }
    
    return rawCollections.map(collection => ({
        id: collection.id,
        name: collection.name,
        count: collection.count || 0,
        description: collection.description || '',
        slug: collection.slug || '',
        parent: collection.parent || 0
    }));
}

// Display Functions
/**
 * Displays the scraped collections in the UI
 */
function displayCollections() {
    const container = document.getElementById('collectionsList');
    if (!container) {
        log('Collections list container not found', 'error', 'error');
        return;
    }

    container.innerHTML = '';

    if (!collections.length) {
        log('No collections found to display', 'warning', 'warning');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No collections found';
        container.appendChild(emptyMessage);
        return;
    }

    collections.forEach(collection => {
        const card = createCollectionCard(collection);
        container.appendChild(card);
    });

    log(`Displayed ${collections.length} collections`, 'success', 'check_circle');
}

/**
 * Creates a collection card element for the provided collection
 * @param {object} collection - The collection data
 * @returns {HTMLElement} The collection card element
 */
function createCollectionCard(collection) {
    const template = document.getElementById('collectionTemplate');
    if (!template) {
        log('Collection template not found', 'error', 'error');
        return document.createElement('div');
    }

    const card = template.content.cloneNode(true).firstElementChild;
    const nameElement = card.querySelector('.item-name');
    const countElement = card.querySelector('.item-count');
    const selectButton = card.querySelector('.select-button');

    if (nameElement) nameElement.textContent = collection.name;
    if (countElement) countElement.textContent = `${collection.count || 0} products`;
    
    if (selectButton) {
        const icon = selectButton.querySelector('.material-icons');
        selectButton.addEventListener('click', () => {
            const isSelected = selectedCollections.has(collection.id);
            if (isSelected) {
                selectedCollections.delete(collection.id);
                icon.textContent = 'add';
                log(`Removed collection: ${collection.name}`, 'info', 'remove_circle');
            } else {
                selectedCollections.add(collection.id);
                icon.textContent = 'check';
                log(`Added collection: ${collection.name}`, 'info', 'add_circle');
            }
            updateSelectedCount();
            updateSelectedItemsList();
        });
    }

    return card;
}

/**
 * Displays the scraped products in the UI
 */
function displayProducts() {
    const container = document.getElementById('productsList');
    if (!container) {
        log('Products list container not found', 'error', 'error');
        return;
    }

    container.innerHTML = '';

    if (!products.length) {
        log('No products found to display', 'warning', 'warning');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No products found';
        container.appendChild(emptyMessage);
        return;
    }

    products.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });

    log(`Displayed ${products.length} products`, 'success', 'check_circle');
}

/**
 * Creates a product card element for the provided product
 * @param {object} product - The product data
 * @returns {HTMLElement} The product card element
 */
function createProductCard(product) {
    const template = document.getElementById('productTemplate');
    if (!template) {
        log('Product template not found', 'error', 'error');
        return document.createElement('div');
    }

    const card = template.content.cloneNode(true).firstElementChild;
    const imageElement = card.querySelector('.product-image');
    const nameElement = card.querySelector('.item-name');
    const priceElement = card.querySelector('.item-price');
    const selectButton = card.querySelector('.select-button');

    if (imageElement && product.images && product.images.length > 0) {
        imageElement.src = product.images[0];
        imageElement.alt = product.name;
    }

    if (nameElement) nameElement.textContent = product.name;
    if (priceElement) priceElement.textContent = product.price_html || product.price || 'Price not available';

    if (selectButton) {
        const icon = selectButton.querySelector('.material-icons');
        selectButton.addEventListener('click', () => {
            const isSelected = selectedProducts.has(product.id);
            if (isSelected) {
                selectedProducts.delete(product.id);
                icon.textContent = 'add';
                log(`Removed product: ${product.name}`, 'info', 'remove_circle');
            } else {
                selectedProducts.add(product.id);
                icon.textContent = 'check';
                log(`Added product: ${product.name}`, 'info', 'add_circle');
            }
            updateSelectedCount();
            updateSelectedItemsList();
        });
    }

    return card;
}

// Filter Functions
/**
 * Sets up event listeners for filter inputs
 */
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const stockFilter = document.getElementById('stockFilter');

    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
    }

    if (stockFilter) {
        stockFilter.addEventListener('change', filterProducts);
    }
}

/**
 * Filters products based on search term, category, and stock status
 */
function filterProducts() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoryValue = document.getElementById('categoryFilter')?.value || '';
    const stockValue = document.getElementById('stockFilter')?.value || '';

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryValue || (product.categories && product.categories.some(cat => cat.id.toString() === categoryValue));
        const matchesStock = !stockValue || product.stock_status === stockValue;

        return matchesSearch && matchesCategory && matchesStock;
    });

    // Update pagination for filtered results
    totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    currentPage = 1;

    // Display filtered products
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const container = document.getElementById('productsList');
    container.innerHTML = '';

    filteredProducts.slice(startIndex, endIndex).forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });

    updatePagination();
}

// Tab Functions
/**
 * Sets up event listeners for tab buttons
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            switchTab(tabId);
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get terminal element and verify it exists
    const terminal = document.getElementById('terminalContent');
    if (!terminal) {
        console.error('Terminal element not found during initialization');
        return;
    }

    // Clear terminal and show initial ready message
    clearTerminal();
    log('Ready to scrape products and collections', 'info', 'check_circle');

    // Setup event listeners and initialize UI components
    setupTabs();
    setupFilters();
    updateUI();

    // Scrape Products button
    let scrapeButton = document.getElementById('scrapeButton');
    if (scrapeButton) {
        scrapeButton.addEventListener('click', async () => {
            if (isLoading) return;
            
            try {
                setLoading(true);
                const type = document.getElementById('scrapeType').value;
                
                if (type === 'products') {
                    await scrapeProducts();
                    displayProducts();
                } else if (type === 'collections') {
                    await scrapeCollections();
                    displayCollections();
                }
            } catch (error) {
                console.error('Error scraping:', error);
                log(`Error: ${error.message}`, 'error', 'error');
            } finally {
                setLoading(false);
            }
        });
        
        // Set initial button state
        scrapeButton.disabled = false;
        scrapeButton.style.cursor = 'pointer';
    } else {
        console.error('Scrape button not found');
    }

    // Export Selected button
    let exportSelectedBtn = document.getElementById('exportSelected');
    if (exportSelectedBtn) {
        exportSelectedBtn.addEventListener('click', () => {
            try {
                const options = {
                    name: document.getElementById('exportName')?.checked || false,
                    price: document.getElementById('exportPrice')?.checked || false,
                    description: document.getElementById('exportDescription')?.checked || false,
                    sku: document.getElementById('exportSKU')?.checked || false,
                    stock: document.getElementById('exportStock')?.checked || false,
                    images: document.getElementById('exportImages')?.checked || false
                };

                if (!Object.values(options).some(Boolean)) {
                    log('Please select at least one field to export', 'warning', 'warning');
                    return;
                }

                if (selectedProducts.size === 0 && selectedCollections.size === 0) {
                    log('Please select items to export', 'warning', 'warning');
                    return;
                }

                exportSelectedItems(options);
            } catch (error) {
                console.error('Error exporting items:', error);
                log(`Error: ${error.message}`, 'error', 'error');
            }
        });
    } else {
        console.error('Export Selected button not found');
    }

    // Clear Selection button
    let clearSelectionBtn = document.getElementById('clearSelection');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            try {
                selectedProducts.clear();
                selectedCollections.clear();
                updateSelectedItemsList();
                updateSelectedCount();
                log('Selection cleared', 'info', 'clear_all');
            } catch (error) {
                console.error('Error clearing selection:', error);
                log(`Error: ${error.message}`, 'error', 'error');
            }
        });
    } else {
        console.error('Clear Selection button not found');
    }
});

/**
 * Sets the loading state of the UI
 * @param {boolean} loading - Whether the UI is in a loading state
 */
function setLoading(loading) {
    isLoading = loading;
    const scrapeButton = document.getElementById('scrapeButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    if (scrapeButton) {
        scrapeButton.disabled = loading;
        scrapeButton.style.cursor = loading ? 'not-allowed' : 'pointer';
    }
    
    if (loadingSpinner) {
        loadingSpinner.style.display = loading ? 'inline-block' : 'none';
    }
}

/**
 * Initializes button event listeners
 */
function initializeButtons() {
    const scrapeButton = document.getElementById('scrapeButton');
    const clearButton = document.getElementById('clearButton');
    const scrapeType = document.getElementById('scrapeType');
    
    if (scrapeButton && scrapeType) {
        scrapeButton.addEventListener('click', async () => {
            if (isLoading) return;
            
            try {
                setLoading(true);
                const type = scrapeType.value;
                
                if (type === 'products') {
                    await scrapeProducts();
                    displayProducts();
                } else if (type === 'collections') {
                    await scrapeCollections();
                    displayCollections();
                }
            } catch (error) {
                console.error('Error scraping:', error);
                log(`Error: ${error.message}`, 'error', 'error');
            } finally {
                setLoading(false);
            }
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            clearSelection();
        });
    }
}

/**
 * Updates the selected count display
 */
function updateSelectedCount() {
    const selectedCount = document.getElementById('selectedCount');
    if (selectedCount) {
        const total = selectedProducts.size + selectedCollections.size;
        selectedCount.textContent = total.toString();
    }
}

/**
 * Clears all selections
 */
function clearSelection() {
    selectedProducts.clear();
    selectedCollections.clear();
    updateSelectedCount();
    
    // Remove selected class from all items
    document.querySelectorAll('.item.selected').forEach(item => {
        item.classList.remove('selected');
    });
}

/**
 * Shows an error message to the user
 * @param {string} message - The error message to display
 */
function showError(message) {
    // Implement error display logic here
    console.error(message);
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
});

/**
 * Updates the UI to reflect the current state
 */
function updateUI() {
    const startButton = document.getElementById('startScraping');
    if (startButton) {
        startButton.disabled = selectedCollections.size === 0 && selectedProducts.size === 0;
    }
}

/**
 * Shows or hides the loading indicator
 * @param {boolean} show - Whether to show or hide the loading indicator
 */
function showLoading(show) {
    if (show) {
        log('Loading...', 'info', 'hourglass_empty');
    }
}

/**
 * Updates the list of selected items in the UI
 */
function updateSelectedItemsList() {
    const container = document.getElementById('selectedItemsList');
    if (!container) return;

    container.innerHTML = '';
    let count = 0;

    // Add selected collections
    selectedCollections.forEach(id => {
        const collection = collections.find(c => c.id === id);
        if (collection) {
            count++;
            container.appendChild(createSelectedItemElement(collection, 'collection'));
        }
    });

    // Add selected products
    selectedProducts.forEach(id => {
        const product = products.find(p => p.id === id);
        if (product) {
            count++;
            container.appendChild(createSelectedItemElement(product, 'product'));
        }
    });

    // Update count
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = count;
    }

    // Enable/disable export button
    const exportButton = document.getElementById('exportSelected');
    if (exportButton) {
        exportButton.disabled = count === 0;
    }
}

/**
 * Creates a selected item element for the UI
 * @param {Object} item - The collection or product item
 * @param {string} type - The type of item ('collection' or 'product')
 * @returns {HTMLElement} The created element
 */
function createSelectedItemElement(item, type) {
    const div = document.createElement('div');
    div.className = 'selected-item';
    div.innerHTML = `
        <div class="selected-item-info">
            <span class="selected-item-type">${type}</span>
            <span>${item.name}</span>
        </div>
        <button class="selected-item-remove" data-id="${item.id}" data-type="${type}">
            <span class="material-icons">close</span>
        </button>
    `;

    // Add remove button listener
    div.querySelector('.selected-item-remove').addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        const type = e.currentTarget.dataset.type;
        if (type === 'collection') {
            selectedCollections.delete(id);
        } else {
            selectedProducts.delete(id);
        }
        updateSelectedItemsList();
        updateUI();
    });

    return div;
}

/**
 * Exports selected items based on export options
 * @param {Object} options - Export options for fields to include
 */
function exportSelectedItems(options) {
    try {
        log('Preparing data for export...', 'info', 'file_download');
        const results = [];

        // Process selected collections
        selectedCollections.forEach(id => {
            const collection = collections.find(c => c.id === id);
            if (collection) {
                results.push(formatItemForExport(collection, 'collection', options));
            }
        });

        // Process selected products
        selectedProducts.forEach(id => {
            const product = products.find(p => p.id === id);
            if (product) {
                results.push(formatItemForExport(product, 'product', options));
            }
        });

        // Create CSV content
        const csvContent = convertDataToCSV(results, options);
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `woo_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log(`Successfully exported ${results.length} items`, 'success', 'check_circle');
        showToast(`Exported ${results.length} items`);
    } catch (error) {
        log(`Export failed: ${error.message}`, 'error', 'error');
        showToast('Export failed', true);
    }
}

/**
 * Formats an item for export based on options
 * @param {Object} item - The item to format
 * @param {string} type - The type of item
 * @param {Object} options - Export options
 * @returns {Object} Formatted item
 */
function formatItemForExport(item, type, options) {
    const formatted = {
        type: type,
        id: item.id
    };

    if (options.name) formatted.name = item.name;
    if (options.price && type === 'product') formatted.price = item.price;
    if (options.description) formatted.description = item.description;
    if (options.sku && type === 'product') formatted.sku = item.sku;
    if (options.stock && type === 'product') formatted.stock = item.inStock ? 'In Stock' : 'Out of Stock';
    if (options.images) formatted.images = item.images ? item.images.join(', ') : '';

    return formatted;
}

/**
 * Converts an array of products into a CSV string
 * @param {array} products - The products to convert
 * @returns {string} The CSV string
 */
function convertToCSV(products) {
    const headers = ['ID', 'Name', 'Price', 'Description', 'Image URL'];
    const rows = products.map(p => [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.price,
        `"${(p.description || '').replace(/"/g, '""').replace(/<[^>]+>/g, '')}"`,
        p.image
    ]);
    
    return [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
}

/**
 * Converts data to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Object} options - Export options for fields to include
 * @returns {string} CSV string
 */
function convertDataToCSV(data, options) {
    if (!data || !data.length) return '';

    // Get headers from the first item
    const headers = Object.keys(data[0]);
    const rows = [headers.join(',')];

    // Add data rows
    data.forEach(item => {
        const values = headers.map(header => {
            const value = item[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        rows.push(values.join(','));
    });

    return rows.join('\n');
}

/**
 * Updates the count of selected items in the UI
 */
function updateSelectedCount() {
    const selectedCount = document.getElementById('selectedCount');
    if (!selectedCount) {
        console.warn('Selected count element not found');
        return;
    }
    
    const totalSelected = selectedProducts.size + selectedCollections.size;
    selectedCount.textContent = totalSelected.toString();
    
    // Enable/disable export button based on selection
    const exportButton = document.getElementById('exportSelected');
    if (exportButton) {
        exportButton.disabled = totalSelected === 0;
    }
}
