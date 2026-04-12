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
          <main className="flex-1 h-screen overflow-hidden">
            {children}
          </main>
        </div>
      </ChatProvider>
    </SocketProvider>
  );
}
