import { SocketProvider } from '@/providers/SocketProvider';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-[#0F0F12]">
        <Sidebar />

        {/* Main content area offset by sidebar width on desktop */}
        <main
          className="flex-1 h-screen overflow-hidden"
          style={{ marginLeft: 'var(--sidebar-w)' }}
        >
          {children}
        </main>
      </div>
    </SocketProvider>
  );
}
