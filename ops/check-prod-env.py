#!/usr/bin/env python3
"""Read-only production environment preflight. Never prints secrets."""
from pathlib import Path
import re
import sys

def read_env(path):
    values = {}
    for index, raw in enumerate(Path(path).read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        match = re.fullmatch(r"([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)", line)
        if not match:
            raise ValueError(f"invalid environment declaration at line {index}")
        key, val = match.groups()
        if key in values:
            raise ValueError(f"duplicate environment key at line {index}")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        values[key] = val
    return values

def check(config, compose):
    errors = []
    def require(ok, reason):
        if not ok:
            errors.append(reason)
    require(config.get("APP_ENV") == "production", "APP_ENV must be production")
    require(config.get("FRONTEND_URL") == "https://play.iradios.gr", "FRONTEND_URL must be play.iradios.gr")
    require(config.get("IRADIOS_GATEWAY_ENV") == "production", "Gateway tenant must be production")
    require(config.get("IRADIOS_BILLING_ENABLED", "0") in ("0", "1"), "Invalid billing flag")
    require(config.get("IRADIOS_PRODUCTION_CUTOVER_APPROVED", "0") in ("0", "1"), "Invalid cutover flag")
    require(config.get("PRODUCTION_BILLING_EMAILS_ENABLED", "0") in ("0", "1"), "Invalid billing emails flag")
    for name in ("ILUMA_GATEWAY_STAGING_KEY", "ILUMA_GATEWAY_STAGING_SECRET", "NEXI_ALIAS", "NEXI_MAC_KEY"):
        require(not config.get(name), f"{name} must not be present in production app config")
    if config.get("IRADIOS_BILLING_ENABLED") == "1":
        require(config.get("IRADIOS_PRODUCTION_CUTOVER_APPROVED") == "1", "Billing cannot run before cutover approval")
        require(bool(re.fullmatch(r"ilg_[a-f0-9]{48}", config.get("ILUMA_GATEWAY_PROD_KEY", ""))), "Missing/invalid production Gateway key")
        require(bool(re.fullmatch(r"[a-f0-9]{64}", config.get("ILUMA_GATEWAY_PROD_SECRET", ""))), "Missing/invalid production Gateway secret")
    host = config.get("SMTP_HOST", "").strip().lower()
    require(bool(host) and host not in ("mailpit", "localhost", "127.0.0.1", "::1") and not host.endswith(".internal"), "Production SMTP must be external, not Mailpit/local")
    require(bool(config.get("SMTP_USER")) and bool(config.get("SMTP_PASS")), "Production SMTP credentials missing")
    require(bool(config.get("MAIL_FROM")), "MAIL_FROM missing")
    require(bool(compose.get("PROD_MONGO_PASSWORD")), "Mongo root password missing")
    require(bool(compose.get("PROD_MONGO_APP_PASSWORD")), "Mongo app password missing")
    return errors

if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("usage: check-prod-env.py /etc/iradios/production/backend.env /etc/iradios/production/compose.env")
        problems = check(read_env(sys.argv[1]), read_env(sys.argv[2]))
        if problems:
            for problem in problems:
                print("STOP: " + problem, file=sys.stderr)
            sys.exit(1)
        print("PASS: production environment boundary; secrets hidden")
    except (OSError, ValueError) as e:
        print("STOP: production environment preflight failed: " + str(e), file=sys.stderr)
        sys.exit(1)
