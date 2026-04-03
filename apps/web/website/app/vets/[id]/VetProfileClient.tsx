'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Stethoscope, 
  Building2, 
  Calendar,
  ArrowLeft,
  Star,
  Download
} from 'lucide-react';
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
  profilePicture?: string;
  workingHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  createdAt?: string;
}

export default function VetProfileClient({ vetId }: { vetId: string }) {
  const [vet, setVet] = useState<Vet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVet();
  }, [vetId]);

  const fetchVet = async () => {
    try {
      setLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/vets/public/${vetId}`);
      if (response.data.success) {
        setVet(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load veterinarian profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !vet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This veterinarian profile does not exist'}</p>
          <Link href="/vets">
            <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90">
              Back to Directory
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-accent text-white py-8 px-4">
        <div className="container mx-auto">
          <Link href="/vets">
            <button className="flex items-center gap-2 text-white hover:text-secondary transition-colors mb-4">
              <ArrowLeft className="w-5 h-5" />
              Back to Directory
            </button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Profile Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-primary to-accent p-8 text-white">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl overflow-hidden">
                    {vet.profilePicture ? (
                      <img 
                        src={vet.profilePicture} 
                        alt={vet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-6xl font-bold text-primary">
                        {vet.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-center md:text-left">
                    <h1 className="text-4xl font-bold mb-2 font-poppins">
                      Dr. {vet.name}
                    </h1>
                    <p className="text-xl text-secondary mb-2">
                      {vet.specialty || vet.specialization || 'General Practitioner'}
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-1 text-yellow-300">
                      <Star className="w-5 h-5 fill-current" />
                      <Star className="w-5 h-5 fill-current" />
                      <Star className="w-5 h-5 fill-current" />
                      <Star className="w-5 h-5 fill-current" />
                      <Star className="w-5 h-5 fill-current" />
                      <span className="ml-2 text-white">5.0 (Verified)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Content */}
              <div className="p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 font-poppins">
                  About Dr. {vet.name}
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6 font-inter">
                  {vet.bio || (
                    <>
                      Dr. {vet.name} is a dedicated {(vet.specialty || vet.specialization)?.toLowerCase() || 'veterinary professional'} 
                      {vet.clinicName && ` practicing at ${vet.clinicName}`}
                      {(vet.clinicLocation || vet.clinicAddress) && ` in ${vet.clinicLocation || vet.clinicAddress}`}. 
                      With a commitment to providing exceptional care for your pets, Dr. {vet.name} offers 
                      comprehensive veterinary services including routine check-ups, vaccinations, diagnostics, 
                      and treatment for various pet health conditions.
                    </>
                  )}
                </p>

                <h3 className="text-xl font-bold text-gray-800 mb-3 font-poppins">
                  Specialization & Expertise
                </h3>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <p className="text-gray-700 font-inter">
                    <strong className="text-primary">{vet.specialty || vet.specialization || 'General Veterinary Medicine'}</strong>
                    <br />
                    Providing expert care in diagnosis, treatment, and preventive medicine for all types of pets.
                  </p>
                </div>

                {vet.workingHours && (vet.workingHours.open || vet.workingHours.close || vet.workingHours.days) && (
                  <>
                    <h3 className="text-xl font-bold text-gray-800 mb-3 font-poppins">
                      Working Hours
                    </h3>
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                      <p className="text-gray-700 font-inter">
                        {vet.workingHours.open && vet.workingHours.close && (
                          <><strong className="text-primary">Hours:</strong> {vet.workingHours.open} - {vet.workingHours.close}<br /></>
                        )}
                        {vet.workingHours.days && vet.workingHours.days.length > 0 && (
                          <><strong className="text-primary">Days:</strong> {vet.workingHours.days.join(', ')}</>
                        )}
                      </p>
                    </div>
                  </>
                )}

                <h3 className="text-xl font-bold text-gray-800 mb-3 font-poppins">
                  Services Offered
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Routine Health Check-ups
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Vaccinations & Immunizations
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Diagnostic Services
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Emergency Care
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Surgical Procedures
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Pet Wellness Consultations
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
              <h3 className="text-xl font-bold text-gray-800 mb-6 font-poppins">
                Contact Information
              </h3>

              <div className="space-y-4 mb-8">
                {vet.clinicName && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500 font-poppins">Clinic</p>
                      <p className="text-gray-800 font-medium">{vet.clinicName}</p>
                    </div>
                  </div>
                )}

                {(vet.clinicLocation || vet.clinicAddress || vet.location) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500 font-poppins">Location</p>
                      <p className="text-gray-800 font-medium">
                        {vet.clinicAddress || vet.clinicLocation || vet.location}
                      </p>
                    </div>
                  </div>
                )}

                {vet.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500 font-poppins">Phone</p>
                      <a 
                        href={`tel:${vet.phone}`}
                        className="text-gray-800 font-medium hover:text-primary"
                      >
                        {vet.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 font-poppins">Email</p>
                    <a 
                      href={`mailto:${vet.email}`}
                      className="text-gray-800 font-medium hover:text-primary break-all"
                    >
                      {vet.email}
                    </a>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <button className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Book Appointment
                </button>
                
                <a 
                  href="https://play.google.com/store" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download PawSewa App
                </a>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 text-center font-inter">
                  Download our mobile app for easy appointment booking and pet health management
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
