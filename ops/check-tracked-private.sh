#!/usr/bin/env bash
# Fail if Git is already tracking runtime secrets, customer data, or raw exports.
# .gitignore alone protects only UNTRACKED files.
set -euo pipefail
cd "$(dirname "$0")/.."
bad=0
while IFS= read -r -d '' file; do
  # Explicitly permitted public, placeholder-only templates.
  case "$file" in
    .env.example|*/.env.example) continue ;;
  esac
  if [[ "$file" =~ (^|/)\.env([.]|$) ]] ||
     [[ "$file" =~ (^|/)(uploads|client-data|customer-data|client-files|customer-files|admin-data|admin-private|private-data|private-uploads|user-data|backups|dumps|db-dumps|secrets|credentials|archives|exported-reports|runtime)/ ]] ||
     [[ "$file" =~ \.(csv|tsv|xlsx|xls|ods|jsonl|ndjson|parquet|sql|bson|dump|archive|backup|sqlite|sqlite3|db|pem|key|p8|p12|pfx|jks|keystore|kdbx|age|gpg|asc|htpasswd)$ ]] ||
     [[ "$file" =~ (^|/)(\.npmrc|\.netrc|\.pypirc|id_rsa|id_ed25519)$ ]] ||
     [[ "$file" =~ (^|/)(service-account|service_account|credentials|secrets)[^/]*\.json$ ]]
  then
    echo "STOP: tracked private or secret-like file: $file" >&2
    bad=1
  fi
done < <(git ls-files -z)
if [[ "$bad" -ne 0 ]]; then
  echo "Private files already tracked must be removed from the Git index." >&2
  echo "Inspect before running git rm --cached; rotate any previously leaked secrets." >&2
  exit 1
fi
echo "Git tracked-file privacy check: OK (no obvious sensitive paths)."
