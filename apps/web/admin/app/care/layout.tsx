import AdminMainLayout from '@/components/AdminMainLayout';

export default function CareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminMainLayout>{children}</AdminMainLayout>;
}
