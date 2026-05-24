import { useState, useEffect } from 'react';
import { Bell, Save } from 'lucide-react';
import { useApi, useApiPost } from '../hooks/useApi';

export default function AlertsPage() {
  const { data, loading, refetch } = useApi('/alerts');
  const { execute, loading: saving, error } = useApiPost();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        budgetThresholds: data.budgetThresholds || [],
        studentThresholds: data.studentThresholds || {},
        notifications: data.notifications || {},
      });
    }
  }, [data]);

  const toggleThreshold = (idx) => {
    setForm((prev) => {
      const thresholds = [...prev.budgetThresholds];
      thresholds[idx] = { ...thresholds[idx], notify: !thresholds[idx].notify };
      return { ...prev, budgetThresholds: thresholds };
    });
  };

  const updateStudentThreshold = (key, value) => {
    setForm((prev) => ({
      ...prev,
      studentThresholds: { ...prev.studentThresholds, [key]: value },
    }));
  };

  const updateNotifications = (key, value) => {
    setForm((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaved(false);
    try {
      await execute('/alerts', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      refetch();
    } catch (e) {
      // error in hook
    }
  };

  if (loading && !form) {
    return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">알림 설정</h2>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          <Save size={16} />
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
          설정이 저장되었습니다.
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Budget Thresholds */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell size={18} className="text-blue-600" />
          예산 임계값 알림
        </h3>
        <div className="space-y-3">
          {form.budgetThresholds.map((t, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500">
                  동작: {t.action === 'email' ? '이메일 발송' : '전체 정지 + 이메일'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.notify}
                  onChange={() => toggleThreshold(idx)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Student Thresholds */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">학생별 임계값</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">일일 요청 제한</label>
            <input
              type="number"
              value={form.studentThresholds.dailyRequests || 200}
              onChange={(e) => updateStudentThreshold('dailyRequests', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">일일 비용 제한 ($)</label>
            <input
              type="number"
              step="0.5"
              value={form.studentThresholds.dailyCost || 5}
              onChange={(e) => updateStudentThreshold('dailyCost', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.studentThresholds.notifyAdmin ?? true}
                onChange={(e) => updateStudentThreshold('notifyAdmin', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <span className="text-sm text-gray-700">관리자에게 알림</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.studentThresholds.autoSuspend ?? false}
                onChange={(e) => updateStudentThreshold('autoSuspend', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <span className="text-sm text-gray-700">자동 정지</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">알림 수신 설정</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">관리자 이메일</label>
            <input
              type="email"
              value={form.notifications.adminEmail || ''}
              onChange={(e) => updateNotifications('adminEmail', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.notifications.enabled ?? true}
                onChange={(e) => updateNotifications('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <span className="text-sm text-gray-700">알림 활성화</span>
          </div>
        </div>
      </div>
    </div>
  );
}
