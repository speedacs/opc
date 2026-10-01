/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 问卷系统 v3 ============
// 基础信息 + 24 题风险问卷，输出 0-100 风险分与 4 级风险等级

const Questionnaire = {
  data: null,
  riskTypes: null,
  currentIndex: 0,
  answers: {},
  basicInfo: {},

  async load() {
    if (this.data && this.riskTypes) return;
    try {
      const [qResponse, rResponse] = await Promise.all([
        fetch('data/initial-questionnaire.json?t=' + Date.now()),
        fetch('data/risk-types.json?t=' + Date.now())
      ]);
      this.data = await qResponse.json();
      this.riskTypes = await rResponse.json();
    } catch (e) {
      console.warn('Questionnaire: fetch failed, using embedded data.', e.message);
      if (window.__EMBEDDED_DATA__) {
        this.data = window.__EMBEDDED_DATA__.initialQuestionnaire;
        this.riskTypes = window.__EMBEDDED_DATA__.riskTypes;
      } else {
        throw new Error('问卷数据加载失败');
      }
    }
  },

  reset() {
    this.currentIndex = 0;
    this.answers = {};
    this.basicInfo = {};
    this._justCompletedAt = 0;
  },

  restore() {
    const saved = Storage.getInitialAnswers();
    if (saved) {
      this.answers = saved.answers || {};
      this.basicInfo = saved.basicInfo || {};
      this.currentIndex = saved.currentIndex || 0;
    }
  },

  saveProgress() {
    Storage.saveInitialAnswers({
      answers: this.answers,
      basicInfo: this.basicInfo,
      currentIndex: this.currentIndex
    });
  },

  getTotal() { return this.data ? this.data.questions.length : 0; },
  getBasicTotal() { return this.data ? this.data.basicInfo.length : 0; },
  getAnsweredCount() { return Object.keys(this.answers).length; },
  getBasicAnsweredCount() { return Object.keys(this.basicInfo).length; },

  getCurrentQuestion() {
    if (!this.data || this.currentIndex >= this.data.questions.length) return null;
    return this.data.questions[this.currentIndex];
  },

  answer(questionId, score) {
    this.answers[questionId] = score;
    this.saveProgress();
  },

  answerBasic(id, value) {
    this.basicInfo[id] = value;
    this.saveProgress();
  },

  prev() {
    if (this.currentIndex > 0) { this.currentIndex--; return true; }
    return false;
  },

  next() {
    if (this.currentIndex < this.getTotal() - 1) { this.currentIndex++; return true; }
    if (this.currentIndex === this.getTotal() - 1) { this.currentIndex++; return false; }
    return false;
  },

  isBasicComplete() {
    return this.getBasicAnsweredCount() >= this.getBasicTotal();
  },

  isComplete() {
    return this.isBasicComplete() && this.getAnsweredCount() >= this.getTotal();
  },

  // 计算风险评分（每题 1-5 → 0-100 风险分）
  calculateRiskScores() {
    if (!this.data || !this.riskTypes) return null;

    const riskStats = {};
    const categoryStats = {};

    this.riskTypes.risks.forEach(risk => {
      riskStats[risk.id] = {
        ...risk,
        scores: [],
        totalScore: 0,
        avgScore: 0,
        percent: 0,
        questionCount: 0,
        specificHit: []
      };
    });

    this.data.categories.forEach(cat => {
      categoryStats[cat.id] = {
        ...cat,
        totalScore: 0,
        percent: 0,
        questionCount: 0,
        riskIds: new Set()
      };
    });

    this.data.questions.forEach(q => {
      const score = this.answers[q.id];
      if (score === undefined) return;

      if (riskStats[q.riskId]) {
        riskStats[q.riskId].scores.push(score);
        riskStats[q.riskId].totalScore += score;
        riskStats[q.riskId].questionCount++;
        if (score >= 4) {
          riskStats[q.riskId].specificHit.push({
            id: q.specificRiskId,
            name: q.specificRiskName,
            score: score
          });
        }
      }
      if (categoryStats[q.categoryId]) {
        categoryStats[q.categoryId].totalScore += score;
        categoryStats[q.categoryId].questionCount++;
        categoryStats[q.categoryId].riskIds.add(q.riskId);
      }
    });

    Object.keys(riskStats).forEach(rid => {
      const r = riskStats[rid];
      r.avgScore = r.questionCount > 0 ? r.totalScore / r.questionCount : 0;
      r.percent = Math.round(((r.avgScore - 1) / 4) * 100);
      if (r.percent < 0) r.percent = 0;
      r.level = this.scoreToLevel(r.percent);
      r.score = r.percent;
    });

    Object.keys(categoryStats).forEach(cid => {
      const c = categoryStats[cid];
      const avg = c.questionCount > 0 ? c.totalScore / c.questionCount : 0;
      c.percent = Math.round(((avg - 1) / 4) * 100);
      if (c.percent < 0) c.percent = 0;
      c.level = this.scoreToLevel(c.percent);
      c.score = c.percent;
    });

    const sortedRisks = Object.values(riskStats)
      .filter(r => r.questionCount > 0)
      .sort((a, b) => b.percent - a.percent);

    const overallPercent = this.calculateOverallPercent();

    return {
      riskStats,
      categoryStats,
      sortedRisks,
      topRisks: sortedRisks.slice(0, 5),
      overallPercent,
      overallLevel: this.scoreToLevel(overallPercent),
      overallType: this.detectOverallType(sortedRisks),
      diagnosisFactors: this.buildDiagnosisFactors(sortedRisks)
    };
  },

  calculateOverallPercent() {
    const keys = Object.keys(this.answers);
    if (keys.length === 0) return 0;
    const sum = keys.reduce((acc, k) => acc + this.answers[k], 0);
    const avg = sum / keys.length;
    return Math.round(((avg - 1) / 4) * 100);
  },

  // 4 级风险等级：低风险 / 关注 / 预警 / 高风险
  scoreToLevel(percent) {
    if (percent >= 75) return 'high';
    if (percent >= 55) return 'medium';
    if (percent >= 35) return 'low';
    return 'info';
  },

  detectOverallType(sortedRisks) {
    if (!sortedRisks || sortedRisks.length === 0) return '均衡型';
    const top = sortedRisks[0];
    if (top.percent < 35) return '相对稳健型（各维度均衡）';
    return top.shortName + '突出型';
  },

  // 关键诊断因素：基础信息命中的高风险信号 + 评分较高的具体风险
  buildDiagnosisFactors(sortedRisks) {
    const factors = [];
    const b = this.basicInfo || {};

    if (b.b4 && (b.b4.includes('60-80') || b.b4.includes('80 小时以上'))) {
      factors.push({ key: 'workload', label: '工作负荷', value: '偏高（' + b.b4 + '）', level: 'high' });
    } else if (b.b4) {
      factors.push({ key: 'workload', label: '工作负荷', value: b.b4, level: 'info' });
    }

    if (b.b5 && (b.b5.includes('核心环节依赖') || b.b5.includes('几乎全部依赖'))) {
      factors.push({ key: 'ai_dep', label: 'AI 依赖程度', value: b.b5, level: 'medium' });
    }

    if (b.b6 && (b.b6.includes('完全没有') || b.b6.includes('较少'))) {
      factors.push({ key: 'support', label: '社会支持', value: b.b6, level: 'high' });
    }

    if (b.b1 && (b.b1.includes('个人经营') || b.b1.includes('一人有限责任公司'))) {
      factors.push({ key: 'org', label: '组织形式', value: b.b1 + '（单点依赖）', level: 'medium' });
    }

    if (b.b2 && (b.b2.includes('1 年以内'))) {
      factors.push({ key: 'age', label: '经营年限', value: b.b2, level: 'medium' });
    }

    if (b.b3 && (b.b3.includes('10 万以下'))) {
      factors.push({ key: 'revenue', label: '营收规模', value: b.b3, level: 'medium' });
    }

    (sortedRisks || []).slice(0, 3).forEach(r => {
      if (r.specificHit && r.specificHit.length > 0) {
        r.specificHit.slice(0, 2).forEach(s => {
          factors.push({ key: 'risk_' + s.id, label: r.shortName, value: s.name, level: 'high' });
        });
      }
    });

    return factors.slice(0, 6);
  },

  generateReport() {
    const stats = this.calculateRiskScores();
    if (!stats) return null;

    return {
      id: 'report_' + Date.now(),
      generatedAt: Date.now(),
      user: Storage.getCurrentUser(),
      basicInfo: this.basicInfo,
      provenance: (window.Watermark ? Watermark.provenance({ type: 'assessment' }) : null),
      summary: {
        overallScore: stats.overallPercent,
        overallLevel: stats.overallLevel,
        overallType: stats.overallType,
        totalQuestions: this.getTotal(),
        answeredCount: this.getAnsweredCount(),
        diagnosisFactors: stats.diagnosisFactors
      },
      categories: stats.categoryStats,
      allRisks: stats.riskStats,
      sortedRisks: stats.sortedRisks,
      topRisks: stats.topRisks
    };
  },

  complete() {
    // 防重复归档：同一组答案短时间内只归档一次（避免重复记忆/历史条目）
    if (this._justCompletedAt && Date.now() - this._justCompletedAt < 15000) {
      return Storage.getLatestReport();
    }
    this._justCompletedAt = Date.now();
    const report = this.generateReport();
    if (report) {
      Storage.saveReport(report);
      // 架构 v3.2：每次问卷完成 → 写入记忆层（动态档案 + 记忆条目 + 本地经验沉淀）
      try {
        if (window.Memory) Memory.recordAssessment(report);
      } catch (e) {
        console.warn('Memory.recordAssessment failed:', e.message);
      }
      const history = Storage.getReportsHistory();
      history.unshift({
        id: report.id,
        generatedAt: report.generatedAt,
        user: report.user,
        overallScore: report.summary.overallScore,
        overallLevel: report.summary.overallLevel,
        overallType: report.summary.overallType,
        topRiskNames: report.topRisks.slice(0, 3).map(r => r.name),
        topRisks: report.topRisks.slice(0, 3).map(r => ({ id: r.id, name: r.name, avgScore: r.avgScore, percent: r.percent, level: r.level, categoryId: r.categoryId }))
      });
      if (history.length > 20) history.length = 20;
      Storage.saveReportsHistory(history);
    }
    return report;
  },

  getCurrentIndex() { return this.currentIndex; },

  getProgress() {
    const total = this.getTotal();
    return total > 0 ? (this.currentIndex + 1) / total : 0;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Questionnaire;
} else {
  window.Questionnaire = Questionnaire;
}
