import AdminMainLayout from '@/components/AdminMainLayout';

export default function MainGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminMainLayout>{children}</AdminMainLayout>;
}
