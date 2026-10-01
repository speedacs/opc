/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
/* 羽织梦 · 以梦化羽｜本文件包含软件的版权水印与数字签名信息，请勿删除 */
// ============ 水印 / 版权签名模块 ============
// 归属：羽织梦　签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽
// 作用：在软件与代码中植入可追溯的版权标记，用于版权登记与防止冒名。

const Watermark = {
  author: '羽织梦',
  authorLatin: 'YUZHIMENG',
  motto: '羽织梦，以梦化羽；所织皆梦，所梦皆羽',
  mottoShort: '以梦化羽 · 所织皆梦，所梦皆羽',
  appName: 'OPC 风险筛查',
  appVersion: '3.7',
  copyright: '© 2026 羽织梦 版权所有',
  image: 'assets/watermark_small.png',
  markId: 'YZM-OPC-2026',

  // 零宽字符表（用于不可见隐写）
  _zw: { 0: '\u200b', 1: '\u200c' },

  // 把任意文字编码成一串不可见的零宽字符
  encode(text) {
    const src = this.author + '|' + this.motto + '|' + (text || '');
    let out = '';
    for (let i = 0; i < src.length; i++) {
      const code = src.charCodeAt(i);
      for (let b = 15; b >= 0; b--) {
        out += ((code >> b) & 1) ? this._zw[1] : this._zw[0];
      }
    }
    return out;
  },

  // 从零宽字符还原文字
  decode(str) {
    if (!str) return '';
    const bits = [];
    for (let i = 0; i < str.length; i++) {
      if (str[i] === this._zw[0]) bits.push(0);
      else if (str[i] === this._zw[1]) bits.push(1);
    }
    let out = '';
    for (let i = 0; i + 16 <= bits.length; i += 16) {
      let code = 0;
      for (let b = 0; b < 16; b++) code = (code << 1) | bits[i + b];
      out += String.fromCharCode(code);
    }
    return out;
  },

  // 不可见指纹（写入 DOM / 数据文件）
  fingerprint(tag) {
    return this.encode(tag || 'main');
  },

  // 溯源信息（写入报告与导出数据）
  provenance(extra) {
    return {
      author: this.author,
      authorLatin: this.authorLatin,
      motto: this.motto,
      markId: this.markId,
      app: this.appName + ' v' + this.appVersion,
      issuedAt: Date.now(),
      extra: extra || null
    };
  },

  // 初始化：写入元信息、隐藏标记、控制台署名、界面淡水印
  init() {
    try {
      this._injectMeta();
      this._injectHiddenMark();
      this._injectLayer();
      this._signConsole();
    } catch (e) {
      console.warn('[Watermark] init skipped:', e.message);
    }
  },

  _injectMeta() {
    const head = document.head;
    if (!head || head.querySelector('meta[name="author"][data-yzm]')) return;
    const metas = [
      ['author', this.author],
      ['copyright', this.copyright],
      ['description', this.appName + ' v' + this.appVersion + ' · ' + this.mottoShort],
      ['generator', 'YZM-' + this.appVersion]
    ];
    metas.forEach(function(pair) {
      const m = document.createElement('meta');
      m.setAttribute('name', pair[0]);
      m.setAttribute('content', pair[1]);
      m.setAttribute('data-yzm', '1');
      head.appendChild(m);
    });
  },

  // 隐藏节点：承载零宽指纹与署名属性（不显示、不可选）
  _injectHiddenMark() {
    if (document.getElementById('yzm-mark')) return;
    const el = document.createElement('div');
    el.id = 'yzm-mark';
    el.setAttribute('data-author', this.author);
    el.setAttribute('data-motto', this.motto);
    el.setAttribute('data-mark', this.markId);
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    el.textContent = this.fingerprint('dom');
    document.body.appendChild(el);
  },

  // 界面淡水印：右下角极低透明度，不影响阅读与操作
  _injectLayer() {
    if (document.getElementById('yzm-layer')) return;
    const layer = document.createElement('div');
    layer.id = 'yzm-layer';
    layer.className = 'wm-layer';
    layer.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = this.image;
    img.alt = '';
    img.onerror = function () { layer.style.display = 'none'; };
    layer.appendChild(img);
    document.body.appendChild(layer);
  },

  _signConsole() {
    if (this._signed) return;
    this._signed = true;
    const style = 'color:#4F6EF7;font-weight:bold;';
    try {
      console.log('%c' + this.appName + ' v' + this.appVersion + '  ' + this.copyright, style);
      console.log('%c' + this.motto, 'color:#8B5CF6;');
      console.log('%cmark: ' + this.markId, 'color:#98A1B5;font-size:11px;');
    } catch (e) { /* ignore */ }
  },

  // 在页面中插入一小行署名（用于报告页/关于页）
  inlineHtml() {
    return '<div class="wm-inline"><img src="' + this.image + '" alt="" onerror="this.style.display=\'none\';" />' +
      '<span>' + this.author + ' · ' + this.mottoShort + '</span></div>';
  },

  // 校验软件中的版权标记（用于版权存证 / 被冒用时取证）
  verify() {
    const result = {
      author: this.author,
      motto: this.motto,
      markId: this.markId,
      appVersion: this.appVersion,
      checks: {}
    };
    try {
      const mark = document.getElementById('yzm-mark');
      result.checks.hiddenNode = !!mark;
      result.checks.hiddenDecoded = mark ? this.decode(mark.textContent).indexOf(this.author) >= 0 : false;
      result.checks.watermarkLayer = !!document.getElementById('yzm-layer');
      result.checks.metaAuthor = !!document.querySelector('meta[name="author"][content="' + this.author + '"]');
      const html = document.documentElement.outerHTML;
      result.checks.zeroWidthInDom = html.indexOf(this._zw[1]) >= 0;
    } catch (e) {
      result.checks.error = e.message;
    }
    result.passed = Object.keys(result.checks).every(function(k) { return result.checks[k] === true; });
    return result;
  }
};

Watermark._sig = '​‌‌‌‌‌‌‌‌​‌‌‌‌​‌​‌‌‌‌‌‌​‌‌​​​‌‌‌​‌‌​‌​​​‌​‌​​‌‌​​​​​​​​​​‌‌‌‌‌​​​‌​​‌‌‌​‌‌‌​​‌​‌​‌‌​‌​​​‌​‌​​‌‌​​‌​‌​​‌‌​​​‌​‌‌​​‌‌‌‌‌‌‌‌​‌‌‌‌​‌‌‌‌‌‌‌‌‌​​​‌‌​‌‌​‌‌​​​‌​​‌​​​​​​​‌‌‌‌‌‌​‌‌​​​‌‌‌​‌‌‌​‌‌​‌​​​​‌‌​​‌‌​‌​​​‌​‌​​‌‌​‌‌‌‌‌‌‌‌​​​​‌‌​​​‌‌​​​‌​​‌​​​​​​​‌‌​‌​​​‌​‌​​‌‌​​‌‌‌​‌‌​‌​​​​‌‌​​‌‌‌‌‌‌‌‌​‌‌‌‌​‌';  // 隐藏签名（零宽字符，肉眼不可见）

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Watermark;
} else {
  window.Watermark = Watermark;
}
