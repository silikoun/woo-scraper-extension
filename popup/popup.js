class WooScraperUI {
    constructor() {
        this.categories = new Set();
        this.products = new Map();
        this.initializeElements();
        this.attachEventListeners();
        this.updateProgressBar(0);
    }

    initializeElements() {
        this.startButton = document.getElementById('startScraping');
        this.exportButton = document.getElementById('exportData');
        this.categoryInput = document.getElementById('categoryInput');
        this.categoryChips = document.getElementById('categoryChips');
        this.productList = document.getElementById('productList');
        this.progressBar = document.querySelector('.progress-bar-fill');
        this.statusText = document.getElementById('statusText');
    }

    attachEventListeners() {
        this.startButton.addEventListener('click', () => this.startScraping());
        this.exportButton.addEventListener('click', () => this.exportData());
        this.categoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.categoryInput.value.trim()) {
                this.addCategory(this.categoryInput.value.trim());
                this.categoryInput.value = '';
            }
        });
    }

    addCategory(category) {
        if (this.categories.has(category)) return;
        
        this.categories.add(category);
        
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `
            ${category}
            <span class="material-icons" style="font-size: 18px;">close</span>
        `;
        
        chip.querySelector('.material-icons').addEventListener('click', () => {
            this.categories.delete(category);
            chip.remove();
        });
        
        this.categoryChips.appendChild(chip);
    }

    updateProgressBar(percent) {
        this.progressBar.style.width = `${percent}%`;
    }

    async startScraping() {
        if (this.categories.size === 0) {
            this.setStatus('Please add at least one category first');
            return;
        }

        this.setStatus('Scraping in progress...', true);
        this.updateProgressBar(0);
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            chrome.tabs.sendMessage(tab.id, {
                action: 'startScraping',
                categories: Array.from(this.categories)
            }, response => {
                if (response && response.success) {
                    this.updateProductList(response.products);
                    this.setStatus('Scraping completed!');
                    this.updateProgressBar(100);
                } else {
                    throw new Error(response?.error || 'Failed to start scraping');
                }
            });
        } catch (error) {
            this.setStatus(`Error: ${error.message}`);
            this.updateProgressBar(0);
        }
    }

    updateProductList(products) {
        this.productList.innerHTML = '';
        this.products = new Map(products);
        
        products.forEach(([id, product]) => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <div>
                    <div style="font-weight: 500;">${product.name}</div>
                    <div style="color: var(--text-secondary); font-size: 14px;">
                        Price: ${product.price}
                    </div>
                </div>
                <div class="chip">${product.category}</div>
            `;
            
            this.productList.appendChild(item);
        });
    }

    async exportData() {
        if (this.products.size === 0) {
            this.setStatus('No products to export');
            return;
        }

        const data = {
            categories: Array.from(this.categories),
            products: Array.from(this.products.values())
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        try {
            await chrome.downloads.download({
                url: url,
                filename: 'woo-products.json',
                saveAs: true
            });
            this.setStatus('Data exported successfully!');
        } catch (error) {
            this.setStatus('Failed to export data');
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    setStatus(message, isLoading = false) {
        this.statusText.textContent = message;
        if (!isLoading) {
            this.updateProgressBar(0);
        }
    }
}

// Initialize the UI when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WooScraperUI();
});
