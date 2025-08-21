"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  RefreshCw,
  Calendar,
  MapPin,
  Zap
} from "lucide-react";
import { getUserAnalyses, deleteAnalysis, type AnalysisSummary } from "@/lib/analyses-api";
import { useRouter } from "next/navigation";

export function AnalysesList() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'created_at' | 'address' | 'verdict'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const loadAnalyses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await getUserAnalyses(currentPage, 10, sortBy, sortOrder);
        
        if (result.success && result.data) {
          setAnalyses(result.data);
          setTotal(result.total || 0);
        } else {
          setError(result.error || 'Erro ao carregar análises');
        }
      } catch (error) {
        console.error('Error loading analyses:', error);
        setError('Erro inesperado ao carregar análises');
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalyses();
  }, [currentPage, sortBy, sortOrder]);

  const loadAnalyses = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getUserAnalyses(currentPage, 10, sortBy, sortOrder);
      
      if (result.success && result.data) {
        setAnalyses(result.data);
        setTotal(result.total || 0);
      } else {
        setError(result.error || 'Erro ao carregar análises');
      }
    } catch (error) {
      console.error('Error loading analyses:', error);
      setError('Erro inesperado ao carregar análises');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAnalysis = (id: string) => {
    // Navigate directly to analysis detail page
    router.push(`/dashboard/analysis/${id}`);
  };

  const handleDeleteAnalysis = async (id: string, address: string) => {
    if (!confirm(`Tem certeza que deseja deletar a análise de "${address}"?`)) {
      return;
    }
    
    try {
      const result = await deleteAnalysis(id);
      
      if (result.success) {
        // Remove from local state
        setAnalyses(prev => prev.filter(analysis => analysis.id !== id));
        setTotal(prev => prev - 1);
      } else {
        setError(result.error || 'Erro ao deletar análise');
      }
    } catch (error) {
      console.error('Error deleting analysis:', error);
      setError('Erro ao deletar análise');
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'Apto':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Apto</Badge>;
      case 'Parcial':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcial</Badge>;
      case 'Não apto':
        return <Badge variant="destructive">Não apto</Badge>;
      default:
        return <Badge variant="outline">{verdict}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Minhas Análises</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Minhas Análises</span>
            <span className="text-sm text-muted-foreground">({total})</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalyses}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {analyses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma análise encontrada
            </h3>
            <p className="text-gray-500">
              Execute sua primeira análise para vê-la aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center space-x-1 text-left"
                      onClick={() => {
                        if (sortBy === 'address') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('address');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <MapPin className="h-4 w-4" />
                      <span>Endereço</span>
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center space-x-1 text-left"
                      onClick={() => {
                        if (sortBy === 'verdict') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('verdict');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <span>Status</span>
                    </button>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center space-x-1">
                      <Zap className="h-4 w-4" />
                      <span>Produção</span>
                    </div>
                  </TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center space-x-1 text-left"
                      onClick={() => {
                        if (sortBy === 'created_at') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('created_at');
                          setSortOrder('desc');
                        }
                      }}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Data</span>
                    </button>
                  </TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell>
                      <div className="max-w-xs truncate" title={analysis.address}>
                        {analysis.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getVerdictBadge(analysis.verdict)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {analysis.estimatedProduction.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground ml-1">
                        kWh/ano
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{analysis.usableArea}</span>
                      <span className="text-sm text-muted-foreground ml-1">m²</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(analysis.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewAnalysis(analysis.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteAnalysis(analysis.id, analysis.address)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {total > 10 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * 10 + 1} a {Math.min(currentPage * 10, total)} de {total} análises
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage * 10 >= total}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}