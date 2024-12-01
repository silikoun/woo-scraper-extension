// Jest setup file
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://belledelphinemerchandise.store/belle-delphine-hoodie/',
    referrer: 'https://belledelphinemerchandise.store/',
    contentType: 'text/html',
    includeNodeLocations: true,
    storageQuota: 10000000
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
    userAgent: 'node.js'
};
global.URL = URL;

// Mock chrome API
global.chrome = {
    tabs: {
        query: jest.fn().mockResolvedValue([{
            url: 'https://belledelphinemerchandise.store/belle-delphine-hoodie/'
        }])
    },
    scripting: {
        executeScript: jest.fn()
    }
};
