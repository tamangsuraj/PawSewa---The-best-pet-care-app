import AdminMainLayout from '@/components/AdminMainLayout';

export default function SuppliesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminMainLayout>{children}</AdminMainLayout>;
}
