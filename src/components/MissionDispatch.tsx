import { useState, useEffect } from 'react';
import { supabase, Mission, Chantier, Client, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Send, X, MapPin, Calendar, CheckCircle, XCircle } from 'lucide-react';

export default function MissionDispatch() {
  const { profile: currentUser } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [coordinators, setCoordinators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState('');

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);

    const [missionsRes, coordinatorsRes] = await Promise.all([
      supabase
        .from('missions')
        .select(`
          *,
          chantiers (
            *,
            clients (*)
          ),
          coordinator:profiles!missions_coordinator_id_fkey (*)
        `)
        .in('statut', ['pending', 'assigned', 'refused'])
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coordinator')
        .eq('is_active', true)
        .order('first_name'),
    ]);

    if (missionsRes.data) setMissions(missionsRes.data);
    if (coordinatorsRes.data) setCoordinators(coordinatorsRes.data);

    setLoading(false);
  };

  const handleAssignMission = async () => {
    if (!selectedMission || !selectedCoordinator || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('missions')
        .update({
          coordinator_id: selectedCoordinator,
          statut: 'assigned',
        })
        .eq('id', selectedMission.id);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        action: 'assign_mission',
        entity_type: 'mission',
        entity_id: selectedMission.id,
        details: { coordinator_id: selectedCoordinator },
      });

      setShowAssignModal(false);
      setSelectedMission(null);
      setSelectedCoordinator('');
      fetchData();
    } catch (error) {
      console.error('Error assigning mission:', error);
      alert('Erreur lors de l\'attribution');
    }
  };

  const handleUpdateStatus = async (missionId: string, newStatus: 'in_progress' | 'refused') => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('missions')
        .update({ statut: newStatus })
        .eq('id', missionId);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        action: 'update_mission_status',
        entity_type: 'mission',
        entity_id: missionId,
        details: { new_status: newStatus },
      });

      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const openAssignModal = (mission: Mission) => {
    setSelectedMission(mission);
    setSelectedCoordinator(mission.coordinator_id || '');
    setShowAssignModal(true);
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'refused': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'pending': return 'En attente';
      case 'assigned': return 'Affectée';
      case 'refused': return 'Refusée';
      default: return statut;
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

  const pendingMissions = missions.filter(m => m.statut === 'pending');
  const assignedMissions = missions.filter(m => m.statut === 'assigned');
  const refusedMissions = missions.filter(m => m.statut === 'refused');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Attribution des missions</h1>
        <p className="text-slate-600 mt-1">Gérer l'affectation des missions aux coordonnateurs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">En attente</p>
          <p className="text-3xl font-bold text-slate-900">{pendingMissions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Affectées</p>
          <p className="text-3xl font-bold text-blue-600">{assignedMissions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Refusées</p>
          <p className="text-3xl font-bold text-red-600">{refusedMissions.length}</p>
        </div>
      </div>

      <div className="space-y-6">
        {missions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-600">Aucune mission à attribuer</p>
          </div>
        ) : (
          missions.map((mission) => {
            const chantierData = mission.chantiers as Chantier & { clients?: Client };
            const coordinatorData = mission.coordinator as Profile | undefined;

            return (
              <div
                key={mission.id}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-slate-900">{chantierData?.nom}</h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(mission.statut)}`}>
                        {getStatusLabel(mission.statut)}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <strong>Client:</strong> {chantierData?.clients?.nom}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4" />
                        {chantierData?.adresse}, {chantierData?.ville}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(mission.date_debut).toLocaleDateString('fr-FR')} - {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
                      </div>
                      {mission.consignes && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                          <strong className="text-slate-700">Consignes:</strong>
                          <p className="text-slate-600 mt-1">{mission.consignes}</p>
                        </div>
                      )}
                    </div>

                    {coordinatorData && (
                      <div className="mt-4 flex items-center gap-2 text-sm">
                        <div className="px-4 py-2 bg-blue-50 rounded-lg">
                          <span className="font-medium text-blue-900">Coordonnateur: </span>
                          <span className="text-blue-700">
                            {coordinatorData.first_name} {coordinatorData.last_name}
                          </span>
                          {coordinatorData.phone && (
                            <span className="text-blue-600 ml-2">({coordinatorData.phone})</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openAssignModal(mission)}
                      className="flex items-center gap-2 bg-prosps-blue text-white px-4 py-2 rounded-lg hover:bg-prosps-blue-dark transition-colors whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      {coordinatorData ? 'Réaffecter' : 'Affecter'}
                    </button>

                    {mission.statut === 'assigned' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(mission.id, 'in_progress')}
                          className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap border border-green-200"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirmer
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(mission.id, 'refused')}
                          className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap border border-red-200"
                        >
                          <XCircle className="w-4 h-4" />
                          Refuser
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAssignModal && selectedMission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Affecter un coordonnateur</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedMission(null);
                  setSelectedCoordinator('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">
                  {(selectedMission.chantiers as Chantier)?.nom}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {(selectedMission.chantiers as Chantier & { clients?: Client })?.clients?.nom}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Sélectionner un coordonnateur
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {coordinators.map((coordinator) => (
                    <label
                      key={coordinator.id}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedCoordinator === coordinator.id
                          ? 'bg-prosps-blue text-white border-prosps-blue'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="coordinator"
                        value={coordinator.id}
                        checked={selectedCoordinator === coordinator.id}
                        onChange={(e) => setSelectedCoordinator(e.target.value)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">
                          {coordinator.first_name} {coordinator.last_name}
                        </p>
                        <p className={`text-sm ${selectedCoordinator === coordinator.id ? 'text-slate-300' : 'text-slate-600'}`}>
                          {coordinator.email}
                          {coordinator.zone_geographique && ` • ${coordinator.zone_geographique}`}
                          {coordinator.specialite && ` • ${coordinator.specialite}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedMission(null);
                    setSelectedCoordinator('');
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAssignMission}
                  disabled={!selectedCoordinator}
                  className="flex-1 flex items-center justify-center gap-2 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Affecter et notifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
