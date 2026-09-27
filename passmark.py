"""PassMark 跑分榜采集。

PassMark 把榜单拆成了多个页面，必须合并才能拿到完整数据：
  CPU：cpu_list.php（仅 Intel，含 CPU Mark / 排名 / 性价比 / 价格）
       high_end_cpus.html / mid_range_cpus.html / common_cpus.html（含 CPU Mark）
       singleThread.html（单线程得分）
  GPU：gpu_list.php（含 G3D Mark / 排名 / 性价比 / 价格）
       high_end_gpus.html / mid_range_gpus.html / common_gpus.html
前四类页面用 <table id="cputable"> 渲染，榜单页用 <ul class="chartlist"> 渲染。
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common import Fetcher, norm_key, parse_float, parse_int

CPU_BASE = "https://www.cpubenchmark.net/"
GPU_BASE = "https://www.videocardbenchmark.net/"

CPU_PAGES = [
    {"key": "list", "url": CPU_BASE + "cpu_list.php", "type": "table", "metric": "multi"},
    {"key": "high_end", "url": CPU_BASE + "high_end_cpus.html", "type": "chart", "metric": "multi"},
    {"key": "mid_range", "url": CPU_BASE + "mid_range_cpus.html", "type": "chart", "metric": "multi"},
    {"key": "common", "url": CPU_BASE + "common_cpus.html", "type": "chart", "metric": "multi"},
    {"key": "single", "url": CPU_BASE + "singleThread.html", "type": "chart", "metric": "single"},
]

GPU_PAGES = [
    {"key": "list", "url": GPU_BASE + "gpu_list.php", "type": "table", "metric": "multi"},
    {"key": "high_end", "url": GPU_BASE + "high_end_gpus.html", "type": "chart", "metric": "multi"},
    {"key": "mid_range", "url": GPU_BASE + "mid_range_gpus.html", "type": "chart", "metric": "multi"},
    {"key": "common", "url": GPU_BASE + "common_gpus.html", "type": "chart", "metric": "multi"},
]

# 多线程/图形跑分在输出里的字段名
SCORE_FIELDS = {"cpu": "passmark_cpu_mark", "gpu": "passmark_g3d_mark"}


def _parse_price(text: str | None) -> float | None:
    if not text:
        return None
    cleaned = text.replace(",", "").replace("$", "").strip().rstrip("*")
    if not cleaned or cleaned.upper() in {"NA", "N/A", "-", "NONE"}:
        return None
    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    return float(match.group()) if match else None


def parse_table_page(html: str) -> list[dict]:
    """解析 cpu_list.php / gpu_list.php 的表格。"""
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", id="cputable")
    if table is None:
        table = max(soup.find_all("table"), key=lambda t: len(t.find_all("tr")), default=None)
    if table is None:
        return []

    records: list[dict] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 3:
            continue
        score = parse_int(cells[1].get_text(" ", strip=True))
        if score is None:
            continue
        link = cells[0].find("a", href=True)
        source_id = None
        if link:
            id_match = re.search(r"[?&]id=(\d+)", link["href"])
            source_id = id_match.group(1) if id_match else None
        records.append({
            "model": cells[0].get_text(" ", strip=True),
            "metric": "multi",
            "score": score,
            "rank": parse_int(cells[2].get_text(" ", strip=True)),
            "value": parse_float(cells[3].get_text(" ", strip=True)),
            "price": _parse_price(cells[4].get_text(" ", strip=True)) if len(cells) > 4 else None,
            "url": link["href"] if link else None,
            "source_id": source_id,
        })
    return records


def parse_chart_page(html: str) -> list[dict]:
    """解析榜单页的 <ul class="chartlist">。"""
    soup = BeautifulSoup(html, "lxml")
    chart = max(soup.find_all("ul"), key=lambda u: len(u.find_all("li")), default=None)
    if chart is None:
        return []

    records: list[dict] = []
    for position, li in enumerate(chart.find_all("li"), start=1):
        name_node = li.select_one(".prdname")
        count_node = li.select_one(".count")
        price_node = li.select_one(".price-neww")
        link = li.find("a", href=True)
        if name_node is None:
            continue
        records.append({
            "model": name_node.get_text(" ", strip=True),
            "metric": "multi",
            "score": parse_int(count_node.get_text(" ", strip=True)) if count_node else None,
            "rank": position,
            "value": None,
            "price": _parse_price(price_node.get_text(" ", strip=True)) if price_node else None,
            "url": link["href"] if link else None,
            "source_id": None,
        })
    return records


def _page_base(url: str) -> str:
    return CPU_BASE if "cpubenchmark" in url else GPU_BASE


def collect(fetcher: Fetcher, kind: str, log=print) -> list[dict]:
    """抓取并合并该类别的所有 PassMark 榜单。"""
    pages = CPU_PAGES if kind == "cpu" else GPU_PAGES
    score_key = SCORE_FIELDS[kind]
    index: dict[str, dict] = {}

    for page in pages:
        html = fetcher.get(page["url"])
        rows = (parse_table_page(html) if page["type"] == "table"
                else parse_chart_page(html))
        base = _page_base(page["url"])
        added = filled = 0
        for row in rows:
            key = norm_key(row["model"])
            if not key:
                continue
            if row.get("url") and not str(row["url"]).startswith("http"):
                row["url"] = urljoin(base, row["url"])
            row["page"] = page["key"]
            row["metric"] = page["metric"]
            metric_field = ("passmark_single_thread"
                            if page["metric"] == "single" else score_key)

            target = index.get(key)
            if target is None:
                index[key] = {
                    "source": "passmark",
                    "match_key": key,
                    "model": row["model"],
                    "url": row["url"],
                    "source_id": row["source_id"],
                    score_key: None,
                    "passmark_single_thread": None,
                    "passmark_rank": None,
                    "passmark_value": None,
                    "price_usd": None,
                }
                target = index[key]
                added += 1
            else:
                filled += 1
            if target.get(metric_field) is None and row.get("score") is not None:
                target[metric_field] = row["score"]
            # 排名/性价比只信任 cpu_list.php 这类带完整列的表格
            if page["type"] == "table":
                target["passmark_rank"] = target["passmark_rank"] or row.get("rank")
                target["passmark_value"] = target["passmark_value"] or row.get("value")
            if target.get("price_usd") is None:
                target["price_usd"] = row.get("price")
            if not target.get("url"):
                target["url"] = row["url"]
        log(f"  [passmark-{kind}/{page['key']}] {len(rows)} 条（新增 {added}，补全 {filled}）")

    return list(index.values())


def fetch_benchmarks(fetcher: Fetcher, kind: str, log=print) -> list[dict]:
    records = collect(fetcher, kind, log=log)
    log(f"  [passmark-{kind}] 合并后 {len(records)} 条跑分")
    return records


if __name__ == "__main__":
    import sys

    fetcher = Fetcher(delay=0.5)
    target = sys.argv[1] if len(sys.argv) > 1 else "cpu"
    items = fetch_benchmarks(fetcher, target)
    for item in items[:3]:
        print(" ", item)
    with_score = [i for i in items if i.get(SCORE_FIELDS[target])]
    print(f"  有主跑分 {len(with_score)} 条 / 共 {len(items)} 条")
    if target == "cpu":
        print("  有单线程分:", len([i for i in items if i["passmark_single_thread"]]))
