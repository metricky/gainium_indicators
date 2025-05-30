#!/bin/bash

# Build script that checks if build is needed
# This script checks if dist exists and if source files are newer than dist

DIST_DIR="dist"
SRC_DIR="src"
BUILD_MARKER="$DIST_DIR/.build-marker"

# Function to check if build is needed
need_build() {
    # If dist doesn't exist, we need to build
    if [ ! -d "$DIST_DIR" ]; then
        echo "dist directory doesn't exist, building..."
        return 0
    fi
    
    # If build marker doesn't exist, we need to build
    if [ ! -f "$BUILD_MARKER" ]; then
        echo "build marker doesn't exist, building..."
        return 0
    fi
    
    # Check if any source file is newer than the build marker
    if find "$SRC_DIR" -name "*.ts" -newer "$BUILD_MARKER" | grep -q .; then
        echo "source files are newer than last build, rebuilding..."
        return 0
    fi
    
    # Check if tsconfig.json is newer than the build marker
    if [ "tsconfig.json" -nt "$BUILD_MARKER" ]; then
        echo "tsconfig.json is newer than last build, rebuilding..."
        return 0
    fi
    
    echo "build is up to date, skipping..."
    return 1
}

# Main build logic
if need_build; then
    echo "Building @gainium/indicators..."
    rm -rf "$DIST_DIR"
    npm run build
    # Create build marker
    mkdir -p "$DIST_DIR"
    touch "$BUILD_MARKER"
    echo "Build completed!"
else
    echo "Build skipped - no changes detected"
fi
