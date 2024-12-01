import { cleanName, extractCollectionInfo, scanPageForCollections } from './collection-scraper';

describe('Collection Scraper Tests', () => {
    beforeEach(() => {
        // Set up our document body
        document.body.innerHTML = `
            <div class="product-page">
                <nav class="navigation">
                    <a href="https://belledelphinemerchandise.store/belle-delphine-hoodie/">Belle Delphine Hoodie</a>
                    <a href="https://belledelphinemerchandise.store/belle-delphine-shirt/">Belle Delphine Shirt</a>
                </nav>
                <div class="woocommerce-breadcrumb">
                    <a href="https://belledelphinemerchandise.store/">Home</a>
                    <a href="https://belledelphinemerchandise.store/belle-delphine-pants/">Belle Delphine Pants</a>
                </div>
                <div class="product-links">
                    <a href="https://belledelphinemerchandise.store/belle-delphine-hat/">Belle Delphine Hat</a>
                    <a href="https://belledelphinemerchandise.store/belle-delphine-accessories/">Belle Delphine Accessories</a>
                </div>
            </div>
        `;
    });

    // Test URL parsing
    describe('URL Parsing', () => {
        test('should extract collection info from valid URL', () => {
            const url = 'https://belledelphinemerchandise.store/belle-delphine-hoodie/';
            const info = extractCollectionInfo(url);
            expect(info).toBeDefined();
            expect(info.id).toBe('belle-delphine-hoodie');
            expect(info.name).toBe('Belle Delphine Hoodie');
            expect(info.url).toBe(url);
        });

        test('should return null for invalid URL', () => {
            const url = 'https://belledelphinemerchandise.store/some-other-product/';
            const info = extractCollectionInfo(url);
            expect(info).toBeNull();
        });

        test('should handle URLs with query parameters', () => {
            const url = 'https://belledelphinemerchandise.store/belle-delphine-shirt/?variant=123';
            const info = extractCollectionInfo(url);
            expect(info).toBeDefined();
            expect(info.id).toBe('belle-delphine-shirt');
        });
    });

    // Test name cleaning
    describe('Name Cleaning', () => {
        test('should clean and format collection names', () => {
            const tests = [
                ['belle-delphine-hoodie', 'Belle Delphine Hoodie'],
                ['belle-delphine-t-shirt', 'Belle Delphine T Shirt'],
                ['belle-delphine-accessories-pack', 'Belle Delphine Accessories Pack'],
                ['> belle-delphine-hat (5)', 'Belle Delphine Hat'],
                ['Home > belle-delphine-pants', 'Belle Delphine Pants']
            ];

            tests.forEach(([input, expected]) => {
                expect(cleanName(input)).toBe(expected);
            });
        });
    });

    // Test collection gathering
    describe('Collection Gathering', () => {
        test('should find all unique collections on the page', () => {
            const collections = scanPageForCollections(document);
            expect(collections).toHaveLength(5); // Based on our mock DOM
            
            const collectionIds = collections.map(c => c.id);
            expect(collectionIds).toContain('belle-delphine-hoodie');
            expect(collectionIds).toContain('belle-delphine-shirt');
            expect(collectionIds).toContain('belle-delphine-pants');
            expect(collectionIds).toContain('belle-delphine-hat');
            expect(collectionIds).toContain('belle-delphine-accessories');
        });

        test('should not have duplicate collections', () => {
            // Add duplicate links to the page
            document.body.innerHTML += `
                <div class="duplicates">
                    <a href="https://belledelphinemerchandise.store/belle-delphine-hoodie/">Duplicate Hoodie</a>
                    <a href="https://belledelphinemerchandise.store/belle-delphine-shirt/">Duplicate Shirt</a>
                </div>
            `;

            const collections = scanPageForCollections(document);
            const ids = collections.map(c => c.id);
            const uniqueIds = [...new Set(ids)];
            expect(ids).toHaveLength(uniqueIds.length);
        });

        test('should handle empty page gracefully', () => {
            document.body.innerHTML = '<div></div>';
            const collections = scanPageForCollections(document);
            expect(collections).toHaveLength(0);
        });
    });

    // Test error handling
    describe('Error Handling', () => {
        test('should handle malformed URLs', () => {
            const url = 'not-a-valid-url';
            const info = extractCollectionInfo(url);
            expect(info).toBeNull();
        });

        test('should handle missing elements gracefully', () => {
            document.body.innerHTML = '<div class="empty-page"></div>';
            const collections = scanPageForCollections(document);
            expect(collections).toHaveLength(0);
        });

        test('should handle null href attributes', () => {
            document.body.innerHTML = `
                <div>
                    <a>No href link</a>
                    <a href="">Empty href link</a>
                </div>
            `;
            const collections = scanPageForCollections(document);
            expect(collections).toHaveLength(0);
        });
    });
});
