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
document.getElementById('clearLogs')?.addEventListener('click', () => {
    const logContent = document.querySelector('.log-content');
    const logContainer = document.querySelector('.log-container');
    if (logContent) {
        logContent.innerHTML = '';
        logContainer.style.display = 'none';
    }
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
            // Try WooCommerce Store API first (public, no auth needed)
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
                    const processedProducts = wpProducts.map(product => ({
                        id: product.id,
                        name: product.title?.rendered || '',
                        price: product.meta?.price || '',
                        price_html: product.meta?.price_html || '',
                        description: product.content?.rendered || '',
                        short_description: product.excerpt?.rendered || '',
                        sku: product.meta?.sku || '',
                        stock_status: product.meta?.stock_status || '',
                        images: product._embedded?.['wp:featuredmedia']?.map(media => media.source_url) || [],
                        categories: product._embedded?.['wp:term']?.[0]?.map(term => term.name) || []
                    }));
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

                const processedProducts = products.map(product => ({
                    id: product.id,
                    name: product.name,
                    price: product.prices?.price || '',
                    price_html: product.prices?.price_html || '',
                    description: product.description || '',
                    short_description: product.short_description || '',
                    sku: product.sku || '',
                    stock_status: product.stock_status || '',
                    images: product.images?.map(img => img.src) || [],
                    categories: product.categories?.map(cat => cat.name) || []
                }));
                
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
async function scrapeCollections() {
    setLoading(true);
    collections = [];
    selectedCollections.clear();

    try {
        const baseUrl = await getBaseUrl();
        if (!baseUrl) {
            throw new Error('Could not determine store URL');
        }

        if (!detectedPlatform) {
            await detectPlatform(baseUrl);
        }

        log('Fetching collections...', 'info', 'sync');

        switch (detectedPlatform) {
            case PLATFORM.WOOCOMMERCE:
                collections = await scrapeWooCommerceCollections(baseUrl);
                break;
            case PLATFORM.SHOPIFY:
                collections = await scrapeShopifyCollections(baseUrl);
                break;
            default:
                throw new Error('Unsupported platform');
        }

        log(`Found ${collections.length} collections`, 'success', 'check_circle');
        displayCollections();
    } catch (error) {
        log(`Error: ${error.message}`, 'error', 'error');
    } finally {
        setLoading(false);
        updateButtonStates();
    }
}

/**
 * Scrapes WooCommerce collections
 * @param {string} baseUrl - The base URL of the WooCommerce platform
 * @returns {array} The scraped WooCommerce collections
 */
async function scrapeWooCommerceCollections(baseUrl) {
    const collections = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories?per_page=100&page=${page}`);
            if (!response.ok) throw new Error('Failed to fetch collections');
            
            const data = await response.json();
            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }
            
            // For each collection, fetch its products
            for (const cat of data) {
                const collectionProducts = await scrapeWooCommerceCollectionProducts(baseUrl, cat.id);
                collections.push({
                    id: cat.id.toString(),
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description,
                    count: cat.count,
                    image: cat.image?.src || null,
                    parent: cat.parent,
                    products: collectionProducts
                });
                
                log(`Scraped ${collectionProducts.length} products from collection: ${cat.name}`, 'info', 'info');
            }
            
            page++;
        } catch (error) {
            log(`Error fetching collections: ${error.message}`, 'error', 'error');
            hasMore = false;
        }
    }
    
    return collections;
}

async function scrapeWooCommerceCollectionProducts(baseUrl, categoryId) {
    const products = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products?category=${categoryId}&per_page=100&page=${page}&status=publish`);
            if (!response.ok) throw new Error(`Failed to fetch products for category ${categoryId}`);

            const data = await response.json();
            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            products.push(...data.map(product => ({
                id: product.id.toString(),
                title: product.name,
                sku: product.sku,
                price: product.price,
                regular_price: product.regular_price,
                sale_price: product.sale_price,
                stock_status: product.stock_status,
                description: product.description,
                short_description: product.short_description,
                categories: product.categories.map(cat => cat.name),
                images: product.images.map(img => img.src),
                variations: product.variations,
                attributes: product.attributes,
                url: product.permalink
            })));

            page++;
        } catch (error) {
            log(`Error fetching products for category ${categoryId}: ${error.message}`, 'error', 'error');
            hasMore = false;
        }
    }

    return products;
}

/**
 * Scrapes Shopify collections
 * @param {string} baseUrl - The base URL of the Shopify platform
 * @returns {array} The scraped Shopify collections
 */
async function scrapeShopifyCollections(baseUrl) {
    try {
        const response = await fetch(`${baseUrl}/collections.json`);
        if (!response.ok) throw new Error('Failed to fetch Shopify collections');
        
        const data = await response.json();
        const collections = [];

        // For each collection, fetch its products
        for (const collection of data.collections) {
            const collectionProducts = await scrapeShopifyCollectionProducts(baseUrl, collection.handle);
            collections.push({
                id: collection.id,
                name: collection.title,
                description: collection.description,
                handle: collection.handle,
                image: collection.image?.src || null,
                products: collectionProducts
            });

            // Log progress
            log(`Scraped ${collectionProducts.length} products from collection: ${collection.title}`, 'info', 'info');
        }

        return collections;
    } catch (error) {
        log(`Error fetching Shopify collections: ${error.message}`, 'error', 'error');
        return [];
    }
}

async function scrapeShopifyCollectionProducts(baseUrl, handle) {
    try {
        const response = await fetch(`${baseUrl}/collections/${handle}/products.json`);
        if (!response.ok) throw new Error(`Failed to fetch products for collection ${handle}`);

        const data = await response.json();
        return data.products.map(product => ({
            id: product.id.toString(),
            title: product.title,
            handle: product.handle,
            description: product.body_html,
            price: product.variants[0]?.price,
            compare_at_price: product.variants[0]?.compare_at_price,
            sku: product.variants[0]?.sku,
            stock_status: product.variants[0]?.available ? 'instock' : 'outofstock',
            images: product.images.map(img => img.src),
            variants: product.variants,
            options: product.options,
            url: `${baseUrl}/products/${product.handle}`
        }));
    } catch (error) {
        log(`Error fetching products for collection ${handle}: ${error.message}`, 'error', 'error');
        return [];
    }
}

// Display Functions
/**
 * Displays the scraped collections in the UI
 */
function displayCollections() {
    const container = document.getElementById('collectionsContent');
    if (!container) return;

    container.innerHTML = '';
    if (!collections.length) {
        container.innerHTML = '<div class="no-items">No collections found</div>';
        return;
    }

    collections.forEach(collection => {
        const card = createCollectionCard(collection);
        container.appendChild(card);
    });
}

/**
 * Creates a collection card element
 * @param {object} collection - The collection data
 * @returns {HTMLElement} The collection card element
 */
function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.dataset.id = collection.id;

    const selected = selectedCollections.has(collection.id);
    if (selected) card.classList.add('selected');

    // Create collection header
    const header = document.createElement('div');
    header.className = 'collection-header';
    header.innerHTML = `
        <h3>${collection.name}</h3>
        <span class="product-count">${collection.products.length} products</span>
    `;
    card.appendChild(header);

    // Create products grid
    const productsGrid = document.createElement('div');
    productsGrid.className = 'collection-products';
    
    // Add first 4 products as preview
    collection.products.slice(0, 4).forEach(product => {
        const productPreview = document.createElement('div');
        productPreview.className = 'product-preview';
        productPreview.innerHTML = `
            <img src="${product.images[0] || 'placeholder.jpg'}" alt="${product.title}">
            <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-price">${formatPrice(product.price)}</div>
            </div>
        `;
        productsGrid.appendChild(productPreview);
    });

    if (collection.products.length > 4) {
        const moreProducts = document.createElement('div');
        moreProducts.className = 'more-products';
        moreProducts.textContent = `+${collection.products.length - 4} more`;
        productsGrid.appendChild(moreProducts);
    }

    card.appendChild(productsGrid);

    // Add click handler
    card.addEventListener('click', (e) => {
        if (e.target.closest('.product-preview')) {
            // Handle product click
            return;
        }
        
        const id = collection.id;
        if (selectedCollections.has(id)) {
            selectedCollections.delete(id);
            card.classList.remove('selected');
        } else {
            selectedCollections.add(id);
            card.classList.add('selected');
        }
        updateSelectedCount();
        updateButtonStates();
    });

    return card;
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
    console.log('Creating card for product:', product.id);
    
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;

    // Create checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'product-checkbox';
    checkbox.checked = selectedProducts.has(product.id);
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            selectedProducts.add(product.id);
            log(`Selected product: ${product.name}`, 'info', 'check_circle');
        } else {
            selectedProducts.delete(product.id);
            log(`Deselected product: ${product.name}`, 'info', 'remove_circle');
        }
        updateSelectedCount();
        updateButtonStates();
    });

    // Create main content container
    const content = document.createElement('div');
    content.className = 'product-content';

    // Add product image if available
    if (product.images && product.images.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image-container';
        
        const img = document.createElement('img');
        img.src = product.images[0];
        img.alt = product.name;
        img.className = 'product-image';
        img.addEventListener('error', () => {
            img.src = 'placeholder.png'; // Add a placeholder image
            img.alt = 'Image not available';
        });
        
        imageContainer.appendChild(img);
        content.appendChild(imageContainer);
    }

    // Add product details
    const details = document.createElement('div');
    details.className = 'product-details';

    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = product.name || 'Unnamed Product';

    const price = document.createElement('p');
    price.className = 'product-price';
    const formattedPrice = formatPrice(product.price_html || product.price);
    price.textContent = formattedPrice || 'Price not available';

    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.short_description || product.description || 'No description available';

    details.appendChild(name);
    details.appendChild(price);
    details.appendChild(description);
    content.appendChild(details);

    // Add checkbox and content to card
    card.appendChild(checkbox);
    card.appendChild(content);

    return card;
}

// Filter Functions
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

// Tab Functions
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

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const contentId = tab.id.replace('Tab', 'Content');
            document.getElementById(contentId)?.classList.add('active');

            // Update UI based on active tab
            updateSelectedCount();
            updateButtonStates();
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
    // Initialize UI elements
    const searchInput = document.getElementById('searchInput');
    const searchBy = document.getElementById('searchBy');
    const stockSelect = document.getElementById('stockStatus');
    const priceRange = document.getElementById('priceRange');
    const sortSelect = document.getElementById('sortBy');
    const scrapeButton = document.getElementById('scrapeButton');
    const clearButton = document.getElementById('clearButton');
    const selectAllButton = document.getElementById('selectAll');

    // Set up filter event listeners
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }
    if (searchBy) {
        searchBy.addEventListener('change', filterProducts);
    }
    if (stockSelect) {
        stockSelect.addEventListener('change', filterProducts);
    }
    if (priceRange) {
        priceRange.addEventListener('change', filterProducts);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', filterProducts);
    }

    // Set up other event listeners
    if (scrapeButton) {
        scrapeButton.addEventListener('click', async () => {
            if (isLoading) return;
            
            try {
                setLoading(true);
                // Use the active tab to determine what to scrape
                const type = activeTab === 'productsTab' ? 'products' : 'collections';
                
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
            products = [];
            selectedProducts.clear();
            currentPage = 1;
            totalPages = 1;
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.innerHTML = '';
            }
            updateButtonStates();
            updatePagination();
            clearTerminal();
        });
    }

    if (selectAllButton) {
        selectAllButton.addEventListener('click', () => {
            const productsGrid = document.getElementById('productsGrid');
            if (!productsGrid) return;
            
            const allCheckboxes = productsGrid.querySelectorAll('input[type="checkbox"]');
            const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
            
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = !allChecked;
                const productId = checkbox.getAttribute('data-product-id');
                if (productId) {
                    if (!allChecked) {
                        selectedProducts.add(productId);
                    } else {
                        selectedProducts.delete(productId);
                    }
                }
            });
            
            updateButtonStates();
            updateSelectedCount();
        });
    }

    // Initialize pagination buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                filterProducts();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                filterProducts();
            }
        });
    }

    // Initialize terminal clear button
    const clearTerminalBtn = document.getElementById('clearTerminal');
    if (clearTerminalBtn) {
        clearTerminalBtn.addEventListener('click', clearTerminal);
    }

    // Initialize other UI components
    updateButtonStates();
    updatePagination();
});

// Export Modal Functions
function setupExportModal() {
    const modal = document.getElementById('exportModal');
    const closeBtn = modal.querySelector('.close-button');
    const confirmBtn = document.getElementById('confirmExport');
    const exportFormatSelect = document.getElementById('exportFormat');
    const exportFieldsContainer = document.getElementById('exportFields');

    // Close modal when clicking close button
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Populate export fields based on active tab
    function updateExportFields() {
        exportFieldsContainer.innerHTML = '';
        const fields = activeTab === 'productsTab' ? 
            [
                { id: 'title', label: 'Title', checked: true },
                { id: 'sku', label: 'SKU', checked: true },
                { id: 'price', label: 'Price', checked: true },
                { id: 'stock_status', label: 'Stock Status', checked: true },
                { id: 'description', label: 'Description', checked: false },
                { id: 'images', label: 'Images', checked: false }
            ] :
            [
                { id: 'name', label: 'Name', checked: true },
                { id: 'slug', label: 'Slug', checked: true },
                { id: 'description', label: 'Description', checked: false },
                { id: 'count', label: 'Product Count', checked: true }
            ];

        fields.forEach(field => {
            const container = document.createElement('div');
            container.className = 'checkbox-container';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `field_${field.id}`;
            checkbox.checked = field.checked;
            checkbox.value = field.id;
            
            const label = document.createElement('label');
            label.htmlFor = `field_${field.id}`;
            label.textContent = field.label;
            
            container.appendChild(checkbox);
            container.appendChild(label);
            exportFieldsContainer.appendChild(container);
        });
    }

    // Handle export confirmation
    confirmBtn.onclick = async () => {
        const format = exportFormatSelect.value;
        const selectedFields = Array.from(exportFieldsContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        if (selectedFields.length === 0) {
            showToast('Please select at least one field to export', true);
            return;
        }

        const selectedItems = getSelectedItems();
        if (selectedItems.length === 0) {
            showToast('Please select items to export', true);
            return;
        }

        try {
            await exportData(selectedItems, format, selectedFields);
            modal.style.display = 'none';
            showToast('Export completed successfully');
        } catch (error) {
            showToast('Export failed: ' + error.message, true);
        }
    };

    // Update fields when tab changes
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(updateExportFields, 0);
        });
    });

    // Initial fields setup
    updateExportFields();
}

// Export button click handler
document.getElementById('exportBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('exportModal');
    modal.style.display = 'block';
});

// Get selected items based on active tab
function getSelectedItems() {
    if (activeTab === 'productsTab') {
        return products.filter(product => selectedProducts.has(product.id));
    } else {
        // For collections tab, return all products from selected collections
        const selectedItems = [];
        collections.forEach(collection => {
            if (selectedCollections.has(collection.id)) {
                selectedItems.push(...collection.products);
            }
        });
        return selectedItems;
    }
}

async function exportData(items, format, fields) {
    if (!items || items.length === 0) {
        throw new Error('No items selected for export');
    }

    // Filter item data based on selected fields
    const filteredItems = items.map(item => {
        const filteredItem = {};
        fields.forEach(field => {
            if (item.hasOwnProperty(field)) {
                let value = item[field];
                
                // Handle special cases
                if (field === 'images' && Array.isArray(value)) {
                    value = value.join(';');
                } else if (field === 'categories' && Array.isArray(value)) {
                    value = value.join(';');
                } else if (field === 'price' || field === 'regular_price' || field === 'sale_price') {
                    value = formatPrice(value);
                }
                
                filteredItem[field] = value;
            }
        });
        return filteredItem;
    });

    let content;
    let mimeType;

    const timestamp = new Date().toISOString().slice(0, 10);
    const itemType = activeTab === 'productsTab' ? 'products' : 'collections';
    const filename = `${itemType}_export_${timestamp}`;

    switch (format.toLowerCase()) {
        case 'csv':
            content = convertToCSV(filteredItems, fields);
            mimeType = 'text/csv';
            break;
        case 'json':
            content = JSON.stringify(filteredItems, null, 2);
            mimeType = 'application/json';
            break;
        case 'excel':
            content = convertToCSV(filteredItems, fields);
            mimeType = 'text/csv';
            break;
        default:
            throw new Error('Unsupported export format');
    }

    // Create blob and download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function convertToCSV(items, fields) {
    if (!items || items.length === 0) return '';

    const headers = fields.join(',');
    const rows = items.map(item => {
        return fields.map(field => {
            let value = item[field];
            
            // Handle different value types
            if (value === null || value === undefined) {
                return '';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            
            value = String(value);
            // Escape quotes and special characters
            value = value.replace(/"/g, '""');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
            }
            return value;
        }).join(',');
    });

    return [headers, ...rows].join('\n');
}

/**
 * Updates the UI to reflect the current state
 */
function updateUI() {
    // Update the display based on active tab
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        if (activeTab.id === 'productsContent') {
            // Update product cards
            const productCards = document.querySelectorAll('.product-card');
            productCards.forEach(card => {
                const productId = parseInt(card.dataset.id);
                card.classList.toggle('selected', selectedProducts.has(productId));
            });
        } else if (activeTab.id === 'collectionsContent') {
            // Update collection cards
            const collectionCards = document.querySelectorAll('.collection-card');
            collectionCards.forEach(card => {
                const collectionId = parseInt(card.dataset.id);
                card.classList.toggle('selected', selectedCollections.has(collectionId));
            });
        }
    }

    // Update selection count and button states
    updateSelectedCount();
    updateButtonStates();
}

function updateButtonStates() {
    const exportButton = document.getElementById('exportSelected');
    const clearButton = document.getElementById('clearButton');
    const selectAllBtn = document.getElementById('selectAll');
    const invertSelectionBtn = document.getElementById('invertSelection');
    
    // Get counts based on active tab
    const activeTab = document.querySelector('.tab-content.active');
    let selectedCount = 0;
    let totalCount = 0;
    
    if (activeTab) {
        if (activeTab.id === 'productsContent') {
            selectedCount = selectedProducts.size;
            totalCount = products.length;
        } else if (activeTab.id === 'collectionsContent') {
            selectedCount = selectedCollections.size;
            totalCount = collections.length;
        }
    }

    // Update button states
    if (exportButton) {
        const hasSelection = selectedProducts.size > 0 || selectedCollections.size > 0;
        exportButton.disabled = !hasSelection;
    }

    if (clearButton) {
        clearButton.disabled = totalCount === 0;
    }

    if (selectAllBtn) {
        selectAllBtn.disabled = totalCount === 0;
    }

    if (invertSelectionBtn) {
        invertSelectionBtn.disabled = totalCount === 0;
    }
}

function clearSelection() {
    selectedProducts.clear();
    selectedCollections.clear();
    updateUI();
}

/**
 * Refreshes card selections in the UI
 */
function refreshCardSelections() {
    const cards = document.querySelectorAll('.product-card, .collection-card');
    const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;

    cards.forEach(card => {
        const id = card.dataset.id;
        if (selectedSet.has(id)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

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
    
    if (scrapeButton) {
        scrapeButton.addEventListener('click', async () => {
            if (isLoading) return;
            
            try {
                setLoading(true);
                // Use the active tab to determine what to scrape
                const type = activeTab === 'productsTab' ? 'products' : 'collections';
                
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
            products = [];
            selectedProducts.clear();
            currentPage = 1;
            totalPages = 1;
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.innerHTML = '';
            }
            updateButtonStates();
            updatePagination();
            clearTerminal();
        });
    }

    // Set initial button states
    updateButtonStates();
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
    setupTabs();
    setupExportModal();
    setupSelectionHandlers();
});

function setupExportModal() {
    const modal = document.getElementById('exportModal');
    const closeBtn = modal.querySelector('.close-button');
    const exportBtn = document.getElementById('confirmExport');
    const exportSelectedBtn = document.getElementById('exportSelected');

    // Setup export selected button
    if (exportSelectedBtn) {
        exportSelectedBtn.addEventListener('click', () => {
            const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;
            if (selectedSet.size === 0) {
                log('Please select items to export', 'warning', 'warning');
                return;
            }
            modal.style.display = 'block';
            updateExportFields();
        });
    }

    // Setup close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Setup export confirmation button
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const format = document.getElementById('exportFormat').value;
            const fields = Array.from(document.querySelectorAll('#exportFields input:checked'))
                .map(input => input.value);

            if (fields.length === 0) {
                log('Please select at least one field to export', 'warning', 'warning');
                return;
            }

            exportItems(format, fields);
            modal.style.display = 'none';
        });
    }
}

function exportItems(format, fields) {
    try {
        const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;
        const items = activeTab === 'productsTab' ? products : collections;
        
        if (selectedSet.size === 0) {
            log('No items selected for export', 'warning', 'warning');
            return;
        }

        // Get selected items
        const selectedItems = items.filter(item => selectedSet.has(item.id));
        
        // Filter fields
        const exportData = selectedItems.map(item => {
            const filteredItem = {};
            fields.forEach(field => {
                if (field in item) {
                    filteredItem[field] = item[field];
                }
            });
            return filteredItem;
        });

        let content;
        let mimeType;

        const timestamp = new Date().toISOString().slice(0, 10);
        const itemType = activeTab === 'productsTab' ? 'products' : 'collections';
        const filename = `${itemType}_export_${timestamp}`;

        switch (format.toLowerCase()) {
            case 'csv':
                content = convertToCSV(exportData);
                mimeType = 'text/csv';
                break;
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
                break;
            case 'excel':
                content = convertToCSV(exportData);
                mimeType = 'text/csv';
                break;
            default:
                throw new Error('Unsupported export format');
        }

        // Create and trigger download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log(`Successfully exported ${selectedSet.size} ${itemType}`, 'success', 'download');
    } catch (error) {
        log(`Export failed: ${error.message}`, 'error', 'error');
        console.error('Export error:', error);
    }
}

function convertToCSV(items) {
    if (!items || items.length === 0) return '';

    const headers = Object.keys(items[0]);
    const rows = items.map(item => {
        return headers.map(header => {
            let value = item[header];
            
            // Handle different value types
            if (value === null || value === undefined) {
                return '';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            
            value = String(value);
            // Escape quotes and special characters
            value = value.replace(/"/g, '""');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
            }
            return value;
        }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

function updateExportFields() {
    const fieldsContainer = document.getElementById('exportFields');
    if (!fieldsContainer) return;

    const items = activeTab === 'productsTab' ? products : collections;
    const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;

    if (selectedSet.size === 0 || items.length === 0) {
        fieldsContainer.innerHTML = '<p>No items selected</p>';
        return;
    }

    // Get the first selected item to determine available fields
    const firstItem = items.find(item => selectedSet.has(item.id));
    if (!firstItem) return;

    const fields = Object.keys(firstItem);
    const commonFields = ['id', 'name', 'price', 'description'];

    fieldsContainer.innerHTML = fields.map(field => `
        <label class="field-option">
            <input type="checkbox" value="${field}" ${commonFields.includes(field) ? 'checked' : ''}>
            ${field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
        </label>
    `).join('');
}

// Initialize export functionality
document.addEventListener('DOMContentLoaded', () => {
    setupExportModal();
});

function setupSelectionHandlers() {
    const selectAllBtn = document.getElementById('selectAll');
    const invertSelectionBtn = document.getElementById('invertSelection');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const items = activeTab === 'productsTab' ? products : collections;
            const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;

            // Toggle selection
            if (selectedSet.size === items.length) {
                selectedSet.clear();
                log('Cleared all selections', 'info', 'deselect');
            } else {
                selectedSet.clear(); // Clear first to ensure clean state
                items.forEach(item => selectedSet.add(item.id));
                log(`Selected all items (${items.length})`, 'success', 'select_all');
            }

            // Update UI
            updateSelectedItemsList();
            updateSelectedCount();
            updateButtonStates();
            refreshCardSelections();
        });
    }

    if (invertSelectionBtn) {
        invertSelectionBtn.addEventListener('click', () => {
            const items = activeTab === 'productsTab' ? products : collections;
            const selectedSet = activeTab === 'productsTab' ? selectedProducts : selectedCollections;

            items.forEach(item => {
                if (selectedSet.has(item.id)) {
                    selectedSet.delete(item.id);
                } else {
                    selectedSet.add(item.id);
                }
            });

            // Update UI
            updateSelectedItemsList();
            updateSelectedCount();
            updateButtonStates();
            refreshCardSelections();
            log('Inverted selection', 'info', 'swap_horiz');
        });
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
    for (const id of selectedCollections) {
        const collection = collections.find(c => c.id === id);
        if (collection) {
            count++;
            container.appendChild(createSelectedItemElement(collection, 'collection'));
        }
    }

    // Add selected products
    for (const id of selectedProducts) {
        const product = products.find(p => p.id === id);
        if (product) {
            count++;
            container.appendChild(createSelectedItemElement(product, 'product'));
        }
    }

    // Update count
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = count;
    }

    // Update export button state
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
    div.dataset.id = item.id;

    const isSelected = type === 'collection' ? selectedCollections.has(item.id) : selectedProducts.has(item.id);
    if (isSelected) {
        div.classList.add('selected');
    }

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
 * Updates the count of selected items in the UI
 */
function updateSelectedCount() {
    const totalSelected = selectedProducts.size + selectedCollections.size;
    
    // Update all count displays
    const countElements = [
        document.getElementById('selectedCount'),
        document.getElementById('headerSelectedCount')
    ];

    countElements.forEach(element => {
        if (element) {
            element.textContent = totalSelected;
        }
    });

    // Update export button state
    const exportButton = document.getElementById('exportSelected');
    if (exportButton) {
        exportButton.disabled = totalSelected === 0;
    }
}

/**
 * Shows a toast message to the user
 * @param {string} message - The message to display
 * @param {boolean} error - Whether the message is an error
 */
function showToast(message, error = false) {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }

    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

/**
 * Formats a price string to ensure consistent decimal separator (comma)
 * and proper currency symbol placement.
 * 
 * @param {string|number} priceStr - The price to format
 * @returns {string} Formatted price string
 */
function formatPrice(priceStr) {
    if (!priceStr) return '';
    
    // Log input for debugging
    console.log('Price input:', priceStr);
    
    // Convert to string if number
    let price = priceStr.toString();
    
    // Handle HTML content if present
    if (price.includes('<')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = price;
        price = tempDiv.textContent || tempDiv.innerText;
    }
    
    // Remove currency symbols and whitespace
    price = price.replace(/[^\d.,]/g, '').trim();
    console.log('After cleaning:', price);
    
    // Handle different decimal separators
    if (price.includes('.') && price.includes(',')) {
        // European format (1.234,56)
        price = price.replace(/\./g, '').replace(',', '.');
    } else if (price.includes(',')) {
        // Single comma format
        price = price.replace(',', '.');
    }
    
    console.log('Before parsing:', price);
    
    // Parse and format
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
        console.log('Failed to parse price');
        return '';
    }
    
    const formatted = numPrice.toFixed(2).replace('.', ',');
    console.log('Final formatted price:', formatted);
    return formatted;
}

// Add collection scraping and export functionality
async function scrapeWooCommerceCollections(baseUrl) {
    const collections = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/categories?per_page=100&page=${page}`);
            if (!response.ok) throw new Error('Failed to fetch collections');
            
            const data = await response.json();
            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }
            
            // For each collection, fetch its products
            for (const cat of data) {
                const collectionProducts = await scrapeWooCommerceCollectionProducts(baseUrl, cat.id);
                collections.push({
                    id: cat.id.toString(),
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description,
                    count: cat.count,
                    image: cat.image?.src || null,
                    parent: cat.parent,
                    products: collectionProducts
                });
                
                log(`Scraped ${collectionProducts.length} products from collection: ${cat.name}`, 'info', 'info');
            }
            
            page++;
        } catch (error) {
            log(`Error fetching collections: ${error.message}`, 'error', 'error');
            hasMore = false;
        }
    }
    
    return collections;
}

async function scrapeShopifyCollections(baseUrl) {
    try {
        const response = await fetch(`${baseUrl}/collections.json`);
        if (!response.ok) throw new Error('Failed to fetch Shopify collections');
        
        const data = await response.json();
        const collections = [];

        // For each collection, fetch its products
        for (const collection of data.collections) {
            const collectionProducts = await scrapeShopifyCollectionProducts(baseUrl, collection.handle);
            collections.push({
                id: collection.id,
                name: collection.title,
                description: collection.description,
                handle: collection.handle,
                image: collection.image?.src || null,
                products: collectionProducts
            });

            // Log progress
            log(`Scraped ${collectionProducts.length} products from collection: ${collection.title}`, 'info', 'info');
        }

        return collections;
    } catch (error) {
        log(`Error fetching Shopify collections: ${error.message}`, 'error', 'error');
        return [];
    }
}

async function scrapeCollectionProducts(baseUrl, categoryId) {
    const products = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(`${baseUrl}/wp-json/wc/v3/products?category=${categoryId}&per_page=100&page=${page}&status=publish`);
            if (!response.ok) throw new Error(`Failed to fetch products for category ${categoryId}`);

            const data = await response.json();
            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            products.push(...data.map(product => ({
                id: product.id.toString(),
                title: product.name,
                sku: product.sku,
                price: product.price,
                regular_price: product.regular_price,
                sale_price: product.sale_price,
                stock_status: product.stock_status,
                description: product.description,
                short_description: product.short_description,
                categories: product.categories.map(cat => cat.name),
                images: product.images.map(img => img.src),
                variations: product.variations,
                attributes: product.attributes,
                url: product.permalink
            })));

            page++;
        } catch (error) {
            log(`Error fetching products for category ${categoryId}: ${error.message}`, 'error', 'error');
            hasMore = false;
        }
    }

    return products;
}

async function scrapeShopifyCollectionProducts(baseUrl, handle) {
    try {
        const response = await fetch(`${baseUrl}/collections/${handle}/products.json`);
        if (!response.ok) throw new Error(`Failed to fetch products for collection ${handle}`);

        const data = await response.json();
        return data.products.map(product => ({
            id: product.id.toString(),
            title: product.title,
            handle: product.handle,
            description: product.body_html,
            price: product.variants[0]?.price,
            compare_at_price: product.variants[0]?.compare_at_price,
            sku: product.variants[0]?.sku,
            stock_status: product.variants[0]?.available ? 'instock' : 'outofstock',
            images: product.images.map(img => img.src),
            variants: product.variants,
            options: product.options,
            url: `${baseUrl}/products/${product.handle}`
        }));
    } catch (error) {
        log(`Error fetching products for collection ${handle}: ${error.message}`, 'error', 'error');
        return [];
    }
}

// Update display functions to show products within collections
function displayCollections() {
    const container = document.getElementById('collectionsContent');
    if (!container) return;

    container.innerHTML = '';
    if (!collections.length) {
        container.innerHTML = '<div class="no-items">No collections found</div>';
        return;
    }

    collections.forEach(collection => {
        const card = createCollectionCard(collection);
        container.appendChild(card);
    });
}

function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.dataset.id = collection.id;

    const selected = selectedCollections.has(collection.id);
    if (selected) card.classList.add('selected');

    // Create collection header
    const header = document.createElement('div');
    header.className = 'collection-header';
    header.innerHTML = `
        <h3>${collection.name}</h3>
        <span class="product-count">${collection.products.length} products</span>
    `;
    card.appendChild(header);

    // Create products grid
    const productsGrid = document.createElement('div');
    productsGrid.className = 'collection-products';
    
    // Add first 4 products as preview
    collection.products.slice(0, 4).forEach(product => {
        const productPreview = document.createElement('div');
        productPreview.className = 'product-preview';
        productPreview.innerHTML = `
            <img src="${product.images[0] || 'placeholder.jpg'}" alt="${product.title}">
            <div class="product-info">
                <div class="product-title">${product.title}</div>
                <div class="product-price">${formatPrice(product.price)}</div>
            </div>
        `;
        productsGrid.appendChild(productPreview);
    });

    if (collection.products.length > 4) {
        const moreProducts = document.createElement('div');
        moreProducts.className = 'more-products';
        moreProducts.textContent = `+${collection.products.length - 4} more`;
        productsGrid.appendChild(moreProducts);
    }

    card.appendChild(productsGrid);

    // Add click handler
    card.addEventListener('click', (e) => {
        if (e.target.closest('.product-preview')) {
            // Handle product click
            return;
        }
        
        const id = collection.id;
        if (selectedCollections.has(id)) {
            selectedCollections.delete(id);
            card.classList.remove('selected');
        } else {
            selectedCollections.add(id);
            card.classList.add('selected');
        }
        updateSelectedCount();
        updateButtonStates();
    });

    return card;
}
