/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 报告工具 v3 ============
const Report = {
  loadLatest() { return Storage.getLatestReport(); },
  loadHistory() { return Storage.getReportsHistory(); },

  levelText(level) {
    return { high: '高风险', medium: '预警', low: '关注', info: '低风险' }[level] || '未知';
  },

  levelColor(level) {
    return { high: '#F56C6C', medium: '#E6A23C', low: '#3BB273', info: '#909399' }[level] || '#909399';
  },

  levelTag(level) {
    return '<span class="tag tag-' + level + '">' + this.levelText(level) + '</span>';
  },

  categoryTag(categoryId) {
    if (categoryId === 'internal') return '<span class="tag tag-internal">内源风险</span>';
    if (categoryId === 'external') return '<span class="tag tag-external">外源风险</span>';
    return '';
  },

  characterImage(risk) {
    const imgPath = 'assets/characters/' + (risk.characterImage || 'assistant.jpg');
    return imgPath;
  },

  renderCharacter(risk, size) {
    const s = size || 56;
    const placeholder = risk.characterImagePlaceholder || '🧑';
    const src = this.characterImage(risk);
    return '<div class="character-frame" style="width:' + s + 'px;height:' + s + 'px;font-size:' + (s / 2) + 'px;">' +
      '<img src="' + src + '" alt="' + (risk.name || '') + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + placeholder + '\';" />' +
      '</div>';
  },

  // ============ 完整报告 ============
  renderReport(report) {
    if (!report) {
      return '<div class="empty">' +
        '<div class="empty-icon">📋</div>' +
        '<div class="empty-text">还没有完成风险评估</div>' +
        '<div style="margin-top:var(--sp-4);"><button class="btn btn-primary" onclick="App.goToQuestionnaire()">开始评估</button></div>' +
        '</div>';
    }

    const summary = report.summary || {};
    const score = summary.overallScore !== undefined ? summary.overallScore : 0;
    const level = summary.overallLevel || 'info';
    const levelColor = this.levelColor(level);
    const type = summary.overallType || '';
    const topRisks = report.topRisks || [];
    const sortedRisks = report.sortedRisks || [];
    const diagnosis = summary.diagnosisFactors || [];

    let html = '';
    html += '<div class="report-score-card">';
    html += '<div class="score-ring" style="--score:' + score + ';--score-color:' + levelColor + ';">';
    html += '<div class="score-ring-inner">';
    html += '<div class="score-ring-num">' + score + '</div>';
    html += '<div class="score-ring-label">综合风险分</div>';
    html += '</div></div>';
    html += '<div class="report-level" style="color:' + levelColor + ';">' + this.levelText(level) + '</div>';
    html += '<div class="report-desc">' + this._levelDescription(level) + '</div>';
    if (type) {
      html += '<div class="report-type">🧬 ' + type + '</div>';
    }
    html += '<div style="font-size:var(--fs-xs);color:var(--text-3);margin-top:var(--sp-3);">基于 ' + (summary.answeredCount || 0) + ' 题风险问卷 · ' + new Date(report.generatedAt).toLocaleDateString('zh-CN') + '</div>';
    html += '</div>';

    // 预警横幅
    if (level === 'high' || level === 'medium') {
      html += '<div class="review-note" style="border-style:solid;background:#FFF5F5;border-color:rgba(245,108,108,0.35);">';
      html += '<div class="review-note-title" style="color:#E5484D;">⚠️ 风险预警</div>';
      html += '<div class="review-note-text">您当前已处于' + this.levelText(level) + '状态，建议优先处理下方「治理行动清单」，并在 30 天后复测。</div>';
      html += '</div>';
    }

    // 核心诊断依据
    if (diagnosis.length > 0) {
      html += '<div class="report-section"><div class="card card-pad">';
      html += '<div class="card-title">🔬 核心诊断依据</div>';
      html += '<div class="card-sub" style="margin-bottom:var(--sp-3);">当前命中的关键关联因素（非风险根因）</div>';
      diagnosis.forEach(function(f) {
        const c = f.level === 'high' ? '#F56C6C' : (f.level === 'medium' ? '#E6A23C' : '#909399');
        html += '<div style="display:flex;align-items:center;gap:var(--sp-3);padding:8px 0;border-bottom:1px solid var(--border);">';
        html += '<div style="font-size:var(--fs-sm);color:' + c + ';font-weight:700;min-width:72px;">' + f.label + '</div>';
        html += '<div style="flex:1;font-size:var(--fs-sm);color:var(--text-1);">' + f.value + '</div>';
        html += '<div style="font-size:var(--fs-xs);color:' + c + ';font-weight:600;">' + (f.level === 'high' ? '高' : f.level === 'medium' ? '中' : '低') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // 雷达图
    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">📡 风险维度画像</div>';
    html += '<div class="card-sub">8 大风险类的得分分布（0-100）</div>';
    html += '<div class="radar-wrap"><canvas id="radar-canvas" width="640" height="520"></canvas></div>';
    html += '</div></div>';

    // TOP 风险
    if (topRisks.length > 0) {
      html += '<div class="report-section"><div class="card card-pad">';
      html += '<div class="card-title">🎯 TOP 风险</div>';
      html += '<div class="card-sub" style="margin-bottom:var(--sp-2);">您最需要优先治理的风险领域</div>';
      topRisks.slice(0, 5).forEach(function(r, idx) {
        const rank = idx + 1;
        const pct = r.percent !== undefined ? r.percent : 0;
        html += '<div class="top-risk-row">';
        html += '<div class="top-risk-rank r' + rank + '">' + rank + '</div>';
        html += this.renderCharacter(r, 46);
        html += '<div style="flex:1;min-width:0;">';
        html += '<div class="top-risk-name">' + r.name + '</div>';
        html += '<div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%;background:' + this.levelColor(r.level) + ';"></div></div>';
        html += '</div>';
        html += '<div class="top-risk-score" style="color:' + this.levelColor(r.level) + ';">' + pct + '</div>';
        html += '</div>';
      }.bind(this));
      html += '</div></div>';
    }

    // 详细风险分析（可展开）
    html += '<div class="report-section"><div class="section-title">📖 风险详细分析</div>';
    sortedRisks.forEach(function(risk) {
      html += this.renderRiskCard(risk);
    }.bind(this));
    html += '</div>';

    // 治理行动清单（汇总）
    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">✅ 治理行动清单</div>';
    html += '<div class="card-sub" style="margin-bottom:var(--sp-3);">按「立即—7 日—中长期」输出可执行事项</div>';
    html += '<div class="action-list">';
    html += this._renderGovernanceSummary(sortedRisks);
    html += '</div>';
    html += '</div></div>';

    // 外部专业支持
    const supportSet = new Set();
    sortedRisks.slice(0, 3).forEach(function(r) {
      (r.externalSupport || []).forEach(function(s) { supportSet.add(s); });
    });
    if (supportSet.size > 0) {
      html += '<div class="report-section"><div class="card card-pad">';
      html += '<div class="card-title">🛠️ 建议的外部专业支持</div>';
      html += '<div style="margin-top:var(--sp-2);">';
      supportSet.forEach(function(s) {
        html += '<span class="support-chip">' + s + '</span>';
      });
      html += '</div></div></div>';
    }

    // 复盘提醒
    const reviewDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    html += '<div class="review-note">';
    html += '<div class="review-note-title">🔄 下次复盘：' + reviewDate.getMonth() + '月' + reviewDate.getDate() + '日</div>';
    html += '<div class="review-note-text">治理措施执行一段时间后建议复测，系统会自动对比历史风险变化，形成动态风险档案。</div>';
    html += '</div>';

    html += '<div class="disclaimer">⚠️ 说明：本报告为感知风险测评，反映您对风险压力的主观感知与结构化认识，并非客观损失概率，不能作为实际发生损失或违约风险的预测值。高风险结论建议经专业人士复核后再执行重大处置。</div>';

    // 版权署名（羽织梦 · 以梦化羽）
    if (window.Watermark) {
      html += '<div style="padding:0 var(--sp-4);">' + Watermark.inlineHtml() + '</div>';
    }

    // 底部操作
    html += '<div style="padding:0 var(--sp-4) var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3);">';
    html += '<button class="btn btn-primary btn-block" onclick="App.startAgent()">💬 与 AI 助手深度访谈</button>';
    html += '<button class="btn btn-outline btn-block" onclick="App.archiveAndReset()">📥 完成评估并归档</button>';
    html += '<button class="btn btn-ghost btn-block" onclick="App.retakeQuestionnaire()">🔄 重新评估</button>';
    html += '</div>';

    return html;
  },

  _levelDescription(level) {
    return {
      high: '多项风险并发，可能影响经营连续性，建议立即启动治理并寻求外部专业支持。',
      medium: '关键风险已达到需要处理的程度，建议优先处理相关风险并加强关注。',
      low: '个别维度出现值得注意的信号，建议针对性改善并持续关注。',
      info: '整体风险处于可接受范围，建议常规监测并按周期复测。'
    }[level] || '';
  },

  _renderGovernanceSummary(sortedRisks) {
    const immediate = [];
    const seven = [];
    const long = [];
    sortedRisks.slice(0, 3).forEach(function(r) {
      if (r.governance) {
        (r.governance.immediate || []).forEach(function(t) { immediate.push('【' + r.shortName + '】' + t); });
        (r.governance.sevenDay || []).forEach(function(t) { seven.push('【' + r.shortName + '】' + t); });
        (r.governance.longTerm || []).forEach(function(t) { long.push('【' + r.shortName + '】' + t); });
      }
    });

    let html = '';
    html += '<div class="action-group immediate"><div class="action-group-title">⚡ 立即处理（今日起）</div><ul>';
    (immediate.length ? immediate : ['优先处理评分最高的 1-2 项风险']).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    html += '<div class="action-group seven"><div class="action-group-title">📅 7 日内改善</div><ul>';
    (seven.length ? seven : ['制定本周风险改善计划并执行']).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    html += '<div class="action-group long"><div class="action-group-title">🏗️ 中长期建设（1-3 个月）</div><ul>';
    (long.length ? long : ['建立持续的风险复盘与治理机制']).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    return html;
  },

  renderRiskCard(risk) {
    const pct = risk.percent !== undefined ? risk.percent : 0;
    const score = risk.avgScore ? risk.avgScore.toFixed(1) : '0';
    const specific = risk.specificRisks || [];

    let html = '';
    html += '<div class="risk-detail-card" id="rdc-' + risk.id.replace('.', '-') + '">';
    html += '<div class="risk-detail-card-head" onclick="Report.toggleRiskCard(\'' + risk.id + '\')">';
    html += this.renderCharacter(risk, 44);
    html += '<div style="flex:1;min-width:0;">';
    html += '<div class="rdc-name">' + risk.name + '</div>';
    html += '<div class="rdc-meta">' + this.categoryTag(risk.categoryId) + ' ' + this.levelTag(risk.level) + '</div>';
    html += '</div>';
    html += '<div class="rdc-score" style="color:' + this.levelColor(risk.level) + ';">' + pct + '</div>';
    html += '</div>';

    html += '<div class="risk-detail-card-body">';
    html += '<div style="font-size:var(--fs-sm);color:var(--text-1);line-height:1.7;margin-bottom:var(--sp-3);">' + risk.description + '</div>';

    if (specific.length > 0) {
      html += '<div class="risk-section-title">🧩 具体风险（' + specific.length + ' 项）</div>';
      specific.forEach(function(s) {
        html += '<div class="specific-risk">';
        html += '<div class="specific-risk-name">' + s.name + '</div>';
        html += '<div class="specific-risk-quote">' + s.quote + '</div>';
        html += '<div class="specific-risk-source">—— ' + s.source + '</div>';
        html += '</div>';
      });
    }

    html += '<div class="risk-section-title">🚨 可观察信号</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.symptoms || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';

    html += '<div class="risk-section-title" style="margin-top:var(--sp-3);">🌱 触发情境</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.causes || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';

    if (risk.consequences && risk.consequences.length > 0) {
      html += '<div class="risk-section-title" style="margin-top:var(--sp-3);">⚠️ 潜在后果</div><ul class="risk-list ' + risk.categoryId + '">';
      risk.consequences.forEach(function(s) { html += '<li>' + s + '</li>'; });
      html += '</ul>';
    }

    html += '<div class="risk-section-title" style="margin-top:var(--sp-3);">💡 治理建议</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.recommendations || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';

    if (risk.governance) {
      html += '<div class="risk-section-title" style="margin-top:var(--sp-3);">📋 行动清单</div>';
      html += '<div class="governance-block immediate"><div class="governance-block-title">⚡ 立即处理</div><ul>';
      (risk.governance.immediate || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
      html += '</ul></div>';
      html += '<div class="governance-block seven"><div class="governance-block-title">📅 7 日内</div><ul>';
      (risk.governance.sevenDay || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
      html += '</ul></div>';
      html += '<div class="governance-block long"><div class="governance-block-title">🏗️ 中长期</div><ul>';
      (risk.governance.longTerm || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
      html += '</ul></div>';
    }
    html += '</div></div>';
    return html;
  },

  toggleRiskCard(id) {
    const el = document.getElementById('rdc-' + id.replace('.', '-'));
    if (el) el.classList.toggle('open');
  },

  drawRadar(report) {
    const canvas = document.getElementById('radar-canvas');
    if (!canvas || !report) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const risks = (report.sortedRisks || []).filter(function(r) { return r.questionCount > 0; });
    if (risks.length < 3) {
      ctx.fillStyle = '#A5ADC0';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('数据不足，暂无法绘制', W / 2, H / 2);
      return;
    }

    const n = risks.length;
    const cx = W / 2, cy = H / 2 + 10;
    const R = Math.min(W, H) / 2 - 55;
    const levels = [0.25, 0.5, 0.75, 1];

    function point(i, r) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    }

    // 网格
    ctx.strokeStyle = '#E4E9F5';
    ctx.lineWidth = 1;
    levels.forEach(function(lv) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = point(i % n, R * lv);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });

    // 轴线
    ctx.strokeStyle = '#DCE3F2';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = point(i, R);
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 数据
    const dataColor = '#4F6EF7';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const p = point(idx, (risks[idx].percent / 100) * R);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,110,247,0.18)';
    ctx.fill();
    ctx.strokeStyle = dataColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 数据点
    for (let i = 0; i < n; i++) {
      const p = point(i, (risks[i].percent / 100) * R);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#4F6EF7';
      ctx.fill();
    }

    // 标签
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#4A5368';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    risks.forEach(function(r, i) {
      const p = point(i, R + 26);
      const label = r.shortName;
      ctx.fillText(label, p.x, p.y);
    });
  },

  // ============ 历史 ============
  renderHistoryList(history) {
    if (!history || history.length === 0) {
      return '<div class="empty">' +
        '<div class="empty-icon">📊</div>' +
        '<div class="empty-text">暂无历史评估记录</div>' +
        '<div style="font-size:var(--fs-xs);color:var(--text-3);margin-top:4px;">完成一次完整评估后将自动存档</div>' +
        '</div>';
    }

    let html = '';
    const sorted = history.slice().reverse();
    sorted.forEach(function(item, idx) {
      const date = new Date(item.generatedAt);
      const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
      const color = Report.levelColor(item.overallLevel);
      const topNames = (item.topRiskNames || []).join('、') || '未识别';
      html += '<div class="card history-item fade-in" onclick="App.viewHistoryReport(\'' + item.id + '\')">';
      html += '<div class="card-pad"><div class="history-item-top">';
      html += '<div class="history-score" style="background:' + color + ';">' + item.overallScore + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="history-date">' + dateStr + ' · ' + (item.overallType || Report.levelText(item.overallLevel)) + '</div>';
      html += '<div class="history-risks">主要风险：' + topNames + '</div>';
      html += '</div>';
      html += '<div class="menu-item-arrow">›</div>';
      html += '</div></div></div>';
    });
    return html;
  },

  renderHistoryDetail(historyItem) {
    if (!historyItem) return '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">报告数据不存在</div></div>';

    const date = new Date(historyItem.generatedAt);
    const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    const color = this.levelColor(historyItem.overallLevel);
    const top3 = (historyItem.topRisks || []).slice(0, 3);

    let html = '';
    html += '<div class="report-score-card">';
    html += '<div class="score-ring" style="--score:' + historyItem.overallScore + ';--score-color:' + color + ';">';
    html += '<div class="score-ring-inner"><div class="score-ring-num" style="color:' + color + ';">' + historyItem.overallScore + '</div>';
    html += '<div class="score-ring-label">综合风险分</div></div></div>';
    html += '<div class="report-level" style="color:' + color + ';">' + this.levelText(historyItem.overallLevel) + '</div>';
    if (historyItem.overallType) html += '<div class="report-type">🧬 ' + historyItem.overallType + '</div>';
    html += '<div style="font-size:var(--fs-xs);color:var(--text-3);margin-top:var(--sp-3);">' + dateStr + '</div>';
    html += '</div>';

    if (top3.length > 0) {
      html += '<div class="report-section"><div class="card card-pad">';
      html += '<div class="card-title">🎯 当时 TOP 风险</div>';
      top3.forEach(function(r, idx) {
        const pct = r.percent !== undefined ? r.percent : 0;
        html += '<div class="top-risk-row">';
        html += '<div class="top-risk-rank r' + (idx + 1) + '">' + (idx + 1) + '</div>';
        html += '<div style="flex:1;"><div class="top-risk-name">' + r.name + '</div>';
        html += '<div class="mini-bar"><div class="mini-bar-fill" style="width:' + pct + '%;background:' + this.levelColor(r.level) + ';"></div></div></div>';
        html += '<div class="top-risk-score" style="color:' + this.levelColor(r.level) + ';">' + pct + '</div>';
        html += '</div>';
      }.bind(this));
      html += '</div></div>';
    }

    html += '<div style="padding:0 var(--sp-4) var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3);">';
    html += '<button class="btn btn-primary btn-block" onclick="App.reassessFromHistory()">🔄 基于本次历史重新评估</button>';
    html += '<button class="btn btn-ghost btn-block" onclick="App.goBack()">返回</button>';
    html += '</div>';
    return html;
  },

  archiveCurrent(report) { return Storage.archiveReport(report); }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Report;
} else {
  window.Report = Report;
}
