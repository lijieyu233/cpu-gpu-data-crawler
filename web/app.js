/* HWDATA — 排序 / 筛选 / 分页 / 对比 */
(() => {
  'use strict';

  const nf = new Intl.NumberFormat('en-US');
  const KINDS = ['cpu', 'gpu'];
  const MAX_CMP = 4;

  /* ── 配置 ───────────────────────────────────────────────── */

  const CFG = {
    cpu: {
      primary: 'passmark_cpu_mark',
      base: { model: 'Ryzen 5 5600', t: 'vs 5600' },
      columns: [
        { k: 'model', t: '型号', type: 'name', sticky: true, w: '234px' },
        { k: 'brand', t: '品牌', type: 'brand', w: '84px' },
        { k: 'codename', t: '核心代号', type: 'text', w: '128px' },
        { k: 'cores', t: '核心', type: 'int', num: true, w: '64px' },
        { k: 'threads', t: '线程', type: 'int', num: true, w: '64px' },
        { k: 'base_clock_ghz', t: '基础频率', u: 'GHz', type: 'dec', num: true, w: '94px' },
        { k: 'boost_clock_ghz', t: '加速频率', u: 'GHz', type: 'dec', num: true, w: '94px' },
        { k: 'socket', t: '插槽', type: 'text', w: '124px' },
        { k: 'process_nm', t: '制程', u: 'nm', type: 'int', num: true, w: '72px' },
        { k: 'l3_cache_mb', t: 'L3', u: 'MB', type: 'int', num: true, w: '76px' },
        { k: 'tdp_w', t: 'TDP', u: 'W', type: 'int', num: true, w: '68px' },
        { k: 'released_date', d: 'released', t: '发布', type: 'text', w: '110px' },
        { k: 'passmark_cpu_mark', t: 'PassMark', type: 'mark', num: true, w: '118px' },
        { k: 'vs_ratio', t: 'vs 5600', type: 'vs', num: true, w: '84px' },
        { k: 'passmark_single_thread', t: '单线程', type: 'mark', num: true, w: '94px' },
        { k: 'passmark_rank', t: '排名', type: 'rank', num: true, w: '68px' },
        { k: 'price_usd', t: '参考价', type: 'usd', num: true, w: '84px' },
      ],
      filters: [
        { k: 'brand', t: '品牌', type: 'multi' },
        { k: 'codename', t: '核心代号', type: 'multi', scroll: true },
        { k: 'socket', t: '插槽', type: 'multi', scroll: true },
        { k: 'process_nm', t: '制程 (nm)', type: 'multi' },
        { k: 'year', t: '发布年份', type: 'range', ph: ['1900', '2030'] },
        { k: 'cores', t: '核心数', type: 'range', ph: ['1', '128'] },
        { k: 'tdp_w', t: 'TDP (W)', type: 'range', ph: ['1', '500'] },
        { k: 'haspm', t: '仅显示有跑分', type: 'bool' },
      ],
      compare: [
        { k: 'brand', t: '品牌', type: 'brand' },
        { k: 'codename', t: '核心代号' },
        { k: 'socket', t: '插槽' },
        { k: 'cores', t: '核心数', better: 'high' },
        { k: 'threads', t: '线程数', better: 'high' },
        { k: 'base_clock_ghz', t: '基础频率', u: 'GHz', dec: 2, better: 'high' },
        { k: 'boost_clock_ghz', t: '加速频率', u: 'GHz', dec: 2, better: 'high' },
        { k: 'process_nm', t: '制程', u: 'nm', better: 'low' },
        { k: 'l3_cache_mb', t: 'L3 缓存', u: 'MB', better: 'high' },
        { k: 'tdp_w', t: 'TDP', u: 'W' },
        { k: 'released', t: '发布时间' },
        { k: 'passmark_cpu_mark', t: 'PassMark 多线程', int: true, better: 'high' },
        { k: 'passmark_single_thread', t: 'PassMark 单线程', int: true, better: 'high' },
        { k: 'passmark_rank', t: '全球排名', better: 'low' },
        { k: 'passmark_value', t: '性价比', dec: 2, better: 'high' },
        { k: 'price_usd', t: '参考价', usd: true },
      ],
    },
    gpu: {
      primary: 'passmark_g3d_mark',
      base: { model: 'GeForce RTX 5060', t: 'vs RTX 5060' },
      // 默认只展示常用几列，其余在「字段」面板里开启
      dftHidden: [
        'brand', 'chip', 'memory_type', 'bus_width_bit', 'bus_interface',
        'core_clock_ghz', 'memory_clock_ghz', 'shaders', 'tmus', 'rops',
        'released_date', 'fp32_tflops', 'texel_rate', 'pixel_rate',
      ],
      columns: [
        { k: 'model', t: '型号', type: 'name', sticky: true, w: '238px' },
        { k: 'brand', t: '品牌', type: 'brand', w: '84px' },
        { k: 'chip', t: '芯片', type: 'text', w: '122px' },
        { k: 'memory_gb', t: '显存', u: 'GB', type: 'dec', num: true, w: '72px' },
        { k: 'memory_type', t: '显存类型', type: 'text', w: '92px' },
        { k: 'bus_width_bit', t: '位宽', u: 'bit', type: 'int', num: true, w: '76px' },
        { k: 'bus_interface', t: '总线', type: 'text', w: '126px' },
        { k: 'core_clock_ghz', t: '核心频率', u: 'GHz', type: 'dec', num: true, w: '98px' },
        { k: 'memory_clock_ghz', t: '显存频率', u: 'GHz', type: 'dec', num: true, w: '98px' },
        { k: 'shaders', t: '着色器', type: 'int', num: true, w: '86px' },
        { k: 'tmus', t: 'TMU', type: 'int', num: true, w: '68px' },
        { k: 'rops', t: 'ROP', type: 'int', num: true, w: '68px' },
        { k: 'released_date', d: 'released', t: '发布', type: 'text', w: '110px' },
        { k: 'fp32_tflops', t: 'FP32 算力', u: 'TFLOPS', type: 'dec1', num: true, w: '106px' },
        { k: 'texel_rate', t: '纹理填充率', u: 'GTexel/s', type: 'dec1', num: true, w: '118px' },
        { k: 'pixel_rate', t: '像素填充率', u: 'GPixel/s', type: 'dec1', num: true, w: '118px' },
        { k: 'passmark_g3d_mark', t: 'G3D Mark', type: 'mark', num: true, w: '118px' },
        { k: 'vs_ratio', t: 'vs RTX 5060', type: 'vs', num: true, w: '106px' },
        { k: 'passmark_rank', t: '排名', type: 'rank', num: true, w: '68px' },
        { k: 'price_usd', t: '参考价', type: 'usd', num: true, w: '84px' },
      ],
      filters: [
        { k: 'brand', t: '品牌', type: 'multi' },
        { k: 'memory_type', t: '显存类型', type: 'multi' },
        { k: 'bus_interface', t: '总线接口', type: 'multi', scroll: true },
        { k: 'chip', t: '芯片代号', type: 'multi', scroll: true },
        { k: 'year', t: '发布年份', type: 'range', ph: ['1998', '2030'] },
        { k: 'memory_gb', t: '显存 (GB)', type: 'range', ph: ['1', '128'] },
        { k: 'bus_width_bit', t: '位宽 (bit)', type: 'range', ph: ['32', '1024'] },
        { k: 'haspm', t: '仅显示有跑分', type: 'bool' },
      ],
      compare: [
        { k: 'brand', t: '品牌', type: 'brand' },
        { k: 'chip', t: '芯片代号' },
        { k: 'bus_interface', t: '总线接口' },
        { k: 'memory_gb', t: '显存容量', u: 'GB', dec: 1, better: 'high' },
        { k: 'memory_type', t: '显存类型' },
        { k: 'bus_width_bit', t: '显存位宽', u: 'bit', better: 'high' },
        { k: 'core_clock_ghz', t: '核心频率', u: 'GHz', dec: 3, better: 'high' },
        { k: 'memory_clock_ghz', t: '显存频率', u: 'GHz', dec: 3, better: 'high' },
        { k: 'shaders', t: '着色器单元', better: 'high' },
        { k: 'tmus', t: 'TMU', better: 'high' },
        { k: 'rops', t: 'ROP', better: 'high' },
        { k: 'fp32_tflops', t: 'FP32 算力', u: 'TFLOPS', dec: 1, better: 'high' },
        { k: 'texel_rate', t: '纹理填充率', u: 'GTexel/s', dec: 1, better: 'high' },
        { k: 'pixel_rate', t: '像素填充率', u: 'GPixel/s', dec: 1, better: 'high' },
        { k: 'released', t: '发布时间' },
        { k: 'passmark_g3d_mark', t: 'PassMark G3D', int: true, better: 'high' },
        { k: 'passmark_rank', t: '全球排名', better: 'low' },
        { k: 'passmark_value', t: '性价比', dec: 2, better: 'high' },
        { k: 'price_usd', t: '参考价', usd: true },
      ],
    },
  };

  /* ── 数据准备 ───────────────────────────────────────────── */

  const DATA = { cpu: [], gpu: [] };
  const MAXMARK = { cpu: 0, gpu: 0 };
  const BASE = { cpu: null, gpu: null };

  function prepare() {
    for (const kind of KINDS) {
      const src = (window.HWDATA && window.HWDATA[kind]) || [];
      const mark = CFG[kind].primary;
      const rows = src.map((raw, i) => {
        const r = Object.assign({}, raw);
        r.__id = kind + ':' + i;
        const y = /^(\d{4})/.exec(r.released_date || '');
        r.year = y ? Number(y[1]) : null;
        r.haspm = r[mark] != null;
        // 派生指标：以加速频率换算的峰值算力 / 填充率（仅显卡）
        if (kind === 'gpu') {
          const clk = Number(r.core_clock_ghz);
          const ok = Number.isFinite(clk) && clk > 0;
          r.fp32_tflops = ok && r.shaders ? (Number(r.shaders) * 2 * clk) / 1000 : null;
          r.texel_rate = ok && r.tmus ? Number(r.tmus) * clk : null;
          r.pixel_rate = ok && r.rops ? Number(r.rops) * clk : null;
        }
        return r;
      });

      // 基准型号的跑分，用于计算 vs_ratio
      const base = CFG[kind].base;
      const ref = base ? rows.find((r) => r.model === base.model && Number(r[mark]) > 0) : null;
      BASE[kind] = ref ? Number(ref[mark]) : null;
      if (BASE[kind]) {
        for (const r of rows) {
          const v = Number(r[mark]);
          r.vs_ratio = Number.isFinite(v) && v > 0 ? (v / BASE[kind]) * 100 : null;
        }
      }

      DATA[kind] = rows;
      MAXMARK[kind] = rows.reduce((m, r) => Math.max(m, Number(r[mark]) || 0), 0);
    }
  }

  /* ── 状态 ───────────────────────────────────────────────── */

  const state = {
    kind: 'cpu',
    q: '',
    pageSize: 50,
    page: { cpu: 1, gpu: 1 },
    sel: { cpu: [], gpu: [] },
    sort: {
      cpu: { k: CFG.cpu.primary, dir: -1 },
      gpu: { k: CFG.gpu.primary, dir: -1 },
    },
    filters: { cpu: {}, gpu: {} },
    cols: { cpu: [], gpu: [] },     // 字段顺序（含被隐藏的）
    hidden: { cpu: [], gpu: [] },   // 被隐藏的字段
    widths: { cpu: {}, gpu: {} },   // 自定义列宽（px）
  };

  for (const kind of KINDS) {
    const bag = {};
    for (const d of CFG[kind].filters) {
      bag[d.k] = d.type === 'multi' ? [] : d.type === 'range' ? { min: '', max: '' } : false;
    }
    state.filters[kind] = bag;
  }

  /* ── 字段顺序 / 显隐（持久化到 localStorage） ───────────── */

  const LS_COLS = 'hwdata-cols-v2';
  const LOCKED = 'model';   // 型号列固定在最左，不可隐藏、不可拖动
  const MINW = 52;          // 列宽下限

  function defaultCols(kind) {
    return CFG[kind].columns.map((d) => d.k);
  }

  function defaultHidden(kind) {
    return (CFG[kind].dftHidden || []).slice();
  }

  function defWidth(kind, k) {
    const c = CFG[kind].columns.find((d) => d.k === k);
    const n = c && c.w ? parseInt(c.w, 10) : NaN;
    return Number.isFinite(n) ? n : 120;
  }

  function widthOf(kind, k) {
    const v = state.widths[kind][k];
    return Number.isFinite(v) && v >= MINW ? v : defWidth(kind, k);
  }

  function loadCols() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_COLS) || 'null'); } catch (_) { saved = null; }
    for (const kind of KINDS) {
      const all = defaultCols(kind);
      let order = all.slice();
      let hidden = defaultHidden(kind);
      const s = saved && saved[kind];
      if (s) {
        if (Array.isArray(s.order)) {
          const valid = s.order.filter((k) => all.indexOf(k) >= 0);
          for (const k of all) if (valid.indexOf(k) < 0) valid.push(k);   // 补齐新增字段
          order = valid;
        }
        if (Array.isArray(s.hidden)) hidden = s.hidden.filter((k) => k !== LOCKED && all.indexOf(k) >= 0);
      }
      state.cols[kind] = order;
      state.hidden[kind] = hidden;

      const w = {};
      if (s && s.widths && typeof s.widths === 'object') {
        for (const k of all) {
          const v = Number(s.widths[k]);
          if (Number.isFinite(v) && v >= MINW) w[k] = Math.round(v);
        }
      }
      state.widths[kind] = w;
    }
  }

  function saveCols() {
    try {
      localStorage.setItem(LS_COLS, JSON.stringify({
        cpu: { order: state.cols.cpu, hidden: state.hidden.cpu, widths: state.widths.cpu },
        gpu: { order: state.cols.gpu, hidden: state.hidden.gpu, widths: state.widths.gpu },
      }));
    } catch (_) { /* 隐私模式下忽略 */ }
  }

  /* 按用户顺序返回可见列定义 */
  function colsOf(kind) {
    const defs = CFG[kind].columns;
    const byKey = new Map(defs.map((d) => [d.k, d]));
    const hidden = state.hidden[kind];
    const out = [];
    const seen = new Set();

    // 型号列永远第一
    if (byKey.has(LOCKED)) { out.push(byKey.get(LOCKED)); seen.add(LOCKED); }

    for (const k of state.cols[kind]) {
      if (k === LOCKED || seen.has(k)) continue;
      const d = byKey.get(k);
      if (!d) continue;
      seen.add(k);
      if (hidden.indexOf(k) < 0) out.push(d);
    }
    for (const d of defs) {                       // 兜底：新增但未记录进 order 的列
      if (seen.has(d.k) || hidden.indexOf(d.k) >= 0) continue;
      out.push(d);
    }
    return out;
  }

  const $ = (id) => document.getElementById(id);
  // HTML 与 JS 版本不一致时节点可能缺失，绑定前判空，避免初始化中断
  const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const BRAND_COLOR = { amd: '#d9363e', nvidia: '#699c00', intel: '#0a6cb4', apple: '#6b7280' };
  function brandColor(brand) {
    const b = String(brand || '').toLowerCase();
    for (const key in BRAND_COLOR) if (b.includes(key)) return BRAND_COLOR[key];
    return 'var(--ink-3)';
  }

  function brandTag(brand) {
    if (!brand) return '—';
    return `<span class="tag" style="--bc:${brandColor(brand)}">${esc(brand)}</span>`;
  }

  function fmtCell(v, type) {
    if (v === null || v === undefined || v === '') return '<span class="na">—</span>';
    switch (type) {
      case 'brand': return brandTag(v);
      case 'int': return nf.format(v);
      case 'mark': return markCell(Number(v));
      case 'rank': return `<span class="rank${Number(v) <= 100 ? ' top' : ''}">#${nf.format(v)}</span>`;
      case 'dec': return String(Math.round(Number(v) * 1000) / 1000);
      case 'dec1': return String(Math.round(Number(v) * 10) / 10);
      case 'usd': return '$' + nf.format(Math.round(Number(v)));
      case 'vs': {
        const n = Number(v);
        const txt = String(Math.round(n * 10) / 10).replace(/\.0$/, '');
        return `<span class="vs ${n >= 100 ? 'up' : 'down'}">${txt}%</span>`;
      }
      default: return esc(v);
    }
  }

  function markCell(v) {
    if (!v) return '<span class="na">—</span>';
    const p = MAXMARK[state.kind] ? Math.min(1, v / MAXMARK[state.kind]) : 0;
    return `<span class="markbar${p >= 0.55 ? ' hi' : ''}" style="--p:${p.toFixed(3)}">${nf.format(v)}</span>`;
  }

  /* ── 过滤 / 排序 ────────────────────────────────────────── */

  function computed() {
    const kind = state.kind;
    const f = state.filters[kind];
    const q = state.q.trim().toLowerCase();
    let list = DATA[kind];

    if (q) {
      list = list.filter((r) =>
        `${r.model || ''} ${r.brand || ''} ${r.codename || r.chip || ''} ${r.socket || ''} ${r.memory_type || ''}`
          .toLowerCase().includes(q));
    }

    for (const d of CFG[kind].filters) {
      const v = f[d.k];
      if (d.type === 'multi') {
        if (v.length) list = list.filter((r) => v.indexOf(String(r[d.k])) >= 0);
      } else if (d.type === 'range') {
        const lo = v.min === '' ? null : Number(v.min);
        const hi = v.max === '' ? null : Number(v.max);
        if (lo !== null) list = list.filter((r) => r[d.k] != null && r[d.k] >= lo);
        if (hi !== null) list = list.filter((r) => r[d.k] != null && r[d.k] <= hi);
      } else if (d.type === 'bool' && v) {
        list = list.filter((r) => r.haspm);
      }
    }

    const sort = state.sort[kind];
    if (!sort) return list.slice();

    const col = CFG[kind].columns.find((c) => c.k === sort.k);
    const dir = sort.dir;
    return list.slice().sort((a, b) => {
      const x = a[sort.k];
      const y = b[sort.k];
      if (!col || !col.num) {
        const sx = x == null ? '' : String(x).toLowerCase();
        const sy = y == null ? '' : String(y).toLowerCase();
        return sx < sy ? -dir : sx > sy ? dir : 0;
      }
      const ex = x == null || x === '';
      const ey = y == null || y === '';
      if (ex && ey) return 0;
      if (ex) return 1;
      if (ey) return -1;
      return (Number(x) - Number(y)) * dir;
    });
  }

  /* ── 渲染：结果统计 / 条件标签 ──────────────────────────── */

  function renderCounts(shown) {
    $('cntShown').textContent = nf.format(shown);
    $('cntTotal').textContent = nf.format(DATA[state.kind].length);
  }

  function activeList() {
    const kind = state.kind;
    const f = state.filters[kind];
    const out = [];
    if (state.q.trim()) out.push({ k: '$q', text: `搜索: ${state.q.trim()}`, clear: () => { state.q = ''; $('q').value = ''; } });
    for (const d of CFG[kind].filters) {
      const v = f[d.k];
      if (d.type === 'multi' && v.length) {
        out.push({ k: d.k, text: `${d.t}: ${v.join(' / ')}`, clear: () => { v.length = 0; } });
      } else if (d.type === 'range' && (v.min !== '' || v.max !== '')) {
        const parts = [];
        if (v.min !== '') parts.push('≥ ' + v.min);
        if (v.max !== '') parts.push('≤ ' + v.max);
        out.push({ k: d.k, text: `${d.t} ${parts.join(' 且 ')}`, clear: () => { v.min = ''; v.max = ''; } });
      } else if (d.type === 'bool' && v) {
        out.push({ k: d.k, text: d.t, clear: () => { f[d.k] = false; } });
      }
    }
    return out;
  }

  function renderChips() {
    const list = activeList();
    $('activeChips').innerHTML = list.map((a, i) =>
      `<span class="achip">${esc(a.text)}<button data-chip="${i}" title="移除">✕</button></span>`).join('');
    $('activeChips').dataset.n = list.length;
    chipsRef = list;
  }

  let chipsRef = [];
  $('activeChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    chipsRef[Number(btn.dataset.chip)].clear();
    state.page[state.kind] = 1;
    renderAll();
  });

  /* ── 渲染：筛选面板 ─────────────────────────────────────── */

  const optCache = new Map();
  function options(kind, key) {
    const id = kind + '|' + key;
    if (optCache.has(id)) return optCache.get(id);
    const map = new Map();
    for (const r of DATA[kind]) {
      const v = r[key];
      if (v === null || v === undefined || v === '') continue;
      const s = String(v);
      map.set(s, (map.get(s) || 0) + 1);
    }
    const arr = Array.from(map.entries());
    const numeric = arr.every(([k]) => /^-?\d+(\.\d+)?$/.test(k));
    arr.sort((a, b) => (numeric ? Number(a[0]) - Number(b[0]) : b[1] - a[1] || a[0].localeCompare(b[0])));
    const cut = arr.slice(0, 150);
    optCache.set(id, cut);
    return cut;
  }

  function renderFilters() {
    const kind = state.kind;
    const f = state.filters[kind];
    const nodes = [];

    nodes.push('<div class="fgroup"><div class="fgroup-title"><span>关键词</span></div>' +
      `<input class="finline" id="fq" type="search" placeholder="型号 / 代号 / 插槽…" value="${esc(state.q)}"></div>`);

    for (const d of CFG[kind].filters) {
      const v = f[d.k];
      const on = d.type === 'multi' ? v.length > 0
        : d.type === 'range' ? (v.min !== '' || v.max !== '')
        : v;
      let body = '';

      if (d.type === 'multi') {
        body = `<div class="fopts${d.scroll ? ' scroll' : ''}">` +
          options(kind, d.k).map(([val, n]) =>
            `<button class="fopt${v.indexOf(val) >= 0 ? ' on' : ''}" data-f="${d.k}" data-v="${esc(val)}">${esc(val)}<i>${n}</i></button>`
          ).join('') + '</div>';
      } else if (d.type === 'range') {
        body = `<div class="frange">
          <input type="number" data-f="${d.k}" data-b="min" placeholder="${d.ph[0]}" value="${esc(v.min)}">
          <span>—</span>
          <input type="number" data-f="${d.k}" data-b="max" placeholder="${d.ph[1]}" value="${esc(v.max)}">
        </div>`;
      } else {
        body = `<label class="fswitch"><input type="checkbox" data-f="${d.k}"${v ? ' checked' : ''}>` +
          `<span class="track"></span><span>${d.t}</span></label>`;
      }

      nodes.push(`<div class="fgroup${on ? ' on' : ''}" data-g="${d.k}">
        <div class="fgroup-title"><span>${d.t}</span>
        <button class="fclear" data-clear="${d.k}">清除</button></div>${body}</div>`);
    }

    $('filterPanel').innerHTML = nodes.join('');
  }

  /* ── 渲染：表头 / 表体 / 分页 ───────────────────────────── */

  /* 列宽：<colgroup> 定宽，末尾加一列填充列吸收剩余宽度，保证表格铺满容器 */
  function applyWidths() {
    const kind = state.kind;
    const g = $('colgroup');
    const table = $('grid');
    const wrap = $('tablewrap');
    if (!g || !table) return;

    let sum = 0;
    const cols = colsOf(kind).map((c) => {
      const w = widthOf(kind, c.k);
      sum += w;
      return `<col style="width:${w}px">`;
    });
    cols.push('<col>');
    g.innerHTML = cols.join('');

    const avail = wrap ? wrap.clientWidth : 0;
    table.style.width = Math.max(sum, avail) + 'px';
  }

  function renderHead() {
    const kind = state.kind;
    const sort = state.sort[kind];
    const ref = BASE[kind];
    $('thead').innerHTML = '<tr>' + colsOf(kind).map((c) => {
      const sorted = sort && sort.k === c.k;
      const cls = [c.num ? 'num' : '', c.sticky ? 'sticky' : '', sorted ? 'sorted' : '', sorted && sort.dir === 1 ? 'asc' : '']
        .filter(Boolean).join(' ');
      const title = c.type === 'vs' && ref
        ? `以 ${CFG[kind].base.model}（${nf.format(ref)}）跑分为 100% · 点击排序`
        : '点击排序';
      return `<th class="${cls}" data-k="${c.k}" draggable="${c.sticky ? 'false' : 'true'}" title="${esc(title)}">
        ${esc(c.t)}${c.u ? `<span class="u">${c.u}</span>` : ''}<span class="caret"></span>` +
        `<span class="colres" draggable="false" title="拖动调整列宽"></span></th>`;
    }).join('') + '<th class="filler" aria-hidden="true"></th></tr>';
    applyWidths();
  }

  function renderBody(list) {
    const kind = state.kind;
    const cols = colsOf(kind);
    const sel = state.sel[kind];
    const pages = Math.max(1, Math.ceil(list.length / state.pageSize));
    const page = Math.min(state.page[kind], pages);
    state.page[kind] = page;
    const slice = list.slice((page - 1) * state.pageSize, page * state.pageSize);

    $('tbody').innerHTML = slice.map((r) => {
      const tds = cols.map((c) => {
        const val = c.d ? r[c.d] : r[c.k];
        if (c.type === 'name') {
          return `<td class="sticky"><div class="mcell"><span class="box"></span>
            <span class="mname">${esc(r.model)}</span>
            <a class="mlink" href="${esc(r.techpowerup_url || r.url || '#')}" target="_blank" rel="noopener" title="TechPowerUp">↗</a>
          </div></td>`;
        }
        return `<td class="${c.num ? 'num' : ''}">${fmtCell(val, c.type)}</td>`;
      }).join('') + '<td class="filler"></td>';
      return `<tr data-id="${r.__id}" class="${sel.indexOf(r.__id) >= 0 ? 'sel' : ''}">${tds}</tr>`;
    }).join('');

    $('empty').hidden = slice.length > 0;
    return page;
  }

  function renderPager(total) {
    const state_ = state;
    const pages = Math.max(1, Math.ceil(total / state_.pageSize));
    const page = Math.min(state_.page[state_.kind], pages);
    if (total === 0) { $('pager').innerHTML = ''; return; }

    const nums = [];
    const push = (n) => nums.push(`<button class="pbtn${n === page ? ' on' : ''}" data-p="${n}">${n}</button>`);
    const dot = () => nums.push('<span class="pdots">···</span>');

    const win = new Set([1, pages, page, page - 1, page + 1, page - 2, page + 2]);
    if (page <= 3) [1, 2, 3, 4, 5].forEach((n) => win.add(n));
    if (page >= pages - 2) [pages - 4, pages - 3, pages - 2, pages - 1, pages].forEach((n) => win.add(n));
    const sorted = Array.from(win).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) dot();
      push(n);
      prev = n;
    }

    $('pager').innerHTML =
      `<button class="pbtn" data-p="prev" ${page === 1 ? 'disabled' : ''}>‹</button>` +
      nums.join('') +
      `<button class="pbtn" data-p="next" ${page === pages ? 'disabled' : ''}>›</button>` +
      `<span class="pinfo">${nf.format((page - 1) * state_.pageSize + 1)}–${nf.format(Math.min(page * state_.pageSize, total))} / ${nf.format(total)}</span>`;
  }

  /* ── 渲染：分段控件 / 对比托盘 ──────────────────────────── */

  function renderSeg() {
    document.querySelectorAll('.seg-btn').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.kind === state.kind));
    });
    const active = document.querySelector('.seg-btn[aria-selected="true"]');
    const thumb = $('segThumb');
    if (active) {
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.transform = `translateX(${active.offsetLeft - 3}px)`;
    }
    $('segCpuN').textContent = nf.format(DATA.cpu.length);
    $('segGpuN').textContent = nf.format(DATA.gpu.length);
  }

  function renderTray() {
    const kind = state.kind;
    const ids = state.sel[kind];
    const tray = $('tray');
    if (!ids.length) { tray.hidden = true; return; }
    tray.hidden = false;
    const recs = ids.map((id) => DATA[kind].find((r) => r.__id === id)).filter(Boolean);
    $('trayItems').innerHTML = recs.map((r) =>
      `<span class="titem"><b>${esc(r.model)}</b><button data-un="${r.__id}" title="移除">✕</button></span>`).join('');
    $('trayGo').disabled = recs.length < 2;
    $('trayGo').textContent = recs.length < 2 ? '再选 1 款对比' : `开始对比 (${recs.length})`;
  }

  /* ── 渲染：字段面板（显隐 + 顺序） ──────────────────────── */

  function updateFieldsCount() {
    const el = $('fieldsCount');
    if (!el) return;
    const total = CFG[state.kind].columns.length;
    el.textContent = `${total - state.hidden[state.kind].length}/${total}`;
  }

  function fieldItems(kind) {
    return [LOCKED].concat(state.cols[kind].filter((k) => k !== LOCKED));
  }

  function renderFields() {
    const pop = $('fieldPop');
    if (!pop) return;
    const kind = state.kind;
    const defs = new Map(CFG[kind].columns.map((d) => [d.k, d]));
    const hidden = state.hidden[kind];

    pop.innerHTML =
      `<div class="fp-head"><span>显示字段<em>拖拽调整顺序</em></span>
         <button class="link" id="fpReset">恢复默认</button></div>
       <ul class="fp-list">` +
      fieldItems(kind).map((k) => {
        const d = defs.get(k);
        if (!d) return '';
        const locked = k === LOCKED;
        const on = locked || hidden.indexOf(k) < 0;
        return `<li class="fp-item${on ? '' : ' off'}${locked ? ' locked' : ''}" data-k="${k}" draggable="${!locked}">
          <span class="fp-handle">${locked ? '·' : '⠿'}</span>
          <input type="checkbox" data-fk="${k}"${on ? ' checked' : ''}${locked ? ' disabled' : ''}>
          <span class="fp-name">${esc(d.t)}${d.u ? `<i>${d.u}</i>` : ''}</span>
        </li>`;
      }).join('') +
      `</ul>
       <div class="fp-foot">型号列固定在最左，不可隐藏</div>`;

    updateFieldsCount();
  }

  function toggleFields(force) {
    const pop = $('fieldPop');
    if (!pop) return;
    const open = force === undefined ? pop.hidden : force;
    pop.hidden = !open;
    const btn = $('fieldsBtn');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) renderFields();
  }

  function refreshTable() {
    renderHead();
    renderBody(computed());
    updateFieldsCount();
  }

  function resetFields() {
    const kind = state.kind;
    state.cols[kind] = defaultCols(kind);
    state.hidden[kind] = defaultHidden(kind);
    state.widths[kind] = {};
    saveCols();
    renderFields();
    refreshTable();
  }

  let dragKey = null;

  on($('fieldsBtn'), 'click', (e) => {
    e.stopPropagation();
    toggleFields();
  });

  on($('fieldPop'), 'click', (e) => {
    if (e.target.closest('#fpReset')) resetFields();
  });

  on($('fieldPop'), 'change', (e) => {
    const cb = e.target.closest('[data-fk]');
    if (!cb || cb.dataset.fk === LOCKED) return;
    const k = cb.dataset.fk;
    const hidden = state.hidden[state.kind];
    const i = hidden.indexOf(k);
    if (cb.checked) { if (i >= 0) hidden.splice(i, 1); }
    else if (i < 0) hidden.push(k);
    saveCols();
    cb.closest('.fp-item').classList.toggle('off', !cb.checked);
    refreshTable();
  });

  const fpItems = () => { const pop = $('fieldPop'); return pop ? pop.querySelectorAll('.fp-item') : []; };

  on($('fieldPop'), 'dragstart', (e) => {
    const li = e.target.closest('.fp-item');
    if (!li || li.classList.contains('locked')) { e.preventDefault(); return; }
    dragKey = li.dataset.k;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragKey); } catch (_) {}
  });

  on($('fieldPop'), 'dragover', (e) => {
    if (!dragKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    fpItems().forEach((n) => n.classList.remove('over'));
    const li = e.target.closest('.fp-item');
    if (li && li.dataset.k !== dragKey && !li.classList.contains('locked')) li.classList.add('over');
  });

  on($('fieldPop'), 'drop', (e) => {
    if (!dragKey) return;
    e.preventDefault();
    const li = e.target.closest('.fp-item');
    if (!li || li.classList.contains('locked') || li.dataset.k === dragKey) return;

    const kind = state.kind;
    const order = state.cols[kind].slice();
    const from = order.indexOf(dragKey);
    const to = order.indexOf(li.dataset.k);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragKey);

    state.cols[kind] = order;
    saveCols();
    dragKey = null;
    renderFields();
    refreshTable();
  });

  on($('fieldPop'), 'dragend', () => {
    dragKey = null;
    fpItems().forEach((n) => n.classList.remove('dragging', 'over'));
  });

  // 点击面板外关闭
  document.addEventListener('click', (e) => {
    const pop = $('fieldPop');
    if (!pop || pop.hidden) return;
    if (e.target.closest('#fieldPop') || e.target.closest('#fieldsBtn')) return;
    toggleFields(false);
  });

  /* ── 对比视图 ───────────────────────────────────────────── */

  function cmpValue(row, def) {
    const v = row[def.k];
    if (v === null || v === undefined || v === '') return null;
    if (def.k === 'brand') return v;
    if (def.usd) return '$' + nf.format(Math.round(Number(v)));
    if (def.int) return nf.format(Number(v));
    if (def.dec != null) return (Number(v)).toFixed(def.dec).replace(/\.?0+$/, '') || '0';
    return String(v);
  }

  function openCompare() {
    const kind = state.kind;
    const ids = state.sel[kind];
    const recs = ids.map((id) => DATA[kind].find((r) => r.__id === id)).filter(Boolean);
    if (recs.length < 2) return;

    const primary = CFG[kind].primary;
    const max = Math.max(...recs.map((r) => Number(r[primary]) || 0)) || 1;

    const barRows = recs.map((r) => {
      const v = Number(r[primary]) || 0;
      const w = (v / max) * 100;
      return `<div class="bar-row">
        <div class="bar-name">${esc(r.model)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${w.toFixed(1)}%"></div></div>
      </div>`;
    }).join('');

    const head = recs.map((r) => `<th>
      <div class="cmp-col-head">
        <span class="cname">${esc(r.model)}</span>
        <span class="cmeta">${brandTag(r.brand)}<button class="rm" data-un="${r.__id}">移除</button></span>
      </div></th>`).join('');

    const body = CFG[kind].compare.map((def) => {
      const cells = recs.map((r) => ({ r, txt: cmpValue(r, def) }));
      let bestIdx = -1;
      if (def.better && def.k !== 'brand') {
        const nums = cells.map((c) => (c.txt === null ? null : Number(c.r[def.k])));
        const valid = nums.filter((n) => n !== null && !Number.isNaN(n));
        if (valid.length > 1) {
          const target = def.better === 'high' ? Math.max(...valid) : Math.min(...valid);
          if (valid.filter((n) => n === target).length < valid.length) bestIdx = target;
        }
      }
      const tds = cells.map((c) => {
        if (c.txt === null) return '<td class="na">—</td>';
        const isBest = bestIdx !== -1 && Number(c.r[def.k]) === bestIdx;
        return `<td class="${isBest ? 'best' : ''}">${esc(c.txt)}${def.u ? ' ' + def.u : ''}</td>`;
      }).join('');
      return `<tr><th>${esc(def.t)}${def.u ? `<small>${def.u}</small>` : ''}</th>${tds}</tr>`;
    }).join('');

    $('cmpSub').textContent = `${recs.length} 款 · ${DATA[kind].length ? '' : ''}数据来源 TechPowerUp 规格库 / PassMark 跑分榜`;
    $('cmpBody').innerHTML =
      `<div class="cmp-legend"><i></i>绿色为该项最优值（仅供参考，不同架构不可直接类比）</div>
       <div class="bars">${barRows}</div>
       <table class="cmp-table"><thead><tr><th>参数</th>${head}</tr></thead><tbody>${body}</tbody></table>`;

    $('overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    $('cmpBody').scrollTop = 0;
  }

  function closeCompare() {
    $('overlay').hidden = true;
    document.body.style.overflow = '';
  }

  /* ── 主渲染 ─────────────────────────────────────────────── */

  function renderAll() {
    const list = computed();
    renderCounts(list.length);
    renderChips();
    renderHead();
    renderBody(list);
    renderPager(list.length);
    renderSeg();
    renderTray();
    renderFilters();
    const fp = $('fieldPop');
    if (fp && !fp.hidden) renderFields(); else updateFieldsCount();
  }

  /* ── 交互 ───────────────────────────────────────────────── */

  let timer = null;
  const lazy = (fn, ms = 140) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  // 分类切换
  document.querySelectorAll('.seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.kind === b.dataset.kind) return;
      state.kind = b.dataset.kind;
      renderAll();
    });
  });

  // 全局搜索
  $('q').addEventListener('input', (e) => {
    state.q = e.target.value;
    state.page[state.kind] = 1;
    const panel = document.getElementById('fq');
    if (panel) panel.value = state.q;
    lazy(() => {
      const list = computed();
      renderCounts(list.length);
      renderChips();
      renderBody(list);
      renderPager(list.length);
    });
  });

  // 表头排序
  $('thead').addEventListener('click', (e) => {
    if (e.target.closest('.colres') || colDragging) return;   // 调宽 / 拖动排序时不触发排序
    const th = e.target.closest('th[data-k]');
    if (!th) return;
    const k = th.dataset.k;
    const cur = state.sort[state.kind];
    if (cur && cur.k === k) cur.dir = -cur.dir;
    else state.sort[state.kind] = { k, dir: (CFG[state.kind].columns.find((c) => c.k === k) || {}).num ? -1 : 1 };
    state.page[state.kind] = 1;
    renderAll();
  });

  // 表头拖动排序
  let dragCol = null;
  let colDragging = false;

  function moveColumn(from, to) {
    const kind = state.kind;
    const order = state.cols[kind].slice();
    const i = order.indexOf(from);
    const j = order.indexOf(to);
    if (i < 0 || j < 0 || i === j) return;
    order.splice(i, 1);
    order.splice(j, 0, from);
    state.cols[kind] = order;
    saveCols();
    refreshTable();
  }

  const headThs = (sel) => $('thead').querySelectorAll(sel || 'th[data-k]');

  on($('thead'), 'dragstart', (e) => {
    const th = e.target.closest('th[data-k]');
    if (resizing || !th || th.classList.contains('sticky') || e.target.closest('.colres')) {
      e.preventDefault();
      return;
    }
    dragCol = th.dataset.k;
    colDragging = true;
    th.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragCol); } catch (_) {}
  });

  on($('thead'), 'dragover', (e) => {
    if (!dragCol) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    headThs().forEach((n) => n.classList.remove('over'));
    const th = e.target.closest('th[data-k]');
    if (th && !th.classList.contains('sticky') && th.dataset.k !== dragCol) th.classList.add('over');
  });

  on($('thead'), 'drop', (e) => {
    if (!dragCol) return;
    e.preventDefault();
    const th = e.target.closest('th[data-k]');
    if (th && !th.classList.contains('sticky')) moveColumn(dragCol, th.dataset.k);
    dragCol = null;
  });

  on($('thead'), 'dragend', () => {
    dragCol = null;
    headThs('th').forEach((n) => n.classList.remove('dragging', 'over'));
    setTimeout(() => { colDragging = false; }, 0);
  });

  // 拖动表头右边缘调整列宽
  let resizing = null;

  on($('thead'), 'mousedown', (e) => {
    const h = e.target.closest('.colres');
    if (!h || e.button !== 0) return;
    const th = h.closest('th[data-k]');
    if (!th) return;
    e.preventDefault();
    e.stopPropagation();
    const w0 = th.getBoundingClientRect().width;
    resizing = { kind: state.kind, k: th.dataset.k, x: e.clientX, w0, w: Math.round(w0) };
    document.body.classList.add('col-resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const w = Math.max(MINW, Math.round(resizing.w0 + (e.clientX - resizing.x)));
    if (w === resizing.w) return;
    resizing.w = w;
    state.widths[resizing.kind][resizing.k] = w;
    applyWidths();
  });

  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    document.body.classList.remove('col-resizing');
    resizing = null;
    saveCols();
  });

  window.addEventListener('resize', () => { applyWidths(); });

  // 行选择
  $('tbody').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const kind = state.kind;
    const ids = state.sel[kind];
    const id = tr.dataset.id;
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
    else {
      if (ids.length >= MAX_CMP) { flashTray(); return; }
      ids.push(id);
    }
    tr.classList.toggle('sel', i < 0);
    renderTray();
  });

  function flashTray() {
    const tray = $('tray');
    tray.classList.remove('shake');
    void tray.offsetWidth;
    tray.classList.add('shake');
  }

  // 分页
  $('pager').addEventListener('click', (e) => {
    const btn = e.target.closest('.pbtn');
    if (!btn || btn.disabled) return;
    const total = computed().length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    const p = btn.dataset.p;
    if (p === 'prev') state.page[state.kind] = Math.max(1, state.page[state.kind] - 1);
    else if (p === 'next') state.page[state.kind] = Math.min(pages, state.page[state.kind] + 1);
    else state.page[state.kind] = Number(p);
    const list = computed();
    renderBody(list);
    renderPager(list.length);
    $('tablewrap').scrollTop = 0;
  });

  // 每页条数
  $('pageSize').addEventListener('change', (e) => {
    state.pageSize = Number(e.target.value);
    state.page[state.kind] = 1;
    const list = computed();
    renderBody(list);
    renderPager(list.length);
  });

  // 筛选面板
  $('filterPanel').addEventListener('click', (e) => {
    const clear = e.target.closest('[data-clear]');
    if (clear) {
      const k = clear.dataset.clear;
      const d = CFG[state.kind].filters.find((x) => x.k === k);
      state.filters[state.kind][k] = d.type === 'multi' ? [] : d.type === 'range' ? { min: '', max: '' } : false;
      state.page[state.kind] = 1;
      renderAll();
      return;
    }
    const opt = e.target.closest('.fopt');
    if (opt) {
      const arr = state.filters[state.kind][opt.dataset.f];
      const i = arr.indexOf(opt.dataset.v);
      if (i >= 0) arr.splice(i, 1); else arr.push(opt.dataset.v);
      state.page[state.kind] = 1;
      opt.classList.toggle('on', i < 0);
      applyList();
      syncGroups();
    }
  });

  $('filterPanel').addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'fq') {
      state.q = el.value;
      $('q').value = el.value;
      state.page[state.kind] = 1;
      lazy(applyList);
      return;
    }
    if (el.type === 'checkbox' && el.dataset.f) {
      state.filters[state.kind][el.dataset.f] = el.checked;
      state.page[state.kind] = 1;
      applyList();
      syncGroups();
      return;
    }
    if (el.dataset.f && el.dataset.b) {
      state.filters[state.kind][el.dataset.f][el.dataset.b] = el.value;
      state.page[state.kind] = 1;
      lazy(() => { applyList(); syncGroups(); });
    }
  });

  /* 只刷新结果区，避免重建筛选面板导致输入框失焦 */
  function applyList() {
    const list = computed();
    renderCounts(list.length);
    renderChips();
    renderBody(list);
    renderPager(list.length);
  }

  function syncGroups() {
    const f = state.filters[state.kind];
    document.querySelectorAll('#filterPanel .fgroup[data-g]').forEach((g) => {
      const v = f[g.dataset.g];
      const on = Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? v.min !== '' || v.max !== '' : !!v;
      g.classList.toggle('on', on);
    });
  }

  // 重置
  $('resetBtn').addEventListener('click', resetAll);
  $('clearFilters').addEventListener('click', resetAll);
  function resetAll() {
    state.q = '';
    $('q').value = '';
    const bag = {};
    for (const d of CFG[state.kind].filters) {
      bag[d.k] = d.type === 'multi' ? [] : d.type === 'range' ? { min: '', max: '' } : false;
    }
    state.filters[state.kind] = bag;
    state.page[state.kind] = 1;
    renderAll();
  }

  // 对比托盘
  $('trayItems').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-un]');
    if (!btn) return;
    removeSel(btn.dataset.un);
  });
  $('trayClear').addEventListener('click', () => {
    state.sel[state.kind] = [];
    renderBody(computed());
    renderTray();
  });
  $('trayGo').addEventListener('click', openCompare);

  $('cmpBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-un]');
    if (!btn) return;
    removeSel(btn.dataset.un);
    if (state.sel[state.kind].length < 2) closeCompare(); else openCompare();
  });

  function removeSel(id) {
    const kind = state.kind;
    const i = state.sel[kind].indexOf(id);
    if (i >= 0) state.sel[kind].splice(i, 1);
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) tr.classList.remove('sel');
    renderTray();
  }

  $('cmpClose').addEventListener('click', closeCompare);
  $('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeCompare(); });

  // 主题
  const themeBtn = $('themeBtn');
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hwdata-theme', t); } catch (_) {}
  }
  themeBtn.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // 键盘
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const fp = $('fieldPop');
      if (fp && !fp.hidden) toggleFields(false);
      else if (!$('overlay').hidden) closeCompare();
      else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input' && tag !== 'select') {
      e.preventDefault();
      $('q').focus();
      $('q').select();
    }
  });

  /* ── 启动 ───────────────────────────────────────────────── */

  function boot() {
    const bootEl = $('boot');
    if (!window.HWDATA || !window.HWDATA.cpu) {
      bootEl.textContent = '未找到数据文件 web/data/cpu.js\n请在项目根目录运行：python web/build_data.py';
      return;
    }
    try {
      setTheme((() => { try { return localStorage.getItem('hwdata-theme'); } catch (_) { return null; } })()
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      prepare();
      loadCols();
      renderAll();
      requestAnimationFrame(() => { renderSeg(); bootEl.hidden = true; });
    } catch (err) {
      bootEl.textContent = '初始化失败：' + err.message;
      console.error(err);
    }
  }

  boot();
})();