import WooScraper from './scraper.js';
import chalk from 'chalk';
import ora from 'ora';

async function main() {
    try {
        console.log(chalk.cyan('\nWooCommerce Product Scraper Test'));
        console.log(chalk.gray('─'.repeat(50)));

        const baseUrl = 'https://vintagefootball.shop';
        const scraper = new WooScraper(baseUrl);

        // Initialize scraper and fetch categories
        await scraper.initialize();

        // Get category selection from user
        console.log(chalk.cyan('\nSelect categories to scrape:'));
        console.log(chalk.gray('Enter category IDs separated by commas, or press Enter to scrape all categories'));
        
        process.stdout.write(chalk.yellow('Category IDs: '));
        
        const input = await new Promise((resolve) => {
            let data = '';
            process.stdin.on('data', (chunk) => {
                data += chunk;
                if (data.includes('\n')) {
                    resolve(data.trim());
                }
            });
        });

        const selectedCategories = input.trim() ? 
            input.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : 
            [];

        if (selectedCategories.length > 0) {
            console.log(chalk.cyan('\nSelected categories:'));
            selectedCategories.forEach(id => {
                const category = scraper.categories.get(id);
                if (category) {
                    console.log(chalk.white(`- ${category.name} (${category.count} products)`));
                }
            });
        } else {
            console.log(chalk.cyan('\nScraping all categories'));
        }

        // Start scraping
        console.log(chalk.gray('\n─'.repeat(50)));
        await scraper.scrapeProducts(selectedCategories);
    } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled promise rejection:'), error);
    process.exit(1);
});

// Run the main function
main().catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
});
