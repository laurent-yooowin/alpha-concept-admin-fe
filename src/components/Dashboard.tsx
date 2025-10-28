import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Briefcase,
  FileText,
} from 'lucide-react';

interface Stats {
  totalMissions: number;
  pendingMissions: number;
  completedMissions: number;
  totalReports: number;
  submittedReports: number;
  validatedReports: number;
  sentReports: number;
  totalCoordinators: number;
  avgProcessingTime: number;
  monthlyMissions: { month: string; count: number }[];
  coordinatorStats: { name: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMissions: 0,
    pendingMissions: 0,
    completedMissions: 0,
    totalReports: 0,
    submittedReports: 0,
    validatedReports: 0,
    sentReports: 0,
    totalCoordinators: 0,
    avgProcessingTime: 0,
    monthlyMissions: [],
    coordinatorStats: [],
    statusBreakdown: [],
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  useEffect(() => {
    fetchStats();
  }, [profile]);

  const fetchStats = async () => {
    setLoading(true);

    try {
      const missionQuery = supabase.from('missions').select('*');
      const reportQuery = supabase.from('rapports').select('*');
      const coordinatorQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'coordinator')
        .eq('is_active', true);

      if (profile?.role === 'coordinator') {
        missionQuery.eq('coordinator_id', profile.id);
        reportQuery.eq('coordinator_id', profile.id);
      }

      const [missionsRes, reportsRes, coordinatorsRes] = await Promise.all([
        missionQuery,
        reportQuery,
        coordinatorQuery,
      ]);

      const missions = missionsRes.data || [];
      const reports = reportsRes.data || [];
      const coordinators = coordinatorsRes.data || [];

      const monthlyData: Record<string, number> = {};
      missions.forEach((mission) => {
        const date = new Date(mission.created_at);
        const monthKey = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      });

      const monthlyMissions = Object.entries(monthlyData)
        .map(([month, count]) => ({ month, count }))
        .slice(-6);

      const coordinatorData: Record<string, number> = {};
      if (isAdmin) {
        const { data: missionsWithCoord } = await supabase
          .from('missions')
          .select('coordinator_id, coordinator:profiles!missions_coordinator_id_fkey(first_name, last_name)')
          .not('coordinator_id', 'is', null);

        if (missionsWithCoord) {
          missionsWithCoord.forEach((mission: any) => {
            if (mission.coordinator) {
              const name = `${mission.coordinator.first_name} ${mission.coordinator.last_name}`;
              coordinatorData[name] = (coordinatorData[name] || 0) + 1;
            }
          });
        }
      }

      const coordinatorStats = Object.entries(coordinatorData)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const statusData: Record<string, number> = {};
      missions.forEach((mission) => {
        statusData[mission.statut] = (statusData[mission.statut] || 0) + 1;
      });

      const statusBreakdown = Object.entries(statusData).map(([status, count]) => ({
        status,
        count,
      }));

      const completedReports = reports.filter((r) => r.statut === 'validated' || r.statut === 'sent_to_client');
      let avgTime = 0;
      if (completedReports.length > 0) {
        const totalTime = completedReports.reduce((sum, report) => {
          const created = new Date(report.created_at).getTime();
          const validated = report.validated_at ? new Date(report.validated_at).getTime() : created;
          return sum + (validated - created);
        }, 0);
        avgTime = Math.round(totalTime / completedReports.length / (1000 * 60 * 60 * 24));
      }

      setStats({
        totalMissions: missions.length,
        pendingMissions: missions.filter((m) => m.statut === 'pending' || m.statut === 'assigned').length,
        completedMissions: missions.filter((m) => m.statut === 'completed').length,
        totalReports: reports.length,
        submittedReports: reports.filter((r) => r.statut === 'submitted').length,
        validatedReports: reports.filter((r) => r.statut === 'validated').length,
        sentReports: reports.filter((r) => r.statut === 'sent_to_client').length,
        totalCoordinators: coordinators.length,
        avgProcessingTime: avgTime,
        monthlyMissions,
        coordinatorStats,
        statusBreakdown,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }

    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'En attente',
      assigned: 'Affectée',
      in_progress: 'En cours',
      completed: 'Terminée',
      refused: 'Refusée',
      cancelled: 'Annulée',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-slate-100 text-slate-700',
      assigned: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      refused: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-600 mt-1">Vue d'ensemble de l'activité SPS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Missions totales</p>
          <p className="text-3xl font-bold text-slate-900">{stats.totalMissions}</p>
          <p className="text-sm text-slate-500 mt-2">
            {stats.pendingMissions} en attente
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Missions terminées</p>
          <p className="text-3xl font-bold text-slate-900">{stats.completedMissions}</p>
          <p className="text-sm text-slate-500 mt-2">
            {stats.totalMissions > 0 ? Math.round((stats.completedMissions / stats.totalMissions) * 100) : 0}% du total
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Rapports soumis</p>
          <p className="text-3xl font-bold text-slate-900">{stats.submittedReports}</p>
          <p className="text-sm text-slate-500 mt-2">
            {stats.validatedReports} validés
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <Clock className="w-6 h-6 text-slate-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Temps moyen de traitement</p>
          <p className="text-3xl font-bold text-slate-900">{stats.avgProcessingTime}</p>
          <p className="text-sm text-slate-500 mt-2">jours</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-slate-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Missions par mois</h2>
          </div>

          {stats.monthlyMissions.length > 0 ? (
            <div className="space-y-4">
              {stats.monthlyMissions.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{item.month}</span>
                    <span className="text-sm font-bold text-slate-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-prosps-blue h-2 rounded-full transition-all"
                      style={{
                        width: `${(item.count / Math.max(...stats.monthlyMissions.map((m) => m.count))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Aucune donnée disponible</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-slate-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Répartition par statut</h2>
          </div>

          {stats.statusBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.statusBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Aucune donnée disponible</p>
          )}
        </div>
      </div>

      {isAdmin && stats.coordinatorStats.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="w-5 h-5 text-slate-700" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Top 5 Coordonnateurs</h2>
          </div>

          <div className="space-y-4">
            {stats.coordinatorStats.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 bg-prosps-blue text-white rounded-full text-sm font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900 ml-2 flex-shrink-0">{item.count} missions</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-prosps-blue h-2 rounded-full transition-all"
                      style={{
                        width: `${(item.count / Math.max(...stats.coordinatorStats.map((c) => c.count))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <FileText className="w-5 h-5 text-slate-700" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Statistiques des rapports</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">{stats.totalReports}</p>
            <p className="text-sm text-slate-600 mt-1">Total</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-900">{stats.submittedReports}</p>
            <p className="text-sm text-blue-600 mt-1">Soumis</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-900">{stats.validatedReports}</p>
            <p className="text-sm text-green-600 mt-1">Validés</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <p className="text-2xl font-bold text-emerald-900">{stats.sentReports}</p>
            <p className="text-sm text-emerald-600 mt-1">Envoyés</p>
          </div>
        </div>
      </div>
    </div>
  );
}
