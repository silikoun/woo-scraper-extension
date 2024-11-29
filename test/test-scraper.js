// Test script for WooCommerce scraper
import fetch from 'node-fetch';

const TEST_URL = 'https://vintagefootball.shop';

async function testScrapeProducts() {
    console.log('\n=== Testing Product Scraping ===');
    try {
        // Try WooCommerce REST API v3
        console.log('\nTesting WooCommerce REST API v3...');
        const v3Response = await fetch(`${TEST_URL}/wp-json/wc/v3/products?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (v3Response.ok) {
            const data = await v3Response.json();
            console.log(`✅ Successfully fetched ${data.length} products from WC REST API v3`);
            console.log('Sample product:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ WC REST API v3 not available');
        }

        // Try WooCommerce Store API
        console.log('\nTesting WooCommerce Store API...');
        const storeResponse = await fetch(`${TEST_URL}/wp-json/wc/store/v1/products?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (storeResponse.ok) {
            const data = await storeResponse.json();
            console.log(`✅ Successfully fetched ${data.length} products from Store API`);
            console.log('Sample product:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ Store API not available');
        }

        // Try WordPress REST API
        console.log('\nTesting WordPress REST API...');
        const wpResponse = await fetch(`${TEST_URL}/wp-json/wp/v2/product?per_page=100&_embed`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (wpResponse.ok) {
            const data = await wpResponse.json();
            console.log(`✅ Successfully fetched ${data.length} products from WP REST API`);
            console.log('Sample product:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ WordPress REST API not available');
        }

    } catch (error) {
        console.error('❌ Error testing product scraping:', error.message);
    }
}

async function testScrapeCollections() {
    console.log('\n=== Testing Collection Scraping ===');
    try {
        // Try WooCommerce REST API v3
        console.log('\nTesting WooCommerce REST API v3 Categories...');
        const v3Response = await fetch(`${TEST_URL}/wp-json/wc/v3/products/categories?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (v3Response.ok) {
            const data = await v3Response.json();
            console.log(`✅ Successfully fetched ${data.length} categories from WC REST API v3`);
            console.log('Sample category:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ WC REST API v3 categories not available');
        }

        // Try WooCommerce Store API
        console.log('\nTesting WooCommerce Store API Categories...');
        const storeResponse = await fetch(`${TEST_URL}/wp-json/wc/store/v1/products/categories?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (storeResponse.ok) {
            const data = await storeResponse.json();
            console.log(`✅ Successfully fetched ${data.length} categories from Store API`);
            console.log('Sample category:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ Store API categories not available');
        }

        // Try WordPress REST API
        console.log('\nTesting WordPress REST API Categories...');
        const wpResponse = await fetch(`${TEST_URL}/wp-json/wp/v2/product_cat?per_page=100`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (wpResponse.ok) {
            const data = await wpResponse.json();
            console.log(`✅ Successfully fetched ${data.length} categories from WP REST API`);
            console.log('Sample category:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('❌ WordPress REST API categories not available');
        }

    } catch (error) {
        console.error('❌ Error testing collection scraping:', error.message);
    }
}

// Run tests
async function runTests() {
    console.log('Starting scraper tests for:', TEST_URL);
    await testScrapeProducts();
    await testScrapeCollections();
    console.log('\nTests completed!');
}

runTests();
