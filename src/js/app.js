/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ App 主控制器 v3（SPA） ============
const App = {
  state: {
    currentPage: 'home',
    isLoggedIn: false,
    user: null,
    report: null,
    stack: []
  },

  data: {
    riskTypes: null,
    questionnaire: null
  },

  async init() {
    // 版权水印与签名（羽织梦 · 以梦化羽）
    try { if (window.Watermark) Watermark.init(); } catch (e) { /* ignore */ }
    try {
      await this._loadWithTimeout();
    } catch (e) {
      console.error('App.init: data load failed:', e.message);
    }

    this.hideLoading();
    this.state.user = Auth.getCurrentUser();
    this.state.isLoggedIn = Auth.isLoggedIn();

    if (!this.state.isLoggedIn) {
      this.showLogin();
      return;
    }

    this.state.report = Report.loadLatest();
    Questionnaire.restore();
    Agent.restore();
    this.renderMain();
  },

  async _loadWithTimeout() {
    const timeout = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('网络连接超时，已使用离线数据')); }, 8000);
    });
    const load = Promise.all([Questionnaire.load(), Agent.load()]);
    await Promise.race([load, timeout]);
    this.data.riskTypes = Questionnaire.riskTypes;
    this.data.questionnaire = Questionnaire.data;
  },

  // ============ 加载遮罩 ============
  showLoading(text) {
    let loading = document.getElementById('loading-overlay');
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'loading-overlay';
      loading.className = 'loading-overlay';
      loading.innerHTML =
        '<div class="loading-hero"><img src="assets/characters/brand.jpg" alt="OPC" /></div>' +
        '<div class="loading-name">OPC 风险筛查</div>' +
        '<div class="loading-sub" id="loading-text">' + (text || '加载中...') + '</div>' +
        '<div class="loading-spinner"></div>';
      document.body.appendChild(loading);
    } else {
      const t = document.getElementById('loading-text');
      if (t) t.textContent = text || '加载中...';
    }
  },

  hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(function() { loading.remove(); }, 350);
    }
  },

  // ============ Toast ============
  showToast(text) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2200);
  },

  // ============ 登录 / 注册 ============
  showLogin() {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="login-page">' +
      '  <div class="login-hero"><img src="assets/characters/brand.jpg" alt="OPC" /></div>' +
      '  <div class="login-title">OPC 风险筛查</div>' +
      '  <div class="login-sub">个人创业者 AI 协同风险智能治理助手</div>' +
      '  <div class="login-card">' +
      '    <div class="form-group"><label class="form-label">用户名</label>' +
      '      <input type="text" id="login-username" class="form-input" placeholder="请输入用户名" autocomplete="username" /></div>' +
      '    <div class="form-group"><label class="form-label">密码</label>' +
      '      <input type="password" id="login-password" class="form-input" placeholder="请输入密码" autocomplete="current-password" /></div>' +
      '    <div class="form-group" id="nickname-group" style="display:none;"><label class="form-label">昵称（可选）</label>' +
      '      <input type="text" id="login-nickname" class="form-input" placeholder="用于显示的昵称" /></div>' +
      '    <button class="btn btn-primary btn-block" id="login-submit">登录</button>' +
      '    <div class="login-toggle" id="login-toggle">还没有账号？立即注册</div>' +
      '  </div>' +
      '  <div class="login-footer">识别 · 评估 · 分级 · 预警 · 治理 · 复盘<br/>数据仅保存在本地设备</div>' +
      '</div>';

    let isRegister = false;
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const nicknameInput = document.getElementById('login-nickname');
    const nicknameGroup = document.getElementById('nickname-group');
    const submitBtn = document.getElementById('login-submit');
    const toggleBtn = document.getElementById('login-toggle');

    const handleSubmit = function() {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const nickname = nicknameInput ? nicknameInput.value.trim() : '';
      const result = isRegister
        ? Auth.register(username, password, nickname)
        : Auth.login(username, password);

      if (result.success) {
        App.state.user = result.user;
        App.state.isLoggedIn = true;
        App.showToast(isRegister ? '注册成功，已登录' : '登录成功');
        setTimeout(function() { location.reload(); }, 500);
      } else {
        App.showToast(result.error);
      }
    };

    const toggle = function() {
      isRegister = !isRegister;
      submitBtn.textContent = isRegister ? '注册' : '登录';
      toggleBtn.textContent = isRegister ? '已有账号，立即登录' : '还没有账号？立即注册';
      nicknameGroup.style.display = isRegister ? 'block' : 'none';
    };

    submitBtn.onclick = handleSubmit;
    toggleBtn.onclick = toggle;
    passwordInput.onkeypress = function(e) { if (e.key === 'Enter') handleSubmit(); };
  },

  // ============ 主界面 ============
  renderMain() {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="navbar" id="navbar">' +
      '  <div class="navbar-left" id="nav-left"></div>' +
      '  <div class="navbar-title" id="nav-title">首页</div>' +
      '  <div class="navbar-right" id="nav-right"></div>' +
      '</div>' +
      '<div class="page" id="page-content"></div>' +
      '<div class="tabbar" id="tabbar">' +
      '  <div class="tabbar-item active" data-page="home"><div class="tabbar-icon">🏠</div><div class="tabbar-label">首页</div></div>' +
      '  <div class="tabbar-item" data-page="risks"><div class="tabbar-icon">🧭</div><div class="tabbar-label">风险库</div></div>' +
      '  <div class="tabbar-item" data-page="questionnaire"><div class="tabbar-icon">📋</div><div class="tabbar-label">测评</div></div>' +
      '  <div class="tabbar-item" data-page="agent"><div class="tabbar-icon">💬</div><div class="tabbar-label">AI 助手</div></div>' +
      '  <div class="tabbar-item" data-page="profile"><div class="tabbar-icon">👤</div><div class="tabbar-label">我的</div></div>' +
      '</div>';

    this.state.currentPage = 'home';
    this._bindTabbar();
    this.renderHome();
  },

  _bindTabbar() {
    const tabbar = document.getElementById('tabbar');
    if (!tabbar) return;
    tabbar.onclick = function(e) {
      const item = e.target.closest ? e.target.closest('.tabbar-item') : null;
      if (!item) return;
      const page = item.dataset.page;
      if (page === 'questionnaire') {
        App.goToQuestionnaire();
      } else {
        App.switchPage(page);
      }
    };
  },

  _setNavbar(title, rightHtml, leftHtml) {
    const navTitle = document.getElementById('nav-title');
    const navRight = document.getElementById('nav-right');
    const navLeft = document.getElementById('nav-left');
    if (navTitle) navTitle.textContent = title || '';
    if (navRight) navRight.innerHTML = rightHtml || '';
    if (navLeft) navLeft.innerHTML = leftHtml || '';
  },

  _showTabbar(show) {
    const tabbar = document.getElementById('tabbar');
    const page = document.getElementById('page-content');
    if (tabbar) tabbar.style.display = show ? 'flex' : 'none';
    if (page) page.classList.toggle('no-tabbar', !show);
  },

  _renderPage(html) {
    const page = document.getElementById('page-content');
    if (page) page.innerHTML = html;
    page.scrollTop = 0;
    if (this.state.currentPage === 'report') {
      setTimeout(function() { Report.drawRadar(App.state.report); }, 60);
    }
  },

  switchPage(page) {
    this.state.currentPage = page;
    document.querySelectorAll('.tabbar-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.page === page);
    });

    if (page === 'agent') {
      this._showTabbar(false);
      const navbar = document.getElementById('navbar');
      if (navbar) navbar.style.display = 'none';
      this._setNavbar('', '', '');
      this.renderAgent();
      return;
    }

    this._showTabbar(true);

    const pageEl = document.getElementById('page-content');
    if (pageEl) {
      pageEl.className = 'page';
      pageEl.style.overflow = '';
    }
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.style.display = '';

    const titles = {
      home: '首页',
      risks: '风险库',
      questionnaire: '风险测评',
      agent: 'AI 助手',
      report: '风险报告',
      profile: '我的'
    };
    this._setNavbar(titles[page] || '', '', '');

    if (page === 'home') this.renderHome();
    else if (page === 'risks') this.renderRiskLibrary();
    else if (page === 'questionnaire') this.renderQuestionnaire();
    else if (page === 'agent') this.renderAgent();
    else if (page === 'report') this.renderReportPage();
    else if (page === 'profile') this.renderProfile();
  },

  // ============ 首页 ============
  renderHome() {
    const report = Report.loadLatest();
    const user = Auth.getCurrentUser();
    const nickname = user && user.nickname ? user.nickname : '创业者';
    const risks = this.data.riskTypes ? this.data.riskTypes.risks : [];

    let html = '';
    html += '<div class="home-hero fade-in">';
    html += '<div class="home-hero-greet">你好，' + nickname + ' 👋</div>';
    html += '<div class="home-hero-title">OPC 风险筛查</div>';
    html += '<div class="home-hero-desc">24 项特有风险 · 智能筛查 · 治理闭环</div>';
    html += '<div class="home-hero-img"><img src="assets/characters/brand.jpg" alt="OPC 风险筛查" /></div>';
    html += '</div>';

    html += '<div class="home-actions">';
    html += '<div class="home-action" onclick="App.goToQuestionnaire()">';
    html += '<div class="home-action-icon" style="background:var(--primary-light);">📋</div>';
    html += '<div><div class="home-action-title">风险测评</div><div class="home-action-sub">24 题生成画像</div></div>';
    html += '</div>';
    html += '<div class="home-action" onclick="App.startAgent()">';
    html += '<div class="home-action-icon" style="background:rgba(124,92,252,0.12);">💬</div>';
    html += '<div><div class="home-action-title">AI 深度访谈</div><div class="home-action-sub">个性化诊断</div></div>';
    html += '</div>';
    html += '</div>';

    if (report && report.summary) {
      const score = report.summary.overallScore;
      const level = report.summary.overallLevel;
      const color = Report.levelColor(level);
      const topNames = (report.topRisks || []).slice(0, 2).map(function(r) { return r.name; }).join('、');
      html += '<div class="card home-report" onclick="App.switchPage(\'report\')">';
      html += '<div class="home-report-top">';
      html += '<div class="home-report-score" style="background:' + color + ';">' + score + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="home-report-title">' + (report.summary.overallType || '风险画像') + '</div>';
      html += '<div class="home-report-sub">' + Report.levelText(level) + (topNames ? ' · 主要风险：' + topNames : '') + '</div>';
      html += '</div>';
      html += '<div class="menu-item-arrow">›</div>';
      html += '</div>';
      html += '<div class="home-report-foot">';
      html += Report.levelTag(level);
      html += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.startAgent()">AI 访谈</button>';
      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="card home-report">';
      html += '<div class="home-report-top">';
      html += '<div class="home-report-score" style="background:linear-gradient(135deg,#A9B7FB,#7C8EF7);">?</div>';
      html += '<div style="flex:1;">';
      html += '<div class="home-report-title">还没有风险画像</div>';
      html += '<div class="home-report-sub">完成 24 题测评，生成您的专属风险报告与治理清单</div>';
      html += '</div>';
      html += '</div>';
      html += '<div style="margin-top:var(--sp-3);"><button class="btn btn-primary btn-block" onclick="App.goToQuestionnaire()">开始测评</button></div>';
      html += '</div>';
    }

    html += '<div class="section-title" style="margin-left:var(--sp-4);">🧭 八大风险领域</div>';
    html += '<div class="risk-grid">';
    risks.forEach(function(risk) {
      const count = (risk.specificRisks || []).length;
      html += '<div class="risk-tile ' + risk.categoryId + '" onclick="App.openRiskDetail(\'' + risk.id + '\')">';
      html += '<div class="risk-tile-img">' + Report.renderCharacter(risk, 84) + '</div>';
      html += '<div class="risk-tile-name">' + risk.name + '</div>';
      html += '<div class="risk-tile-meta">' + risk.categoryName.replace('风险', '') + '</div>';
      html += '<div style="text-align:center;"><span class="risk-tile-count">' + count + ' 项具体风险</span></div>';
      html += '</div>';
    });
    html += '</div>';

    this._renderPage(html);
  },

  // ============ 风险库 ============
  renderRiskLibrary() {
    const risks = this.data.riskTypes ? this.data.riskTypes.risks : [];
    const categories = this.data.riskTypes ? this.data.riskTypes.categories : [];

    let html = '';
    categories.forEach(function(cat) {
      const catRisks = risks.filter(function(r) { return r.categoryId === cat.id; });
      const isExternal = cat.id === 'external';
      html += '<div class="category-banner" style="background:' + (isExternal ? 'linear-gradient(135deg,#F6BD16,#E67E22)' : 'var(--primary-gradient)') + ';">';
      html += '<div class="category-banner-icon">' + (cat.icon || '📌') + '</div>';
      html += '<div><div class="category-banner-name">' + cat.name + '</div>';
      html += '<div class="category-banner-desc">' + cat.description + '</div></div>';
      html += '</div>';

      html += '<div class="card" style="margin:var(--sp-3) var(--sp-4) var(--sp-5);">';
      catRisks.forEach(function(risk) {
        const count = (risk.specificRisks || []).length;
        html += '<div class="risk-list-item" onclick="App.openRiskDetail(\'' + risk.id + '\')">';
        html += Report.renderCharacter(risk, 52);
        html += '<div class="risk-list-info">';
        html += '<div class="risk-list-name">' + risk.name + '</div>';
        html += '<div class="risk-list-desc">' + count + ' 项具体风险 · ' + (risk.symptoms && risk.symptoms[0] ? risk.symptoms[0] : '') + '</div>';
        html += '</div>';
        html += '<div class="risk-list-arrow">›</div>';
        html += '</div>';
      });
      html += '</div>';
    });

    this._renderPage(html);
  },

  openRiskDetail(id) {
    const risk = this.data.riskTypes.risks.find(function(r) { return r.id === id; });
    if (!risk) return;
    this.state.stack.push(this.state.currentPage);
    this.state.currentPage = 'risk-detail';
    this._showTabbar(false);
    this._setNavbar('风险详情', '', '<div class="navbar-back" onclick="App.goBack()">‹</div>');

    const isExternal = risk.categoryId === 'external';
    let html = '';
    html += '<div class="risk-detail-hero ' + (isExternal ? 'external' : '') + ' fade-in">';
    html += Report.renderCharacter(risk, 120);
    html += '<div class="risk-detail-name">' + risk.name + '</div>';
    html += '<div class="risk-detail-cat">' + risk.categoryName + ' · ' + (risk.specificRisks || []).length + ' 项具体风险</div>';
    html += '</div>';

    html += '<div class="risk-section"><div class="card card-pad">';
    html += '<div class="risk-section-title">📖 风险描述</div>';
    html += '<div class="risk-text">' + risk.description + '</div>';
    html += '</div></div>';

    html += '<div class="risk-section"><div class="card card-pad">';
    html += '<div class="risk-section-title">🧩 具体风险（来自访谈）</div>';
    (risk.specificRisks || []).forEach(function(s) {
      html += '<div class="specific-risk">';
      html += '<div class="specific-risk-name">' + s.name + '</div>';
      html += '<div class="specific-risk-quote">' + s.quote + '</div>';
      html += '<div class="specific-risk-source">—— ' + s.source + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="risk-section"><div class="card card-pad">';
    html += '<div class="risk-section-title">🚨 可观察信号</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.symptoms || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';
    html += '<div class="risk-section-title" style="margin-top:var(--sp-4);">🌱 触发情境</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.causes || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';
    html += '<div class="risk-section-title" style="margin-top:var(--sp-4);">⚠️ 潜在后果</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.consequences || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';
    html += '</div></div>';

    html += '<div class="risk-section"><div class="card card-pad">';
    html += '<div class="risk-section-title">💡 治理建议</div><ul class="risk-list ' + risk.categoryId + '">';
    (risk.recommendations || []).forEach(function(s) { html += '<li>' + s + '</li>'; });
    html += '</ul>';
    html += '</div></div>';

    html += '<div class="risk-section"><div class="card card-pad">';
    html += '<div class="risk-section-title">📋 治理行动清单</div>';
    html += '<div class="governance-block immediate"><div class="governance-block-title">⚡ 立即处理</div><ul>';
    (risk.governance.immediate || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    html += '<div class="governance-block seven"><div class="governance-block-title">📅 7 日内</div><ul>';
    (risk.governance.sevenDay || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    html += '<div class="governance-block long"><div class="governance-block-title">🏗️ 中长期</div><ul>';
    (risk.governance.longTerm || []).forEach(function(t) { html += '<li>' + t + '</li>'; });
    html += '</ul></div>';
    html += '</div></div>';

    html += '<div style="padding:0 var(--sp-4) var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3);">';
    html += '<button class="btn btn-primary btn-block" onclick="App.goToQuestionnaire()">开始测评，看看我的该项风险</button>';
    html += '<button class="btn btn-ghost btn-block" onclick="App.goBack()">返回</button>';
    html += '</div>';

    this._renderPage(html);
  },

  // ============ 问卷 ============
  goToQuestionnaire() {
    if (this.state.currentPage !== 'questionnaire') {
      this.state.currentPage = 'questionnaire';
      document.querySelectorAll('.tabbar-item').forEach(function(item) {
        item.classList.toggle('active', item.dataset.page === 'questionnaire');
      });
      this._showTabbar(true);
    }
    const pageEl = document.getElementById('page-content');
    if (pageEl) {
      pageEl.className = 'page';
      pageEl.style.overflow = '';
    }
    this._setNavbar('风险测评', '', '');
    this.renderQuestionnaire();
  },

  renderQuestionnaire() {
    const total = Questionnaire.getTotal();
    const basicTotal = Questionnaire.getBasicTotal();
    const basicDone = Questionnaire.getBasicAnsweredCount();

    // 基础信息未完成 → 先填基础信息
    if (basicDone < basicTotal) {
      this._renderBasicInfo();
      return;
    }

    const q = Questionnaire.getCurrentQuestion();
    if (!q) {
      // 全部完成 → 生成报告
      const report = Questionnaire.complete();
      this.state.report = report;
      this.switchPage('report');
      return;
    }

    const index = Questionnaire.getCurrentIndex();
    const progress = Math.round(((index + 1) / total) * 100);
    const risk = this.data.riskTypes.risks.find(function(r) { return r.id === q.riskId; });
    const answered = Questionnaire.answers[q.id];

    let html = '';
    html += '<div class="quiz-progress">';
    html += '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + progress + '%;"></div></div>';
    html += '<div class="quiz-progress-text"><span>第 ' + (index + 1) + ' / ' + total + ' 题</span><span>' + progress + '%</span></div>';
    html += '</div>';

    html += '<div class="quiz-char character-frame" style="' + (risk ? 'border-color:' + risk.color : '') + ';">';
    html += '<img src="' + (risk ? Report.characterImage(risk) : 'assets/characters/brand.jpg') + '" alt="" onerror="this.style.display=\'none\';" />';
    html += '</div>';

    html += '<div class="quiz-question">';
    html += '<div class="quiz-question-text">' + q.text + '</div>';
    html += '<div class="quiz-question-risk">' + (risk ? risk.categoryName + ' · ' + q.riskName : '') + '</div>';
    html += '</div>';

    const labels = this.data.questionnaire.meta.scale.labels;
    html += '<div class="quiz-options">';
    for (let i = 1; i <= 5; i++) {
      html += '<div class="quiz-option' + (answered === i ? ' selected' : '') + '" data-qid="' + q.id + '" data-score="' + i + '">';
      html += '<div class="quiz-option-num">' + i + '</div>';
      html += '<div class="quiz-option-label">' + labels[String(i)] + '</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="quiz-nav">';
    html += '<button class="btn btn-outline" id="quiz-prev" ' + (index === 0 ? 'disabled style="opacity:0.4;"' : '') + '>上一题</button>';
    html += '<button class="btn btn-primary" id="quiz-next">' + (index === total - 1 ? '完成' : '下一题') + '</button>';
    html += '</div>';

    this._renderPage(html);

    document.querySelectorAll('.quiz-option').forEach(function(el) {
      el.onclick = function() {
        const qid = el.dataset.qid;
        const score = parseInt(el.dataset.score, 10);
        Questionnaire.answer(qid, score);
        document.querySelectorAll('.quiz-option').forEach(function(o) { o.classList.remove('selected'); });
        el.classList.add('selected');
      };
    });

    const prevBtn = document.getElementById('quiz-prev');
    const nextBtn = document.getElementById('quiz-next');
    if (prevBtn) prevBtn.onclick = function() { if (Questionnaire.prev()) App.renderQuestionnaire(); };
    if (nextBtn) nextBtn.onclick = function() {
      if (Questionnaire.answers[q.id] === undefined) {
        App.showToast('请先选择您的同意程度');
        return;
      }
      Questionnaire.next();
      App.renderQuestionnaire();
    };
  },

  _renderBasicInfo() {
    const basicInfo = this.data.questionnaire.basicInfo;
    const done = Questionnaire.getBasicAnsweredCount();
    const q = basicInfo[done];
    if (!q) {
      this.renderQuestionnaire();
      return;
    }

    let html = '';
    html += '<div class="quiz-progress">';
    html += '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + Math.round((done / basicInfo.length) * 100) + '%;"></div></div>';
    html += '<div class="quiz-progress-text"><span>基础信息 ' + (done + 1) + ' / ' + basicInfo.length + '</span><span>了解您的经营概况</span></div>';
    html += '</div>';

    html += '<div class="quiz-basic">';
    html += '<div class="quiz-basic-title">' + q.text + '</div>';
    html += '<div class="quiz-basic-sub">用于生成「关键诊断因素」，不影响问卷计分</div>';
    html += '<div class="quiz-basic-options">';
    q.options.forEach(function(opt, idx) {
      const selected = Questionnaire.basicInfo[q.id] === opt;
      html += '<div class="quiz-basic-option' + (selected ? ' selected' : '') + '" data-bid="' + q.id + '" data-opt="' + idx + '">' + opt + '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="quiz-nav">';
    html += '<button class="btn btn-outline" id="quiz-prev">上一步</button>';
    html += '<button class="btn btn-primary" id="quiz-next">下一步</button>';
    html += '</div>';

    this._renderPage(html);

    let selected = false;
    document.querySelectorAll('.quiz-basic-option').forEach(function(el) {
      el.onclick = function() {
        const bid = el.dataset.bid;
        const opt = q.options[parseInt(el.dataset.opt, 10)];
        Questionnaire.answerBasic(bid, opt);
        document.querySelectorAll('.quiz-basic-option').forEach(function(o) { o.classList.remove('selected'); });
        el.classList.add('selected');
        selected = true;
      };
    });

    const prevBtn = document.getElementById('quiz-prev');
    const nextBtn = document.getElementById('quiz-next');
    if (prevBtn) prevBtn.onclick = function() {
      if (done > 0) {
        const prevQ = basicInfo[done - 1];
        if (prevQ) delete Questionnaire.basicInfo[prevQ.id];
        Questionnaire.saveProgress();
        App._renderBasicInfo();
      } else {
        App.switchPage('home');
      }
    };
    if (nextBtn) nextBtn.onclick = function() {
      if (!selected && Questionnaire.basicInfo[q.id] === undefined) {
        App.showToast('请选择一个选项');
        return;
      }
      App._renderBasicInfo();
    };
  },

  retakeQuestionnaire() {
    const ok = window.confirm('确定要重新评估吗？当前问卷答案将被清空。');
    if (!ok) return;
    Questionnaire.reset();
    Storage.resetCurrentSession();
    this.state.report = null;
    this.goToQuestionnaire();
  },

  // ============ 报告页 ============
  renderReportPage() {
    this.state.report = Report.loadLatest();
    const html = Report.renderReport(this.state.report);
    this._renderPage(html);
  },

  archiveAndReset() {
    if (!this.state.report) return;
    const result = Report.archiveCurrent(this.state.report);
    if (result.success) {
      this.showToast('已归档到历史档案');
    }
    Questionnaire.reset();
    Storage.resetCurrentSession();
    Agent.clear();
    this.state.report = null;
    this.switchPage('profile');
  },

  // ============ AI 助手 ============
  startAgent() {
    this.switchPage('agent');
  },

  renderAgent() {
    const page = document.getElementById('page-content');
    page.className = 'agent-page';
    page.style.overflow = 'hidden';
    page.innerHTML =
      '<div class="agent-header">' +
      '  <div class="agent-header-back" onclick="App.goHome()">‹</div>' +
      '  <div class="character-frame"><img src="assets/characters/assistant.jpg" alt="小盾" onerror="this.style.display=\'none\';" /></div>' +
      '  <div><div class="agent-header-name">' + Agent.agentName + '</div>' +
      '  <div class="agent-header-status">' + (Agent.externalAPI.enabled && Agent.externalAPI.apiKey ? 'DeepSeek · ' + Agent.externalAPI.model : '本地模式（可在「我的-API设置」接入 DeepSeek）') + '</div></div>' +
      '  <div class="agent-header-tag" onclick="App.startNewAgent()">🔄 新访谈</div>' +
      '</div>' +
      '<div class="agent-messages" id="agent-messages"></div>' +
      '<div class="agent-quick" id="agent-quick"></div>' +
      '<div class="agent-input">' +
      '  <textarea id="agent-input" placeholder="描述您的情况，或回复小盾的问题..." rows="1"></textarea>' +
      '  <button class="agent-send" id="agent-send">➤</button>' +
      '</div>';

    this._bindAgentEvents();

    // 初始化会话
    if (Agent.conversation.length === 0) {
      const report = Report.loadLatest();
      Agent.start(report, null);
    }
    this._renderAgentMessages();
  },

  _bindAgentEvents() {
    const input = document.getElementById('agent-input');
    const send = document.getElementById('agent-send');

    const doSend = function() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      Agent.userInput(text).then(function() {
        App._renderAgentMessages();
      });
    };

    send.onclick = doSend;
    input.onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    };
    input.addEventListener('input', function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // 快捷提问
    const quick = document.getElementById('agent-quick');
    if (quick) {
      quick.innerHTML = [
        '我的最大风险是什么？',
        '我该怎么办？',
        '请给出治理清单',
        'AI 内容会侵权吗？'
      ].map(function(t) {
        return '<button onclick="App.sendQuick(\'' + t.replace(/'/g, '') + '\')">' + t + '</button>';
      }).join('');
    }
  },

  sendQuick(text) {
    const input = document.getElementById('agent-input');
    if (input) input.value = text;
    const send = document.getElementById('agent-send');
    if (send) send.click();
  },

  _renderAgentMessages() {
    const container = document.getElementById('agent-messages');
    if (!container) return;
    const messages = Agent.getMessages();
    let html = '';

    if (messages.length === 0) {
      html += '<div class="empty" style="padding:var(--sp-8) var(--sp-4);">' +
        '<div class="empty-icon">💬</div>' +
        '<div class="empty-text">完成风险测评后，与 AI 助手深入诊断</div>' +
        '<div style="margin-top:var(--sp-4);"><button class="btn btn-primary" onclick="App.goToQuestionnaire()">先去测评</button></div>' +
        '</div>';
    }

    messages.forEach(function(msg) {
      const isUser = msg.role === 'user';
      const time = new Date(msg.timestamp).toTimeString().slice(0, 5);
      const isLoading = msg.meta && msg.meta.type === 'loading';
      html += '<div class="msg ' + (isUser ? 'msg-user' : 'msg-agent') + (isLoading ? ' msg-loading' : '') + '">';
      if (!isUser) {
        html += '<div class="character-frame"><img src="assets/characters/assistant.jpg" alt="小盾" onerror="this.style.display=\'none\';" /></div>';
      }
      html += '<div style="max-width:calc(100% - 46px);">';
      if (isLoading) {
        html += '<div class="msg-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
      } else {
        html += '<div class="msg-bubble">' + this._escapeHtml(msg.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') + '</div>';
      }
      html += '<div class="msg-time">' + time + '</div>';
      html += '</div></div>';
    }.bind(this));

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  },

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  startNewAgent() {
    Agent.saveConversationNote();
    Agent.clear();
    const report = Report.loadLatest();
    Agent.start(report, null);
    this._renderAgentMessages();
    this.showToast('已开始新的访谈');
  },

  goHome() {
    this.switchPage('home');
  },

  // ============ 我的 ============
  renderProfile() {
    const user = Auth.getCurrentUser();
    const history = Storage.getReportsHistory();
    const nickname = user && user.nickname ? user.nickname : '创业者';
    const apiEnabled = Agent.externalAPI.enabled && Agent.externalAPI.apiKey;
    let memInfo = '';
    try {
      if (window.Memory) {
        const ms = Memory.getStore();
        memInfo = (ms.assessments ? ms.assessments.length : 0) + ' 次';
      }
    } catch (e) { /* ignore */ }

    let html = '';
    html += '<div class="profile-card fade-in">';
    html += '<div class="profile-avatar">' + (nickname ? nickname[0] : '创') + '</div>';
    html += '<div><div class="profile-name">' + nickname + '</div>';
    html += '<div class="profile-sub">@' + (user ? user.username : '') + ' · ' + history.length + ' 次评估记录</div></div>';
    html += '</div>';

    html += '<div class="menu-group">';
    html += '<div class="menu-item" onclick="App.showHistory()"><div class="menu-item-icon">📊</div><div class="menu-item-label">历史评估</div><div class="menu-item-value">' + history.length + ' 条</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.showMemory()"><div class="menu-item-icon">🧠</div><div class="menu-item-label">记忆与知识沉淀</div><div class="menu-item-value">' + memInfo + '</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.showSettings()"><div class="menu-item-icon">🔌</div><div class="menu-item-label">AI 接口设置</div><div class="menu-item-value">' + (apiEnabled ? Agent.externalAPI.model : '未配置') + '</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.editNickname()"><div class="menu-item-icon">✏️</div><div class="menu-item-label">修改昵称</div><div class="menu-item-value">' + nickname + '</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.retakeQuestionnaire()"><div class="menu-item-icon">🔄</div><div class="menu-item-label">重新评估</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.about()"><div class="menu-item-icon">ℹ️</div><div class="menu-item-label">关于本工具</div><div class="menu-item-arrow">›</div></div>';
    html += '<div class="menu-item" onclick="App.logout()"><div class="menu-item-icon">🚪</div><div class="menu-item-label" style="color:#E5484D;">退出登录</div><div class="menu-item-arrow">›</div></div>';
    html += '</div>';

    html += '<div class="settings-note">v3.7 · 风险体系基于《OPC 企业风险故事线与风险链（完整版）》（2 大风险域 · 8 大风险类 · 24 项具体风险）；治理流程遵循《第五章 智能体设计》，知识库已纳入质性调查《编码后的发现汇总》，图标采用新版风险符号。</div>';
    html += '<div style="margin:0 var(--sp-4) var(--sp-4);">' + Watermark.inlineHtml() + '</div>';

    this._renderPage(html);
  },

  showHistory() {
    this.state.stack.push(this.state.currentPage);
    this.state.currentPage = 'history';
    this._showTabbar(false);
    this._setNavbar('历史评估', '', '<div class="navbar-back" onclick="App.goBack()">‹</div>');
    const history = Storage.getReportsHistory();
    this._renderPage(Report.renderHistoryList(history));
  },

  // ============ 记忆与知识沉淀 ============
  showMemory() {
    this.state.stack.push(this.state.currentPage);
    this.state.currentPage = 'memory';
    this._showTabbar(false);
    this._setNavbar('记忆与知识沉淀', '', '<div class="navbar-back" onclick="App.goBack()">‹</div>');
    this._renderPage(this._renderMemoryPage());
  },

  _renderMemoryPage() {
    const store = Memory.getStore();
    const agg = Memory.getAggregate();
    const profile = store.profile;

    let html = '';

    // 动态档案
    html += '<div class="settings-note">架构 v3.2：每次完成问卷，App 会自动把结果沉淀为「动态档案 + 记忆条目 + 本地经验」，AI 助手在后续访谈中会调用这些记忆，让诊断越来越了解您。</div>';

    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">🧬 动态风险档案</div>';
    if (profile) {
      const d = new Date(profile.lastAssessmentAt);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const color = Report.levelColor(profile.overallLevel);
      html += '<div style="display:flex;align-items:center;gap:var(--sp-3);margin-top:var(--sp-2);">';
      html += '<div class="home-report-score" style="background:' + color + ';">' + profile.overallScore + '</div>';
      html += '<div style="flex:1;">';
      html += '<div style="font-weight:700;">' + (profile.overallType || '风险画像') + '</div>';
      html += '<div class="form-hint" style="margin-top:2px;">' + dateStr + ' · 共 ' + (store.assessments ? store.assessments.length : 0) + ' 次评估 · ' + Report.levelText(profile.overallLevel) + '</div>';
      html += '</div></div>';
      if (profile.topRisks && profile.topRisks.length) {
        html += '<div style="margin-top:var(--sp-3);">';
        profile.topRisks.forEach(function(r) {
          html += '<span class="support-chip" style="margin-bottom:var(--sp-2);">' + r.name + ' ' + r.percent + '</span>';
        });
        html += '</div>';
      }
    } else {
      html += '<div class="empty" style="padding:var(--sp-4);"><div class="empty-text" style="font-size:var(--fs-sm);">还没有评估记录，完成一次问卷后会自动生成</div></div>';
    }
    html += '</div></div>';

    // 记忆条目
    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">📝 记忆条目（智能体可调用）</div>';
    html += '<div class="card-sub" style="margin-bottom:var(--sp-2);">由问卷答案与基础信息自动生成</div>';
    if (store.facts && store.facts.length) {
      html += '<ul class="risk-list">';
      store.facts.slice(0, 10).forEach(function(f) {
        const dot = f.level === 'high' ? '#F56C6C' : (f.level === 'medium' ? '#E6A23C' : '#5B8FF9');
        html += '<li style="font-size:var(--fs-sm);padding-left:14px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + dot + ';margin-right:6px;"></span>' + f.text + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<div class="empty" style="padding:var(--sp-3);"><div class="empty-text" style="font-size:var(--fs-sm);">暂无记忆条目</div></div>';
    }
    html += '</div></div>';

    // 对话备忘
    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">💬 对话备忘</div>';
    if (store.conversations && store.conversations.length) {
      html += '<ul class="risk-list">';
      store.conversations.slice(0, 5).forEach(function(c) {
        const d = new Date(c.date);
        const ds = d.getMonth() + 1 + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        html += '<li style="font-size:var(--fs-sm);padding-left:14px;"><span style="color:var(--text-3);font-size:var(--fs-xs);margin-right:6px;">' + ds + '</span>' + c.summary + '</li>';
      });
      html += '</ul>';
    } else {
      html += '<div class="empty" style="padding:var(--sp-3);"><div class="empty-text" style="font-size:var(--fs-sm);">暂无对话备忘，与 AI 助手访谈后会自动保存</div></div>';
    }
    html += '</div></div>';

    // 本地知识沉淀
    html += '<div class="report-section"><div class="card card-pad">';
    html += '<div class="card-title">📚 本地知识沉淀（问卷 → 知识库）</div>';
    html += '<div class="card-sub" style="margin-bottom:var(--sp-2);">本机所有问卷的匿名聚合，随评估次数增长，可导出用于知识库迭代</div>';
    html += '<div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-3);">';
    html += '<span class="tag tag-internal">样本 ' + (agg.count || 0) + ' 份</span>';
    if (agg.highCount) html += '<span class="tag tag-high">高风险 ' + agg.highCount + ' 次</span>';
    html += '</div>';
    const hits = Object.keys(agg.riskHits || {});
    if (hits.length) {
      const max = Math.max.apply(null, hits.map(function(h) { return agg.riskHits[h]; }));
      hits.sort(function(a, b) { return agg.riskHits[b] - agg.riskHits[a]; });
      hits.slice(0, 5).forEach(function(id) {
        const cnt = agg.riskHits[id];
        html += '<div style="display:flex;align-items:center;gap:var(--sp-3);padding:4px 0;">';
        html += '<div style="flex:1;min-width:0;"><div style="font-size:var(--fs-sm);">' + Memory._riskName(id) + '</div>';
        html += '<div class="mini-bar"><div class="mini-bar-fill" style="width:' + Math.round(cnt / max * 100) + '%;background:var(--primary);"></div></div></div>';
        html += '<div style="font-size:var(--fs-sm);font-weight:700;">' + cnt + '</div>';
        html += '</div>';
      });
    } else {
      html += '<div class="form-hint">完成问卷后这里会出现命中率最高的风险统计</div>';
    }
    html += '</div></div>';

    // 操作
    html += '<div style="padding:0 var(--sp-4) var(--sp-6);display:flex;flex-direction:column;gap:var(--sp-3);">';
    html += '<button class="btn btn-primary btn-block" onclick="App.exportMemory()">📤 导出记忆 JSON（用于知识库迭代）</button>';
    html += '<button class="btn btn-ghost btn-block" onclick="App.resetMemory()">🗑️ 清空我的记忆</button>';
    html += '<button class="btn btn-outline btn-block" onclick="App.goBack()">返回</button>';
    html += '</div>';

    // 导出结果容器
    html += '<textarea id="memory-export-area" style="position:fixed;left:-9999px;top:0;" readonly></textarea>';
    return html;
  },

  exportMemory() {
    let json = Memory.exportJSON();
    try {
      const obj = JSON.parse(json);
      obj.provenance = Watermark.provenance({ type: 'memory-export' });
      json = JSON.stringify(obj, null, 2);
    } catch (e) { /* ignore */ }
    const area = document.getElementById('memory-export-area');
    if (area) {
      area.value = json;
      area.style.position = 'fixed';
      area.style.left = '0';
      area.style.top = '0';
      area.style.width = '100%';
      area.style.height = '70vh';
      area.style.zIndex = '200';
      area.style.fontSize = '11px';
      area.style.padding = '12px';
      area.style.position = 'fixed';
      area.focus();
      area.select();
    }
    this.showToast('已生成记忆 JSON（可长按复制）');
  },

  resetMemory() {
    const ok = window.confirm('确定清空本账号的记忆档案吗？历史报告与本地知识沉淀会保留。');
    if (!ok) return;
    Memory.reset();
    this.showToast('记忆已清空');
    this._renderPage(this._renderMemoryPage());
  },

  viewHistoryReport(id) {
    const history = Storage.getReportsHistory();
    const item = history.find(function(h) { return h.id === id; });
    if (!item) { this.showToast('报告不存在'); return; }
    this.state.currentHistoryId = id;
    this.state.stack.push('history');
    this.state.currentPage = 'history-detail';
    this._showTabbar(false);
    this._setNavbar('历史报告', '', '<div class="navbar-back" onclick="App.goBack()">‹</div>');
    this._renderPage(Report.renderHistoryDetail(item));
  },

  reassessFromHistory() {
    Questionnaire.reset();
    Storage.resetCurrentSession();
    this.state.report = null;
    this.goToQuestionnaire();
  },

  showSettings() {
    this.state.stack.push(this.state.currentPage);
    this.state.currentPage = 'settings';
    this._showTabbar(false);
    this._setNavbar('AI 接口设置', '', '<div class="navbar-back" onclick="App.goBack()">‹</div>');

    const cfg = Agent.externalAPI;
    let html = '';
    html += '<div class="settings-note">智能体默认使用 DeepSeek（OpenAI 兼容接口）。填入 API Key 后即可启用在线问答；未配置时自动使用内置知识库本地回答。API Key 仅保存在本机。</div>';
    html += '<div class="quiz-basic" style="margin-top:var(--sp-4);">';
    html += '<div class="quiz-basic-title">接口配置</div>';
    html += '<div style="height:var(--sp-3);"></div>';
    html += '<div class="form-group"><label class="form-label">API 地址</label>' +
      '<input type="text" id="cfg-endpoint" class="form-input" value="' + cfg.endpoint + '" placeholder="https://api.deepseek.com/v1/chat/completions" /></div>';
    html += '<div class="form-group"><label class="form-label">API Key</label>' +
      '<input type="password" id="cfg-key" class="form-input" value="' + cfg.apiKey + '" placeholder="sk-..." autocomplete="off" /></div>';
    html += '<div class="form-group"><label class="form-label">模型</label>' +
      '<input type="text" id="cfg-model" class="form-input" value="' + cfg.model + '" placeholder="deepseek-chat" /></div>';
    html += '<div style="display:flex;gap:var(--sp-3);">';
    html += '<button class="btn btn-ghost" id="cfg-test" style="flex:1;">测试连接</button>';
    html += '<button class="btn btn-primary" id="cfg-save" style="flex:1;">保存配置</button>';
    html += '</div>';
    html += '<div id="cfg-result" style="margin-top:var(--sp-3);font-size:var(--fs-sm);color:var(--text-2);"></div>';
    html += '</div>';

    html += '<div class="quiz-basic">';
    html += '<div class="quiz-basic-title">模型说明</div>';
    html += '<div class="form-hint" style="line-height:1.8;margin-top:var(--sp-2);">' +
      '· 默认模型：deepseek-chat（V3 系列对话模型）<br/>' +
      '· 深度推理可切换：deepseek-reasoner（R1 系列）<br/>' +
      '· 申请 Key：DeepSeek 开放平台 platform.deepseek.com<br/>' +
      '· 智能体编号：' + Agent.agentId + '（API 请求头 X-Agent-Id）' +
      '</div>';
    html += '</div>';

    this._renderPage(html);

    document.getElementById('cfg-save').onclick = function() {
      const endpoint = document.getElementById('cfg-endpoint').value.trim();
      const apiKey = document.getElementById('cfg-key').value.trim();
      const model = document.getElementById('cfg-model').value.trim();
      if (!endpoint || !model) { App.showToast('请填写接口地址和模型'); return; }
      Agent.configureExternalAPI({ endpoint: endpoint, apiKey: apiKey, model: model, enabled: !!apiKey });
      App.showToast(apiKey ? '已保存并启用在线模式' : '已保存（未填 Key，使用本地模式）');
    };

    document.getElementById('cfg-test').onclick = function() {
      const endpoint = document.getElementById('cfg-endpoint').value.trim();
      const apiKey = document.getElementById('cfg-key').value.trim();
      const model = document.getElementById('cfg-model').value.trim();
      const result = document.getElementById('cfg-result');
      result.textContent = '⏳ 正在测试...';
      Agent.testConnection(endpoint, apiKey, model).then(function(res) {
        result.textContent = res.success ? '✅ ' + res.message : '❌ ' + res.message;
      });
    };
  },

  editNickname() {
    const nickname = window.prompt('请输入新的昵称：', Auth.getCurrentUser() ? Auth.getCurrentUser().nickname : '');
    if (nickname && nickname.trim()) {
      Auth.updateProfile({ nickname: nickname.trim() });
      this.showToast('昵称已更新');
      this.renderProfile();
    }
  },

  about() {
    window.alert(
      'OPC 风险筛查 v3.7\n\n' +
      '基于《OPC企业风险故事线与风险链（完整版）》构建 24 项特有风险体系，' +
      '治理流程遵循《第五章 人工智能OPC特有风险智能治理智能体设计与应用》，' +
      '知识库纳入质性调查《编码后的发现汇总》。\n\n' +
      '功能：风险测评 · 分级预警 · AI 深度访谈（DeepSeek）· 治理清单 · 动态复盘 · 问卷记忆沉淀\n\n' +
      Watermark.copyright + '\n' +
      '作者：' + Watermark.author + '（' + Watermark.authorLatin + '）\n' +
      '签名：' + Watermark.motto + '\n' +
      '标记编号：' + Watermark.markId
    );
  },

  logout() {
    const ok = window.confirm('确定退出登录吗？本地数据会保留。');
    if (!ok) return;
    Auth.logout();
    location.reload();
  },

  goBack() {
    const prev = this.state.stack.pop();
    if (prev && ['home', 'risks', 'questionnaire', 'agent', 'report', 'profile'].indexOf(prev) >= 0) {
      this.switchPage(prev);
    } else {
      this.switchPage('home');
    }
  }
};

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', function() {
  App.showLoading('正在加载风险知识库...');
  App.init();
});
