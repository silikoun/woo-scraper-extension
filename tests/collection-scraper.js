// Collection scraping functions isolated for testing

// Function to clean name
export function cleanName(text) {
    if (!text) return '';
    return text
        .replace(/^\s*>\s*/, '')
        .replace(/\(\d+\)/, '')
        .replace(/^Home\s*[\/›>]\s*/, '')
        .split('-')
        .map(part => part.trim())
        .filter(part => part)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Function to extract collection info from URL
export function extractCollectionInfo(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        // Skip non-product URLs
        if (!path.includes('belle-delphine-')) return null;
        
        // Extract the product type (e.g., 'hoodie', 'shirt')
        const parts = path.split('/').filter(p => p);
        const lastPart = parts[parts.length - 1];
        const match = lastPart.match(/belle-delphine-(.*)/);
        if (!match) return null;
        
        const type = match[1];
        return {
            id: `belle-delphine-${type}`,
            name: `Belle Delphine ${cleanName(type)}`,
            url: url
        };
    } catch (e) {
        console.error('Error parsing URL:', url, e);
        return null;
    }
}

// Function to scan page for collections
export function scanPageForCollections(document) {
    const collections = new Map();
    const debug = {
        log: (...args) => console.log('[Collection Scraper]', ...args),
        error: (...args) => console.error('[Collection Scraper]', ...args)
    };

    // Function to add a collection
    const addCollection = (url) => {
        if (!url) return;
        const info = extractCollectionInfo(url);
        if (info && !collections.has(info.id)) {
            collections.set(info.id, {
                id: info.id,
                name: info.name,
                count: 0,
                url: info.url
            });
            debug.log('Added collection:', info);
        }
    };

    try {
        // Only check current page URL if we have product links on the page
        const hasProductLinks = document.querySelector('a[href*="belle-delphine-"]') !== null;
        if (hasProductLinks && document.location?.href) {
            addCollection(document.location.href);
        }

        // Check all product links
        document.querySelectorAll('a[href*="belle-delphine-"]').forEach(link => {
            addCollection(link.href);
        });

        // Check navigation menu
        document.querySelectorAll('nav a, .menu a, .menu-item a').forEach(link => {
            if (link.href?.includes('belle-delphine-')) {
                addCollection(link.href);
            }
        });

        // Check breadcrumb
        const breadcrumb = document.querySelector('.woocommerce-breadcrumb, .breadcrumb');
        if (breadcrumb) {
            breadcrumb.querySelectorAll('a').forEach(link => {
                if (link.href?.includes('belle-delphine-')) {
                    addCollection(link.href);
                }
            });
        }

        return Array.from(collections.values());
    } catch (error) {
        debug.error('Error scanning page:', error);
        return Array.from(collections.values()); // Return what we found so far
    }
}
