#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 src 目录打包成单文件 HTML（CSS、脚本、数据、图片全部内联）

用法：
    python tools/build_single_html.py src out/app.html
"""
import base64
import os
import sys

SCRIPT_ORDER = [
    'js/data-bundled.js',
    'js/storage.js',
    'js/auth.js',
    'js/memory.js',
    'js/watermark.js',
    'js/questionnaire.js',
    'js/agent.js',
    'js/report.js',
    'js/app.js',
]

IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')


def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    mime = 'image/png' if ext == '.png' else 'image/jpeg'
    with open(path, 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode('ascii'))


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'src'
    out = sys.argv[2] if len(sys.argv) > 2 else 'out/app.html'

    with open(os.path.join(src, 'css', 'main.css'), encoding='utf-8') as f:
        css = f.read()

    scripts = []
    for rel in SCRIPT_ORDER:
        p = os.path.join(src, rel.replace('/', os.sep))
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                scripts.append(f.read())

    images = {}
    by_name = {}
    assets_dir = os.path.join(src, 'assets')
    for root, dirs, files in os.walk(assets_dir):
        for f in files:
            if f.lower().endswith(IMAGE_EXTS):
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src).replace('\\', '/')
                uri = data_uri(full)
                images[rel] = uri
                by_name[f] = uri

    joined = '\n'.join(scripts)
    # 1) 源码中的完整相对路径 → 内联图片
    for rel, uri in images.items():
        joined = joined.replace(rel, uri)

    # 2) 风险图标按文件名查找（数据里只存文件名）
    img_map_js = ',\n'.join('  "%s": "%s"' % (k, v) for k, v in by_name.items())
    prefix = "/* 单文件版：内联图片映射 */\nwindow.__IMG__ = {\n%s\n};\n" % img_map_js
    suffix = """
/* 单文件版：风险图标改为内联图片（在所有模块加载后覆盖） */
try {
  Report.characterImage = function (risk) {
    var name = (risk && risk.characterImage) ? risk.characterImage : 'assistant.jpg';
    return window.__IMG__[name] || window.__IMG__['assistant.jpg'] || '';
  };
} catch (e) { /* ignore */ }
"""
    joined = prefix + '\n' + joined + '\n' + suffix

    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="author" content="羽织梦" />
<meta name="copyright" content="(C) 2026 羽织梦 版权所有" />
<title>OPC 风险筛查</title>
<style>
%s
</style>
</head>
<body>
<div id="app"></div>
<script>
/* 单文件运行时兜底：本地数据与本地存储 */
(function () {
  try { window.localStorage.setItem('__probe__', '1'); window.localStorage.removeItem('__probe__'); }
  catch (e) {
    var mem = new Map();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: function (k) { return mem.has(String(k)) ? mem.get(String(k)) : null; },
        setItem: function (k, v) { mem.set(String(k), String(v)); },
        removeItem: function (k) { mem.delete(String(k)); },
        clear: function () { mem.clear(); },
        key: function (i) { return Array.from(mem.keys())[i] || null; },
        get length() { return mem.size; }
      }
    });
  }
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, options) {
    try {
      var name = String(url).split('?')[0].split('/').pop();
      var d = window.__EMBEDDED_DATA__;
      var map = d ? { 'risk-types.json': d.riskTypes, 'initial-questionnaire.json': d.initialQuestionnaire, 'knowledge-base.json': d.knowledgeBase } : {};
      if (map[name]) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(map[name]); } });
      }
    } catch (e) { /* fallthrough */ }
    if (nativeFetch) return nativeFetch(url, options);
    return Promise.reject(new Error('fetch unavailable'));
  };
})();
</script>
<script>
%s
</script>
</body>
</html>
""" % (css, joined)

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('built %s (%.1f KB)' % (out, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
