import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Settings, Bell, LogOut,
  FlaskConical, KeyRound, Cpu, BarChart3, ScrollText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const icons = {
  LayoutDashboard,
  Users,
  Settings,
  Bell,
  FlaskConical,
  KeyRound,
  Cpu,
  BarChart3,
  ScrollText,
};

const navItems = [
  { path: '/', label: '개요', icon: 'LayoutDashboard' },
  { path: '/workshops', label: '실습 관리', icon: 'FlaskConical' },
  { path: '/keys', label: 'API 키 관리', icon: 'KeyRound' },
  { path: '/models', label: '모델 관리', icon: 'Cpu' },
  { path: '/usage', label: '사용량 통계', icon: 'BarChart3' },
  { path: '/audit', label: '감사 로그', icon: 'ScrollText' },
  { path: '/students', label: '학생 관리', icon: 'Users' },
  { path: '/control', label: '일괄 제어', icon: 'Settings' },
  { path: '/alerts', label: '알림 설정', icon: 'Bell' },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-30 md:w-60 max-md:w-16 transition-all">
      <div className="p-4 border-b border-gray-200 max-md:px-2">
        <h1 className="text-lg font-bold text-blue-600 max-md:hidden">APIM 대시보드</h1>
        <p className="text-xs text-gray-500 mt-0.5 max-md:hidden">EduElden AI 실습 관리</p>
        <div className="hidden max-md:block text-center">
          <span className="text-blue-600 font-bold text-sm">AI</span>
        </div>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const Icon = icons[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors max-md:justify-center max-md:mx-1 max-md:px-2 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={20} />
              <span className="max-md:hidden">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 max-md:px-2">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors max-md:justify-center max-md:px-2"
        >
          <LogOut size={20} />
          <span className="max-md:hidden">로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
