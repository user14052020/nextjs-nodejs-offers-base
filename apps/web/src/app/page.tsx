import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <div className="container grid" style={{ gap: 24 }}>
        <section className="card">
          <h1>Offers Base</h1>
          <p className="muted">
            Минимальный кабинет ИП: организации, клиенты, выполненные работы и PDF‑документы.
          </p>
          <Link className="button" href="/login">
            Перейти к входу
          </Link>
        </section>
      </div>
    </main>
  );
}
