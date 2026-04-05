import AdminMainLayout from '@/components/AdminMainLayout';

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminMainLayout>{children}</AdminMainLayout>;
}
