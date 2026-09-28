# CPU / GPU 硬件参数与跑分采集

从两个大型硬件数据站抓取 CPU、GPU 的规格与跑分，按型号名归一化后合并，输出 CSV / JSON。

## 数据来源

| 站点 | 采集内容 | 接口 |
| --- | --- | --- |
| TechPowerUp 规格库 | 品牌、型号、代号、核心数/线程数、频率、插槽、工艺、L3 缓存、TDP、发布时间、显存规格、着色器/TMU/ROP 数量 | `/{cpu,gpu}-specs/?p=N&ajax`（返回 JSON，内含 HTML 片段） |
| PassMark 跑分榜 | CPU Mark、单线程得分、G3D Mark、全球排名、性价比、参考价（美元） | `cpu_list.php`、`high_end_cpus.html`、`mid_range_cpus.html`、`common_cpus.html`、`singleThread.html` 及对应 GPU 页面 |

TechPowerUp 的详情页和 Geekbench 均有反爬校验，本项目只使用可稳定获取的列表页数据。

## 输出

| 文件 | 条数 | 说明 |
| --- | --- | --- |
| `out/cpu.csv` / `out/cpu.json` | 4483 | TechPowerUp 全量 CPU |
| `out/gpu.csv` / `out/gpu.json` | 3384 | TechPowerUp 全量 GPU |

CSV 为 UTF-8 BOM 编码，可直接用 Excel 打开；JSON 额外带 `generated_at`、`count`、`columns` 元信息。

### 字段

CPU：`brand` 品牌、`model` 型号、`codename` 核心代号、`cores` 核心数、`threads` 线程数、`base_clock_ghz` 基础频率、`boost_clock_ghz` 加速频率、`socket` 插槽、`process_nm` 制程(nm)、`l3_cache_mb` 三级缓存(MB)、`tdp_w` 功耗(W)、`released` 发布日期原文、`released_date` 发布日期(ISO)、`passmark_cpu_mark` PassMark 多线程分、`passmark_single_thread` 单线程分、`passmark_rank` 全球排名、`passmark_value` 性价比、`price_usd` 参考价、`techpowerup_url`、`passmark_url`、`match_key` 匹配键。

GPU：`brand`、`model`、`chip` 芯片代号、`memory_gb` 显存容量、`memory_type` 显存类型、`bus_width_bit` 位宽、`bus_interface` 总线接口、`core_clock_ghz` 核心频率、`memory_clock_ghz` 显存频率、`shaders` 着色器数、`tmus`、`rops`、`released` / `released_date`，以及同上的 PassMark 字段（跑分为 `passmark_g3d_mark`）。

## 使用

```bash
pip install -r requirements.txt
python crawl.py                # 全量抓取 CPU + GPU
python crawl.py --only cpu     # 只抓 CPU
python crawl.py --max-pages 3  # 只抓前 3 页（调试）
python crawl.py --no-cache     # 忽略缓存重新抓取
```

请求默认间隔 1.3 秒，被限流（HTTP 429）时按 `Retry-After` 或指数退避自动重试。
响应原文缓存在 `.cache/`，重复运行不会重复请求网站。

## 匹配率与已知限制

- CPU 4483 条中 2495 条（55.7%）匹配到 PassMark 跑分；GPU 3384 条中 1428 条（42.2%）匹配到 G3D 跑分。
- 未匹配的主要是三类：PassMark 尚未收录的 2025/2026 年新卡（如 RTX 50 系移动版）、主机/嵌入式等非零售型号（Playstation 5 GPU、Switch 2 GPU）、以及两站写法不同的老型号（如 TechPowerUp 的 `Radeon RX 570` 在 PassMark 中合并为 `Radeon RX 470/570`）。匹配失败的记录跑分字段为空，其余规格仍然完整。
- 型号匹配采用归一化全等匹配（去厂商前缀、`@ 频率` 后缀、显存规格前缀后比对），未使用模糊匹配，宁缺勿错。
- GPU 列表页不提供 TDP、制程、加速频率，因此这些字段未纳入 GPU 输出。
- 核显的显存为 `System Shared`，容量字段留空。

## 可视化界面

`web/` 是一个纯静态的参数浏览页，支持按任意列排序、多条件筛选、分页，以及最多 4 个型号的横向参数对比（自动标出每项最优值并给出跑分条形图）。显卡页额外提供由规格换算的 FP32 算力、纹理填充率与像素填充率（着色器/TMU/ROP × 加速频率）。

```bash
python web/build_data.py      # 把 out/*.json 精简后转成 web/data/*.js
```

浏览器打开 `file://` 时无法 fetch 本地 JSON，所以这里把数据打包成可直接 `<script>` 加载的 JS 文件。生成后直接双击 `web/index.html` 即可使用；数据更新后重新执行一次即可。

### 在线版

部署在腾讯云服务器：<http://134.175.67.86:8090/>（`nginx:alpine` 容器，容器名 `hwdata`，配置见 `deploy/`）。

```bash
# 首次部署 / 更新页面
scp -i ~/.ssh/id_ed25519 web/index.html web/style.css web/app.js ubuntu@134.175.67.86:/data/docker/hwdata/html/
scp -i ~/.ssh/id_ed25519 web/data/*.js ubuntu@134.175.67.86:/data/docker/hwdata/html/data/
```

## 结构

```
common.py     HTTP 抓取（限速/重试/缓存）、型号名归一化、数值解析
tpu.py        TechPowerUp 列表采集与字段整理
passmark.py   PassMark 各榜单采集与合并
crawl.py      调度入口：抓取 → 合并 → 导出
web/          纯静态浏览界面（index.html / style.css / app.js）+ 数据打包脚本
```
