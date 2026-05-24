import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-60 max-md:ml-16 min-h-screen p-6 transition-all">
        <Outlet />
      </main>
    </div>
  );
}
