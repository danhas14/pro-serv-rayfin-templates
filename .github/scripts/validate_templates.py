"""Validates each templates/<name>/ folder has a README.md and a well-formed metadata.yaml,
and does a lightweight scan for likely secrets/connection strings."""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml")
    sys.exit(2)

REQUIRED_METADATA_FIELDS = ["name", "description", "owner", "tags", "fabric_item_types", "last_updated"]

SECRET_PATTERNS = [
    re.compile(r"AccountKey=", re.IGNORECASE),
    re.compile(r"SharedAccessSignature", re.IGNORECASE),
    re.compile(r"(api|client)[_-]?(key|secret)\s*[:=]", re.IGNORECASE),
    re.compile(r"-----BEGIN (RSA |EC )?PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),  # JWT-looking token
]

TEXT_EXTENSIONS = {".json", ".pbir", ".pbip", ".yaml", ".yml", ".md", ".txt", ".pq", ".tmdl"}

had_error = False


def fail(msg: str) -> None:
    global had_error
    print(f"ERROR: {msg}")
    had_error = True


def check_template(folder: Path) -> None:
    readme = folder / "README.md"
    metadata = folder / "metadata.yaml"

    if not readme.exists():
        fail(f"{folder}: missing README.md")

    if not metadata.exists():
        fail(f"{folder}: missing metadata.yaml")
        return

    try:
        data = yaml.safe_load(metadata.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        fail(f"{folder}: metadata.yaml is not valid YAML ({exc})")
        return

    for field in REQUIRED_METADATA_FIELDS:
        if field not in data:
            fail(f"{folder}: metadata.yaml missing required field '{field}'")

    for path in folder.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS:
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for pattern in SECRET_PATTERNS:
                if pattern.search(content):
                    fail(f"{path}: matched suspicious pattern '{pattern.pattern}' — possible secret")


def main() -> int:
    templates_dir = Path("templates")
    if not templates_dir.exists():
        print("No templates/ directory found, nothing to validate.")
        return 0

    subfolders = [p for p in templates_dir.iterdir() if p.is_dir()]
    if not subfolders:
        print("No template folders found under templates/.")
        return 0

    for folder in subfolders:
        check_template(folder)

    if had_error:
        print("\nValidation failed.")
        return 1

    print(f"Validated {len(subfolders)} template folder(s) successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
