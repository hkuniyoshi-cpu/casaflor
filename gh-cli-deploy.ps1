# ============================================================
# gh-cli-deploy.ps1 - Kabushiki-gaisha Casaflor
# One-shot deploy using GitHub CLI (gh) + git
# ============================================================
# Prereqs:
#   - gh auth login (already logged in as hkuniyoshi-cpu)
#   - git installed
# ============================================================

$repoName    = "casaflor"
$repoOwner   = "hkuniyoshi-cpu"
$repoDesc    = "Casa Flor (Kabushiki-gaisha Casaflor) - Okinawa Nago Interior/Exterior Finishing Partner Site"
$siteDir     = "C:\Users\endle\.claude\お取引先ポータル\企業別\カーサフロール様\casaflor-partner-site"

# ------------------------------------------------------------
Set-Location -LiteralPath $siteDir

# Init git if needed
if (-not (Test-Path ".git")) {
    git init -b main | Out-Null
}

# Create the repo on GitHub (skip silently if it already exists)
$exists = gh repo view "$repoOwner/$repoName" 2>$null
if (-not $exists) {
    gh repo create "$repoOwner/$repoName" --public --description "$repoDesc" --source "." --remote origin --push
    Write-Output "OK  gh repo create + push done"
} else {
    Write-Output "INFO repo exists - pushing update"
    git add .
    git commit -m "update site"
    $hasOrigin = git remote 2>$null | Select-String -Pattern "^origin$"
    if (-not $hasOrigin) {
        git remote add origin ("https://github.com/" + $repoOwner + "/" + $repoName + ".git")
    }
    git branch -M main
    git push -u origin main
}

Write-Output ""
Write-Output "Next steps:"
Write-Output "  1. Cloudflare Pages -> Connect to Git -> select $repoOwner/$repoName"
Write-Output "  2. Build command: empty / Output dir: empty"
Write-Output "  3. Add custom domain: casaflor.search-mania.net"
