import { Metadata } from 'next';
import VetProfileClient from './VetProfileClient';
import axios from 'axios';

interface Vet {
  _id: string;
  name: string;
  email: string;
  specialization?: string;
  specialty?: string;
  clinicName?: string;
  clinicLocation?: string;
  clinicAddress?: string;
  phone?: string;
  location?: string;
  bio?: string;
}

// Revalidate every 10 seconds for real-time updates
export const revalidate = 10;

// Generate static params for all vets at build time
export async function generateStaticParams() {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const response = await axios.get(`${apiBase}/vets/public`);
    const vets = response.data.data || [];
    
    return vets.map((vet: Vet) => ({
      id: vet._id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const response = await axios.get(`${apiBase}/vets/public/${params.id}`);
    const vet: Vet = response.data.data;

    const specialty = vet.specialty || vet.specialization || 'Veterinarian';
    const location = vet.clinicLocation || vet.clinicAddress || vet.location || 'Your Area';
    const title = `Dr. ${vet.name} - ${specialty} in ${location} | PawSewa`;
    const description = vet.bio || `Book an appointment with Dr. ${vet.name}, a certified ${specialty} at ${vet.clinicName || 'their clinic'} in ${location}. Trusted pet care services on PawSewa.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Veterinarian Profile | PawSewa',
      description: 'Find trusted veterinary care for your pets on PawSewa',
    };
  }
}

export default function VetProfilePage({ params }: { params: { id: string } }) {
  return <VetProfileClient vetId={params.id} />;
}
