#!/bin/bash

# ==============================================================================
# 🚀 SCRIPT D'INSTALLATION & DÉBLOCAGE 1-CLIC POUR MACOS (RECIF METHODOCLINIQUE)
# ==============================================================================

# Trouver le répertoire courant du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="RECIF-MethodoClinique.app"
TARGET_APP="/Applications/$APP_NAME"

echo "=========================================================="
echo " 🚀 INSTALLATION & DÉBLOCAGE AUTOMATIQUE METHODOCLINIQUE"
echo "=========================================================="
echo ""

# 1. Si l'application se trouve à côté du script, la copier dans /Applications
if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
    echo "📦 Copie de $APP_NAME vers /Applications..."
    cp -R "$SCRIPT_DIR/$APP_NAME" "/Applications/" 2>/dev/null || true
fi

# 2. Retirer les restrictions de sécurité macOS Gatekeeper (Quarantaine)
if [ -d "$TARGET_APP" ]; then
    echo "⚡ Déblocage des restrictions de sécurité macOS (Gatekeeper)..."
    xattr -cr "$TARGET_APP" 2>/dev/null || true
    xattr -rd com.apple.quarantine "$TARGET_APP" 2>/dev/null || true
    
    echo ""
    echo "=========================================================="
    echo " ✅ SUCCÈS : RECIF MethodoClinique est installé et débloqué !"
    echo " 🚀 Lancement automatique en cours..."
    echo "=========================================================="
    echo ""
    
    open "$TARGET_APP"
    sleep 2
    exit 0
else
    echo "⚠️ L'application $APP_NAME n'a pas pu être localisée."
    echo "Veuillez glisser l'application dans votre dossier /Applications puis relancer ce script."
    echo ""
    read -p "Appuyez sur Entrée pour fermer cette fenêtre..."
fi
