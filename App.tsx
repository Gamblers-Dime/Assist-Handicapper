#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  Basketball-IQ GitHub Push Script
#  Run this AFTER creating the repo at github.com/YOUR_USERNAME/Basketball-iq
# ════════════════════════════════════════════════════════════════

set -e

echo ""
echo "🏀 Basketball-IQ — GitHub Push Setup"
echo "════════════════════════════════════"
echo ""

# 1. Prompt for username
read -p "GitHub username (or org name): " GH_USER
read -p "GitHub Personal Access Token:  " GH_TOKEN
echo ""

# 2. Create the repo via GitHub API (if it doesn't exist)
echo "→ Creating repository Basketball-iq on GitHub..."
curl -s -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"name\":\"Basketball-iq\",\"description\":\"NBA PG Analytics & Prop-Betting Intelligence Platform — 70%+ win rate algorithm\",\"private\":false,\"auto_init\":false}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ Repo created:', d.get('html_url','already exists or error'))" 2>/dev/null || echo "  (Repo may already exist — continuing)"

echo ""

# 3. Set remote with token authentication
echo "→ Configuring remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/Basketball-iq.git"

# 4. Push
echo "→ Pushing to main..."
git push -u origin main --force

echo ""
echo "✅ Done! View your repo at:"
echo "   https://github.com/${GH_USER}/Basketball-iq"
echo ""
