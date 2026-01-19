#!/bin/bash

# ============================================
# Tabby MCP Plugin - Build from Source
# Cross-platform: macOS / Linux
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_NAME="tabby-mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║    Tabby MCP - Build from Source         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Detect OS
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
            else
                TABBY_PLUGIN_DIR="$HOME/.config/tabby/plugins/node_modules/$PLUGIN_NAME"
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            OS="windows"
            if [ -n "$APPDATA" ]; then
                TABBY_PLUGIN_DIR="$APPDATA/tabby/plugins/node_modules/$PLUGIN_NAME"
            else
                echo -e "${RED}❌ Cannot detect APPDATA. Use PowerShell script.${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}❌ Unsupported operating system${NC}"
            exit 1
            ;;
    esac
}

# Check Node.js
check_node() {
    echo -e "${YELLOW}📋 Checking Node.js...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found!${NC}"
        echo ""
        echo "Please install Node.js 18+ from:"
        echo "  - https://nodejs.org/"
        echo "  - Or use a version manager (nvm, fnm, volta)"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version must be 18 or higher (found: v$NODE_VERSION)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"
}

# Build
build_plugin() {
    echo ""
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    cd "$PROJECT_DIR"
    npm install --legacy-peer-deps
    
    echo ""
    echo -e "${YELLOW}🔨 Building plugin...${NC}"
    npm run build
    
    echo -e "${GREEN}✓ Build complete${NC}"
}

# Install
install_plugin() {
    echo ""
    echo -e "${YELLOW}📁 Installing to Tabby plugins...${NC}"
    
    mkdir -p "$TABBY_PLUGIN_DIR"
    
    cp -r "$PROJECT_DIR/dist" "$TABBY_PLUGIN_DIR/"
    cp "$PROJECT_DIR/package.json" "$TABBY_PLUGIN_DIR/"
    
    if [ -d "$PROJECT_DIR/typings" ]; then
        cp -r "$PROJECT_DIR/typings" "$TABBY_PLUGIN_DIR/"
    fi
    
    echo -e "${GREEN}✓ Installed to: $TABBY_PLUGIN_DIR${NC}"
}

# Main
main() {
    detect_os
    echo -e "${BLUE}🖥️  Detected OS: ${OS}${NC}"
    echo ""
    
    check_node
    build_plugin
    install_plugin
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✅ Build & Install Complete!         ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}🔄 Please restart Tabby to load the plugin.${NC}"
    echo ""
    echo -e "${BLUE}📋 After restart, go to Settings → MCP to configure.${NC}"
}

main "$@"
