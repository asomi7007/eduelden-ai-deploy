export const MODEL_COLORS = {
  'gpt-54-mini': '#3b82f6',   // blue-500
  'gpt-55': '#a855f7',        // purple-500
  'deepseek-v4-flash': '#10b981', // emerald-500
};

export const MODEL_LABELS = {
  'gpt-54-mini': 'GPT-54 Mini',
  'gpt-55': 'GPT-55',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
};

export const BUDGET_TOTAL = 800;

export const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const NAV_ITEMS = [
  { path: '/', label: '개요', icon: 'LayoutDashboard' },
  { path: '/students', label: '학생 관리', icon: 'Users' },
  { path: '/control', label: '일괄 제어', icon: 'Settings' },
  { path: '/alerts', label: '알림 설정', icon: 'Bell' },
];
