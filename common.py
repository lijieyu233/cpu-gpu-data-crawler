"""公共工具：HTTP 抓取（带磁盘缓存与重试）、名称归一化、数值解析。"""

from __future__ import annotations

import hashlib
import json
import random
import re
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / ".cache"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, text/javascript, application/xhtml+xml, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}


class Fetcher:
    """带磁盘缓存、限速与重试的 HTTP 抓取器。

    同一 URL 只会真正请求一次，原始响应正文缓存在 .cache/ 下；
    传 use_cache=False 可强制刷新。
    """

    def __init__(self, delay: float = 0.7, use_cache: bool = True) -> None:
        self.delay = delay
        self.use_cache = use_cache
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self._last_request = 0.0

    def _throttle(self) -> None:
        gap = time.monotonic() - self._last_request
        wait = self.delay - gap + random.uniform(0, 0.3)
        if wait > 0:
            time.sleep(wait)
        self._last_request = time.monotonic()

    @staticmethod
    def _cache_path(key: str) -> Path:
        digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
        return CACHE_DIR / f"{digest}.txt"

    def get(self, url: str, *, cache_key: str | None = None, retries: int = 6) -> str:
        key = cache_key or url
        path = self._cache_path(key)
        if self.use_cache and path.exists():
            return path.read_text(encoding="utf-8")

        last_error: Exception | None = None
        for attempt in range(retries):
            self._throttle()
            try:
                resp = self.session.get(url, timeout=45)
            except requests.RequestException as exc:
                last_error = exc
                time.sleep(1.5 * (attempt + 1))
                continue

            if resp.status_code == 200:
                if self.use_cache:
                    CACHE_DIR.mkdir(parents=True, exist_ok=True)
                    path.write_text(resp.text, encoding="utf-8")
                return resp.text

            if resp.status_code == 429:
                # 被限流：优先遵守 Retry-After，否则指数退避
                header = resp.headers.get("Retry-After", "")
                wait = float(header) if header.replace(".", "", 1).isdigit() else 0.0
                wait = wait or min(15.0 * (attempt + 1), 120.0)
                last_error = RuntimeError("HTTP 429 限流")
                print(f"    ! 触发限流，等待 {wait:.0f}s 后重试（{url}）")
                time.sleep(wait)
                continue

            if resp.status_code in (403, 408, 425) or resp.status_code >= 500:
                last_error = RuntimeError(f"HTTP {resp.status_code}")
                time.sleep(3.0 * (attempt + 1))
                continue

            raise RuntimeError(f"HTTP {resp.status_code} for {url}")

        raise RuntimeError(f"抓取失败 {url}: {last_error}")

    def get_json(self, url: str, *, cache_key: str | None = None, retries: int = 6) -> dict:
        return json.loads(self.get(url, cache_key=cache_key, retries=retries))


# --------------------------------------------------------------------------
# 型号名归一化：用于跨站点匹配（TechPowerUp 名称 <-> PassMark 名称）
# --------------------------------------------------------------------------

_VENDOR_TOKENS = {
    "amd", "intel", "nvidia", "ati", "apple", "qualcomm", "mediatek", "samsung",
    "google", "amlogic", "rockchip", "via", "hygon", "loongson", "zhaoxin",
    "unisoc", "hisilicon", "broadcom", "marvell", "fujitsu", "ibm", "motorola",
    "sis", "ali", "vmware", "microsoft", "sony", "toshiba", "nec", "transmeta",
    "micron", "allwinner", "ingenic", "spreadtrum", "nuvia", "centaur", "idt",
}

_MEMORY_PREFIX = re.compile(r"^(?:\d+\s?(?:kb|mb|gb))+[\s-]*")
_MEMORY_TYPES = {"ddr", "ddr2", "ddr3", "ddr4", "ddr5", "gddr", "gddr2", "gddr3",
                 "gddr4", "gddr5", "gddr6", "sdr", "edo", "sdram", "vram"}
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def norm_key(name: str) -> str:
    """把型号名压成便于跨站匹配的键（去掉厂商前缀、频率后缀、非字母数字）。"""
    text = name.lower()
    text = re.sub(r"\(r\)|\(tm\)|\(c\)", " ", text)
    text = re.sub(r"@.*$", " ", text)              # PassMark 的 "@ 3.10GHz"
    text = _MEMORY_PREFIX.sub(" ", text)           # PassMark 显卡的 "256MB " 前缀
    text = re.sub(r"\bsoc\b", " ", text)           # TechPowerUp 的 "A9-9425 SoC"
    tokens = text.split()
    while tokens and tokens[0] in _VENDOR_TOKENS:
        tokens.pop(0)
    while tokens and tokens[0] in _MEMORY_TYPES:
        tokens.pop(0)
    return _NON_ALNUM.sub("", " ".join(tokens))


# --------------------------------------------------------------------------
# 数值解析
# --------------------------------------------------------------------------

def parse_int(value: str) -> int | None:
    """从 "65 W" / "32 MB" / "128 bit" 中取出整数。"""
    match = re.search(r"-?\d+", value.replace(",", ""))
    return int(match.group()) if match else None


def parse_float(value: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", ""))
    return float(match.group()) if match else None


def parse_clock_range(value: str) -> tuple[float | None, float | None]:
    """解析 "3.4 to 4.6 GHz" / "1920 MHz" 这类频率，统一换算成 GHz。"""
    if not value:
        return None, None
    scale = 1.0
    low = value.lower()
    if "mhz" in low:
        scale = 0.001
    numbers = re.findall(r"\d+(?:\.\d+)?", value)
    if not numbers:
        return None, None
    if len(numbers) == 1:
        return round(float(numbers[0]) * scale, 4), None
    return round(float(numbers[0]) * scale, 4), round(float(numbers[1]) * scale, 4)


def parse_capacity_gb(value: str) -> float | None:
    """解析 "8 GB" / "512 MB" 显存容量，统一换算成 GB。"""
    if not value:
        return None
    low = value.lower().replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)", low)
    if not match:
        return parse_float(value)
    number = float(match.group(1))
    unit = match.group(2)
    factor = {"kb": 1 / 1024 / 1024, "mb": 1 / 1024, "gb": 1.0, "tb": 1024.0}[unit]
    return round(number * factor, 4)


_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_released(text: str | None) -> str | None:
    """把 "Apr 2022" / "Mar 6th, 2025" 统一成 ISO 日期字符串。"""
    if not text:
        return None
    full = re.search(r"([A-Za-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})", text)
    if full:
        month = _MONTHS.get(full.group(1).lower())
        if month:
            return f"{int(full.group(3)):04d}-{month:02d}-{int(full.group(2)):02d}"
    month_year = re.search(r"([A-Za-z]{3})[a-z]*\s+(\d{4})", text)
    if month_year:
        month = _MONTHS.get(month_year.group(1).lower())
        if month:
            return f"{int(month_year.group(2)):04d}-{month:02d}-01"
    year = re.search(r"\b(19|20)\d{2}\b", text)
    return f"{year.group()}01-01" if year else None


def guess_brand(name: str) -> str | None:
    """按型号名推断厂商（PassMark 的名称里带厂商前缀）。"""
    low = name.lower()
    if re.search(r"\b(geforce|nvidia|tesla|quadro|rtx|gtx)\b", low):
        return "NVIDIA"
    if re.search(r"\b(radeon|amd|ati|firepro|rx\s?\d)\b", low):
        return "AMD"
    if re.search(r"\b(intel|xe|iris|arc\s?a\d|uhd graphics|hd graphics)\b", low):
        return "Intel"
    if re.search(r"\b(apple|m\d\s?(pro|max|ultra)?)\b", low):
        return "Apple"
    for token, brand in (
        ("amd", "AMD"), ("intel", "Intel"), ("nvidia", "NVIDIA"),
        ("qualcomm", "Qualcomm"), ("mediatek", "MediaTek"), ("apple", "Apple"),
        ("samsung", "Samsung"), ("google", "Google"), ("amlogic", "Amlogic"),
        ("rockchip", "Rockchip"), ("unisoc", "Unisoc"), ("hisilicon", "HiSilicon"),
        ("broadcom", "Broadcom"), ("hygon", "Hygon"), ("loongson", "Loongson"),
        ("zhaoxin", "Zhaoxin"), ("via", "VIA"), ("fujitsu", "Fujitsu"), ("ibm", "IBM"),
    ):
        if re.search(rf"\b{token}\b", low):
            return brand
    return None
