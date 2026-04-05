import AdminMainLayout from '@/components/AdminMainLayout';

export default function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminMainLayout>{children}</AdminMainLayout>;
}
