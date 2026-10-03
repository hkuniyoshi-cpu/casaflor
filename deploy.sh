#!/usr/bin/env bash
# 公開してよいファイルだけを dist/ に集めて Cloudflare Pages へデプロイする。
# リポジトリ直下を丸ごとデプロイすると gas/（APIキー入り）まで公開されるため、必ずこのスクリプトを使う。
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp index.html shared.css favicon.svg ogp.png privacy-policy.html terms.html 404.html robots.txt _routes.json dist/
cp -r img dist/img
unset CLOUDFLARE_API_TOKEN
CI=true WRANGLER_SEND_METRICS=false wrangler pages deploy dist --project-name casaflor --branch main --commit-dirty=true
