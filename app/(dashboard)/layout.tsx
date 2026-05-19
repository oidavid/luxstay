import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="lux-dashboard-root">
      <Sidebar />
      <div className="lux-dashboard-main">
        <TopBar />
        <main className="lux-dashboard-content">
          {children}
        </main>
      </div>

      <style>{`
        .lux-dashboard-root {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--content-bg);
        }

        .lux-dashboard-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .lux-dashboard-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        /* On mobile, add bottom padding so content isn't hidden behind bottom nav */
        @media (max-width: 768px) {
          .lux-dashboard-content {
            padding: 16px 16px 96px;
          }
        }
      `}</style>
    </div>
  )
}
