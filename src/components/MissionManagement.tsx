import { useState, useEffect } from 'react';
import { missionsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Calendar, MapPin, User, Clock } from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  client: string;
  address: string;
  date: string;
  time: string;
  type: string;
  description: string | null;
  status: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

export default function MissionManagement() {
  const { profile: currentUser } = useAuth();
  const [missions, setMissions] = useState < Mission[] > ([]);
  const [coordinators, setCoordinators] = useState < any[] > ([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState < string > ('all');

  const [formData, setFormData] = useState({
    title: '',
    client: '',
    address: '',
    date: '',
    time: '',
    type: 'visite',
    description: '',
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    userId: '',
  });

  const isAdmin = currentUser?.role === 'ROLE_ADMIN';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [missionsData, usersData] = await Promise.all([
        missionsAPI.getAll(),
        usersAPI.getAll(),
      ]);

      setMissions(missionsData);
      setCoordinators(usersData.filter((u: any) => u.role === 'ROLE_USER' && u.isActive));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await missionsAPI.create({
        title: formData.title,
        client: formData.client,
        address: formData.address,
        date: formData.date,
        time: formData.time,
        type: formData.type,
        description: formData.description || null,
        contactFirstName: formData.contactFirstName || null,
        contactLastName: formData.contactLastName || null,
        contactEmail: formData.contactEmail || null,
        contactPhone: formData.contactPhone || null,
        userId: formData.userId || currentUser?.id,
      });

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating mission:', error);
      alert('Erreur lors de la création de la mission');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      client: '',
      address: '',
      date: '',
      time: '',
      type: 'visite',
      description: '',
      contactFirstName: '',
      contactLastName: '',
      contactEmail: '',
      contactPhone: '',
      userId: '',
    });
  };

  const filteredMissions = missions.filter(mission => {
    const matchesSearch =
      mission.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mission.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mission.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || mission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assignee': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'planifiee': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'affectee': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'refusee': return 'bg-red-100 text-red-700 border-red-200';
      case 'en_cours': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'terminee': return 'bg-green-100 text-green-700 border-green-200';
      case 'annulee': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assignee': return 'Assignée';
      case 'planifiee': return 'Planifiée';
      case 'affectee': return 'Affectée';
      case 'refusee': return 'Refusée';
      case 'en_cours': return 'En cours';
      case 'terminee': return 'Terminée';
      case 'annulee': return 'Annulée';
      default: return status;
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestion des missions</h1>
          <p className="text-slate-600 mt-1">{missions.length} mission(s) au total</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nouvelle mission
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par titre, client, adresse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="planifiee">Planifiée</option>
              <option value="affectee">Affectée</option>
              <option value="en_cours">En cours</option>
              <option value="terminee">Terminée</option>
              <option value="refusee">Refusée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Mission</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Client</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Date & Heure</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Type</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Coordonnateur</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMissions.map((mission) => (
                <tr key={mission.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{mission.title}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {mission.address}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {mission.client}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(mission.date).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <Clock className="w-3 h-3" />
                      {mission.time}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 capitalize">{mission.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    {mission.user ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {mission.user.firstName} {mission.user.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Non affecté</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(mission.status)}`}>
                      {getStatusLabel(mission.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Nouvelle mission</h2>
            </div>

            <form onSubmit={handleCreateMission} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Titre de la mission *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Client *</label>
                  <input
                    type="text"
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Type de mission *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  >
                    <option value="visite">Visite</option>
                    <option value="inspection">Inspection</option>
                    <option value="audit">Audit</option>
                    <option value="formation">Formation</option>
                    <option value="suivi">Suivi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Adresse du chantier *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Heure *</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coordonnateur </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                >
                  <option value="">Non affecté</option>
                  {coordinators.map(coord => (
                    <option key={coord.id} value={coord.id}>
                      {coord.firstName} {coord.lastName} {coord.zoneGeographique ? `(${coord.zoneGeographique})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <h3 className="font-semibold text-slate-900 mb-4">Contact sur site *</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prénom *</label>
                    <input
                      type="text"
                      value={formData.contactFirstName}
                      onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
                    <input
                      type="text"
                      value={formData.contactLastName}
                      onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description / Consignes</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium"
                >
                  Créer la mission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
