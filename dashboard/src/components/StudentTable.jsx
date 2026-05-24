import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatNumber, formatCurrency, timeAgo } from '../utils/format';

export default function StudentTable({ students = [] }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState('studentNumber');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = students.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.studentNumber.includes(q) ||
      s.subscriptionId.toLowerCase().includes(q) ||
      s.state.includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp size={14} className="opacity-20" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="text-blue-600" />
    ) : (
      <ChevronDown size={14} className="text-blue-600" />
    );
  };

  const columns = [
    { key: 'studentNumber', label: '번호', w: 'w-16' },
    { key: 'state', label: '상태', w: 'w-20' },
    { key: 'totalTokens', label: '토큰', w: 'w-24' },
    { key: 'estimatedCost', label: '비용', w: 'w-24' },
    { key: 'requests', label: '요청수', w: 'w-20' },
    { key: 'lastActive', label: '최근 활동', w: 'w-28' },
  ];

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="학생 번호 검색..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length}명</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 ${col.w}`}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((student) => (
              <tr
                key={student.subscriptionId}
                className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/students/${student.studentNumber}`)}
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  #{student.studentNumber}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={student.state} />
                </td>
                <td className="px-4 py-3 text-gray-700">{formatNumber(student.totalTokens)}</td>
                <td className="px-4 py-3 text-gray-700">{formatCurrency(student.estimatedCost)}</td>
                <td className="px-4 py-3 text-gray-700">{student.requests.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{timeAgo(student.lastActive)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
