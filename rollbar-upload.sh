#!/bin/bash

# Function to extract the value of versionName from build.gradle
extract_version() {
    local gradle_file="android/app/build.gradle"
    local version_name=$(awk -F'"' '/versionName/ {print $2}' "$gradle_file")
    echo "$version_name"
}

# Load environment variables from .env.local file
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v ^# | xargs)
fi

# Extract version from build.gradle
code_version=$(extract_version)

#url-prefix for a capacitor app is localhost by default, see https://capacitorjs.com/docs/config

# Execute rollbar-cli command with the extracted code version
rollbar-cli upload-sourcemaps ./dist/js --verbose --access-token="$VUE_APP_ROLLBAR_POST_TOKEN" --url-prefix "http://localhost" --code-version "$code_version"
