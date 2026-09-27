"""CPU / GPU 硬件数据采集入口。

数据来源：
  1. TechPowerUp 规格库（品牌、核心数、频率、工艺、缓存、TDP、发布时间等）
  2. PassMark 跑分榜（CPU Mark / G3D Mark、排名、性价比、参考价）

两个来源按型号名归一化后合并，输出 CSV + JSON 到 out/ 目录。

用法：
  python crawl.py                # 全量抓取 CPU + GPU
  python crawl.py --only cpu     # 只抓 CPU
  python crawl.py --max-pages 3  # 只抓前 3 页（调试）
  python crawl.py --no-cache     # 忽略缓存重新抓取
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import passmark
import tpu
from common import Fetcher, guess_brand, norm_key

OUT_DIR = Path(__file__).resolve().parent / "out"

CPU_COLUMNS = [
    "brand", "model", "codename", "cores", "threads",
    "base_clock_ghz", "boost_clock_ghz", "socket", "process_nm",
    "l3_cache_mb", "tdp_w", "released", "released_date",
    "passmark_cpu_mark", "passmark_single_thread", "passmark_rank",
    "passmark_value", "price_usd",
    "techpowerup_url", "passmark_url", "match_key",
]

GPU_COLUMNS = [
    "brand", "model", "chip", "memory_gb", "memory_type", "bus_width_bit",
    "bus_interface", "core_clock_ghz", "memory_clock_ghz",
    "shaders", "tmus", "rops", "released", "released_date",
    "passmark_g3d_mark", "passmark_rank", "passmark_value", "price_usd",
    "techpowerup_url", "passmark_url", "match_key",
]


def merge(kind: str, specs: list[dict], benchmarks: list[dict], log=print) -> list[dict]:
    """按归一化型号名把规格与跑分合并。"""
    index = {bench["match_key"]: bench for bench in benchmarks if bench.get("match_key")}
    score_key = passmark.SCORE_FIELDS[kind]

    merged: list[dict] = []
    matched_keys: set[str] = set()
    for spec in specs:
        key = norm_key(spec["model"])
        bench = index.get(key)
        if bench:
            matched_keys.add(key)
        row = dict(spec)
        row["match_key"] = key
        row[score_key] = bench.get(score_key) if bench else None
        row["passmark_rank"] = bench.get("passmark_rank") if bench else None
        row["passmark_value"] = bench.get("passmark_value") if bench else None
        row["price_usd"] = bench.get("price_usd") if bench else None
        if kind == "cpu":
            row["passmark_single_thread"] = bench.get("passmark_single_thread") if bench else None
        row["techpowerup_url"] = spec.get("url")
        row["passmark_url"] = bench.get("url") if bench else None
        if not row.get("brand"):
            row["brand"] = guess_brand(spec["model"])
        merged.append(row)

    specs_with_score = sum(1 for row in merged if row.get(score_key) is not None)
    rate = len(matched_keys) / len(specs) * 100 if specs else 0
    log(f"  [{kind}] 规格 {len(specs)} 条，跑分库 {len(index)} 条，"
        f"匹配上 {len(matched_keys)} 条（{rate:.1f}%），"
        f"最终有跑分的记录 {specs_with_score} 条")
    return merged


def export(rows: list[dict], columns: list[str], name: str, log=print) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / f"{name}.csv"
    json_path = OUT_DIR / f"{name}.json"

    with csv_path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "count": len(rows),
        "columns": columns,
        "records": rows,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"  已输出 {csv_path.name} / {json_path.name}（{len(rows)} 条）")


def crawl_kind(fetcher: Fetcher, kind: str, max_pages: int | None, log=print) -> list[dict]:
    log(f"开始抓取 {kind.upper()} …")
    raw = tpu.fetch_list(fetcher, kind, max_pages=max_pages, log=log)
    specs = tpu.normalize_cpu(raw) if kind == "cpu" else tpu.normalize_gpu(raw)
    log(f"  [{kind}] TechPowerUp 规格 {len(specs)} 条")
    benchmarks = passmark.fetch_benchmarks(fetcher, kind, log=log)
    rows = merge(kind, specs, benchmarks, log=log)
    export(rows, CPU_COLUMNS if kind == "cpu" else GPU_COLUMNS, kind, log=log)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="CPU/GPU 硬件数据采集")
    parser.add_argument("--only", choices=["cpu", "gpu"], help="只抓某一类")
    parser.add_argument("--max-pages", type=int, default=None, help="每类最多抓多少页（调试用）")
    parser.add_argument("--delay", type=float, default=1.3, help="请求间隔秒数")
    parser.add_argument("--no-cache", action="store_true", help="忽略本地缓存")
    args = parser.parse_args()

    fetcher = Fetcher(delay=args.delay, use_cache=not args.no_cache)
    kinds = [args.only] if args.only else ["cpu", "gpu"]

    started = time.monotonic()
    for kind in kinds:
        crawl_kind(fetcher, kind, args.max_pages)
    print(f"全部完成，耗时 {time.monotonic() - started:.1f}s，输出目录：{OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
