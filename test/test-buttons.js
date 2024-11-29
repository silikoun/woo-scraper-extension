// Test script for button functionality
import { promises as fs } from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
        url: 'https://vintagefootball.shop'
    });

    // Add CSS
    const style = dom.window.document.createElement('style');
    style.textContent = css;
    dom.window.document.head.appendChild(style);

    // Mock chrome API
    dom.window.chrome = {
        tabs: {
            query: () => Promise.resolve([{ url: 'https://vintagefootball.shop' }])
        }
    };

    // Mock fetch API
    dom.window.fetch = async (url) => {
        console.log(`Fetch called with URL: ${url}`);
        return {
            ok: true,
            json: () => Promise.resolve([])
        };
    };

    // Add JS
    const script = dom.window.document.createElement('script');
    script.textContent = js;
    dom.window.document.body.appendChild(script);

    return dom;
}

async function testButtonsExist(dom) {
    console.log('\n=== Testing Button Existence ===');
    const buttons = {
        'scrapeProducts': dom.window.document.getElementById('scrapeProducts'),
        'scrapeCollections': dom.window.document.getElementById('scrapeCollections'),
        'exportSelected': dom.window.document.getElementById('exportSelected'),
        'clearSelection': dom.window.document.getElementById('clearSelection')
    };

    for (const [id, button] of Object.entries(buttons)) {
        if (button) {
            console.log(`✅ ${id} button exists`);
        } else {
            console.log(`❌ ${id} button not found`);
        }
    }
    return buttons;
}

async function testEventListeners(dom) {
    console.log('\n=== Testing Event Listeners ===');
    const events = [];
    
    // Track event listeners
    const originalAddEventListener = dom.window.EventTarget.prototype.addEventListener;
    dom.window.EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (this.id) {
            events.push({ elementId: this.id, type });
            console.log(`✅ Event listener '${type}' added to ${this.id}`);
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    // Trigger DOMContentLoaded
    const event = new dom.window.Event('DOMContentLoaded');
    dom.window.document.dispatchEvent(event);

    return events;
}

async function testButtonClicks(dom) {
    console.log('\n=== Testing Button Clicks ===');
    const buttons = ['scrapeProducts', 'scrapeCollections', 'exportSelected', 'clearSelection'];
    
    for (const id of buttons) {
        const button = dom.window.document.getElementById(id);
        if (button) {
            try {
                // Create click event
                const clickEvent = new dom.window.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: dom.window
                });
                
                // Dispatch event
                button.dispatchEvent(clickEvent);
                console.log(`✅ Successfully clicked ${id} button`);
            } catch (error) {
                console.log(`❌ Error clicking ${id} button:`, error.message);
            }
        }
    }
}

async function runTests() {
    try {
        console.log('Starting button functionality tests...');
        const dom = await setupTestEnvironment();
        await testButtonsExist(dom);
        await testEventListeners(dom);
        await testButtonClicks(dom);
        console.log('\nTests completed!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();
