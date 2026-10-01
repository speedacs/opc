/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 记忆与知识沉淀模块 v3.2 ============
// 架构目标：把「每次问卷评估」转化为三层资产
//   1) 用户动态档案 + 结构化记忆条目（记忆层，智能体可调用）
//   2) 本地匿名经验沉淀（设备级知识池，随问卷数增长）
//   3) 可导出的知识 JSON（供研究/知识库迭代）

const Memory = {
  _user() {
    const u = Storage.getCurrentUser();
    return u ? u.username : 'local';
  },

  // ============ 基础读写 ============
  getStore() {
    const key = 'memory_' + this._user();
    let s = Storage.get(key, null);
    if (!s || typeof s !== 'object') {
      s = { assessments: [], facts: [], conversations: [], profile: null, updatedAt: null };
      Storage.set(key, s);
    }
    return s;
  },

  saveStore(s) {
    Storage.set('memory_' + this._user(), s);
  },

  getAggregate() {
    return Storage.get('kb_local_experience', { count: 0, riskHits: {}, updatedAt: 0 });
  },

  // ============ ① 问卷 → 记忆 ============
  recordAssessment(report) {
    if (!report || !report.summary) return null;

    const s = this.getStore();
    const basic = report.basicInfo || {};
    const now = Date.now();
    const facts = [];

    const push = (type, text, riskId, level) => {
      facts.push({
        id: 'f_' + now + '_' + Math.random().toString(36).slice(2, 6),
        createdAt: now,
        source: 'questionnaire',
        type: type,
        text: text,
        riskId: riskId || null,
        level: level || 'info'
      });
    };

    // 命中的具体风险与高风险领域 → 风险记忆
    (report.topRisks || []).slice(0, 5).forEach(function(r) {
      if (r.percent >= 55) {
        push('risk_hit', '当前高风险领域：' + r.name + '（风险分 ' + r.percent + '/100）', r.id, r.level);
      }
      if (r.specificHit && r.specificHit.length) {
        r.specificHit.slice(0, 2).forEach(function(h) {
          push('risk_hit', '问卷命中具体风险「' + h.name + '」（回答强度 ' + h.score + '/5）', r.id, 'medium');
        });
      }
    });

    // 基础信息 → 行为画像记忆
    if (basic.b4 && (basic.b4.indexOf('60-80') >= 0 || basic.b4.indexOf('80 小时以上') >= 0)) {
      push('behavior', '每周工作时长约 ' + basic.b4 + '，存在精力透支风险', null, 'high');
    }
    if (basic.b5 && (basic.b5.indexOf('核心环节依赖') >= 0 || basic.b5.indexOf('几乎全部依赖') >= 0)) {
      push('behavior', 'AI 依赖程度：' + basic.b5 + '，需防范认知依赖与可靠性风险', null, 'medium');
    }
    if (basic.b6 && (basic.b6.indexOf('完全没有') >= 0 || basic.b6.indexOf('较少') >= 0)) {
      push('behavior', '社会支持网络：' + basic.b6 + '，存在「决策孤岛」风险', null, 'high');
    }
    if (basic.b1 && (basic.b1.indexOf('个人经营') >= 0 || basic.b1.indexOf('一人有限责任公司') >= 0)) {
      push('context', '经营主体：' + basic.b1, null, 'info');
    }
    if (basic.b2) push('context', '经营年限：' + basic.b2, null, 'info');

    // 诊断因素 → 诊断记忆
    (report.summary.diagnosisFactors || []).slice(0, 4).forEach(function(f) {
      push('diagnosis', f.label + '：' + f.value, null, f.level);
    });

    // 动态档案：本次评估 = 一条“案例”
    const assessment = {
      id: 'a_' + now,
      date: report.generatedAt || now,
      overallScore: report.summary.overallScore,
      overallLevel: report.summary.overallLevel,
      overallType: report.summary.overallType,
      topRisks: (report.topRisks || []).slice(0, 3).map(function(r) {
        return { id: r.id, name: r.name, shortName: r.shortName, percent: r.percent, level: r.level };
      }),
      facts: facts.slice(0, 10).map(function(f) { return f.text; })
    };

    s.assessments.unshift(assessment);
    if (s.assessments.length > 30) s.assessments.length = 30;

    // 记忆条目（最新在前，去重保留：同风险/同标签只留最新）
    facts.forEach(function(f) {
      const dupIdx = s.facts.findIndex(function(old) {
        return old.riskId && f.riskId && old.riskId === f.riskId && old.type === f.type;
      });
      if (dupIdx >= 0) s.facts.splice(dupIdx, 1);
    });
    s.facts = facts.concat(s.facts);
    if (s.facts.length > 40) s.facts.length = 40;

    s.profile = {
      lastAssessmentAt: assessment.date,
      overallScore: report.summary.overallScore,
      overallLevel: report.summary.overallLevel,
      overallType: report.summary.overallType,
      topRisks: assessment.topRisks,
      assessmentCount: s.assessments.length
    };
    s.updatedAt = now;
    this.saveStore(s);
    this._updateAggregate(report);
    return assessment;
  },

  // ============ ② 本地匿名经验沉淀 ============
  _updateAggregate(report) {
    const agg = this.getAggregate();
    agg.count = (agg.count || 0) + 1;
    (report.topRisks || []).slice(0, 5).forEach(function(r) {
      if (r.percent >= 55) {
        agg.riskHits[r.id] = (agg.riskHits[r.id] || 0) + 1;
      }
    });
    agg.updatedAt = Date.now();
    Storage.set('kb_local_experience', agg);
  },

  // 把经验池转成可被智能体引用的“本地社区知识”文本
  aggregateToKnowledge() {
    const agg = this.getAggregate();
    if (!agg.count) return null;
    const hits = Object.keys(agg.riskHits).sort(function(a, b) {
      return agg.riskHits[b] - agg.riskHits[a];
    });
    const top = hits.slice(0, 3);
    return {
      count: agg.count,
      text: '本机已沉淀 ' + agg.count + ' 份问卷案例；命中最多的高风险领域为' +
        (top.length ? top.map(function(id) { return '「' + Memory._riskName(id) + '」' + agg.riskHits[id] + ' 次'; }).join('、') : '暂无') +
        '。可作为同类 OPC 高频风险的参考信号。'
    };
  },

  _riskName(id) {
    try {
      const data = window.__EMBEDDED_DATA__ ? window.__EMBEDDED_DATA__.riskTypes : null;
      if (data && data.risks) {
        const r = data.risks.find(function(x) { return x.id === id; });
        if (r) return r.shortName || r.name;
      }
    } catch (e) { /* ignore */ }
    return id;
  },

  // ============ ③ 智能体记忆上下文 ============
  buildMemoryContext() {
    const s = this.getStore();
    const lines = [];

    if (s.profile) {
      const d = new Date(s.profile.lastAssessmentAt);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      lines.push('- 最近评估（' + dateStr + '）：综合风险分 ' + s.profile.overallScore + '/100，等级「' + this._levelText(s.profile.overallLevel) + '」，类型「' + (s.profile.overallType || '未知') + '」');
      if (s.profile.topRisks && s.profile.topRisks.length) {
        lines.push('- TOP 风险：' + s.profile.topRisks.map(function(r) {
          return r.name + '（' + r.percent + '）';
        }).join('、'));
      }
    }

    // 活跃记忆：去重后取最新 8 条
    const seen = {};
    const active = [];
    s.facts.forEach(function(f) {
      if (active.length >= 8) return;
      const key = f.riskId ? (f.riskId + '_' + f.type) : ('_g_' + f.type);
      if (seen[key]) return;
      seen[key] = true;
      active.push(f);
    });
    if (active.length) {
      lines.push('- 用户记忆条目：');
      active.forEach(function(f) {
        lines.push('  · ' + f.text);
      });
    }

    if (s.conversations && s.conversations.length) {
      lines.push('- 最近对话备忘：' + s.conversations[0].summary);
    }

    const local = this.aggregateToKnowledge();
    if (local) lines.push('- 本地经验沉淀：' + local.text);

    return lines.length ? lines.join('\n') : '';
  },

  _levelText(level) {
    return { high: '高风险', medium: '预警', low: '关注', info: '低风险' }[level] || '未知';
  },

  // ============ 对话记忆 ============
  addConversationMemory(summary, meta) {
    if (!summary || !summary.trim()) return;
    const s = this.getStore();
    s.conversations.unshift({
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: Date.now(),
      summary: summary.trim().slice(0, 400),
      meta: meta || null
    });
    if (s.conversations.length > 20) s.conversations.length = 20;
    s.updatedAt = Date.now();
    this.saveStore(s);
  },

  // ============ 导出与重置 ============
  exportJSON() {
    return JSON.stringify({
      exportedAt: Date.now(),
      user: this._user(),
      profile: this.getStore().profile,
      assessments: this.getStore().assessments,
      facts: this.getStore().facts,
      conversations: this.getStore().conversations,
      aggregate: this.getAggregate()
    }, null, 2);
  },

  reset() {
    Storage.remove('memory_' + this._user());
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Memory;
} else {
  window.Memory = Memory;
}
