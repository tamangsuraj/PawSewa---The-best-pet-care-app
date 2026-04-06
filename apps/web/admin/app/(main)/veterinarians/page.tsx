'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserCheck, Clock, CheckCircle, XCircle, Edit2, RefreshCw } from 'lucide-react';

interface Vet {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  specialization?: string;
  currentShift: string;
  isAvailable: boolean;
  bio?: string;
  createdAt: string;
}

export default function VeterinariansPage() {
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingVet, setEditingVet] = useState<Vet | null>(null);
  const [newShift, setNewShift] = useState('');
  const [newAvailability, setNewAvailability] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchVets();
  }, []);

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  const fetchVets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin-token');
      const response = await axios.get(`${apiBase}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const veterinarians = (response.data.data || []).filter(
        (user: any) => user.role === 'veterinarian' || user.role === 'VET'
      );
      setVets(veterinarians.map((u: any) => ({ ...u, name: u.name || u.full_name || u.email })));
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load veterinarians');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (vet: Vet) => {
    setEditingVet(vet);
    setNewShift(vet.currentShift || 'Off');
    setNewAvailability(vet.isAvailable || false);
  };

  const handleUpdateShift = async () => {
    if (!editingVet) return;

    try {
      setUpdating(true);
      const token = localStorage.getItem('admin-token');
      
      await axios.patch(
        `${apiBase}/cases/vets/${editingVet._id}/shift`,
        {
          currentShift: newShift,
          isAvailable: newAvailability
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditingVet(null);
      fetchVets();
      alert('Shift updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update shift');
    } finally {
      setUpdating(false);
    }
  };

  const getShiftBadge = (shift: string) => {
    const styles = {
      Morning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      Evening: 'bg-orange-100 text-orange-800 border-orange-300',
      Night: 'bg-purple-100 text-purple-800 border-purple-300',
      Off: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${styles[shift as keyof typeof styles] || styles.Off}`}>
        <Clock className="w-3 h-3" />
        {shift}
      </span>
    );
  };

  return (
    <>
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-primary mb-2">Veterinarian Management</h1>
                  <p className="text-gray-600">Manage veterinarian shifts and availability</p>
                </div>
                <button
                  onClick={fetchVets}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-gray-600 text-sm">Total Vets</p>
                <p className="text-3xl font-bold text-gray-900">{vets.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-4">
                <p className="text-green-600 text-sm">Available</p>
                <p className="text-3xl font-bold text-green-800">{vets.filter(v => v.isAvailable).length}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg shadow p-4">
                <p className="text-yellow-600 text-sm">Morning Shift</p>
                <p className="text-3xl font-bold text-yellow-800">{vets.filter(v => v.currentShift === 'Morning').length}</p>
              </div>
              <div className="bg-purple-50 rounded-lg shadow p-4">
                <p className="text-purple-600 text-sm">Night Shift</p>
                <p className="text-3xl font-bold text-purple-800">{vets.filter(v => v.currentShift === 'Night').length}</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading veterinarians...</p>
              </div>
            ) : vets.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <UserCheck className="w-20 h-20 text-primary/20 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-primary mb-4">No Veterinarians</h2>
                <p className="text-gray-600">No veterinarians have been registered yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Veterinarian
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Specialty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Shift
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Availability
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vets.map((vet) => (
                      <tr key={vet._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Dr. {vet.name}</p>
                            <p className="text-xs text-gray-500">{vet.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{vet.phone || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{vet.specialty || vet.specialization || 'General'}</p>
                        </td>
                        <td className="px-6 py-4">
                          {getShiftBadge(vet.currentShift || 'Off')}
                        </td>
                        <td className="px-6 py-4">
                          {vet.isAvailable ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                              <CheckCircle className="w-3 h-3" />
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                              <XCircle className="w-3 h-3" />
                              Unavailable
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openEditModal(vet)}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                          >
                            <Edit2 className="w-3 h-3" />
                            Manage Shift
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Edit Shift Modal */}
            {editingVet && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Manage Shift</h2>
                    <p className="text-gray-600 mt-1">Dr. {editingVet.name}</p>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Shift Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Shift
                      </label>
                      <select
                        value={newShift}
                        onChange={(e) => setNewShift(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Evening">Evening</option>
                        <option value="Night">Night</option>
                        <option value="Off">Off</option>
                      </select>
                    </div>

                    {/* Availability Toggle */}
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAvailability}
                          onChange={(e) => setNewAvailability(e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Mark as Available for Assignment
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-8">
                        Available vets will appear in the assignment list for new cases
                      </p>
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                      onClick={() => setEditingVet(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      disabled={updating}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateShift}
                      disabled={updating}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {updating ? 'Updating...' : 'Update Shift'}
                    </button>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
