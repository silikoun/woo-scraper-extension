// Global state
let products = [];
let collections = [];
let currentPage = 1;
let itemsPerPage = 12;
let totalPages = 1;
let selectedProducts = new Set();
let activeTab = 'productsTab';

// Platform detection state
let detectedPlatform = null;
const PLATFORM = {
    WOOCOMMERCE: 'woocommerce',
    SHOPIFY: 'shopify',
    UNKNOWN: 'unknown'
};

// Helper Functions
function showLoading(show) {
    document.querySelector('.loading').style.display = show ? 'flex' : 'none';
}

function log(message, type = 'info', icon = '') {
    const terminal = document.getElementById('terminalContent');
    if (!terminal) {
        console.error('Terminal element not found');
        return;
    }

    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const iconSpan = icon ? `<span class="material-icons terminal-icon">${icon}</span>` : '';
    
    line.innerHTML = `${iconSpan}[${timestamp}] ${message}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    const terminal = document.getElementById('terminalContent');
    if (!terminal) {
        console.error('Terminal element not found');
        return;
    }
    terminal.innerHTML = '';
}

function updatePagination() {
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Platform Detection
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

async function scrapeWooCommerceProducts(baseUrl) {
    try {
        // First try WooCommerce Store API
        let response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?per_page=100`);
        
        if (!response.ok) {
            log('Store API failed, trying REST API...', 'info', 'sync');
            // Try WooCommerce REST API
            response = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100`);
        }

        if (!response.ok) {
            throw new Error('Failed to fetch WooCommerce products');
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];

    } catch (error) {
        throw new Error(`WooCommerce scraping failed: ${error.message}`);
    }
}

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

async function scrapeWooCommerceCollections(baseUrl) {
    try {
        // Try WooCommerce Store API first (public, no auth needed)
        let response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/categories`);
        
        if (!response.ok) {
            log('Store API failed, trying alternative endpoint...', 'info', 'sync');
            // Try WooCommerce categories endpoint
            response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories`);
        }

        if (!response.ok) {
            throw new Error('Failed to fetch WooCommerce categories');
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];

    } catch (error) {
        throw new Error(`WooCommerce categories scraping failed: ${error.message}`);
    }
}

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

// Display Functions
function displayProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    if (!products.length) {
        log('No products found to display', 'warning', 'warning');
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProducts = products.slice(startIndex, endIndex);

    currentProducts.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });

    updateSelectedCount();
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = product.id;

    const imageUrl = product.images && product.images.length > 0 
        ? product.images[0].src 
        : 'placeholder.jpg';

    const stockStatus = product.stock_status || (product.variants && product.variants[0]?.available ? 'instock' : 'outofstock');
    const stockClass = stockStatus === 'instock' ? 'in-stock' : 'out-of-stock';
    const stockText = stockStatus === 'instock' ? 'In Stock' : 'Out of Stock';

    card.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" alt="${product.name}" class="product-image">
            <div class="stock-status ${stockClass}">${stockText}</div>
        </div>
        <div class="product-info">
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price">${product.price_html || product.price || 'Price not available'}</div>
        </div>
    `;

    return card;
}

function displayCollections() {
    const container = document.getElementById('collectionsContainer');
    container.innerHTML = '';

    if (!collections.length) {
        log('No collections found to display', 'warning', 'warning');
        return;
    }

    collections.forEach(collection => {
        const card = createCollectionCard(collection);
        container.appendChild(card);
    });
}

function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageUrl = collection.image?.src || 'placeholder.jpg';

    card.innerHTML = `
        <div class="product-image-container">
            <img src="${imageUrl}" alt="${collection.name}" class="product-image">
        </div>
        <div class="product-info">
            <h3 class="product-title">${collection.name}</h3>
            <div class="product-description">${collection.description || ''}</div>
        </div>
    `;

    return card;
}

function updateSelectedCount() {
    const selectedCountElement = document.querySelector('.selected-count');
    if (selectedCountElement) {
        selectedCountElement.textContent = `${selectedProducts.size} products selected`;
    }
}

// Filter Functions
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
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    filteredProducts.slice(startIndex, endIndex).forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });

    updatePagination();
}

// Tab Functions
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            switchTab(tabId);
        });
    });
}

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
    // Setup button listeners
    document.getElementById('scrapeProducts')?.addEventListener('click', scrapeProducts);
    document.getElementById('scrapeCollections')?.addEventListener('click', scrapeCollections);
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayProducts();
            updatePagination();
        }
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayProducts();
            updatePagination();
        }
    });

    // Setup filters and tabs
    setupFilters();
    setupTabs();

    // Initial log
    log('Ready to scrape products and collections', 'info', 'check_circle');
});
