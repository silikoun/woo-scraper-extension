// Global state
let products = [];
let collections = [];
let currentPage = 1;
let itemsPerPage = 12;
let totalPages = 1;
let selectedProducts = new Set();
let selectedCollections = new Set();
let activeTab = 'productsTab';
let isLoading = false;

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
    
    // Auto-scroll
    terminal.scrollTop = terminal.scrollHeight;
    
    // Also log to console for debugging
    console.log(`[${type.toUpperCase()}] ${message}`);
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
        showLoading(true);
        log('Loading collections...', 'info', 'folder_open');
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('No active tab found');
        
        const baseUrl = new URL(tab.url).origin;
        log(`Fetching from: ${baseUrl}`, 'info', 'link');

        // Try WooCommerce product categories endpoint first
        const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories`);
        
        if (!response.ok) {
            // Try alternative endpoint
            log('Trying alternative endpoint...', 'info', 'sync');
            const altResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/categories`);
            if (!altResponse.ok) throw new Error('Failed to fetch collections');
            const rawCollections = await altResponse.json();
            return processCollections(rawCollections);
        }
        
        const rawCollections = await response.json();
        return processCollections(rawCollections);
    } catch (error) {
        throw new Error(`Failed to fetch collections: ${error.message}`);
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

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const collectionSearch = document.getElementById('collectionSearch');
const productSearch = document.getElementById('productSearch');
const collectionsList = document.getElementById('collectionsList');
const productsList = document.getElementById('productsList');
const selectedItemsList = document.getElementById('selectedItemsList');
const selectedCount = document.getElementById('selectedCount');
const startScrapingBtn = document.getElementById('startScraping');
const settingsButton = document.getElementById('settingsButton');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const statusText = document.getElementById('statusText');

// Templates
const collectionTemplate = document.getElementById('collectionTemplate');
const productTemplate = document.getElementById('productTemplate');

// State
const state = {
    collections: [],
    products: [],
    selectedCollections: new Set(),
    selectedProducts: new Set(),
    activeTab: 'collections',
    isLoading: false,
    baseUrl: 'https://vintagefootball.shop'
};

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    setupEventListeners();
    await loadInitialData();
}

// Event Listeners
function setupEventListeners() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    collectionSearch.addEventListener('input', debounce(e => {
        filterItems('collections', e.target.value);
    }, 300));

    productSearch.addEventListener('input', debounce(e => {
        filterItems('products', e.target.value);
    }, 300));

    startScrapingBtn.addEventListener('click', startScraping);
    settingsButton.addEventListener('click', openSettings);
}

// Tab Management
function switchTab(tabId) {
    state.activeTab = tabId;
    
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });
    
    tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });

    if (tabId === 'products' && state.products.length === 0) {
        loadProducts();
    }
}

// Data Loading
async function loadInitialData() {
    try {
        showLoading('Loading collections...');
        await loadCollections();
        updateUI();
        showToast('Collections loaded successfully');
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showToast('Failed to load data', true);
    } finally {
        hideLoading();
    }
}

async function loadCollections() {
    try {
        showLoading(true);
        log('Loading collections...', 'info', 'folder_open');
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('No active tab found');
        
        const baseUrl = new URL(tab.url).origin;
        log(`Fetching from: ${baseUrl}`, 'info', 'link');

        // Try WooCommerce product categories endpoint first
        const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories`);
        
        if (!response.ok) {
            // Try alternative endpoint
            log('Trying alternative endpoint...', 'info', 'sync');
            const altResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/categories`);
            if (!altResponse.ok) throw new Error('Failed to fetch collections');
            const rawCollections = await altResponse.json();
            state.collections = processCollections(rawCollections);
        } else {
            const rawCollections = await response.json();
            state.collections = processCollections(rawCollections);
        }
        
        log(`Found ${state.collections.length} collections`, 'success', 'check_circle');
        renderCollections();
        showToast('Collections loaded successfully', false);
    } catch (error) {
        console.error('Failed to load collections:', error);
        log(`Error: ${error.message}`, 'error', 'error');
        showToast('Failed to load collections', true);
    } finally {
        hideLoading();
    }
}

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

function renderCollections() {
    const collectionsList = document.getElementById('collectionsList');
    if (!collectionsList) {
        console.error('Collections list element not found');
        return;
    }

    collectionsList.innerHTML = state.collections.map(collection => `
        <div class="collection-item" data-id="${collection.id}">
            <div class="item-info">
                <div class="item-name">${collection.name}</div>
                <div class="item-count">${collection.count} products</div>
            </div>
            <button class="select-button ${state.selectedCollections.has(collection.id) ? 'selected' : ''}" 
                    onclick="toggleSelection('collections', ${collection.id})">
                <span class="material-icons">
                    ${state.selectedCollections.has(collection.id) ? 'remove' : 'add'}
                </span>
            </button>
        </div>
    `).join('');
}

async function loadProducts() {
    try {
        showLoading(true);
        log('Loading products...', 'info', 'shopping_cart');
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) throw new Error('No active tab found');
        
        const baseUrl = new URL(tab.url).origin;
        log(`Fetching from: ${baseUrl}`, 'info', 'link');

        // Try WooCommerce v3 API first
        const response = await fetch(`${baseUrl}/wp-json/wc/v3/products?per_page=100`);
        
        if (!response.ok) {
            // Try WooCommerce Store API
            log('Trying WooCommerce Store API...', 'info', 'sync');
            const storeResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?per_page=100`);
            
            if (!storeResponse.ok) {
                // Try WordPress API
                log('Trying WordPress API...', 'info', 'sync');
                const wpResponse = await fetch(`${baseUrl}/wp-json/wp/v2/product?per_page=100`);
                if (!wpResponse.ok) throw new Error('Failed to fetch products from all endpoints');
                const rawProducts = await wpResponse.json();
                products = processWPProducts(rawProducts);
            } else {
                const rawProducts = await storeResponse.json();
                products = processStoreProducts(rawProducts);
            }
        } else {
            const rawProducts = await response.json();
            products = processV3Products(rawProducts);
        }
        
        log(`Found ${products.length} products`, 'success', 'check_circle');
        renderProducts();
        showToast('Products loaded successfully', false);
    } catch (error) {
        console.error('Failed to load products:', error);
        log(`Error: ${error.message}`, 'error', 'error');
        showToast('Failed to load products', true);
    } finally {
        hideLoading();
    }
}

function processV3Products(rawProducts) {
    return rawProducts.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price || product.regular_price || '0',
        image: product.images?.[0]?.src || 'placeholder.jpg',
        description: product.description || '',
        sku: product.sku || '',
        status: product.status,
        inStock: product.in_stock,
        categories: product.categories?.map(c => c.id) || []
    }));
}

function processStoreProducts(rawProducts) {
    return rawProducts.map(product => ({
        id: product.id,
        name: product.name,
        price: product.prices?.price || product.prices?.regular_price || '0',
        image: product.images?.[0]?.src || 'placeholder.jpg',
        description: product.description || '',
        sku: product.sku || '',
        status: product.status,
        inStock: product.is_in_stock,
        categories: product.categories?.map(c => c.id) || []
    }));
}

function processWPProducts(rawProducts) {
    return rawProducts.map(product => ({
        id: product.id,
        name: product.title?.rendered || 'Untitled Product',
        price: '0', // WordPress API doesn't include price
        image: product.images?.[0]?.src || product._embedded?.['wp:featuredmedia']?.[0]?.source_url || 'placeholder.jpg',
        description: product.content?.rendered || '',
        sku: '',
        status: product.status,
        inStock: true,
        categories: product.categories || []
    }));
}

function renderProducts() {
    const productsList = document.getElementById('productsList');
    if (!productsList) {
        console.error('Products list element not found');
        return;
    }

    if (products.length === 0) {
        productsList.innerHTML = `
            <div class="empty-state">
                <span class="material-icons">inventory</span>
                <p>No products found</p>
            </div>
        `;
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const displayedProducts = products.slice(start, end);

    productsList.innerHTML = displayedProducts.map(product => `
        <div class="product-item" data-id="${product.id}">
            <img class="product-image" src="${product.image}" alt="${product.name}" 
                 onerror="this.src='placeholder.jpg';">
            <div class="item-info">
                <div class="item-name">${product.name}</div>
                <div class="item-price">${formatPrice(product.price)}</div>
                ${product.sku ? `<div class="item-sku">SKU: ${product.sku}</div>` : ''}
                <div class="item-status ${product.inStock ? 'in-stock' : 'out-of-stock'}">
                    ${product.inStock ? 'In Stock' : 'Out of Stock'}
                </div>
            </div>
            <button class="select-button ${selectedProducts.has(product.id) ? 'selected' : ''}" 
                    onclick="toggleSelection('products', ${product.id})">
                <span class="material-icons">
                    ${selectedProducts.has(product.id) ? 'remove' : 'add'}
                </span>
            </button>
        </div>
    `).join('');

    totalPages = Math.ceil(products.length / itemsPerPage);
    updatePagination();
}

// Add CSS styles for product status
const style = document.createElement('style');
style.textContent = `
    .item-status {
        font-size: 12px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-top: 4px;
    }
    .item-status.in-stock {
        background-color: #4caf50;
        color: white;
    }
    .item-status.out-of-stock {
        background-color: #f44336;
        color: white;
    }
    .item-sku {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
    }
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px;
        color: #666;
    }
    .empty-state .material-icons {
        font-size: 48px;
        margin-bottom: 16px;
        color: #999;
    }
`;
document.head.appendChild(style);

// Selection Management
function toggleSelection(type, id) {
    const set = type === 'collections' ? state.selectedCollections : state.selectedProducts;
    const method = set.has(id) ? 'delete' : 'add';
    set[method](id);
    
    if (type === 'collections') {
        renderCollections();
    } else {
        renderProducts();
    }
    
    renderSelectedItems();
}

function removeSelection(type, id) {
    const set = type === 'collections' ? state.selectedCollections : state.selectedProducts;
    set.delete(id);
    
    if (type === 'collections') {
        renderCollections();
    } else {
        renderProducts();
    }
    
    renderSelectedItems();
}

// Filtering
function filterItems(type, searchTerm) {
    const items = type === 'collections' ? state.collections : products;
    const term = searchTerm.toLowerCase();
    
    const filtered = items.filter(item => 
        item.name.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term))
    );
    
    if (type === 'collections') {
        renderCollections(filtered);
    } else {
        renderProducts(filtered);
    }
}

// Scraping
async function startScraping() {
    if (state.selectedCollections.size === 0 && state.selectedProducts.size === 0) {
        showToast('Please select at least one item to scrape', true);
        return;
    }

    try {
        state.isLoading = true;
        updateUI();
        showLoading('Starting scraper...');
        clearTerminal();
        log('Starting scraping process...', 'info', 'hourglass_empty');

        const results = [];
        const totalItems = state.selectedCollections.size + state.selectedProducts.size;
        let completedItems = 0;

        // Scrape selected collections
        for (const collectionId of state.selectedCollections) {
            const collection = state.collections.find(c => c.id === collectionId);
            log(`Scraping collection: ${collection?.name || collectionId}`, 'info', 'folder');
            const collectionProducts = await scrapeCollection(collectionId);
            results.push(...collectionProducts);
            completedItems++;
            updateProgress((completedItems / totalItems) * 100);
        }

        // Scrape selected products
        for (const productId of state.selectedProducts) {
            const product = products.find(p => p.id === productId);
            log(`Scraping product: ${product?.name || productId}`, 'info', 'shopping_cart');
            const scrapedProduct = await scrapeProduct(productId);
            if (scrapedProduct) results.push(scrapedProduct);
            completedItems++;
            updateProgress((completedItems / totalItems) * 100);
        }

        // Save results as CSV
        const csvContent = convertToCSV(results);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scraped_products_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log(`Successfully scraped ${results.length} items`, 'success', 'check_circle');
        showToast(`Successfully scraped ${results.length} items`);
    } catch (error) {
        console.error('Scraping failed:', error);
        log(`Scraping failed: ${error.message}`, 'error', 'error');
        showToast('Scraping failed', true);
    } finally {
        state.isLoading = false;
        hideLoading();
        updateUI();
    }
}

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

async function scrapeProduct(productId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const baseUrl = new URL(tab.url).origin;
        
        const response = await fetch(`${baseUrl}/wp-json/wc/store/v1/products/${productId}`);
        if (!response.ok) {
            const altResponse = await fetch(`${baseUrl}/wp-json/wc/v3/products/${productId}`);
            if (!altResponse.ok) throw new Error(`Failed to fetch product ${productId}`);
            return formatProduct(await altResponse.json());
        }
        return formatProduct(await response.json());
    } catch (error) {
        log(`Failed to scrape product ${productId}: ${error.message}`, 'error', 'error');
        return null;
    }
}

async function scrapeCollection(collectionId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const baseUrl = new URL(tab.url).origin;
        const collection = state.collections.find(c => c.id === collectionId);
        
        log(`Fetching products for collection: ${collection?.name || collectionId}`, 'info', 'shopping_basket');
        
        // Try WooCommerce v3 API first
        const response = await fetch(`${baseUrl}/wp-json/wc/v3/products?category=${collectionId}&per_page=100`);
        
        if (!response.ok) {
            // Try alternative endpoint
            log('Trying alternative endpoint...', 'info', 'sync');
            const altResponse = await fetch(`${baseUrl}/wp-json/wc/store/v1/products?category=${collectionId}&per_page=100`);
            if (!altResponse.ok) throw new Error(`Failed to fetch products for collection ${collectionId}`);
            const products = await altResponse.json();
            log(`Found ${products.length} products in collection`, 'success', 'inventory');
            return products.map(formatProduct);
        }
        
        const products = await response.json();
        log(`Found ${products.length} products in collection`, 'success', 'inventory');
        return products.map(formatProduct);
    } catch (error) {
        log(`Failed to scrape collection ${collectionId}: ${error.message}`, 'error', 'error');
        return [];
    }
}

function formatProduct(product) {
    return {
        id: product.id,
        name: product.name || product.title?.rendered || 'Untitled Product',
        price: product.price || product.regular_price || '0',
        description: (product.description || product.description?.rendered || '').replace(/<[^>]+>/g, ''),
        image: product.images?.[0]?.src || product.image?.src || 'placeholder.jpg'
    };
}

// UI Updates
function updateUI() {
    updateStartButton();
}

function updateStartButton() {
    const hasSelection = state.selectedCollections.size > 0 || state.selectedProducts.size > 0;
    startScrapingBtn.disabled = !hasSelection || state.isLoading;
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

function updateStatus(message) {
    statusText.textContent = message;
}

// Utilities
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price || 0);
}

function showLoading(message) {
    state.isLoading = true;
    updateStatus(message);
    updateUI();
}

function hideLoading() {
    state.isLoading = false;
    updateUI();
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    toastMessage.textContent = message;
    toastIcon.textContent = isError ? 'error' : 'info';
    toast.style.backgroundColor = isError ? 'var(--error)' : '#323232';
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function openSettings() {
    showToast('Settings coming soon');
}

// Make functions available to HTML
window.removeSelection = removeSelection;
