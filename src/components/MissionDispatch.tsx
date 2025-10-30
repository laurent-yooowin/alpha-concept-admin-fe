import { useState, useEffect } from 'react';
import { missionsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Send, X, MapPin, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface Mission {
  id: string;
  chantier_nom: string;
  chantier_ville: string;
  client_nom: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  coordinator_id: string | null;
  coordinator_first_name?: string;
  coordinator_last_name?: string;
  consignes?: string;
}

interface Coordinator {
  id: string;
  firstName: string;
  lastName: string;
  zone_geographique?: string;
}

export default function MissionDispatch() {
  const { profile: currentUser } = useAuth();
  const [missions, setMissions] = useState < Mission[] > ([]);
  const [coordinators, setCoordinators] = useState < Coordinator[] > ([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState < Mission | null > (null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState('');

  const isAdmin = currentUser?.role === 'ROLE_ADMIN';

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const [missionsData, usersData] = await Promise.all([
        missionsAPI.getAll(),
        usersAPI.getAll(),
      ]);

      const pendingMissions = missionsData.filter(
        (m: Mission) => m.statut === 'en_attente' || m.statut === 'planifiee' || m.statut === 'refusee'
      );
      setMissions(pendingMissions);

      const activeCoordinators = usersData.filter(
        (u: any) => u.role === 'ROLE_USER' && u.isActive
      );
      setCoordinators(activeCoordinators);
    } catch (error) {
      console.error('Error fetching data:', error);
    }

    setLoading(false);
  };

  const openAssignModal = (mission: Mission) => {
    setSelectedMission(mission);
    setSelectedCoordinator(mission.coordinator_id || '');
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedMission || !selectedCoordinator) return;

    try {
      await missionsAPI.assign(selectedMission.id, selectedCoordinator);
      setShowAssignModal(false);
      setSelectedMission(null);
      setSelectedCoordinator('');
      fetchData();
    } catch (error) {
      console.error('Error assigning mission:', error);
      alert('Erreur lors de l\'attribution');
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'en_attente':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'planifiee':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'refusee':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'en_attente':
        return 'En attente';
      case 'planifiee':
        return 'Affectée';
      case 'refusee':
        return 'Refusée';
      default:
        return statut;
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Attribution des missions</h1>
        <p className="text-slate-600 mt-1">
          {missions.length} mission(s) en attente d'attribution
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {missions.map((mission) => (
          <div
            key={mission.id}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {mission.chantier_nom}
                </h3>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  {mission.chantier_ville}
                </div>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                  mission.statut
                )}`}
              >
                {getStatusLabel(mission.statut)}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-medium">Client:</span>
                {mission.client_nom}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar className="w-4 h-4" />
                {new Date(mission.date_debut).toLocaleDateString('fr-FR')} -{' '}
                {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
              </div>
              {mission.coordinator_first_name && (
                <div className="flex items-center gap-2 text-sm">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-900 font-medium">
                    {mission.coordinator_first_name} {mission.coordinator_last_name}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => openAssignModal(mission)}
              className="w-full flex items-center justify-center gap-2 bg-prosps-blue text-white px-4 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium"
            >
              {mission.coordinator_id ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Réaffecter
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Affecter
                </>
              )}
            </button>
          </div>
        ))}

        {missions.length === 0 && (
          <div className="col-span-full text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-slate-600">Aucune mission en attente d'attribution</p>
          </div>
        )}
      </div>

      {showAssignModal && selectedMission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Affecter la mission</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedMission(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-bold text-slate-900 mb-2">
                  {selectedMission.chantier_nom}
                </h3>
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedMission.chantier_ville}
                  </div>
                  <div>Client: {selectedMission.client_nom}</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedMission.date_debut).toLocaleDateString('fr-FR')} -{' '}
                    {new Date(selectedMission.date_fin).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sélectionner un coordonnateur
                </label>
                <select
                  value={selectedCoordinator}
                  onChange={(e) => setSelectedCoordinator(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                >
                  <option value="">-- Sélectionner --</option>
                  {coordinators.map((coord) => (
                    <option key={coord.id} value={coord.id}>
                      {coord.firstName} {coord.lastName}
                      {coord.zone_geographique ? ` - ${coord.zone_geographique}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedMission(null);
                }}
                className="flex-1 px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedCoordinator}
                className="flex-1 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmer l'attribution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
