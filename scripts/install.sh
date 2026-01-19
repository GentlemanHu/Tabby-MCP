#!/bin/bash

# ============================================
# Tabby MCP Plugin Installation Script
# Downloads pre-built release from GitHub
# Cross-platform: macOS / Linux
# ============================================

set -e

REPO="GentlemanHu/Tabby-MCP"
PLUGIN_NAME="tabby-mcp"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════╗"
    echo "║       Tabby MCP Plugin Installer         ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Detect OS and set plugin path
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            OS="macos"
            TABBY_PLUGIN_DIR="$HOME/Library/Application Support/tabby/plugins/node_modules/$PLUGIN_NAME"
            ;;
        Linux*)
            OS="linux"
            if [ -d "$HOME/.config/tabby" ]; then
                TABBY_PLUGIN_DIR="$HOME/.config/tabby/plugins/node_modules/$PLUGIN_NAME"
            elif [ -d "$HOME/.tabby" ]; then
                TABBY_PLUGIN_DIR="$HOME/.tabby/plugins/node_modules/$PLUGIN_NAME"
            else
                TABBY_PLUGIN_DIR="$HOME/.config/tabby/plugins/node_modules/$PLUGIN_NAME"
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            OS="windows"
            if [ -n "$APPDATA" ]; then
                TABBY_PLUGIN_DIR="$APPDATA/tabby/plugins/node_modules/$PLUGIN_NAME"
            else
                echo -e "${RED}❌ Error: Cannot detect Windows APPDATA path${NC}"
                echo "Please use the PowerShell script: install.ps1"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}❌ Error: Unsupported operating system${NC}"
            exit 1
            ;;
    esac
}

# Check for required commands
check_requirements() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v unzip &> /dev/null && ! command -v tar &> /dev/null; then
        missing_deps+=("unzip or tar")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing_deps[*]}${NC}"
        echo "Please install them and try again."
        exit 1
    fi
}

# Get latest release URL
get_latest_release() {
    echo -e "${YELLOW}🔍 Fetching latest release info...${NC}"
    
    RELEASE_INFO=$(curl -s "$API_URL")
    
    if echo "$RELEASE_INFO" | grep -q "rate limit"; then
        echo -e "${RED}❌ GitHub API rate limit exceeded. Try again later.${NC}"
        exit 1
    fi
    
    # Try to get tar.gz first, then zip
    if command -v tar &> /dev/null; then
        DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.tar\.gz"' | head -1 | cut -d'"' -f4)
        ARCHIVE_TYPE="tar.gz"
    fi
    
    if [ -z "$DOWNLOAD_URL" ]; then
        DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": "[^"]*\.zip"' | head -1 | cut -d'"' -f4)
        ARCHIVE_TYPE="zip"
    fi
    
    if [ -z "$DOWNLOAD_URL" ]; then
        echo -e "${RED}❌ Could not find release download URL${NC}"
        echo "Please check: https://github.com/$REPO/releases"
        exit 1
    fi
    
    VERSION=$(echo "$RELEASE_INFO" | grep -o '"tag_name": "[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✓ Found version: $VERSION${NC}"
}

# Download and extract
download_and_extract() {
    TEMP_DIR=$(mktemp -d)
    ARCHIVE_FILE="$TEMP_DIR/tabby-mcp.$ARCHIVE_TYPE"
    
    echo -e "${YELLOW}📥 Downloading...${NC}"
    curl -L -o "$ARCHIVE_FILE" "$DOWNLOAD_URL" --progress-bar
    
    echo -e "${YELLOW}📦 Extracting...${NC}"
    
    if [ "$ARCHIVE_TYPE" = "tar.gz" ]; then
        tar -xzf "$ARCHIVE_FILE" -C "$TEMP_DIR"
    else
        unzip -q "$ARCHIVE_FILE" -d "$TEMP_DIR"
    fi
    
    # Find extracted folder
    EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "tabby-mcp*" | head -1)
    
    if [ -z "$EXTRACTED_DIR" ] || [ ! -d "$EXTRACTED_DIR" ]; then
        echo -e "${RED}❌ Extraction failed${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Downloaded and extracted${NC}"
}

# Install plugin
install_plugin() {
    echo -e "${YELLOW}📁 Installing to Tabby plugins...${NC}"
    
    # Create plugin directory
    mkdir -p "$TABBY_PLUGIN_DIR"
    
    # Copy files
    if [ -d "$EXTRACTED_DIR/dist" ]; then
        cp -r "$EXTRACTED_DIR/dist" "$TABBY_PLUGIN_DIR/"
    fi
    
    if [ -d "$EXTRACTED_DIR/typings" ]; then
        cp -r "$EXTRACTED_DIR/typings" "$TABBY_PLUGIN_DIR/"
    fi
    
    if [ -f "$EXTRACTED_DIR/package.json" ]; then
        cp "$EXTRACTED_DIR/package.json" "$TABBY_PLUGIN_DIR/"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo -e "${GREEN}✓ Installed successfully${NC}"
}

# Show completion message
show_complete() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✅ Plugin installed successfully!    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Version:  ${VERSION}${NC}"
    echo -e "${CYAN}Location: ${TABBY_PLUGIN_DIR}${NC}"
    echo ""
    echo -e "${YELLOW}🔄 Please restart Tabby to load the plugin.${NC}"
    echo ""
    echo -e "${BLUE}📋 After restart, go to Settings → MCP to configure.${NC}"
}

# Main
main() {
    print_banner
    detect_os
    
    echo -e "${BLUE}🖥️  Detected OS: ${OS}${NC}"
    echo ""
    
    check_requirements
    get_latest_release
    download_and_extract
    install_plugin
    show_complete
}

main "$@"
