"""把 out/*.json 精简后导出为 web/data/*.js。

浏览器直接打开 index.html（file:// 协议）时无法 fetch 本地 JSON，
因此这里把数据包装成 <script> 可直接加载的 JS 文件。

用法：python web/build_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "out"
DEST = Path(__file__).resolve().parent / "data"

CPU_FIELDS = [
    "brand", "model", "codename", "cores", "threads",
    "base_clock_ghz", "boost_clock_ghz", "socket", "process_nm",
    "l3_cache_mb", "tdp_w", "released", "released_date",
    "passmark_cpu_mark", "passmark_single_thread", "passmark_rank",
    "passmark_value", "price_usd", "techpowerup_url", "passmark_url",
]

GPU_FIELDS = [
    "brand", "model", "chip", "memory_gb", "memory_type",
    "bus_width_bit", "bus_interface", "core_clock_ghz", "memory_clock_ghz",
    "shaders", "tmus", "rops", "released", "released_date",
    "passmark_g3d_mark", "passmark_rank", "passmark_value",
    "price_usd", "techpowerup_url", "passmark_url",
]


def slim(records: list[dict], fields: list[str]) -> list[dict]:
    """只保留界面用得到的字段，顺手去掉全空值，减小体积。"""
    out = []
    for rec in records:
        item = {}
        for key in fields:
            value = rec.get(key)
            if value is None or value == "":
                continue
            item[key] = value
        out.append(item)
    return out


def dump(kind: str, fields: list[str]) -> int:
    source = SRC / f"{kind}.json"
    if not source.exists():
        raise SystemExit(f"缺少数据文件：{source}\n请先运行 python crawl.py 抓取数据。")

    payload = json.loads(source.read_text(encoding="utf-8"))
    records = slim(payload.get("records", []), fields)

    DEST.mkdir(parents=True, exist_ok=True)
    target = DEST / f"{kind}.js"
    body = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    target.write_text(
        f"window.HWDATA=window.HWDATA||{{}};window.HWDATA.{kind}={body};",
        encoding="utf-8",
    )
    print(f"{target.relative_to(ROOT)}  {len(records)} 条  {target.stat().st_size / 1024:.0f} KB")
    return len(records)


if __name__ == "__main__":
    dump("cpu", CPU_FIELDS)
    dump("gpu", GPU_FIELDS)