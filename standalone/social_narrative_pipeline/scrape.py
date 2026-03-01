from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd
from dateutil.parser import isoparse
from playwright.async_api import async_playwright, Page


@dataclass
class RawPost:
    platform: str
    handle: str
    group_label: str
    post_id: str
    published_at: str
    text: str
    likes: int | None
    shares: int | None
    url: str


def in_date_range(ts: str, start_date: datetime, end_date: datetime) -> bool:
    dt = isoparse(ts)
    return start_date.date() <= dt.date() <= end_date.date()


async def scrape_x_profile(page: Page, handle: str, group_label: str, start_date: datetime, end_date: datetime) -> list[RawPost]:
    posts: list[RawPost] = []
    url = f"https://x.com/{handle}"
    await page.goto(url, wait_until="domcontentloaded", timeout=120000)

    for _ in range(8):
        await page.mouse.wheel(0, 3500)
        await page.wait_for_timeout(1200)

    articles = await page.locator("article[data-testid='tweet']").all()
    for article in articles:
        time_el = article.locator("time")
        if await time_el.count() == 0:
            continue
        published_at = await time_el.first.get_attribute("datetime")
        if not published_at or not in_date_range(published_at, start_date, end_date):
            continue

        text = (await article.inner_text()).strip()
        link = await time_el.first.locator("xpath=ancestor::a").get_attribute("href")
        post_id = link.split("/")[-1] if link else ""

        posts.append(
            RawPost(
                platform="x",
                handle=handle,
                group_label=group_label,
                post_id=post_id,
                published_at=published_at,
                text=text,
                likes=None,
                shares=None,
                url=f"https://x.com{link}" if link else url,
            )
        )

    return posts


async def scrape_telegram_profile(page: Page, handle: str, group_label: str, start_date: datetime, end_date: datetime) -> list[RawPost]:
    posts: list[RawPost] = []
    url = f"https://t.me/s/{handle}"
    await page.goto(url, wait_until="domcontentloaded", timeout=120000)

    for _ in range(10):
        await page.mouse.wheel(0, 3500)
        await page.wait_for_timeout(900)

    msg_nodes = await page.locator(".tgme_widget_message_wrap").all()
    for node in msg_nodes:
        date_node = node.locator("time")
        if await date_node.count() == 0:
            continue
        published_at = await date_node.first.get_attribute("datetime")
        if not published_at or not in_date_range(published_at, start_date, end_date):
            continue

        text = (await node.inner_text()).strip()
        msg_link = await node.locator("a.tgme_widget_message_date").get_attribute("href")
        post_id = msg_link.split("/")[-1] if msg_link else ""

        posts.append(
            RawPost(
                platform="telegram",
                handle=handle,
                group_label=group_label,
                post_id=post_id,
                published_at=published_at,
                text=text,
                likes=None,
                shares=None,
                url=msg_link or url,
            )
        )

    return posts


async def scrape_all(targets: pd.DataFrame, start_date: datetime, end_date: datetime) -> list[RawPost]:
    result: list[RawPost] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="state.json" if Path("state.json").exists() else None)
        page = await context.new_page()

        for row in targets.itertuples(index=False):
            platform = str(row.platform).strip().lower()
            handle = str(row.handle).strip().replace("@", "")
            group_label = str(row.group_label).strip()

            if platform == "x":
                result.extend(await scrape_x_profile(page, handle, group_label, start_date, end_date))
            elif platform == "telegram":
                result.extend(await scrape_telegram_profile(page, handle, group_label, start_date, end_date))

        await context.storage_state(path="state.json")
        await browser.close()

    return result


def dedupe(posts: Iterable[RawPost]) -> pd.DataFrame:
    df = pd.DataFrame(asdict(p) for p in posts)
    if df.empty:
        return df
    return df.drop_duplicates(subset=["platform", "handle", "post_id", "published_at"]).sort_values("published_at")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", required=True)
    parser.add_argument("--start-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    targets = pd.read_csv(args.targets)
    start_date = datetime.fromisoformat(args.start_date)
    end_date = datetime.fromisoformat(args.end_date)

    posts = asyncio.run(scrape_all(targets, start_date, end_date))
    df = dedupe(posts)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    print(f"Saved {len(df)} posts -> {args.output}")


if __name__ == "__main__":
    main()
