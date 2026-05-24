import { useState } from 'react';
import { RotateCcw, Pause, Play } from 'lucide-react';
import { useApiPost } from '../hooks/useApi';
import ConfirmDialog from '../components/ConfirmDialog';

const ACTIONS = [
  {
    id: 'resetQuota',
    label: 'Quota 전체 초기화',
    desc: '모든 학생의 일일 사용량 카운터를 리셋합니다.',
    icon: RotateCcw,
    color: 'blue',
    danger: false,
    body: { action: 'resetQuota' },
  },
  {
    id: 'suspendAll',
    label: '전체 정지',
    desc: '모든 학생의 API 접근을 일시 정지합니다. 긴급 상황에서 사용하세요.',
    icon: Pause,
    color: 'red',
    danger: true,
    body: { action: 'suspendAll' },
  },
  {
    id: 'activateAll',
    label: '전체 활성화',
    desc: '정지된 모든 학생의 API 접근을 다시 활성화합니다.',
    icon: Play,
    color: 'green',
    danger: false,
    body: { action: 'activateAll' },
  },
];

export default function ControlPage() {
  const [confirm, setConfirm] = useState(null);
  const [result, setResult] = useState(null);
  const { execute, loading, error } = useApiPost();

  const handleConfirm = async () => {
    const action = confirm;
    setConfirm(null);
    try {
      const res = await execute('/control/bulk', action.body);
      setResult({ success: true, message: res?.message || '완료되었습니다.' });
    } catch (e) {
      setResult({ success: false, message: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">일괄 제어</h2>
      <p className="text-sm text-gray-500">
        전체 학생에 대한 일괄 작업을 수행합니다. 작업은 되돌릴 수 있습니다.
      </p>

      {result && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result.message}
          <button onClick={() => setResult(null)} className="ml-4 underline text-xs">
            닫기
          </button>
        </div>
      )}

      {error && !result && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const colorClasses = {
            blue: 'border-blue-200 hover:border-blue-400',
            red: 'border-red-200 hover:border-red-400',
            green: 'border-green-200 hover:border-green-400',
          };
          const iconBg = {
            blue: 'bg-blue-50 text-blue-600',
            red: 'bg-red-50 text-red-600',
            green: 'bg-green-50 text-green-600',
          };
          return (
            <div
              key={action.id}
              className={`card border-2 transition-colors ${colorClasses[action.color]}`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${iconBg[action.color]}`}>
                <Icon size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{action.label}</h3>
              <p className="text-sm text-gray-500 mb-6">{action.desc}</p>
              <button
                onClick={() => setConfirm(action)}
                disabled={loading}
                className={action.danger ? 'btn-danger w-full text-sm' : 'btn-primary w-full text-sm'}
              >
                {loading ? '처리 중...' : '실행'}
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.label}
        message={`정말로 "${confirm?.label}" 작업을 실행하시겠습니까?`}
        confirmLabel="실행"
        danger={confirm?.danger}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
