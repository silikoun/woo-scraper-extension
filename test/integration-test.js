import { promises as fs } from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupTestEnvironment() {
    // Read the HTML file
    const html = await fs.readFile(join(__dirname, '../popup/popup.html'), 'utf8');
    const css = await fs.readFile(join(__dirname, '../popup/popup.css'), 'utf8');
    const js = await fs.readFile(join(__dirname, '../popup/popup.js'), 'utf8');

    // Create a virtual DOM
    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        url: 'file://' + join(__dirname, '../popup/popup.html')
    });

    // Add CSS
    const style = dom.window.document.createElement('style');
    style.textContent = css;
    dom.window.document.head.appendChild(style);

    // Mock chrome API with vintagefootball.shop URL
    dom.window.chrome = {
        tabs: {
            query: () => Promise.resolve([{ url: 'https://vintagefootball.shop' }])
        }
    };

    // Mock fetch API with real-like data
    dom.window.fetch = async (url) => {
        console.log(`Fetch called with URL: ${url}`);
        
        // Simulate WooCommerce API responses
        if (url.includes('/wp-json/wc/v3/products')) {
            return {
                ok: true,
                json: () => Promise.resolve([
                    {
                        id: 1,
                        name: 'Vintage Football Jersey',
                        price: '59.99',
                        description: 'Classic vintage football jersey',
                        sku: 'VFJ-001',
                        stock_status: 'instock',
                        images: [{ src: 'https://vintagefootball.shop/image1.jpg' }]
                    },
                    {
                        id: 2,
                        name: 'Retro Football Boots',
                        price: '89.99',
                        description: 'Authentic retro football boots',
                        sku: 'RFB-002',
                        stock_status: 'instock',
                        images: [{ src: 'https://vintagefootball.shop/image2.jpg' }]
                    }
                ])
            };
        } else if (url.includes('/wp-json/wc/v3/products/categories')) {
            return {
                ok: true,
                json: () => Promise.resolve([
                    {
                        id: 101,
                        name: 'Jerseys',
                        count: 15
                    },
                    {
                        id: 102,
                        name: 'Boots',
                        count: 10
                    }
                ])
            };
        }
        
        return { ok: false };
    };

    // Mock download functionality
    dom.window.URL.createObjectURL = (blob) => 'mock-url';
    dom.window.URL.revokeObjectURL = () => {};

    // Create a mock link click function
    let lastDownloadedFile = null;
    dom.window.HTMLAnchorElement.prototype.click = function() {
        lastDownloadedFile = this.href;
    };

    // Add JS
    const script = dom.window.document.createElement('script');
    script.textContent = js;
    dom.window.document.body.appendChild(script);

    // Wait for DOMContentLoaded
    await new Promise(resolve => {
        if (dom.window.document.readyState === 'complete') {
            resolve();
        } else {
            dom.window.addEventListener('DOMContentLoaded', resolve);
        }
    });

    return { dom, getLastDownloadedFile: () => lastDownloadedFile };
}

async function testScrapeProducts(dom) {
    console.log('\n=== Testing Product Scraping ===');
    
    const scrapeProductsBtn = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeProductsBtn, 'Scrape Products button should exist');

    // Create a promise that resolves when products are displayed
    const productsDisplayed = new Promise(resolve => {
        const originalDisplayProducts = dom.window.displayProducts;
        dom.window.displayProducts = function() {
            originalDisplayProducts.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeProductsBtn.click();
    
    // Wait for products to be displayed
    await productsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if products are displayed
    const productsList = dom.window.document.getElementById('productsList');
    const productItems = productsList.querySelectorAll('.product-item');
    
    assert(productItems.length === 2, `Expected 2 products, found ${productItems.length}`);
    console.log('✅ Successfully scraped and displayed products');
}

async function testScrapeCollections(dom) {
    console.log('\n=== Testing Collection Scraping ===');
    
    const scrapeCollectionsBtn = dom.window.document.getElementById('scrapeCollections');
    assert(scrapeCollectionsBtn, 'Scrape Collections button should exist');

    // Create a promise that resolves when collections are displayed
    const collectionsDisplayed = new Promise(resolve => {
        const originalDisplayCollections = dom.window.displayCollections;
        dom.window.displayCollections = function() {
            originalDisplayCollections.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeCollectionsBtn.click();
    
    // Wait for collections to be displayed
    await collectionsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if collections are displayed
    const collectionsList = dom.window.document.getElementById('collectionsList');
    const collectionItems = collectionsList.querySelectorAll('.collection-item');
    
    assert(collectionItems.length === 2, `Expected 2 collections, found ${collectionItems.length}`);
    console.log('✅ Successfully scraped and displayed collections');
}

async function testItemSelection(dom) {
    console.log('\n=== Testing Item Selection ===');
    
    // Wait for items to be loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Select a product
    const productsList = dom.window.document.getElementById('productsList');
    const productSelectBtn = productsList.querySelector('.select-button');
    assert(productSelectBtn, 'Product select button should exist');
    productSelectBtn.click();
    
    // Select a collection
    const collectionsList = dom.window.document.getElementById('collectionsList');
    const collectionSelectBtn = collectionsList.querySelector('.select-button');
    assert(collectionSelectBtn, 'Collection select button should exist');
    collectionSelectBtn.click();
    
    // Wait for selection updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check selected items count
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '2', `Expected 2 selected items, found ${selectedCount.textContent}`);
    console.log('✅ Successfully selected items');
}

async function testExportCSV(dom, getLastDownloadedFile) {
    console.log('\n=== Testing CSV Export ===');
    
    const exportSelectedBtn = dom.window.document.getElementById('exportSelected');
    assert(exportSelectedBtn, 'Export Selected button should exist');
    assert(!exportSelectedBtn.disabled, 'Export button should be enabled after selection');

    // Create a promise that resolves when export is complete
    const exportComplete = new Promise(resolve => {
        const originalExportSelectedItems = dom.window.exportSelectedItems;
        dom.window.exportSelectedItems = function(options) {
            originalExportSelectedItems.call(this, options);
            resolve();
        };
    });

    // Click export button
    exportSelectedBtn.click();
    
    // Wait for export to complete
    await exportComplete;
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if file was downloaded
    const downloadedFile = getLastDownloadedFile();
    assert(downloadedFile, 'CSV file should have been downloaded');
    console.log('✅ Successfully exported CSV');
}

async function testClearSelection(dom) {
    console.log('\n=== Testing Clear Selection ===');
    
    const clearSelectionBtn = dom.window.document.getElementById('clearSelection');
    assert(clearSelectionBtn, 'Clear Selection button should exist');

    // Click clear button
    clearSelectionBtn.click();
    
    // Wait for selection to be cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if selection was cleared
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '0', `Expected 0 selected items, found ${selectedCount.textContent}`);
    console.log('✅ Successfully cleared selection');
}

async function testProductScrapingAndSelection(dom) {
    console.log('\n=== Testing Product Scraping and Selection ===');
    
    const scrapeProductsBtn = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeProductsBtn, 'Scrape Products button should exist');

    // Create a promise that resolves when products are displayed
    const productsDisplayed = new Promise(resolve => {
        const originalDisplayProducts = dom.window.displayProducts;
        dom.window.displayProducts = function() {
            originalDisplayProducts.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeProductsBtn.click();
    
    // Wait for products to be displayed
    await productsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if products are displayed
    const productsList = dom.window.document.getElementById('productsList');
    const productItems = productsList.querySelectorAll('.product-item');
    
    assert(productItems.length === 2, `Expected 2 products, found ${productItems.length}`);
    
    // Select a product
    const firstProduct = productItems[0];
    firstProduct.click();
    
    // Check if selection is registered
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '1', `Expected 1 selected item, found ${selectedCount.textContent}`);
    
    console.log('✅ Successfully scraped and selected products');
}

async function testMultipleProductSelections(dom) {
    console.log('\n=== Testing Multiple Product Selections ===');
    
    const scrapeProductsBtn = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeProductsBtn, 'Scrape Products button should exist');

    // Create a promise that resolves when products are displayed
    const productsDisplayed = new Promise(resolve => {
        const originalDisplayProducts = dom.window.displayProducts;
        dom.window.displayProducts = function() {
            originalDisplayProducts.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeProductsBtn.click();
    
    // Wait for products to be displayed
    await productsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if products are displayed
    const productsList = dom.window.document.getElementById('productsList');
    const productItems = productsList.querySelectorAll('.product-item');
    
    assert(productItems.length === 2, `Expected 2 products, found ${productItems.length}`);
    
    // Select multiple products
    productItems[0].click();
    productItems[1].click();
    
    // Check if selection is registered
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '2', `Expected 2 selected items, found ${selectedCount.textContent}`);
    
    console.log('✅ Successfully selected multiple products');
}

async function testClearProductSelections(dom) {
    console.log('\n=== Testing Clear Product Selections ===');
    
    const scrapeProductsBtn = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeProductsBtn, 'Scrape Products button should exist');

    // Create a promise that resolves when products are displayed
    const productsDisplayed = new Promise(resolve => {
        const originalDisplayProducts = dom.window.displayProducts;
        dom.window.displayProducts = function() {
            originalDisplayProducts.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeProductsBtn.click();
    
    // Wait for products to be displayed
    await productsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if products are displayed
    const productsList = dom.window.document.getElementById('productsList');
    const productItems = productsList.querySelectorAll('.product-item');
    
    assert(productItems.length === 2, `Expected 2 products, found ${productItems.length}`);
    
    // Select products
    productItems[0].click();
    productItems[1].click();
    
    // Click clear button
    const clearSelectionBtn = dom.window.document.getElementById('clearSelection');
    clearSelectionBtn.click();
    
    // Wait for selection to be cleared
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if selection was cleared
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '0', `Expected 0 selected items, found ${selectedCount.textContent}`);
    
    console.log('✅ Successfully cleared product selections');
}

async function testProductSelectionErrors(dom) {
    console.log('\n=== Testing Product Selection Errors ===');
    
    const scrapeProductsBtn = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeProductsBtn, 'Scrape Products button should exist');

    // Create a promise that resolves when products are displayed
    const productsDisplayed = new Promise(resolve => {
        const originalDisplayProducts = dom.window.displayProducts;
        dom.window.displayProducts = function() {
            originalDisplayProducts.call(this);
            resolve();
        };
    });

    // Click the button
    scrapeProductsBtn.click();
    
    // Wait for products to be displayed
    await productsDisplayed;
    await new Promise(resolve => setTimeout(resolve, 500)); // Extra wait for DOM updates
    
    // Check if products are displayed
    const productsList = dom.window.document.getElementById('productsList');
    const productItems = productsList.querySelectorAll('.product-item');
    
    assert(productItems.length === 2, `Expected 2 products, found ${productItems.length}`);
    
    // Simulate a broken product element
    const brokenProduct = document.createElement('div');
    brokenProduct.className = 'product-item';
    // Intentionally omit product ID
    productsList.appendChild(brokenProduct);
    
    // Try to select the broken product
    brokenProduct.click();
    
    // Check if selection count remains unchanged
    const selectedCount = dom.window.document.getElementById('selectedCount');
    assert(selectedCount.textContent === '0', `Expected 0 selected items, found ${selectedCount.textContent}`);
    
    console.log('✅ Successfully handled product selection errors');
}

async function testScrapeButtonFunctionality(dom) {
    console.log('\n=== Testing Scrape Button Functionality ===');
    
    // Get the scrape button
    const scrapeButton = dom.window.document.getElementById('scrapeProducts');
    assert(scrapeButton, 'Scrape Products button should exist');
    
    // Check initial button state
    assert(!scrapeButton.disabled, 'Scrape button should be enabled initially');
    assert(scrapeButton.style.cursor !== 'not-allowed', 'Scrape button should be clickable');
    
    // Create a promise that resolves when products start loading
    const loadingStarted = new Promise(resolve => {
        const originalSetLoading = dom.window.setLoading;
        dom.window.setLoading = function(loading) {
            originalSetLoading.call(this, loading);
            if (loading) resolve();
        };
    });
    
    // Click the button
    scrapeButton.click();
    
    // Wait for loading to start
    await loadingStarted;
    
    // Check button state during scraping
    assert(scrapeButton.disabled, 'Scrape button should be disabled while scraping');
    assert(scrapeButton.style.cursor === 'not-allowed', 'Scrape button should show not-allowed cursor while disabled');
    
    // Wait for scraping to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check button state after scraping
    assert(!scrapeButton.disabled, 'Scrape button should be enabled after scraping completes');
    assert(scrapeButton.style.cursor !== 'not-allowed', 'Scrape button should be clickable after scraping completes');
    
    console.log('✅ Successfully tested scrape button functionality');
}

async function runTests() {
    try {
        console.log('Starting integration tests...');
        const { dom, getLastDownloadedFile } = await setupTestEnvironment();
        
        // Run tests in sequence
        await testScrapeButtonFunctionality(dom);
        await testScrapeProducts(dom);
        await testScrapeCollections(dom);
        await testItemSelection(dom);
        await testExportCSV(dom, getLastDownloadedFile);
        await testClearSelection(dom);
        await testProductScrapingAndSelection(dom);
        await testMultipleProductSelections(dom);
        await testClearProductSelections(dom);
        await testProductSelectionErrors(dom);
        
        console.log('\n✨ All integration tests passed!');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

runTests();
