import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <main>
      <div className="container" style={{ maxWidth: 420 }}>
        <LoginForm />
      </div>
    </main>
  );
}
