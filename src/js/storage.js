/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 本地存储管理器 ============
const Storage = {
  PREFIX: 'opc_risk_v3_',

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set error:', e);
      return false;
    }
  },

  get(key, defaultValue = null) {
    try {
      const json = localStorage.getItem(this.PREFIX + key);
      if (json === null) return defaultValue;
      return JSON.parse(json);
    } catch (e) {
      console.error('Storage.get error:', e);
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  clear() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(this.PREFIX)) localStorage.removeItem(k);
    });
  },

  // ============ 用户 ============
  setCurrentUser(user) { return this.set('current_user', user); },
  getCurrentUser() { return this.get('current_user'); },
  clearCurrentUser() { this.remove('current_user'); },
  getUsers() { return this.get('users', {}); },
  saveUsers(users) { return this.set('users', users); },

  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const c = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
  },

  // ============ 问卷与报告 ============
  saveInitialAnswers(answers) { return this.set('initial_answers', answers); },
  getInitialAnswers() { return this.get('initial_answers', null); },
  saveReport(report) { return this.set('latest_report', report); },
  getLatestReport() { return this.get('latest_report', null); },
  saveReportsHistory(reports) { return this.set('reports_history', reports); },
  getReportsHistory() { return this.get('reports_history', []); },

  // ============ 智能体 ============
  saveAgentConversation(conv) { return this.set('agent_conversation', conv); },
  getAgentConversation() { return this.get('agent_conversation', []); },
  clearAgentConversation() { this.remove('agent_conversation'); },

  // ============ 报告归档 ============
  archiveReport(report) {
    if (!report) return { success: false, reason: '无报告数据' };
    var history = this.getReportsHistory();
    var archived = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      generatedAt: new Date().toISOString(),
      overallScore: report.summary.overallScore,
      overallLevel: report.summary.overallLevel,
      overallType: report.summary.overallType || null,
      topRisks: (report.topRisks || []).slice(0, 3).map(function(r) {
        return { id: r.id, name: r.name, riskName: r.riskName, avgScore: r.avgScore, level: r.level, categoryId: r.categoryId, percent: r.percent };
      }),
      sortedRisks: (report.sortedRisks || []).map(function(r) {
        return { id: r.id, name: r.name, riskName: r.riskName, avgScore: r.avgScore, level: r.level, categoryId: r.categoryId, percent: r.percent };
      }),
      summary: report.summary,
      basicInfo: report.basicInfo || null,
      agentContext: report.agentContext || null
    };
    history.push(archived);
    this.saveReportsHistory(history);
    return { success: true, id: archived.id };
  },

  getArchivedReports() { return this.getReportsHistory(); },

  deleteArchivedReport(id) {
    var history = this.getReportsHistory();
    var filtered = history.filter(function(h) { return h.id !== id; });
    this.saveReportsHistory(filtered);
  },

  resetCurrentSession() {
    this.remove('initial_answers');
    this.clearAgentConversation();
    this.remove('latest_report');
  },

  // ============ 知识库更新标记 ============
  setKnowledgeBaseVersion(version) { return this.set('kb_version', version); },
  getKnowledgeBaseVersion() { return this.get('kb_version', null); },
  setKnowledgeBaseUpdateUrl(url) { return this.set('kb_update_url', url); },
  getKnowledgeBaseUpdateUrl() { return this.get('kb_update_url', ''); },
  setCachedKnowledgeBase(kbData) { return this.set('kb_cache', kbData); },
  getCachedKnowledgeBase() { return this.get('kb_cache', null); }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
} else {
  window.Storage = Storage;
}
