export default function AppLayout({ children }: LayoutProps<"/">) {
  return <main className="mx-auto flex w-full max-w-(--content-width-md) flex-1 flex-col gap-(--space-6) px-(--space-4) py-(--space-8)">{children}</main>;
}
