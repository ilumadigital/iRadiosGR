#!/usr/bin/env bash
# Read-only source-vs-target inventory after a staging -> production restore.
# Do not treat equal counts as proof that paid entitlements are provider-verified.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo "Run with sudo" >&2; exit 1; }
for cmd in docker python3 mktemp; do command -v "$cmd" >/dev/null || exit 1; done
for container in iradios_stage-mongo-1 iradios_prod-mongo-1; do
 [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null)" == healthy ]] || {
  echo "STOP: MongoDB $container not healthy" >&2; exit 1;
 }
done
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Print ONLY collection names and document counts, not user documents.
for env in stage prod; do
 if [[ "$env" == stage ]]; then container=iradios_stage-mongo-1; dbname=iradios_stage;
 else container=iradios_prod-mongo-1; dbname=iradios_prod; fi
 docker exec -e IRADIOS_AUDIT_DB="$dbname" "$container" sh -ec \
  'exec mongosh --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval '"'"'
   const d=db.getSiblingDB(process.env.IRADIOS_AUDIT_DB);
   const names=d.getCollectionNames().sort();
   for(const n of names){
    if(n.startsWith("system."))continue;
    print(n+"\t"+d.getCollection(n).countDocuments({}));
   }
  '"'"'' > "$work/$env.collections"
done
python3 - "$work" <<'PY'
import sys
from pathlib import Path
root=Path(sys.argv[1])
def read(label):
    output={}
    for line in (root/f'{label}.collections').read_text().splitlines():
        k,v=line.split('\t')
        output[k]=int(v)
    return output
stage,prod=read('stage'),read('prod')
differences=[k for k in sorted(set(stage)|set(prod)) if stage.get(k)!=prod.get(k)]
print(f'Stage collections: {len(stage)}, prod collections: {len(prod)}')
print(f'Stage records: {sum(stage.values())}, prod records: {sum(prod.values())}')
print(f'Collection count mismatches: {len(differences)}')
if differences:
    sys.exit(1)
PY
python3 - <<'PY'
from pathlib import Path
from hashlib import sha256
import sys
base=Path('/srv/iradios')
def inventory(env):
    root=base/env/'uploads'
    if not root.is_dir():
        raise RuntimeError(f'{env} uploads directory unavailable')
    out={}
    for p in root.rglob('*'):
        if p.is_symlink():
            raise RuntimeError(f'symlink in {env} uploads tree: refuse unverified data')
        if not p.is_file():continue
        h=sha256()
        with p.open('rb') as f:
            for chunk in iter(lambda: f.read(1024*1024),b''):
                h.update(chunk)
        out[p.relative_to(root).as_posix()]=(p.stat().st_size,h.hexdigest())
    return out
stage=inventory('staging')
prod=inventory('production')
bad=sum(stage.get(k)!=prod.get(k) for k in set(stage)|set(prod))
print(f'Uploads: staging={len(stage)}, production={len(prod)}, mismatched/missing={bad}')
if bad:sys.exit(1)
PY
echo "PASS: Mongo collection counts and full upload SHA256 inventories match."
echo "IMPORTANT: Provider-verified payment migration, user rights and live Gateway"
echo "           contract reconciliation are SEPARATE mandatory gates."
