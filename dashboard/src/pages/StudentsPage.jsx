import { useApi } from '../hooks/useApi';
import StudentTable from '../components/StudentTable';
import { REFRESH_INTERVAL } from '../utils/constants';

export default function StudentsPage() {
  const { data, loading, error, refetch } = useApi('/students', { sort: 'tokens' }, {
    refreshInterval: REFRESH_INTERVAL,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">학생 관리</h2>
        <button onClick={refetch} disabled={loading} className="btn-secondary text-sm">
          {loading ? '갱신 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="card flex items-center justify-center h-48 text-gray-400">
          로딩 중...
        </div>
      ) : (
        <StudentTable students={data?.students || []} />
      )}
    </div>
  );
}
