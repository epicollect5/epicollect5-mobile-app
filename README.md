# Epicollect5 Mobile App (Android & iOS)

- Vue 3 https://vuejs.org
- Ionic Vue https://ionicframework.com/docs/vue/overview
- Capacitor https://capacitorjs.com/

## Getting Started

### Prerequisites

- Node.js 22.x (see `engines` in package.json)
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
   
3. Copy the example environment file and configure it:

   ```bash
   cp .env-example.local .env.local
   ```
   
4. Update `.env.local` with your configuration (see Environment Variables section below)

## Environment Variables

The application uses environment variables to configure different aspects of the build and runtime behavior. 
Create a `.env.local` file based on `.env-example.local`:

### Required Variables

- **`VUE_APP_GOOGLE_CLIENT_ID_WEB`** - Google OAuth client ID for web authentication
- **`VUE_APP_GOOGLE_SIGNIN_SCOPE`** - OAuth scopes for Google Sign-In
- **`VUE_APP_MAPBOX_API_TOKEN`** - API token for Mapbox integration
- **`VUE_APP_ESRI_API_TOKEN`** - API token for ESRI/ArcGIS integration

### Build Mode Variables

- **`VUE_APP_MODE`** - Controls the build target. Options:
  - `WEBVIEW` (default) - For native Android & iOS builds
  - `PWA` - For Progressive Web App builds
  - Note: This is typically set by build scripts automatically

### Debug & Development Variables

- **`VUE_APP_DEBUG`** - Enable debug mode
  - Set to `1` to enable debug features
  - Set to empty string `""` to disable (production builds)
  - Note: Environment variables are cast to strings, so use `1` or empty value

- **`VUE_APP_PWA_DEVELOPMENT_SERVER`** - Local development server URL for PWA debugging (e.g., `http://localhost/`)

- **`VUE_APP_BYPASS_UNIQUENESS`** - Bypass uniqueness validation checks for testing
  - Set to `1` to bypass
  - Set to empty string for production

- **`VUE_APP_DEPLOY`** - Deployment configuration (optional)

## Build Scripts

### Development

- **`npm run serve`** - Start development server with hot-reload
- **`npm run build`** - Build the application

### Native Development (Android & iOS)

- **`npm run native:debug`** - Build & copy web assets to native platforms (debug mode)
  - Sets `VUE_APP_MODE=WEBVIEW`
  - Includes debug features

- **`npm run native:prod`** - Build & copy web assets to native platforms (production mode)
  - Sets `VUE_APP_MODE=WEBVIEW`
  - Disables debug mode and uniqueness bypass
  - Runs tests before building (`prenative:prod`)

- **`npm run native:browser`** - Serve app for testing in browser with native features
  - Sets `VUE_APP_MODE=WEBVIEW`
  - Accessible on external network

- **`npm run native:copy`** - Copy assets without rebuilding

### Android Specific

- **`npm run android:open`** - Copy assets and open Android Studio
- **`npm run android:build`** - Build for Android platform

### iOS Specific

- **`npm run ios:open`** - Copy assets and open Xcode
- **`npm run ios:build`** - Build for iOS platform
- **Note:** iOS requires an `xcconfig` file with `REVERSED_CLIENT_ID` for Google Sign-In

### PWA (Progressive Web App)

- **`npm run pwa`** - Run PWA locally in development mode
  - Sets `VUE_APP_MODE=PWA` and `VUE_APP_DEBUG=1`
  - Runs on `http://localhost:1234`
  - Use format: `http://localhost:1234/{project-slug}/add-entry` to add an entry

- **`npm run pwa:prod`** - Build PWA for production
  - Sets `VUE_APP_MODE=PWA`
  - Disables debug mode and uniqueness bypass
  - Runs tests before building (`prepwa:prod`)
  - Generates bundle analysis report

- **`npm run pwa:debug`** - Build PWA with debug features enabled

### Testing

- **`npm run test:unit`** - Run unit tests with Vue CLI
- **`npm run vitest`** - Run tests with Vitest
- **`npm run vitest-ui`** - Run Vitest with UI
- **`npm run britest`** - Run browser tests with Chrome
- **`npm run coverage`** - Generate test coverage report
- **`npm test:e2e`** - Run end-to-end tests with Cypress

### Other Scripts

- **`npm run lint`** - Lint and fix code
- **`npm run dev-build`** - Build in development mode with source maps
- **`npm run rollbar`** - Upload source maps to Rollbar for error tracking

## Build Configuration

The build process is configured in `vue.config.js` and behaves differently based on `VUE_APP_MODE`:

### WEBVIEW Mode (Native Apps)
- Generates source maps for debugging
- Splits code into optimized chunks (app, vendor-capacitor, vendor-vue, vendor-ionic, vendor-common)
- Optimized for native mobile performance

### PWA Mode
- Limits chunks to 5 for optimal web performance
- Removes console logs and debugger statements in production
- Generates bundle analysis report (when `VUE_APP_DEBUG` is not `1`)
- Ignores test-related dependencies in production builds

## Configuration
 - iOS needs a xcconfig file with the REVERSED_CLIENT_ID for Google Sign In.

## Forking

We provide this software as is, under MIT license, for the benefit and use of the community, however we are unable to provide support for its use or modification.

You are not granted rights or licenses to the trademarks of the CGPS or any party, including without limitation the
Epicollect5 name or logo.
If you fork the project and publish it, please choose another name.
