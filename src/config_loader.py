import json
from pathlib import Path
from typing import Any, Dict, List


class ConfigError(Exception):
    """Raised when the portfolio configuration is missing or malformed."""


def load_active_apps(config_path: Path) -> List[Dict[str, Any]]:
    if not config_path.exists():
        raise ConfigError(f"Configuration file not found at: {config_path}")

    try:
        raw_data = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"Invalid JSON in {config_path}: {exc}") from exc

    apps = raw_data.get("apps")
    if not isinstance(apps, list):
        raise ConfigError("'apps' key must be a list in apps.json")

    valid_apps = []
    for item in apps:
        if not item.get("active", True):
            continue
        if "id" not in item or "title" not in item or "url" not in item:
            raise ConfigError(f"App entry missing 'id', 'title', or 'url': {item}")
        valid_apps.append(item)

    return valid_apps
