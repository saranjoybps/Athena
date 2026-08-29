import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
os.environ.setdefault("FABRICA_STORE", "memory")
os.environ.setdefault("FABRICA_AUTH", "dev")
