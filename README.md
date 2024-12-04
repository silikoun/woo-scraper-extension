# WooCommerce Product Scraper Extension

A powerful Chrome extension for scraping WooCommerce products with a beautiful Material Design interface and secure admin panel.

## Features

### Extension Features
- 🎨 Modern Material Design UI
- 🎯 Smart product selection
- 📁 Custom category management
- 💾 Token-based export security
- 🔄 Real-time scraping
- 📱 Responsive design
- 🌙 Dark/Light mode support

### Admin Panel Features
- 🔐 Secure Supabase Authentication
- 👤 User Session Management
- 📊 Product Management Dashboard
- 🔄 Real-time Data Sync
- 📱 Responsive Web Interface

## How It Works

### Free Features
- Browse WooCommerce stores
- View product details
- Select products and categories
- Preview data structure

### Premium Features (Requires Token)
- Export products
- Bulk collection
- Data synchronization
- Advanced filtering

### Authentication System
1. **Initial Access**
   - Install the extension
   - Use basic features without restrictions
   - Token required only for export and collection features

2. **Getting Access Token**
   - Click "Get Access Token" in the extension
   - Redirects to the admin panel website
   - Login or create an account
   - Generate your unique access token
   - Copy token from dashboard

3. **Token Validation**
   - Enter token in extension
   - Click validate button
   - Extension verifies token with server
   - Success: Unlock premium features
   - Error: Display validation message

4. **Using Premium Features**
   - Select products/collections
   - Click export/collect
   - Extension automatically uses validated token
   - Download/sync your data

### Security Implementation
- Tokens are encrypted
- Each token is unique per user
- Regular token validation
- Automatic token refresh
- Secure token storage

## Project Structure

```
woo-scraper-extension/
├── extension/          # Chrome extension files
│   ├── src/           # Source code
│   │   ├── popup/     # Extension UI
│   │   ├── auth/      # Token handling
│   │   └── api/       # API connections
│   └── public/        # Static assets
│
├── panel/             # Admin Panel
│   ├── auth.php       # Authentication handler
│   ├── token.php      # Token generation/validation
│   ├── index.php      # Main dashboard
│   └── .env          # Environment configuration
```

## Installation

### Chrome Extension
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. Build the extension:
   ```bash
   npm install
   npm run build
   ```

### Admin Panel Setup
1. Configure your web server with PHP 7.4+
2. Set up the `.env` file with Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   SUPABASE_JWT_SECRET=your_jwt_secret
   ```
3. Install PHP dependencies:
   ```bash
   composer install
   ```

## Usage

### Basic Usage (No Token Required)
1. Install the extension
2. Browse any WooCommerce store
3. View and select products
4. Preview data structure

### Premium Features (Token Required)
1. Click "Get Access Token" in extension
2. Login/Register on the admin panel
3. Generate your access token
4. Enter token in extension
5. Validate token
6. Use export and collection features

### Token Management
- Tokens expire after set period
- Refresh tokens automatically
- Revoke tokens from admin panel
- View token usage history

## Development

### Extension Development
```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

### Admin Panel Development
- Requires PHP 7.4 or higher
- Uses Supabase for authentication
- GuzzleHTTP for API requests
- Environment variables for configuration

## Security

- Secure token generation
- Encrypted transmission
- Regular validation checks
- Token expiration handling
- Rate limiting
- Activity monitoring
- Secure authentication via Supabase
- Protected API endpoints
- Environment-based configuration
- Session management
- CORS protection

## License

MIT License

## Contributing

Pull requests are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For support, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue if needed
