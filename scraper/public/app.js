// State management
let state = {
    collections: [],
    products: [],
    activeTab: 'collections',
    loading: false
};

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const collectionsGrid = document.querySelector('.collections-grid');
const productsGrid = document.querySelector('.products-grid');
const loadingOverlay = document.querySelector('.loading-overlay');
const searchInput = document.querySelector('#search-input');
const toast = document.querySelector('.toast');

// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
tabButtons.forEach(button => button.addEventListener('click', handleTabChange));
searchInput.addEventListener('input', debounce(handleSearch, 300));

// Initialize the application
async function initialize() {
    showLoading('Fetching collections...');
    try {
        const collections = await fetchCollections();
        state.collections = collections;
        renderCollections();
        showToast('Collections loaded successfully');
    } catch (error) {
        console.error('Failed to fetch collections:', error);
        showToast('Failed to load collections', true);
    } finally {
        hideLoading();
    }
}

// API Calls
async function fetchCollections() {
    const response = await fetch('/api/collections');
    if (!response.ok) throw new Error('Failed to fetch collections');
    return response.json();
}

async function fetchProducts(collectionId) {
    const response = await fetch(`/api/products?collection=${collectionId}`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
}

// UI Rendering
function renderCollections() {
    const filteredCollections = filterItems(state.collections, searchInput.value);
    collectionsGrid.innerHTML = filteredCollections.map(collection => `
        <div class="collection-card">
            <div class="collection-header">
                <h3 class="collection-name">${collection.name}</h3>
                <span class="collection-count">${collection.count} items</span>
            </div>
            <div class="collection-info">
                <p>${collection.description || 'No description available'}</p>
            </div>
            <div class="collection-actions">
                <button class="btn btn-text" onclick="viewCollection('${collection.id}')">
                    <i class="material-icons">visibility</i>
                    View Products
                </button>
                <button class="btn btn-text" onclick="exportCollection('${collection.id}')">
                    <i class="material-icons">download</i>
                    Export CSV
                </button>
            </div>
        </div>
    `).join('');
}

function renderProducts() {
    const filteredProducts = filterItems(state.products, searchInput.value);
    productsGrid.innerHTML = filteredProducts.map(product => `
        <div class="product-card">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-price">${formatPrice(product.price)}</p>
                <p class="product-description">${product.description}</p>
            </div>
            <div class="product-actions">
                <button class="btn btn-text" onclick="viewProductDetails('${product.id}')">
                    <i class="material-icons">info</i>
                    Details
                </button>
            </div>
        </div>
    `).join('');
}

// Event Handlers
async function viewCollection(collectionId) {
    showLoading('Loading products...');
    try {
        const products = await fetchProducts(collectionId);
        state.products = products;
        state.activeTab = 'products';
        updateActiveTab();
        renderProducts();
        showToast('Products loaded successfully');
    } catch (error) {
        console.error('Failed to fetch products:', error);
        showToast('Failed to load products', true);
    } finally {
        hideLoading();
    }
}

async function exportCollection(collectionId) {
    showLoading('Preparing CSV export...');
    try {
        const response = await fetch(`/api/export?collection=${collectionId}`);
        if (!response.ok) throw new Error('Failed to export collection');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collection-${collectionId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Export completed successfully');
    } catch (error) {
        console.error('Failed to export collection:', error);
        showToast('Failed to export collection', true);
    } finally {
        hideLoading();
    }
}

function handleTabChange(event) {
    const tabId = event.target.dataset.tab;
    state.activeTab = tabId;
    updateActiveTab();
}

function handleSearch(event) {
    const searchTerm = event.target.value;
    if (state.activeTab === 'collections') {
        renderCollections();
    } else {
        renderProducts();
    }
}

// UI Utilities
function updateActiveTab() {
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === state.activeTab);
    });
    tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${state.activeTab}-panel`);
    });
}

function showLoading(message = 'Loading...') {
    loadingOverlay.querySelector('p').textContent = message;
    loadingOverlay.classList.remove('hidden');
    state.loading = true;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    state.loading = false;
}

function showToast(message, isError = false) {
    const toastElement = document.querySelector('.toast');
    toastElement.textContent = message;
    toastElement.style.backgroundColor = isError ? 'var(--error)' : '#323232';
    toastElement.classList.remove('hidden');
    setTimeout(() => toastElement.classList.add('hidden'), 3000);
}

// Helper Functions
function filterItems(items, searchTerm) {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.description && item.description.toLowerCase().includes(term))
    );
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
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

// Export functions for external use
window.viewCollection = viewCollection;
window.exportCollection = exportCollection;
window.viewProductDetails = viewProductDetails;
