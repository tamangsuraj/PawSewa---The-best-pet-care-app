import { Shield } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center">
        <Shield className="w-16 h-16 text-primary animate-pulse mx-auto mb-4" />
        <p className="text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}
