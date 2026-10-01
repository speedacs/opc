/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 智能体问答 v3.1（DeepSeek 驱动） ============
// 设计原则与《第五章 智能体设计》一致：
// 结构化评分负责"判"，风险知识库负责"约束"，大模型仅负责"解析与生成"。

const Agent = {
  knowledgeBase: null,
  riskTypes: null,
  questionnaire: null,
  conversation: [],
  isProcessing: false,
  currentContext: null,
  historyContext: null,
  askedFollowups: new Set(),
  _keywordIndex: null,

  maxTurns: 20,
  currentTurn: 0,
  isEnded: false,

  // 唯一智能体编号（用于区分不同智能体的 API 调用）
  agentId: 'opc-agent-v3-001',
  agentName: '小盾',

  _processingTimer: null,

  // 外部 API 配置（默认 DeepSeek，OpenAI 兼容格式）
  externalAPI: {
    enabled: false,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    timeout: 30000
  },

  async load() {
    if (this.knowledgeBase && this.riskTypes) return;
    try {
      const [kbResponse, rtResponse, qResponse] = await Promise.all([
        fetch('data/knowledge-base.json?t=' + Date.now()),
        fetch('data/risk-types.json?t=' + Date.now()),
        fetch('data/initial-questionnaire.json?t=' + Date.now())
      ]);
      this.knowledgeBase = await kbResponse.json();
      this.riskTypes = await rtResponse.json();
      this.questionnaire = await qResponse.json();
      this._buildKeywordIndex();
      this._loadAPIConfig();
      return true;
    } catch (e) {
      console.warn('Agent: fetch failed, using embedded data.', e.message);
      if (window.__EMBEDDED_DATA__) {
        this.knowledgeBase = window.__EMBEDDED_DATA__.knowledgeBase;
        this.riskTypes = window.__EMBEDDED_DATA__.riskTypes;
        this.questionnaire = window.__EMBEDDED_DATA__.initialQuestionnaire;
        this._buildKeywordIndex();
        this._loadAPIConfig();
        return true;
      }
      throw new Error('知识库加载失败');
    }
  },

  _loadAPIConfig() {
    try {
      const saved = localStorage.getItem('opc_agent_api_config_v3');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.endpoint) this.externalAPI.endpoint = cfg.endpoint;
        if (cfg.apiKey) this.externalAPI.apiKey = cfg.apiKey;
        if (cfg.model) this.externalAPI.model = cfg.model;
        if (typeof cfg.enabled === 'boolean') this.externalAPI.enabled = cfg.enabled;
      }
    } catch (e) { /* ignore */ }
  },

  _saveAPIConfig() {
    try {
      localStorage.setItem('opc_agent_api_config_v3', JSON.stringify({
        endpoint: this.externalAPI.endpoint,
        apiKey: this.externalAPI.apiKey,
        model: this.externalAPI.model,
        enabled: this.externalAPI.enabled
      }));
    } catch (e) { /* ignore */ }
  },

  configureExternalAPI(config) {
    if (config) {
      if (typeof config.enabled === 'boolean') this.externalAPI.enabled = config.enabled;
      if (config.endpoint) this.externalAPI.endpoint = config.endpoint;
      if (config.apiKey) this.externalAPI.apiKey = config.apiKey;
      if (config.model) this.externalAPI.model = config.model;
      if (config.timeout) this.externalAPI.timeout = config.timeout;
    }
    this._saveAPIConfig();
    return this.externalAPI;
  },

  _buildKeywordIndex() {
    if (!this.knowledgeBase || !this.knowledgeBase.faq) return;
    this._keywordIndex = new Map();
    this.knowledgeBase.faq.forEach(function(item, idx) {
      item.keywords.forEach(function(kw) {
        const key = kw.toLowerCase();
        if (!this._keywordIndex.has(key)) this._keywordIndex.set(key, []);
        this._keywordIndex.get(key).push(idx);
      }.bind(this));
    }.bind(this));
  },

  // ============ 会话管理 ============
  start(report, historyReport) {
    this.conversation = [];
    this.askedFollowups = new Set();
    this.currentTurn = 0;
    this.isEnded = false;

    this.currentContext = report ? {
      topRisks: (report.topRisks || []).map(r => r.id),
      overallScore: report.summary ? report.summary.overallScore : 0,
      overallLevel: report.summary ? report.summary.overallLevel : 'info',
      overallType: report.summary ? report.summary.overallType : '',
      diagnosisFactors: report.summary ? report.summary.diagnosisFactors : [],
      allRiskDetails: report.sortedRisks ? report.sortedRisks.slice(0, 5) : []
    } : null;

    this.historyContext = historyReport || null;

    const greetings = this.knowledgeBase ? this.knowledgeBase.greetings : ['您好，我是您的风险评估助手。'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    this.pushMessage('agent', greeting);

    if (this.historyContext && this.historyContext.topRisks && this.historyContext.topRisks.length > 0) {
      this._pushHistoryFollowup();
      return;
    }

    if (this.externalAPI.enabled && this.externalAPI.apiKey) {
      this.pushMessage('agent', '⏳ 正在分析您的风险画像...', { type: 'loading' });
      this.save();
      this._pushFirstQuestionViaAPI();
    } else {
      this._pushFirstQuestionLocal();
    }
  },

  async _pushFirstQuestionViaAPI() {
    this.isProcessing = true;
    this._setProcessingTimeout();
    try {
      const firstQ = await this._callAPI(
        this._buildSystemPrompt(),
        [{ role: 'user', content: '请根据我的风险画像，开始诊断，向我提出第一个问题。' }]
      );
      this._replaceLastAgentMessage(firstQ, { type: 'api' });
      this.currentTurn = 1;
    } catch (e) {
      console.warn('[Agent] API failed for first question, fallback to local:', e.message);
      try { this.conversation.pop(); } catch (popErr) {}
      this._pushFirstQuestionLocal();
    } finally {
      this._clearProcessingTimeout();
      this.isProcessing = false;
      this.save();
    }
  },

  _replaceLastAgentMessage(text, meta) {
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      if (this.conversation[i].role === 'agent') {
        this.conversation[i].text = text;
        this.conversation[i].meta = meta || null;
        return;
      }
    }
    this.pushMessage('agent', text, meta);
  },

  _pushFirstQuestionLocal() {
    const topRisks = this.currentContext && this.currentContext.topRisks ? this.currentContext.topRisks : [];
    if (topRisks.length > 0) {
      const topRiskId = topRisks[0];
      const riskDetail = this._findRisk(topRiskId);
      if (riskDetail && riskDetail.agentFollowup && riskDetail.agentFollowup.length > 0) {
        this.pushMessage('agent', riskDetail.agentFollowup[0], { riskId: topRiskId, followupIndex: 0 });
        this.askedFollowups.add(topRiskId + '_0');
        this.currentTurn = 1;
        this.save();
        return;
      }
    }
    this.pushMessage('agent', '请告诉我您目前最关心的创业问题是什么？');
    this.currentTurn = 1;
    this.save();
  },

  _pushHistoryFollowup() {
    const topHistRisk = this.historyContext.topRisks[0];
    const histDate = this.historyContext.generatedAt ? new Date(this.historyContext.generatedAt) : null;
    const dateStr = histDate
      ? (histDate.getFullYear() + '年' + (histDate.getMonth() + 1) + '月' + histDate.getDate() + '日')
      : '之前';

    const localQ = '我注意到您在 ' + dateStr + ' 的评估中，最大的风险是「' + topHistRisk.name + '」（风险分 ' + (topHistRisk.percent !== undefined ? topHistRisk.percent : topHistRisk.avgScore) + '）。\n\n相比当时，这个风险现在是否有所改善？';

    if (this.externalAPI.enabled && this.externalAPI.apiKey) {
      this.pushMessage('agent', '⏳ 正在对比历史数据...', { type: 'loading' });
      this.save();
      this.isProcessing = true;
      this._setProcessingTimeout();
      const self = this;
      this._callAPI(
        this._buildSystemPrompt(),
        [{ role: 'user', content: '我在 ' + dateStr + ' 的评估中，最大风险是「' + topHistRisk.name + '」（风险分 ' + topHistRisk.percent + '）。请对比历史，提出第一个诊断问题。' }]
      ).then(function(q) {
        self._replaceLastAgentMessage(q, { type: 'api' });
        self.currentTurn = 1;
      }).catch(function() {
        try { self.conversation.pop(); } catch (e) {}
        self.pushMessage('agent', localQ, { type: 'history_check', historyId: self.historyContext.id, riskId: topHistRisk.id });
        self.currentTurn = 1;
      }).finally(function() {
        self._clearProcessingTimeout();
        self.isProcessing = false;
        self.save();
      });
    } else {
      this.pushMessage('agent', localQ, { type: 'history_check', historyId: this.historyContext.id, riskId: topHistRisk.id });
      this.currentTurn = 1;
      this.save();
    }
  },

  restore() {
    const saved = Storage.getAgentConversation();
    if (saved && saved.length > 0) this.conversation = saved;

    const state = Storage.get('agent_state_v3', null);
    if (state) {
      if (state.currentContext) this.currentContext = state.currentContext;
      if (state.historyContext) this.historyContext = state.historyContext;
      if (typeof state.isEnded === 'boolean') this.isEnded = state.isEnded;
      if (typeof state.currentTurn === 'number') this.currentTurn = state.currentTurn;
      if (Array.isArray(state.askedFollowups)) this.askedFollowups = new Set(state.askedFollowups);
    }
    this.isProcessing = false;
    this._clearProcessingTimeout();
    this._findCurrentTurn();
  },

  _findCurrentTurn() {
    let turn = 1;
    for (let i = 0; i < this.conversation.length; i++) {
      if (this.conversation[i].role === 'user') turn++;
    }
    this.currentTurn = turn;
    for (let j = 0; j < this.conversation.length; j++) {
      const m = this.conversation[j];
      if (m.role === 'agent' && m.meta && m.meta.riskId && typeof m.meta.followupIndex === 'number') {
        this.askedFollowups.add(m.meta.riskId + '_' + m.meta.followupIndex);
      }
    }
  },

  save() {
    Storage.saveAgentConversation(this.conversation);
    Storage.set('agent_state_v3', {
      currentContext: this.currentContext,
      historyContext: this.historyContext,
      isEnded: this.isEnded,
      currentTurn: this.currentTurn,
      askedFollowups: Array.from(this.askedFollowups),
      savedAt: Date.now()
    });
  },

  clear() {
    this.conversation = [];
    this.askedFollowups = new Set();
    this.currentContext = null;
    this.historyContext = null;
    this.currentTurn = 0;
    this.isEnded = false;
    this.isProcessing = false;
    this._clearProcessingTimeout();
    Storage.clearAgentConversation();
    Storage.remove('agent_state_v3');
  },

  // 把尚未正式结束的访谈压成一句备忘，供下次访谈调用（记忆层）
  saveConversationNote() {
    try {
      if (!window.Memory) return;
      const userCount = this.conversation.filter(function(m) { return m.role === 'user'; }).length;
      if (userCount === 0) return;
      const riskNames = [];
      if (this.currentContext && this.currentContext.allRiskDetails) {
        this.currentContext.allRiskDetails.slice(0, 3).forEach(function(r) {
          riskNames.push(r.name);
        });
      }
      const last = this.conversation[this.conversation.length - 1];
      let note = '进行过 ' + userCount + ' 轮风险访谈' +
        (riskNames.length ? '，聚焦「' + riskNames.join('、') + '」' : '') +
        (last && last.role === 'user' ? '，最后提到：「' + last.text.slice(0, 40) + '」' : '') + '。';
      Memory.addConversationMemory(note, { type: 'agent_note' });
    } catch (e) { /* ignore */ }
  },

  pushMessage(role, text, meta) {
    this.conversation.push({ role: role, text: text, meta: meta || null, timestamp: Date.now() });
    this.save();
  },

  getMessages() { return this.conversation; },

  // ============ 用户输入处理 ============
  async userInput(text) {
    if (!text || !text.trim()) return;
    if (this.isProcessing) return;
    if (this.isEnded) {
      this.pushMessage('agent', '本次诊断已结束。如需继续，请点击下方「重新开始」按钮。');
      return;
    }

    const trimmed = text.trim();
    this.currentTurn++;

    if (this.currentTurn >= this.maxTurns) {
      this.pushMessage('user', trimmed);
      this.isProcessing = true;
      this._setProcessingTimeout();
      let summary;
      try {
        if (this.externalAPI.enabled && this.externalAPI.apiKey) {
          summary = await this._callAPI(
            this._buildSystemPrompt(),
            this._buildConversationHistory().concat([{ role: 'user', content: trimmed }]).concat([
              { role: 'system', content: '这是最后一轮对话。请按《治理报告模板》总结此次诊断：当前风险状态、TOP风险、核心诊断依据、立即处理事项、7日内改善事项、中长期改善事项、建议的外部专业支持、下次复盘时间。' }
            ])
          );
        } else {
          summary = this._generateSessionSummary();
        }
        this.pushMessage('agent', summary, { type: 'end' });
        this.isEnded = true;
      } catch (e) {
        summary = this._generateSessionSummary();
        this.pushMessage('agent', summary, { type: 'end' });
        this.isEnded = true;
      } finally {
        try {
          if (window.Memory) Memory.addConversationMemory(summary, { type: 'session_summary' });
        } catch (e) { /* ignore */ }
        this._clearProcessingTimeout();
        this.isProcessing = false;
        this.save();
      }
      return;
    }

    this.pushMessage('user', trimmed);
    this.isProcessing = true;
    this._setProcessingTimeout();

    try {
      if (this.externalAPI.enabled && this.externalAPI.apiKey) {
        const response = await this._callAPI(
          this._buildSystemPrompt(),
          this._buildConversationHistory()
        );
        this.pushMessage('agent', response, { type: 'api' });
      } else {
        await this.delay(300 + Math.random() * 300);
        const localResp = this.processInput(trimmed);
        this.pushMessage('agent', localResp.text, localResp.meta);
      }
    } catch (e) {
      console.error('[Agent] Error processing input:', e.message);
      try {
        const fallbackResp = this.processInput(trimmed);
        this.pushMessage('agent', fallbackResp.text, fallbackResp.meta);
      } catch (e2) {
        this.pushMessage('agent', '抱歉，我遇到了一些问题。请稍后再试，或点击「重新开始」。');
      }
    } finally {
      this._clearProcessingTimeout();
      this.isProcessing = false;
      this.save();
    }
  },

  // ============ DeepSeek API ============
  // 优先使用 Capacitor 原生 HTTP（绕过 WebView 跨域限制），否则降级 fetch
  async _httpRequest(url, options) {
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
    if (cap && cap.request) {
      let data = null;
      if (options.body) {
        try { data = JSON.parse(options.body); } catch (e) { data = options.body; }
      }
      const res = await cap.request({
        url: url,
        method: options.method || 'GET',
        headers: options.headers || {},
        data: data,
        connectTimeout: this.externalAPI.timeout,
        readTimeout: this.externalAPI.timeout
      });
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        statusText: String(res.status),
        json: async function() {
          return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        },
        text: async function() {
          return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        }
      };
    }
    return fetch(url, options);
  },

  _buildSystemPrompt() {
    let prompt = '你是「小盾」，一位专业的个人创业者（OPC）风险治理智能体，编号 ' + this.agentId + '。你的任务是依据用户问卷结果和对话，进行深入的个性化风险诊断与治理建议。\n\n';

    prompt += '## 角色边界（必须遵守）\n';
    prompt += '1. 风险评分、等级、类型等判断由系统结构化模型完成，你不直接判定或修改风险等级\n';
    prompt += '2. 你的职责是：解析用户口语化回答、解释风险、组织治理建议\n';
    prompt += '3. 知识库与策略库之外的内容，不要编造；无法确认时明确回答「不确定」\n';
    prompt += '4. 对法律、财税、安全等专业问题，只做风险提示并建议咨询专业顾问\n\n';

    if (this.currentContext) {
      prompt += '## 用户风险画像（系统计算，可信）\n';
      prompt += '- 综合风险分：' + (this.currentContext.overallScore !== undefined ? this.currentContext.overallScore : '未知') + '/100\n';
      prompt += '- 风险等级：' + this._levelText(this.currentContext.overallLevel) + '\n';
      if (this.currentContext.overallType) prompt += '- 风险类型：' + this.currentContext.overallType + '\n';

      if (this.currentContext.allRiskDetails && this.currentContext.allRiskDetails.length > 0) {
        prompt += '- 主要风险领域：\n';
        this.currentContext.allRiskDetails.slice(0, 5).forEach(function(r) {
          prompt += '  · ' + r.name + '（' + r.percent + '/100，' + Agent._levelText(r.level) + '）\n';
          if (r.description) prompt += '    说明：' + r.description + '\n';
          if (r.recommendations && r.recommendations.length > 0) {
            prompt += '    建议：' + r.recommendations.slice(0, 2).join('；') + '\n';
          }
        });
      }

      if (this.currentContext.diagnosisFactors && this.currentContext.diagnosisFactors.length > 0) {
        prompt += '- 关键诊断因素：' + this.currentContext.diagnosisFactors.map(function(f) {
          return f.label + '：' + f.value;
        }).join('；') + '\n';
      }
      prompt += '\n';
    }

    if (this.historyContext && this.historyContext.topRisks) {
      prompt += '## 历史评估记录\n';
      const histDate = this.historyContext.generatedAt ? new Date(this.historyContext.generatedAt) : null;
      if (histDate) prompt += '- 评估时间：' + histDate.toLocaleDateString('zh-CN') + '\n';
      prompt += '- 历史综合评分：' + this.historyContext.overallScore + '\n';
      prompt += '- 历史主要风险：' + this.historyContext.topRisks.map(function(r) { return r.name; }).join('、') + '\n\n';
    }

    // 记忆层：历次问卷 + 历史对话沉淀的动态档案（记忆与知识沉淀架构 v3.2）
    const memContext = window.Memory ? Memory.buildMemoryContext() : '';
    if (memContext) {
      prompt += '## 用户记忆（本地动态档案，来自历次问卷与访谈）\n' + memContext + '\n\n';
    }

    prompt += '## 对话规则\n';
    prompt += '1. 每次只问一个问题，等待用户回答后再继续\n';
    prompt += '2. 问题要针对用户的具体风险画像，有深度有针对性\n';
    prompt += '3. 根据用户回答灵活调整，不要机械重复提问\n';
    prompt += '4. 回答简洁，每次不超过 150 字，用友好温暖、像朋友一样的语气\n';
    prompt += '5. 优先追问评分最高、等级最高的风险领域\n';
    prompt += '6. 用户偏离主题时礼貌引导回风险评估\n';
    prompt += '7. 只有在用户明确表示想结束时才做总结\n';
    prompt += '8. 可以引用风险知识库中的典型信号、后果与治理措施来增强解释\n';

    return prompt;
  },

  _levelText(level) {
    return {
      high: '高风险',
      medium: '预警',
      low: '关注',
      info: '低风险'
    }[level] || '未知';
  },

  _buildConversationHistory() {
    const messages = [];
    const recent = this.conversation.slice(-20);
    for (let i = 0; i < recent.length; i++) {
      const msg = recent[i];
      if (msg.meta && msg.meta.type === 'loading') continue;
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      });
    }
    return messages;
  },

  async _callAPI(systemPrompt, conversationMessages) {
    const messages = [{ role: 'system', content: systemPrompt }].concat(conversationMessages);

    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, this.externalAPI.timeout);

    try {
      const response = await this._httpRequest(this.externalAPI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.externalAPI.apiKey,
          'X-Agent-Id': this.agentId
        },
        body: JSON.stringify({
          model: this.externalAPI.model,
          messages: messages,
          max_tokens: 600,
          temperature: 0.7,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errText = '';
        try { errText = await response.text(); } catch (e) {}
        throw new Error('API ' + response.status + ': ' + (errText || response.statusText));
      }

      const data = await response.json();
      const reply =
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.reasoning_content) ||
        (data.output && data.output.text) ||
        (data.data && data.data.choices && data.data.choices[0] && data.data.choices[0].message && data.data.choices[0].message.content);

      if (!reply) throw new Error('API 返回格式异常');
      return reply.trim();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  // 测试 API 连通性
  async testConnection(endpoint, apiKey, model) {
    const ep = endpoint || this.externalAPI.endpoint;
    const key = apiKey || this.externalAPI.apiKey;
    const md = model || this.externalAPI.model;
    if (!key) return { success: false, message: '请先填写 API Key' };

    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 15000);
    try {
      const response = await this._httpRequest(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: md,
          messages: [{ role: 'user', content: '你好，请回复"连接成功"四个字。' }],
          max_tokens: 16,
          stream: false
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        const t = await response.text().catch(function() { return ''; });
        return { success: false, message: '请求失败（' + response.status + '）：' + t.slice(0, 120) };
      }
      const data = await response.json();
      const reply =
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.reasoning_content) ||
        (data.output && data.output.text) || '';
      return { success: true, message: '连接成功：' + reply.slice(0, 60) };
    } catch (e) {
      clearTimeout(timer);
      return { success: false, message: '连接失败：' + e.message };
    }
  },

  // ============ 本地知识库匹配（API 不可用时的降级） ============
  processInput(text) {
    if (!text) return { text: '请详细描述一下您的疑问。', meta: { type: 'fallback' } };

    const kbMatch = this.matchKnowledgeBase(text);
    if (kbMatch) {
      return { text: kbMatch.answer, meta: { type: 'kb', kbId: kbMatch.id } };
    }

    if (this.currentContext && this.currentContext.topRisks && this.currentContext.topRisks.length > 0) {
      for (let ri = 0; ri < this.currentContext.topRisks.length; ri++) {
        const topRiskId = this.currentContext.topRisks[ri];
        const riskDetail = this._findRisk(topRiskId);
        if (riskDetail && riskDetail.agentFollowup) {
          for (let fi = 0; fi < riskDetail.agentFollowup.length; fi++) {
            if (!this.askedFollowups.has(topRiskId + '_' + fi)) {
              this.askedFollowups.add(topRiskId + '_' + fi);
              return {
                text: riskDetail.agentFollowup[fi],
                meta: { type: 'followup', riskId: topRiskId, followupIndex: fi }
              };
            }
          }
        }
      }
    }

    return this.getFallbackResponse(text);
  },

  _findRisk(id) {
    if (!this.riskTypes || !this.riskTypes.risks) return null;
    return this.riskTypes.risks.find(function(r) { return r.id === id; });
  },

  matchKnowledgeBase(text) {
    if (!this.knowledgeBase || !this.knowledgeBase.faq) return null;
    const lowerText = (text || '').toLowerCase();

    if (this._keywordIndex && this._keywordIndex.size > 0) {
      const scores = new Map();
      const words = lowerText.split(/[^\u4e00-\u9fa5a-z0-9]+/);
      for (let wi = 0; wi < words.length; wi++) {
        const word = words[wi];
        if (!word || word.length < 2) continue;
        const iterator = this._keywordIndex.entries();
        let entry = iterator.next();
        while (!entry.done) {
          const kw = entry.value[0];
          const indices = entry.value[1];
          if (word.includes(kw) || kw.includes(word)) {
            for (let ii = 0; ii < indices.length; ii++) {
              const idx = indices[ii];
              scores.set(idx, (scores.get(idx) || 0) + kw.length * (kw.length >= 4 ? 3 : 2));
            }
          }
          entry = iterator.next();
        }
      }
      if (scores.size > 0) {
        let bestIdx = -1, bestScore = 0;
        scores.forEach(function(score, idx) {
          if (score > bestScore) { bestScore = score; bestIdx = idx; }
        });
        if (bestScore >= 6 && bestIdx >= 0) return this.knowledgeBase.faq[bestIdx];
      }
    }

    let bestMatch = null, bestScore = 0;
    for (let fi = 0; fi < this.knowledgeBase.faq.length; fi++) {
      const item = this.knowledgeBase.faq[fi];
      let score = 0;
      for (let ki = 0; ki < item.keywords.length; ki++) {
        if (lowerText.includes(item.keywords[ki].toLowerCase())) score += item.keywords[ki].length;
      }
      if (score > bestScore) { bestScore = score; bestMatch = item; }
    }
    return bestMatch;
  },

  getFallbackResponse(text) {
    if (!text || text.length < 5) {
      return { text: '请详细描述一下您的疑问，这样我能给出更精准的建议。', meta: { type: 'fallback' } };
    }
    const fallbacks = [
      '这是一个好问题。能否告诉我更多细节？比如您遇到的具体场景？',
      '要更好地回答您，我需要了解一些背景信息。您目前业务的核心挑战是什么？',
      '我理解您的关注。我们换个角度：您尝试过哪些方法？',
      '好的，让我帮您梳理一下。您能否结合具体例子说明？',
      '这个问题涉及多个方面。建议您先聚焦最紧迫的一点，其他我们可以后续讨论。'
    ];
    return { text: fallbacks[Math.floor(Math.random() * fallbacks.length)], meta: { type: 'fallback' } };
  },

  _setProcessingTimeout() {
    this._clearProcessingTimeout();
    const self = this;
    this._processingTimer = setTimeout(function() {
      console.warn('[Agent] Processing timeout reached, resetting isProcessing');
      self.isProcessing = false;
      self.save();
    }, 35000);
  },

  _clearProcessingTimeout() {
    if (this._processingTimer) {
      clearTimeout(this._processingTimer);
      this._processingTimer = null;
    }
  },

  delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  },

  _generateSessionSummary() {
    let summary = '🎯 **本次诊断总结**\n\n我们共进行了 ' + this.currentTurn + ' 轮交流。';

    if (this.currentContext) {
      summary += '\n\n📊 当前综合风险分：' + (this.currentContext.overallScore !== undefined ? this.currentContext.overallScore : '未知') + '/100（' + this._levelText(this.currentContext.overallLevel) + '）';
      if (this.currentContext.overallType) summary += '\n风险类型：' + this.currentContext.overallType;
    }

    const riskNames = [];
    if (this.currentContext && this.currentContext.allRiskDetails) {
      this.currentContext.allRiskDetails.slice(0, 3).forEach(function(r) {
        riskNames.push(r.name + '（' + r.percent + '）');
      });
    }
    if (riskNames.length > 0) summary += '\n\n当前主要风险领域：' + riskNames.join('、');

    summary += '\n\n**核心建议：**\n1. 优先处理评分最高的 1-2 项风险\n2. 从「立即处理事项」开始执行治理清单\n3. 建议 30 天后复测，跟踪风险变化\n\n💡 点击「查看完整报告」查看您的风险画像与治理行动清单。';
    return summary;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Agent;
} else {
  window.Agent = Agent;
}
