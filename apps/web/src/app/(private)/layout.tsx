import { AuthGate } from '@/widgets/layout/AuthGate';
import { TopNav } from '@/widgets/layout/TopNav';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <TopNav />
      <main>
        <div className="container">{children}</div>
      </main>
    </AuthGate>
  );
}
