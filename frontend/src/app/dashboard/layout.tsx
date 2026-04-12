import { SocketProvider } from '@/providers/SocketProvider';
import { ChatProvider } from '@/providers/ChatProvider';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider>
      <ChatProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: '#030303' }}>
          <Sidebar />

          {/* Main content offset by sidebar width on desktop */}
          <main
            className="flex-1 h-screen overflow-hidden"
            style={{ marginLeft: 'var(--sidebar-w)' }}
          >
            {children}
          </main>
        </div>
      </ChatProvider>
    </SocketProvider>
  );
}
