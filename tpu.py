"""TechPowerUp 硬件规格库采集（CPU / GPU 列表页 AJAX 接口）。

列表接口： https://www.techpowerup.com/{cpu|gpu}-specs/?p=N&ajax
返回 JSON，其中 list 字段是 HTML 片段，里面就是规格表。
"""

from __future__ import annotations

import re
from typing import Callable, Iterable

from bs4 import BeautifulSoup

from common import (
    Fetcher,
    parse_capacity_gb,
    parse_clock_range,
    parse_int,
    parse_released,
)

BASE_URL = "https://www.techpowerup.com"

# 站点里 tr 的 vendor-XXX class -> 统一厂商名
VENDOR_ALIASES = {
    "amd": "AMD",
    "intel": "Intel",
    "nvidia": "NVIDIA",
    "ati": "ATI",
    "apple": "Apple",
    "qualcomm": "Qualcomm",
    "mediatek": "MediaTek",
    "samsung": "Samsung",
    "google": "Google",
    "amlogic": "Amlogic",
    "rockchip": "Rockchip",
    "unisoc": "Unisoc",
    "hisilicon": "HiSilicon",
    "broadcom": "Broadcom",
    "hygon": "Hygon",
    "loongson": "Loongson",
    "zhaoxin": "Zhaoxin",
    "via": "VIA",
    "centaur": "Centaur",
    "fujitsu": "Fujitsu",
    "ibm": "IBM",
    "marvell": "Marvell",
    "micron": "Micron",
    "motorola": "Motorola",
    "nuvia": "Nuvia",
    "sony": "Sony",
    "toshiba": "Toshiba",
    "transmeta": "Transmeta",
    "vmware": "VMware",
    "allwinner": "Allwinner",
    "ingenic": "Ingenic",
}

CPU_FIELDS = {
    "Codename": "codename",
    "Cores": "cores_text",
    "Clock": "clock_text",
    "Socket": "socket",
    "Process": "process_text",
    "L3 Cache": "l3_text",
    "TDP": "tdp_text",
    "Released": "released",
    "Bus Interface": "bus_interface",
    "L2 Cache": "l2_text",
}

GPU_FIELDS = {
    "Bus": "bus_interface",
    "Memory": "memory_text",
    "GPU Clock": "clock_text",
    "Memory Clock": "memory_clock_text",
    "Cores / TMUs / ROPs": "units_text",
    "TDP": "tdp_text",
    "Released": "released",
    "Process": "process_text",
}


def _vendor_from_row(tr) -> str | None:
    for cls in tr.get("class") or []:
        if cls.startswith("vendor-"):
            raw = cls[len("vendor-"):].lower()
            return VENDOR_ALIASES.get(raw, raw.upper() if len(raw) <= 3 else raw.title())
    return None


def parse_list_page(html: str, tag: str) -> list[dict]:
    """解析一页规格表，返回原始字段字典列表。"""
    if not html or "total in DB" not in html and "<tr" not in html:
        return []
    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("table.items-desktop-table")
    if table is None:
        return []

    headers = [th.get_text(" ", strip=True) for th in table.select("thead th")]
    if not headers:
        return []
    field_map = CPU_FIELDS if tag == "cpu" else GPU_FIELDS

    records: list[dict] = []
    for tr in table.select("tr"):
        cells = tr.find_all("td")
        if len(cells) != len(headers):
            continue
        raw = {headers[i]: cells[i].get_text(" ", strip=True) for i in range(len(headers))}

        # 名称列结构： .item-name 为型号、.item-released 为发布日期、.item-chip 为芯片代号
        name_cell = cells[0]
        name_link = name_cell.select_one(".item-name a") or name_cell.find("a", href=True)
        model = name_link.get_text(" ", strip=True) if name_link else raw.get("Name", "")
        url = BASE_URL + name_link["href"] if name_link else None
        released_node = name_cell.select_one(".item-released")
        chip_node = name_cell.select_one(".item-chip a")
        model_id = None
        if url:
            match = re.search(r"\.c(\d+)$", url)
            model_id = match.group(1) if match else None

        record: dict = {
            "source": "techpowerup",
            "model": model.strip(),
            "brand": _vendor_from_row(tr),
            "url": url,
            "source_id": model_id,
            "released": released_node.get_text(" ", strip=True) if released_node else None,
            "chip": chip_node.get_text(" ", strip=True) if chip_node else None,
        }
        for header, key in field_map.items():
            if header in raw and not record.get(key):
                record[key] = raw[header]
        records.append(record)
    return records


def fetch_list(
    fetcher: Fetcher,
    tag: str,
    *,
    max_pages: int | None = None,
    log: Callable[[str], None] = print,
) -> list[dict]:
    """翻页抓取整库列表。"""
    all_records: list[dict] = []
    page = 1
    while True:
        params = "" if page == 1 else f"p={page}&"
        url = f"{BASE_URL}/{tag}-specs/?{params}ajax"
        payload = fetcher.get_json(url)
        page_records = parse_list_page(payload.get("list", ""), tag)
        if not page_records:
            break
        all_records.extend(page_records)
        log(f"  [{tag}] 第 {page} 页 {len(page_records)} 条，累计 {len(all_records)}")
        if max_pages and page >= max_pages:
            break
        page += 1
    return all_records


def normalize_cpu(records: Iterable[dict]) -> list[dict]:
    """把列表原始字段整理成统一 CPU 规格。"""
    result = []
    for rec in records:
        cores = threads = None
        match = re.search(r"(\d+)\s*/\s*(\d+)", rec.get("cores_text", "") or "")
        if match:
            cores, threads = int(match.group(1)), int(match.group(2))
        else:
            cores = parse_int(rec.get("cores_text", "") or "")
            threads = cores  # 没写线程数说明不支持超线程

        base_clock, boost_clock = parse_clock_range(rec.get("clock_text", "") or "")
        process = parse_int(rec.get("process_text", "") or "")
        l3 = parse_int(rec.get("l3_text", "") or "")
        tdp = parse_int(rec.get("tdp_text", "") or "")
        released = (rec.get("released") or "").strip() or None

        result.append({
            "kind": "cpu",
            "source": "techpowerup",
            "source_id": rec.get("source_id"),
            "url": rec.get("url"),
            "brand": rec.get("brand"),
            "model": rec.get("model"),
            "codename": rec.get("codename"),
            "cores": cores,
            "threads": threads,
            "base_clock_ghz": base_clock,
            "boost_clock_ghz": boost_clock,
            "socket": rec.get("socket"),
            "process_nm": process,
            "l3_cache_mb": l3,
            "tdp_w": tdp,
            "released": released,
            "released_date": parse_released(released),
        })
    return result


def normalize_gpu(records: Iterable[dict]) -> list[dict]:
    """把列表原始字段整理成统一 GPU 规格。"""
    result = []
    for rec in records:
        # 显存列形如 "16 GB / GDDR6 / 256 bit"
        memory_text = rec.get("memory_text", "") or ""
        parts = [p.strip() for p in memory_text.split("/")]
        memory_size = parse_capacity_gb(parts[0]) if parts else None
        memory_type = parts[1].upper() if len(parts) > 1 else None
        bus_width = parse_int(parts[2]) if len(parts) > 2 else parse_int(memory_text)

        core_clock, _ = parse_clock_range(rec.get("clock_text", "") or "")
        mem_clock, _ = parse_clock_range(rec.get("memory_clock_text", "") or "")

        shaders = tmus = rops = None
        units = re.findall(r"(\d+)", rec.get("units_text", "") or "")
        if len(units) >= 3:
            shaders, tmus, rops = (int(x) for x in units[:3])
        elif len(units) == 1:
            shaders = int(units[0])

        result.append({
            "kind": "gpu",
            "source": "techpowerup",
            "source_id": rec.get("source_id"),
            "url": rec.get("url"),
            "brand": rec.get("brand"),
            "model": rec.get("model"),
            "chip": rec.get("chip"),
            "memory_gb": memory_size,
            "memory_type": memory_type,
            "bus_width_bit": bus_width,
            "bus_interface": rec.get("bus_interface"),
            "core_clock_ghz": core_clock,
            "memory_clock_ghz": mem_clock,
            "shaders": shaders,
            "tmus": tmus,
            "rops": rops,
            "released": (rec.get("released") or "").strip() or None,
            "released_date": parse_released(rec.get("released")),
        })
    return result


if __name__ == "__main__":  # 调试：打印第一页解析结果
    import sys

    fetcher = Fetcher(delay=0.5, use_cache=True)
    tag = sys.argv[1] if len(sys.argv) > 1 else "gpu"
    payload = fetcher.get_json(f"{BASE_URL}/{tag}-specs/?ajax")
    raw = parse_list_page(payload["list"], tag)
    print(f"{tag} 第一页解析 {len(raw)} 条")
    for item in raw[:3]:
        print("  RAW :", item)
    norm = normalize_cpu(raw) if tag == "cpu" else normalize_gpu(raw)
    for item in norm[:3]:
        print("  NORM:", item)
