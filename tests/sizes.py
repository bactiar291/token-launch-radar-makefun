import json,hashlib,subprocess
from pathlib import Path
repo=Path(__file__).resolve().parent.parent
print(json.dumps({'dashboard':{p.name:p.stat().st_size for p in (repo/'dashboard').iterdir()},'total_dashboard_bytes':sum(p.stat().st_size for p in (repo/'dashboard').iterdir()),'vendor_sha256':hashlib.sha256((repo/'vendor/makefun-board.ts').read_bytes()).hexdigest()},indent=2))
