import { useState, useEffect } from 'react';
import { reportsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Eye, Edit2, CheckCircle, Send, Calendar, MapPin } from 'lucide-react';

interface Report {
  id: string;
  mission_id: string;
  chantier_nom: string;
  chantier_ville: string;
  client_nom: string;
  contenu: string;
  observations: string | null;
  remarques_admin: string | null;
  statut: string;
  created_at: string;
  validated_at: string | null;
  sent_to_client_at: string | null;
}

export default function ReportManagement() {
  const { profile: currentUser } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedObservations, setEditedObservations] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const isAdmin = currentUser?.role === 'ROLE_ADMIN';

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await reportsAPI.getAll();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
    setLoading(false);
  };

  const openViewModal = (report: Report) => {
    setSelectedReport(report);
    setEditedContent(report.contenu);
    setEditedObservations(report.observations || '');
    setAdminRemarks(report.remarques_admin || '');
    setIsEditing(false);
    setShowViewModal(true);
  };

  const handleValidateReport = async () => {
    if (!selectedReport || !isAdmin) return;

    try {
      await reportsAPI.update(selectedReport.id, {
        contenu: editedContent,
        observations: editedObservations,
        remarques_admin: adminRemarks,
        statut: 'validated',
      });

      setShowViewModal(false);
      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      console.error('Error validating report:', error);
      alert('Erreur lors de la validation');
    }
  };

  const handleSendToClient = async () => {
    if (!selectedReport || !isAdmin) return;

    try {
      await reportsAPI.update(selectedReport.id, {
        statut: 'sent_to_client',
      });

      setShowViewModal(false);
      setSelectedReport(null);
      fetchReports();
      alert('Rapport envoyé au client avec succès');
    } catch (error) {
      console.error('Error sending report:', error);
      alert('Erreur lors de l\'envoi');
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedReport || !isAdmin) return;

    try {
      await reportsAPI.update(selectedReport.id, {
        contenu: editedContent,
        observations: editedObservations,
        remarques_admin: adminRemarks,
      });

      setIsEditing(false);
      fetchReports();
      alert('Modifications enregistrées');
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch =
      report.chantier_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.client_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.contenu.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || report.statut === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'submitted': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'validated': return 'bg-green-100 text-green-700 border-green-200';
      case 'sent_to_client': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'draft': return 'Brouillon';
      case 'submitted': return 'Soumis';
      case 'validated': return 'Validé';
      case 'sent_to_client': return 'Envoyé au client';
      default: return statut;
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Gestion des rapports</h1>
        <p className="text-slate-600 mt-1">{reports.length} rapport(s) au total</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par chantier, client, contenu..."
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
              <option value="draft">Brouillon</option>
              <option value="submitted">Soumis</option>
              <option value="validated">Validé</option>
              <option value="sent_to_client">Envoyé au client</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Chantier</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Client</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Date</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Statut</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{report.chantier_nom}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {report.chantier_ville}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {report.client_nom}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(report.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.statut)}`}>
                      {getStatusLabel(report.statut)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openViewModal(report)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Voir"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Rapport SPS</h2>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedReport.chantier_nom}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedReport.statut)}`}>
                {getStatusLabel(selectedReport.statut)}
              </span>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Client</p>
                    <p className="font-medium text-slate-900">
                      {selectedReport.client_nom}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Date de création</p>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedReport.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contenu du rapport</label>
                {isEditing && isAdmin ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={10}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-slate-900">
                    {editedContent}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Observations</label>
                {isEditing && isAdmin ? (
                  <textarea
                    value={editedObservations}
                    onChange={(e) => setEditedObservations(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-slate-900">
                    {editedObservations || 'Aucune observation'}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Remarques administrateur</label>
                  {isEditing ? (
                    <textarea
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                      placeholder="Ajoutez des remarques internes..."
                    />
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-lg whitespace-pre-wrap text-slate-900 border border-amber-200">
                      {adminRemarks || 'Aucune remarque'}
                    </div>
                  )}
                </div>
              )}

              {selectedReport.validated_at && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900">
                    <strong>Validé le:</strong> {new Date(selectedReport.validated_at).toLocaleDateString('fr-FR')} à {new Date(selectedReport.validated_at).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              )}

              {selectedReport.sent_to_client_at && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-900">
                    <strong>Envoyé au client le:</strong> {new Date(selectedReport.sent_to_client_at).toLocaleDateString('fr-FR')} à {new Date(selectedReport.sent_to_client_at).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedReport(null);
                  setIsEditing(false);
                }}
                className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Fermer
              </button>

              {isAdmin && (
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveEdits}
                        className="flex items-center gap-2 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Enregistrer
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedReport.statut !== 'sent_to_client' && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          <Edit2 className="w-4 h-4" />
                          Modifier
                        </button>
                      )}

                      {selectedReport.statut === 'submitted' && (
                        <button
                          onClick={handleValidateReport}
                          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Valider
                        </button>
                      )}

                      {selectedReport.statut === 'validated' && (
                        <button
                          onClick={handleSendToClient}
                          className="flex items-center gap-2 bg-prosps-blue text-white px-6 py-3 rounded-lg hover:bg-prosps-blue-dark transition-colors font-medium"
                        >
                          <Send className="w-4 h-4" />
                          Envoyer au client
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
