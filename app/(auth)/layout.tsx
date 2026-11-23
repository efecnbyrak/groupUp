export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main data-archetype="editorial" className="flex flex-1 items-start justify-center px-(--space-4) py-(--space-12) sm:items-center">
      {children}
    </main>
  );
}
