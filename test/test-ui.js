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
            json: () => Promise.resolve({
                products: [
                    {
                        id: 1,
                        name: 'Test Product',
                        price: '$10.00',
                        images: ['test.jpg']
                    }
                ],
                collections: [
                    {
                        id: 1,
                        name: 'Test Collection',
                        count: 5
                    }
                ]
            })
        };
    };

    // Define log function
    dom.window.log = function(message, type = 'info', icon = '') {
        const terminal = dom.window.document.getElementById('terminalContent');
        if (!terminal) {
            console.error('Terminal element not found');
            return;
        }

        const line = dom.window.document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true });
        const iconSpan = icon ? `<span class="material-icons terminal-icon">${icon}</span>` : '';
        
        line.innerHTML = `${iconSpan}[${timestamp}] ${message}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    };

    return dom;
}

async function testDisplayFunctions(dom) {
    console.log('\n=== Testing Display Functions ===');

    // Test collections display
    const collectionsList = dom.window.document.getElementById('collectionsList');
    console.log(`Collections list exists: ${!!collectionsList}`);
    
    // Test products display
    const productsList = dom.window.document.getElementById('productsList');
    console.log(`Products list exists: ${!!productsList}`);
    
    // Test templates
    const collectionTemplate = dom.window.document.getElementById('collectionTemplate');
    console.log(`Collection template exists: ${!!collectionTemplate}`);
    
    const productTemplate = dom.window.document.getElementById('productTemplate');
    console.log(`Product template exists: ${!!productTemplate}`);
}

async function testButtonFunctionality(dom) {
    console.log('\n=== Testing Button Functionality ===');
    
    const buttons = {
        scrapeProducts: dom.window.document.getElementById('scrapeProducts'),
        scrapeCollections: dom.window.document.getElementById('scrapeCollections'),
        exportSelected: dom.window.document.getElementById('exportSelected'),
        clearSelection: dom.window.document.getElementById('clearSelection')
    };

    for (const [id, button] of Object.entries(buttons)) {
        if (button) {
            console.log(`✅ ${id} button exists`);
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
        } else {
            console.log(`❌ ${id} button not found`);
        }
    }
}

async function testTerminalFunctionality(dom) {
    console.log('\n=== Testing Terminal Functionality ===');
    
    const terminal = dom.window.document.getElementById('terminalContent');
    console.log(`Terminal exists: ${!!terminal}`);
    
    if (terminal) {
        // Test different message types
        const messages = [
            { text: 'Info message', type: 'info', icon: 'info' },
            { text: 'Success message', type: 'success', icon: 'check_circle' },
            { text: 'Error message', type: 'error', icon: 'error' },
            { text: 'Warning message', type: 'warning', icon: 'warning' }
        ];
        
        messages.forEach(({ text, type, icon }) => {
            try {
                dom.window.log(text, type, icon);
                console.log(`✅ Successfully logged ${type} message`);
            } catch (error) {
                console.log(`❌ Error logging ${type} message:`, error.message);
            }
        });
    }
}

async function runTests() {
    try {
        console.log('Starting UI tests...');
        const dom = await setupTestEnvironment();
        
        // Trigger DOMContentLoaded
        const event = new dom.window.Event('DOMContentLoaded');
        dom.window.document.dispatchEvent(event);
        
        await testDisplayFunctions(dom);
        await testButtonFunctionality(dom);
        await testTerminalFunctionality(dom);
        
        console.log('\nTests completed!');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();
