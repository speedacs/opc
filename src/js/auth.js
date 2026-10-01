/* 羽织梦 · 以梦化羽｜签名：羽织梦，以梦化羽；所织皆梦，所梦皆羽 */
// ============ 本地账号系统 ============
const Auth = {
  register(username, password, nickname) {
    username = (username || '').trim();
    if (!username) return { success: false, error: '请输入用户名' };
    if (!password || password.length < 4) return { success: false, error: '密码至少 4 位' };

    const users = Storage.getUsers();
    if (users[username]) return { success: false, error: '用户名已存在' };

    const user = {
      username,
      nickname: (nickname || '').trim() || username,
      passwordHash: Storage.hashPassword(password),
      createdAt: Date.now(),
      avatar: null
    };
    users[username] = user;
    Storage.saveUsers(users);
    Storage.setCurrentUser(user);
    return { success: true, user };
  },

  login(username, password) {
    username = (username || '').trim();
    const users = Storage.getUsers();
    const user = users[username];
    if (!user) return { success: false, error: '用户不存在' };
    if (user.passwordHash !== Storage.hashPassword(password || '')) {
      return { success: false, error: '密码错误' };
    }
    Storage.setCurrentUser(user);
    return { success: true, user };
  },

  getCurrentUser() {
    return Storage.getCurrentUser();
  },

  isLoggedIn() {
    return !!Storage.getCurrentUser();
  },

  logout() {
    Storage.clearCurrentUser();
  },

  updateProfile(patch) {
    const user = Storage.getCurrentUser();
    if (!user) return null;
    const users = Storage.getUsers();
    const updated = Object.assign({}, user, patch);
    users[user.username] = updated;
    Storage.saveUsers(users);
    Storage.setCurrentUser(updated);
    return updated;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Auth;
} else {
  window.Auth = Auth;
}
