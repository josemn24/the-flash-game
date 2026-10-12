export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div data-surface="demo">{children}</div>;
}
