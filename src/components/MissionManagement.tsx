import { useState, useEffect } from 'react';
import { missionsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, Calendar, MapPin, User } from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  address: string;
  client: string;
  date: string;
  date_fin: string;
  status: string;
  coordinator_first_name?: string;
  coordinator_last_name?: string;
  consignes?: string;
}

export default function MissionManagement() {
  const { profile: currentUser } = useAuth();
  const [missions, setMissions] = useState < Mission[] > ([]);
  const [filteredMissions, setFilteredMissions] = useState < Mission[] > ([]);
  const [coordinators, setCoordinators] = useState < any[] > ([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState < string > ('all');

  const [formData, setFormData] = useState({
    client: '',
    title: '',
    chantier_adresse: '',
    address: '',
    chantier_code_postal: '',
    reference_interne: '',
    date: '',
    date_fin: '',
    consignes: '',
    coordinator_id: '',
  });

  const isAdmin = currentUser?.role === 'ROLE_ADMIN';

  useEffect(() => {
    if (!loading && missions.length === 0) {
      fetchData();
    }
    return () => { setLoading(false); setMissions([]); setFilteredMissions([]); };
  }, []);

  const fetchData = async () => {
    if (!loading) {
      setLoading(true);
      try {
        const [missionsData, usersData] = await Promise.all([
          missionsAPI.getAll(),
          usersAPI.getAll(),
        ]);
        missionsData.map((mission: any) => {
          const coordinator = usersData.find((u: any) => u.id === mission.userId);
          if (coordinator) {
            mission.coordinator_first_name = coordinator.firstName;
            mission.coordinator_last_name = coordinator.lastName;
          }
          return mission;
        });

        setMissions(missionsData);
        setCoordinators(usersData.filter((u: any) => u.role === 'ROLE_USER' && u.isActive));
        setFilteredMissions(missionsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      await missionsAPI.create({
        client: formData.client,
        title: formData.title,
        chantier_adresse: formData.chantier_adresse,
        address: formData.address,
        chantier_code_postal: formData.chantier_code_postal || null,
        reference_interne: formData.reference_interne || null,
        date: formData.date,
        date_fin: formData.date_fin,
        consignes: formData.consignes || null,
        coordinator_id: formData.coordinator_id || null,
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
      client: '',
      title: '',
      chantier_adresse: '',
      address: '',
      chantier_code_postal: '',
      reference_interne: '',
      date: '',
      date_fin: '',
      consignes: '',
      coordinator_id: '',
    });
  };

  const filterMissions = (status: string, term: string) => {
    if (status === 'all' && term.trim() === '') {
      setFilteredMissions(missions);
      return;
    }
    const missionsToFilter = missions.filter(mission => {
      const matchesSearch =
        mission.title?.toLowerCase().includes(term.toLowerCase()) ||
        mission.client?.toLowerCase().includes(term.toLowerCase()) ||
        mission.address?.toLowerCase().includes(term.toLowerCase());

      const matchesStatus = status === 'all' || mission.status === status;

      return matchesSearch && matchesStatus;
    });
    const missionsCopy: Mission[] = [];
    Object.assign(missionsCopy, missionsToFilter);
    setFilteredMissions(missionsCopy);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'en_attente': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'planifiee': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'refusee': return 'bg-red-100 text-red-700 border-red-200';
      case 'en_cours': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'terminee': return 'bg-green-100 text-green-700 border-green-200';
      case 'annulee': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'planifiee': return 'Affectée';
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
              placeholder="Rechercher par chantier, client, ville..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); filterMissions(statusFilter, e.target.value); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); filterMissions(e.target.value, searchTerm); }}
              className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="planifiee">Affectée</option>
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
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Chantier</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Client</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Dates</th>
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
                      {new Date(mission.date).toLocaleDateString('fr-FR')} - {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {mission.coordinator_first_name ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {mission.coordinator_first_name} {mission.coordinator_last_name}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom du client</label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nom du chantier</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Référence interne</label>
                  <input
                    type="text"
                    value={formData.reference_interne}
                    onChange={(e) => setFormData({ ...formData, reference_interne: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Adresse du chantier</label>
                <input
                  type="text"
                  value={formData.chantier_adresse}
                  onChange={(e) => setFormData({ ...formData, chantier_adresse: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ville</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Code postal</label>
                  <input
                    type="text"
                    value={formData.chantier_code_postal}
                    onChange={(e) => setFormData({ ...formData, chantier_code_postal: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date de début</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date de fin</label>
                  <input
                    type="date"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Coordonnateur (optionnel)</label>
                <select
                  value={formData.coordinator_id}
                  onChange={(e) => setFormData({ ...formData, coordinator_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                >
                  <option value="">Non affecté</option>
                  {coordinators.map(coord => (
                    <option key={coord.id} value={coord.id}>
                      {coord.firstName} {coord.lastName} {coord.zone_geographique ? `(${coord.zone_geographique})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Consignes spécifiques</label>
                <textarea
                  value={formData.consignes}
                  onChange={(e) => setFormData({ ...formData, consignes: e.target.value })}
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
