import { useState, useEffect } from 'react';
import { supabase, Mission, Chantier, Client, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Upload, Search, Filter, Calendar, MapPin, User } from 'lucide-react';

export default function MissionManagement() {
  const { profile: currentUser } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [coordinators, setCoordinators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    client_id: '',
    chantier_nom: '',
    chantier_adresse: '',
    chantier_ville: '',
    chantier_code_postal: '',
    reference_interne: '',
    date_debut: '',
    date_fin: '',
    consignes: '',
    coordinator_id: '',
  });

  const [csvData, setCSVData] = useState('');

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const missionsQuery = supabase
      .from('missions')
      .select(`
        *,
        chantiers (
          *,
          clients (*)
        ),
        coordinator:profiles!missions_coordinator_id_fkey (*)
      `)
      .order('created_at', { ascending: false });

    if (currentUser?.role === 'coordinator') {
      missionsQuery.eq('coordinator_id', currentUser.id);
    }

    const [missionsRes, clientsRes, chantiersRes, coordinatorsRes] = await Promise.all([
      missionsQuery,
      supabase.from('clients').select('*').order('nom'),
      supabase.from('chantiers').select('*, clients(*)').order('nom'),
      supabase.from('profiles').select('*').eq('role', 'coordinator').eq('is_active', true),
    ]);

    if (missionsRes.data) setMissions(missionsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (chantiersRes.data) setChantiers(chantiersRes.data);
    if (coordinatorsRes.data) setCoordinators(coordinatorsRes.data);

    setLoading(false);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      let chantierId = '';

      const existingChantier = chantiers.find(
        c => c.client_id === formData.client_id &&
             c.nom === formData.chantier_nom &&
             c.adresse === formData.chantier_adresse
      );

      if (existingChantier) {
        chantierId = existingChantier.id;
      } else {
        const { data: newChantier, error: chantierError } = await supabase
          .from('chantiers')
          .insert({
            client_id: formData.client_id,
            nom: formData.chantier_nom,
            adresse: formData.chantier_adresse,
            ville: formData.chantier_ville,
            code_postal: formData.chantier_code_postal || null,
            reference_interne: formData.reference_interne || null,
          })
          .select()
          .single();

        if (chantierError) throw chantierError;
        chantierId = newChantier.id;
      }

      const { error: missionError } = await supabase
        .from('missions')
        .insert({
          chantier_id: chantierId,
          coordinator_id: formData.coordinator_id || null,
          date_debut: formData.date_debut,
          date_fin: formData.date_fin,
          statut: formData.coordinator_id ? 'assigned' : 'pending',
          consignes: formData.consignes || null,
          created_by: currentUser?.id,
        });

      if (missionError) throw missionError;

      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        action: 'create_mission',
        entity_type: 'mission',
        details: { chantier: formData.chantier_nom },
      });

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating mission:', error);
      alert('Erreur lors de la création de la mission');
    }
  };

  const handleCSVImport = async () => {
    if (!isAdmin || !csvData.trim()) return;

    try {
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        let clientId = '';
        const existingClient = clients.find(c => c.nom.toLowerCase() === row.client?.toLowerCase());

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              nom: row.client || 'Client inconnu',
              email: row.client_email || null,
            })
            .select()
            .single();

          if (clientError) throw clientError;
          clientId = newClient.id;
        }

        const { data: newChantier, error: chantierError } = await supabase
          .from('chantiers')
          .insert({
            client_id: clientId,
            nom: row.chantier || 'Chantier',
            adresse: row.adresse || '',
            ville: row.ville || '',
            code_postal: row.code_postal || null,
            reference_interne: row.reference || null,
          })
          .select()
          .single();

        if (chantierError) throw chantierError;

        const coordinatorEmail = row.coordonnateur?.toLowerCase();
        const coordinator = coordinatorEmail ?
          coordinators.find(c => c.email.toLowerCase() === coordinatorEmail) : null;

        await supabase.from('missions').insert({
          chantier_id: newChantier.id,
          coordinator_id: coordinator?.id || null,
          date_debut: row.date_debut || new Date().toISOString().split('T')[0],
          date_fin: row.date_fin || new Date().toISOString().split('T')[0],
          statut: coordinator ? 'assigned' : 'pending',
          consignes: row.consignes || null,
          created_by: currentUser?.id,
        });
      }

      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id,
        action: 'import_missions_csv',
        entity_type: 'mission',
        details: { count: lines.length - 1 },
      });

      setShowCSVModal(false);
      setCSVData('');
      fetchData();
      alert(`${lines.length - 1} mission(s) importée(s) avec succès`);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Erreur lors de l\'import CSV');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      chantier_nom: '',
      chantier_adresse: '',
      chantier_ville: '',
      chantier_code_postal: '',
      reference_interne: '',
      date_debut: '',
      date_fin: '',
      consignes: '',
      coordinator_id: '',
    });
  };

  const filteredMissions = missions.filter(mission => {
    const chantierData = mission.chantiers as Chantier & { clients?: Client };
    const matchesSearch =
      chantierData?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chantierData?.clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chantierData?.ville?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || mission.statut === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'pending': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'refused': return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'pending': return 'En attente';
      case 'assigned': return 'Affectée';
      case 'refused': return 'Refusée';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Terminée';
      case 'cancelled': return 'Annulée';
      default: return statut;
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
          <div className="flex gap-3">
            <button
              onClick={() => setShowCSVModal(true)}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Import CSV
            </button>
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
          </div>
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
              <option value="pending">En attente</option>
              <option value="assigned">Affectée</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminée</option>
              <option value="refused">Refusée</option>
              <option value="cancelled">Annulée</option>
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
              {filteredMissions.map((mission) => {
                const chantierData = mission.chantiers as Chantier & { clients?: Client };
                const coordinatorData = mission.coordinator as Profile | undefined;

                return (
                  <tr key={mission.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{chantierData?.nom}</p>
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {chantierData?.ville}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {chantierData?.clients?.nom}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-700">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(mission.date_debut).toLocaleDateString('fr-FR')} - {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {coordinatorData ? (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {coordinatorData.first_name} {coordinatorData.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Non affecté</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(mission.statut)}`}>
                        {getStatusLabel(mission.statut)}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  required
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.nom}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nom du chantier</label>
                  <input
                    type="text"
                    value={formData.chantier_nom}
                    onChange={(e) => setFormData({ ...formData, chantier_nom: e.target.value })}
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
                    value={formData.chantier_ville}
                    onChange={(e) => setFormData({ ...formData, chantier_ville: e.target.value })}
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
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
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
                      {coord.first_name} {coord.last_name} {coord.zone_geographique ? `(${coord.zone_geographique})` : ''}
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

      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Import CSV</h2>
              <p className="text-sm text-slate-600 mt-2">
                Format attendu: client,chantier,adresse,ville,code_postal,date_debut,date_fin,reference,coordonnateur,consignes
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={csvData}
                onChange={(e) => setCSVData(e.target.value)}
                rows={12}
                placeholder="Collez vos données CSV ici..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none font-mono text-sm"
              />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCSVModal(false);
                    setCSVData('');
                  }}
                  className="flex-1 px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCSVImport}
                  className="flex-1 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium"
                >
                  Importer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
