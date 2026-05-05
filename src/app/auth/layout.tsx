export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="premium-page flex min-h-screen w-full items-start justify-center px-4 py-8 sm:items-center sm:py-12">
      {children}
    </div>
  );
}
