#!/bin/bash

# ============================================
# Tabby MCP Plugin Uninstall Script
# Cross-platform: macOS / Linux
# ============================================

set -e

PLUGIN_NAME="tabby-mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║      Tabby MCP Plugin Uninstaller        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Detect OS and set plugin path
case "$(uname -s)" in
    Darwin*)
        TABBY_PLUGIN_DIR="$HOME/Library/Application Support/tabby/plugins/node_modules/$PLUGIN_NAME"
        ;;
    Linux*)
        if [ -d "$HOME/.config/tabby" ]; then
            TABBY_PLUGIN_DIR="$HOME/.config/tabby/plugins/node_modules/$PLUGIN_NAME"
        elif [ -d "$HOME/.tabby" ]; then
            TABBY_PLUGIN_DIR="$HOME/.tabby/plugins/node_modules/$PLUGIN_NAME"
        else
            TABBY_PLUGIN_DIR="$HOME/.config/tabby/plugins/node_modules/$PLUGIN_NAME"
        fi
        ;;
    *)
        echo -e "${RED}❌ Error: Unsupported operating system${NC}"
        echo "For Windows, manually delete: %APPDATA%\tabby\plugins\node_modules\\$PLUGIN_NAME"
        exit 1
        ;;
esac

echo -e "${BLUE}📍 Plugin path: ${TABBY_PLUGIN_DIR}${NC}"
echo ""

if [ -d "$TABBY_PLUGIN_DIR" ]; then
    echo -e "${YELLOW}🗑️  Removing plugin...${NC}"
    rm -rf "$TABBY_PLUGIN_DIR"
    echo -e "${GREEN}✅ Plugin uninstalled successfully!${NC}"
    echo ""
    echo -e "${YELLOW}🔄 Please restart Tabby to complete the uninstallation.${NC}"
else
    echo -e "${YELLOW}⚠️  Plugin not found at: $TABBY_PLUGIN_DIR${NC}"
    echo "   Plugin may not be installed or installed in a different location."
fi
