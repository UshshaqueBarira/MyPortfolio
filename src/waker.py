import json
import logging
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
from playwright.async_api import async_playwright, Page

logger = logging.getLogger(__name__)


@dataclass
class WakeResult:
    app_id: str
    title: str
    url: str
    status: str  # "ACTIVE", "WOKEN_UP", or "FAILED"
    latency_ms: int
    detail: str
    checked_at_utc: str


class StreamlitWaker:
    def __init__(
        self,
        navigation_timeout_ms: int = 60000,
        boot_wait_ms: int = 15000,
        heartbeat_wait_ms: int = 5000,
    ):
        self.navigation_timeout_ms = navigation_timeout_ms
        self.boot_wait_ms = boot_wait_ms
        self.heartbeat_wait_ms = heartbeat_wait_ms

    async def _wake_single_app(self, page: Page, app: Dict[str, Any]) -> WakeResult:
        app_id = app["id"]
        title = app["title"]
        url = app["url"]
        now_utc = datetime.now(timezone.utc).isoformat()
        logger.info("Checking [%s] -> %s", title, url)

        start_time = time.perf_counter()
        try:
            await page.goto(
                url,
                wait_until="networkidle",
                timeout=self.navigation_timeout_ms,
            )
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            wake_button = page.get_by_role(
                "button", name="Yes, get this app back up!"
            )

            if await wake_button.is_visible(timeout=5000):
                logger.warning("[%s] Hibernating. Triggering wake-up...", title)
                await wake_button.click()
                await page.wait_for_timeout(self.boot_wait_ms)
                logger.info("[%s] Wake signal completed.", title)
                return WakeResult(
                    app_id, title, url, "WOKEN_UP", elapsed_ms, "Woken from sleep", now_utc
                )

            await page.wait_for_timeout(self.heartbeat_wait_ms)
            logger.info("[%s] Already awake (%dms).", title, elapsed_ms)
            return WakeResult(
                app_id, title, url, "ACTIVE", elapsed_ms, "WebSocket active", now_utc
            )

        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error("[%s] Failed to reach or wake app: %s", title, exc)
            return WakeResult(
                app_id, title, url, "FAILED", elapsed_ms, str(exc), now_utc
            )

    async def wake_all(self, apps: List[Dict[str, Any]]) -> List[WakeResult]:
        results: List[WakeResult] = []
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            for app in apps:
                result = await self._wake_single_app(page, app)
                results.append(result)

            await browser.close()
        return results

    @staticmethod
    def save_telemetry(results: List[WakeResult], status_path: Path) -> None:
        payload = {
            "last_run_utc": datetime.now(timezone.utc).isoformat(),
            "apps": {res.app_id: asdict(res) for res in results},
        }
        status_path.parent.mkdir(parents=True, exist_ok=True)
        status_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        logger.info("Telemetry saved to %s", status_path)
