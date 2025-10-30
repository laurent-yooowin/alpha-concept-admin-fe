import { useState, useEffect } from 'react';
import { missionsAPI, reportsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Eye, Edit2, CheckCircle, Send, Calendar, MapPin } from 'lucide-react';
import { generatePdfService, generateReportPDF } from '../services/generatePdfService';
import { visitService } from '../services/visitService';

interface Report {
  id: string;
  missionId: string;
  mission: string;
  visitId: string;
  title: string;
  address: string;
  client: string;
  content: string;
  observations: string | null;
  remarquesAdmin: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  sentAt: string | null;
  sentToClientAt: string | null;
  header: string | null;
  footer: string | null;
  conformityPercentage: number | null;
}

export default function ReportManagement() {
  const { profile: currentUser } = useAuth();
  const [reports, setReports] = useState < Report[] > ([]);
  const [filteredReports, setFilteredReports] = useState < Report[] > ([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState < string > ('all');
  const [selectedReport, setSelectedReport] = useState < Report | null > (null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editedHeader, setEditedHeader] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedFooter, setEditedFooter] = useState('');
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
      const [reportData, missionsData] = await Promise.all([
        reportsAPI.getAll(),
        missionsAPI.getAll(),
      ]);

      reportData.map((report: Report) => {
        report.createdAt = new Date(report.createdAt).toString();

        if (report.updatedAt) {
          report.updatedAt = new Date(report.updatedAt).toString();
        }

        if (report.validatedAt) {
          report.validatedAt = new Date(report.validatedAt).toString();
        }

        if (report.sentAt) {
          report.sentAt = new Date(report.sentAt).toString();
        }

        if (report.sentToClientAt) {
          report.sentToClientAt = new Date(report.sentToClientAt).toString();
        }

        const mission = missionsData.find((m: any) => m.id === report.missionId);
        if (mission) {
          report.title = mission.title;
          report.address = mission.address;
          report.client = mission.client;
          report.mission = mission.title;
          // const clientUser = usersData.find((u: any) => u.id === mission.client_id);
          // report.client = clientUser ? `${clientUser.firstName} ${clientUser.lastName}` : 'Inconnu';
        }
        // report.content = report.header + '\n' + report.content + '\n' + report.footer || '';

        return report;
      });

      setReports(reportData);
      setFilteredReports(reportData);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
    setLoading(false);
  };

  const openViewModal = (report: Report) => {
    setSelectedReport(report);
    setEditedContent(report.content || '');
    setEditedHeader(report.header || '');
    setEditedFooter(report.footer || '');
    setEditedObservations(report.observations || '');
    setAdminRemarks(report.remarquesAdmin || '');
    setIsEditing(false);
    setShowViewModal(true);
  };

  const handleValidateReport = async () => {
    if (!selectedReport || !isAdmin) return;

    try {
      await reportsAPI.update(selectedReport.id, {
        content: editedContent,
        observations: editedObservations,
        remarquesAdmin: adminRemarks,
        status: 'valide',
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
    let photos: any[] = [];
    try {
      const visitResponse = await visitService.getVisit(selectedReport.visitId);
      // console.log('visitResponse.data.photos >>> : ', visitResponse.data.photos);
      if (visitResponse && visitResponse.photos) {
        photos = visitResponse.photos
          .map((photo: any) => {
            const riskLevelMap: { [key: string]: 'low' | 'medium' | 'high' } = {
              'faible': 'low',
              'moyen': 'medium',
              'eleve': 'high',
              'low': 'low',
              'medium': 'medium',
              'high': 'high'
            };

            const observationText = photo.analysis?.observation || '';
            const recommendationText = photo.analysis?.recommendation || '';

            return {
              id: photo.id || `photo-${Date.now()}-${Math.random()}`,
              uri: photo.uri || photo.s3Url,
              s3Url: photo.s3Url,
              timestamp: new Date(photo.createdAt || Date.now()),
              aiAnalysis: photo.analysis ? {
                observations: observationText ? observationText.split('. ').filter((s: string) => s.length > 0) : [],
                recommendations: recommendationText ? recommendationText.split('. ').filter((s: string) => s.length > 0) : [],
                riskLevel: riskLevelMap[photo.analysis.riskLevel] || 'low',
                confidence: Math.round((photo.analysis.confidence || 0) * 100)
              } : undefined,
              comment: photo.comment || '',
              validated: photo.validated || true
            };
          });
      }
    } catch (error) {
      console.log('Could not load visit photos:', error);
    }
    try {
      const pdfData: any = {
        title: selectedReport.title,
        mission: selectedReport.mission,
        client: selectedReport.client,
        date: selectedReport.createdAt,
        conformity: selectedReport.conformityPercentage,
        header: selectedReport.header || '',
        content: selectedReport.content || 'Contenu non disponible',
        footer: selectedReport.footer || '',
        photos: photos,
      };
      await generatePdfService.generateReportPDF(pdfData);
      await reportsAPI.update(selectedReport.id, {
        status: 'envoyee_au_client',
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
        content: editedContent,
        header: editedHeader,
        footer: editedFooter,
        observations: editedObservations,
        remarquesAdmin: adminRemarks,
      });

      setIsEditing(false);
      fetchReports();
      alert('Modifications enregistrées');
    } catch (error) {
      console.error('Error saving edits:', error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const filterReports = (status: string, term: string) => {
    if (status === 'all' && term.trim() === '') {
      setFilteredReports(reports);
      return;
    }
    const reportsFilter = reports.filter(report => {
      const matchesSearch =
        report.title?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
        report.client?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
        report.address?.toLowerCase().includes(searchTerm?.toLowerCase());
      // || report.content?.toLowerCase().includes(searchTerm?.toLowerCase());

      const matchesStatus = status === 'all' || report.status === status;

      return matchesSearch && matchesStatus;
    });
    const reportsCopy: Report[] = [];
    Object.assign(reportsCopy, reportsFilter);
    setFilteredReports(reportsCopy);
  }


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'brouillon': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'envoye': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'valide': return 'bg-green-100 text-green-700 border-green-200';
      case 'envoye_au_client': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'brouillon': return 'Brouillon';
      case 'envoye': return 'Soumis';
      case 'valide': return 'Validé';
      case 'envoye_au_client': return 'Envoyé au client';
      default: return status;
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
              onChange={(e) => { setSearchTerm(e.target.value); filterReports(statusFilter, e.target.value); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); filterReports(e.target.value, searchTerm); }}
              className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="brouillon">Brouillon</option>
              <option value="envoye">Soumis</option>
              <option value="valide">Validé</option>
              <option value="envoye_au_client">Envoyé au client</option>
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
                      <p className="font-medium text-slate-900">{report.title}</p>
                      <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {report.address}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {report.client}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(report.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                      {getStatusLabel(report.status)}
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
                  {selectedReport.title}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedReport.status)}`}>
                {getStatusLabel(selectedReport.status)}
              </span>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Client</p>
                    <p className="font-medium text-slate-900">
                      {selectedReport.client}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Date de création</p>
                    <p className="font-medium text-slate-900">
                      {new Date(selectedReport.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contenu du rapport</label>
                {isEditing && isAdmin ? (
                  <>
                    <p className="mb-1 text-sm text-slate-500">En-tête</p>
                    <textarea
                      value={editedHeader}
                      onChange={(e) => setEditedHeader(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                    <br />
                    <p className="mb-1 text-sm text-slate-500">Contenu principal</p>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={20}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                    <br />
                    <p className="mb-1 text-sm text-slate-500">Conclusion</p>
                    <textarea
                      value={editedFooter}
                      onChange={(e) => setEditedFooter(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-prosps-blue focus:border-transparent outline-none"
                    />
                  </>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap text-slate-900">
                    {editedHeader + '\n' + editedContent + '\n' + editedFooter}
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

              {selectedReport.validatedAt && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900">
                    <strong>Validé le:</strong> {new Date(selectedReport.validatedAt).toLocaleDateString('fr-FR')} à {new Date(selectedReport.validatedAt).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              )}

              {selectedReport.sentToClientAt && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-900">
                    <strong>Envoyé au client le:</strong> {new Date(selectedReport.sentToClientAt).toLocaleDateString('fr-FR')} à {new Date(selectedReport.sentAt).toLocaleTimeString('fr-FR')}
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
                      {selectedReport.status !== 'envoye_au_client' && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          <Edit2 className="w-4 h-4" />
                          Modifier
                        </button>
                      )}

                      {selectedReport.status === 'envoye' && (
                        <button
                          onClick={handleValidateReport}
                          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Valider
                        </button>
                      )}

                      {selectedReport.status === 'valide' && (
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
