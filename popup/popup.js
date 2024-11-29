class WooScraperUI {
    constructor() {
        this.categories = new Set();
        this.products = new Map();
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.startButton = document.getElementById('startScraping');
        this.exportButton = document.getElementById('exportData');
        this.categoryInput = document.getElementById('categoryInput');
        this.categoryChips = document.getElementById('categoryChips');
        this.productList = document.getElementById('productList');
        this.progressBar = document.getElementById('progressBar');
        this.statusText = document.getElementById('statusText');
    }

    attachEventListeners() {
        this.startButton.addEventListener('click', () => this.startScraping());
        this.exportButton.addEventListener('click', () => this.exportData());
        this.categoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addCategory(this.categoryInput.value);
                this.categoryInput.value = '';
            }
        });
    }

    addCategory(category) {
        if (!category.trim() || this.categories.has(category)) return;
        
        this.categories.add(category);
        
        const chip = document.createElement('md-chip');
        chip.label = category;
        chip.addEventListener('click', () => {
            this.categories.delete(category);
            chip.remove();
        });
        
        this.categoryChips.appendChild(chip);
    }

    async startScraping() {
        this.setStatus('Scraping in progress...', true);
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'startScraping',
                categories: Array.from(this.categories)
            });
            
            if (response.success) {
                this.updateProductList(response.products);
                this.setStatus('Scraping completed!', false);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.setStatus(`Error: ${error.message}`, false);
        }
    }

    updateProductList(products) {
        this.productList.innerHTML = '';
        this.products = new Map(products);
        
        products.forEach(([id, product]) => {
            const item = document.createElement('md-list-item');
            item.headline = product.name;
            item.supportingText = `Price: ${product.price}`;
            
            const chip = document.createElement('md-chip');
            chip.label = product.category;
            item.appendChild(chip);
            
            this.productList.appendChild(item);
        });
    }

    async exportData() {
        const data = {
            categories: Array.from(this.categories),
            products: Array.from(this.products.values())
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: 'woo-products.json',
            saveAs: true
        });
        
        URL.revokeObjectURL(url);
    }

    setStatus(message, loading = false) {
        this.statusText.textContent = message;
        this.progressBar.closed = !loading;
    }
}

// Initialize the UI when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WooScraperUI();
});
