'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, Mail, Phone, Shield, Dog, Calendar } from 'lucide-react';
import { PawSewaLogoSpinner } from '@/components/PawSewaLogoSpinner';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <PawSewaLogoSpinner size={64} className="mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-white to-secondary py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary">Welcome back, {user.name}!</h1>
              <p className="text-gray-600">
                {user.role === 'pet_owner' 
                  ? 'Manage your pets and appointments'
                  : user.role === 'veterinarian'
                  ? 'Customer Dashboard - Professional features coming soon'
                  : 'Customer Dashboard View'
                }
              </p>
            </div>
          </div>

          {/* Role Notice for Non-Pet Owners */}
          {user.role !== 'pet_owner' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> You're viewing the customer dashboard. 
                {user.role === 'veterinarian' && ' Professional veterinarian features are available in the admin panel.'}
                {user.role === 'admin' && ' Admin features are available in the admin panel.'}
              </p>
            </div>
          )}

          {/* User Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary/30 rounded-lg p-4 flex items-center space-x-3">
              <Mail className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xs text-gray-600">Email</p>
                <p className="font-medium text-gray-800">{user.email}</p>
              </div>
            </div>

            {user.phone && (
              <div className="bg-secondary/30 rounded-lg p-4 flex items-center space-x-3">
                <Phone className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-xs text-gray-600">Phone</p>
                  <p className="font-medium text-gray-800">{user.phone}</p>
                </div>
              </div>
            )}

            <div className="bg-secondary/30 rounded-lg p-4 flex items-center space-x-3">
              <Shield className="w-6 h-6 text-primary" />
              <div>
                <p className="text-xs text-gray-600">Role</p>
                <p className="font-medium text-gray-800 capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            onClick={() => router.push('/my-pets')}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
          >
            <Dog className="w-12 h-12 text-primary mb-4" aria-hidden />
            <h3 className="text-xl font-bold text-primary mb-2">My Pets</h3>
            <p className="text-gray-600">View and manage your registered pets</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer opacity-50">
            <Calendar className="w-12 h-12 text-primary mb-4" aria-hidden />
            <h3 className="text-xl font-bold text-primary mb-2">Appointments</h3>
            <p className="text-gray-600">Schedule and track veterinary appointments (Coming Soon)</p>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-medium">
            🎉 Authentication is working! You are successfully logged in.
          </p>
        </div>
      </div>
    </div>
  );
}
