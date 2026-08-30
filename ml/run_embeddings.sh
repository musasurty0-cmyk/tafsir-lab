#!/usr/bin/env bash
# Embed the editions that fit the free tier, one after another.
#
# Sequential on purpose: two processes would each load a copy of the model and
# then contend for the same eight cores, which is slower than doing it once.
# Every edition is resumable on its own, so a failure costs that edition's
# remaining rows and nothing before it.
set -u
cd "$(dirname "$0")/.."
export PYTHONIOENCODING=utf-8
export HF_HUB_DISABLE_SYMLINKS_WARNING=1
export TOKENIZERS_PARALLELISM=false
export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//')"

start=$(date +%s)
while read -r slug; do
  [ -z "$slug" ] && continue
  echo ""
  echo "================================================================"
  echo "[$(date +%H:%M:%S)] $slug"
  echo "================================================================"
  python ml/embed_corpus.py --source "$slug" 2>&1 \
    | grep -vE "Warning|warnings.warn|symlink|Developer Mode|docs.microsoft|how-to-cache|Loading weights"
done < ml/EMBED_EDITIONS.txt
echo ""
echo "ALL EDITIONS FINISHED in $(( ($(date +%s) - start) / 60 )) min"
