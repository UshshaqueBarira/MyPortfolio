import asyncio
import logging
import sys
from pathlib import Path

from src.config_loader import ConfigError, load_active_apps
from src.waker import StreamlitWaker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


async def run() -> int:
    base_dir = Path(__file__).parent
    config_path = base_dir / "config" / "apps.json"
    status_path = base_dir / "config" / "status.json"

    try:
        apps = load_active_apps(config_path)
    except ConfigError as exc:
        logger.critical("Configuration error: %s", exc)
        return 1

    if not apps:
        logger.warning("No active apps found in %s.", config_path)
        return 0

    logger.info("Starting keep-alive cycle for %d app(s)...", len(apps))
    waker = StreamlitWaker()
    results = await waker.wake_all(apps)
    waker.save_telemetry(results, status_path)

    logger.info("--- Execution Summary ---")
    failures = 0
    for res in results:
        logger.info(
            "%-30s | %-10s | %5dms | %s",
            res.title,
            res.status,
            res.latency_ms,
            res.detail,
        )
        if res.status == "FAILED":
            failures += 1

    return 1 if failures > 0 else 0


if __name__ == "__main__":
    exit_code = asyncio.run(run())
    sys.exit(exit_code)
