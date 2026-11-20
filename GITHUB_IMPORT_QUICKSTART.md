# Import iRadiosGR Stage candidate into private GitHub

The `staging` branch has already been created via the connected GitHub App. The code in this bundle is **not yet committed**. Use a trusted local Ubuntu workstation. Do not run these steps on Hetzner.

```bash
sudo apt update && sudo apt install -y gh git unzip rsync
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
mkdir -p ~/Projects ~/Downloads/iradios-stage-import
unzip -q ~/Downloads/iradios_stage_candidate.zip -d ~/Downloads/iradios-stage-import
git clone --branch staging https://github.com/ilumadigital/iRadiosGR.git ~/Projects/iRadiosGR-staging
rsync -av --exclude='.git' ~/Downloads/iradios-stage-import/ ~/Projects/iRadiosGR-staging/
cd ~/Projects/iRadiosGR-staging
bash ops/check-stage-source.sh
git add -A
git diff --cached --check
git diff --cached --stat
# Review the staged diff before proceeding.
git commit -m "stage: import isolated iRadiosGR baseline"
git push origin staging
```

Once GitHub shows all files and Actions staging validation passes, use authorized file transfer from the trusted workstation to `/srv/iradios/staging/app/` or configure GitHub Actions deploy credentials. First stage launch is intentionally manual; production remains on Hetzner.

Caveat: do not run the old production Docker Compose, do not copy live .env secrets, and do not restore real MongoDB user records without anonymization. The zip was reconstructed from a text dump and has not passed a full Docker build in this session.
