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
  # Strip a trailing CR. The editions list is written by Python on Windows, so
  # it arrives CRLF; without this the slug carries an invisible , matches no
  # source, and every edition reports "0 entries -> 0 chunks" as a success.
  slug="${slug%$''}"
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
python - <<'CHECK'
import os, psycopg2
c = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=30); cur = c.cursor()
cur.execute('SELECT count(*), count(embedding) FROM "TafsirChunk"')
n, e = cur.fetchone()
print("chunks %s | embedded %s" % (n, e))
cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
print("database:", cur.fetchone()[0], "of 500 MB")
CHECK
