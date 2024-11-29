import fetch from 'node-fetch';

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

async function scrapeProducts() {
    try {
        const baseUrl = 'https://vintagefootball.shop';
        const products = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`Scraping page ${page}...`);
            const endpoint = `${baseUrl}/wp-json/wc/store/products?page=${page}&per_page=100`;
            const data = await makeRequest(endpoint);
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                hasMore = false;
                break;
            }

            const processedProducts = data.map(product => ({
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
            console.log(`Found ${processedProducts.length} products on page ${page}`);
            
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

async function main() {
    try {
        console.log('Starting scraping...');
        const products = await scrapeProducts();
        console.log('\nScraping completed!');
        console.log(`Total products found: ${products.length}`);
        
        if (products.length > 0) {
            console.log('\nSample products:');
            products.slice(0, 3).forEach(product => {
                console.log('\n-------------------');
                console.log(`Name: ${product.name}`);
                console.log(`Price: ${product.price}`);
                console.log(`Categories: ${product.categories}`);
                console.log(`URL: ${product.url}`);
            });

            // Save products to a file
            const fs = await import('fs/promises');
            await fs.writeFile(
                'scraped-products.json', 
                JSON.stringify(products, null, 2),
                'utf-8'
            );
            console.log('\nProducts saved to scraped-products.json');
        } else {
            console.log('\nNo products found. The website might be blocking scraping attempts.');
        }
    } catch (error) {
        console.error('Scraping failed:', error);
    }
}

main();
