#!/bin/bash

# Uploads the PWA sourcemaps to Rollbar, mirroring rollbar-upload.sh for native.
# Run after a pwa:prod build and before/alongside the deploy: the maps are keyed
# by the hashed chunk filenames and the package version as code_version, which
# is what rollbar-service.js reports from the PWA.
#
# Usage:
#   npm run pwa:rollbar

set -e

# Load only the Rollbar token from .env.local: expanding every value as shell
# words breaks on quoted values, inline comments or any non-identifier word,
# and aborts the script under set -e. The deployment paths stay with
# loadDeployTarget in scripts/deploy-pwa.js, which reads the file itself
if [ -f .env.local ]; then
    ROLLBAR_WRITE_TOKEN=$(grep -E '^ROLLBAR_WRITE_TOKEN=' .env.local | head -n 1 | cut -d= -f2- | sed -e "s/^['\"]//; s/['\"]\$//")
fi

if [ -z "$ROLLBAR_WRITE_TOKEN" ]; then
    echo "rollbar-upload-pwa: ROLLBAR_WRITE_TOKEN is not set in .env.local"
    exit 1
fi

# app version as reported by the PWA (rollbar-service.js code_version)
code_version=$(node -p "require('./package.json').version")

# the PWA bundle is served at <origin>/pwa/ (getBasepath() on the production
# server), so payload frames resolve against that prefix
url_prefix="https://five.epicollect.net/pwa/"

rollbar-cli upload-sourcemaps ./dist --verbose --access-token="$ROLLBAR_WRITE_TOKEN" --verbose --url-prefix "$url_prefix" --code-version "$code_version"
