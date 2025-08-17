"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Download, Trash2 } from "lucide-react";

interface Analysis {
  id: string;
  endereco: string;
  verredito: "Viável" | "Não Viável" | "Parcialmente Viável";
  confianca: number;
  data: string;
}

const mockAnalyses: Analysis[] = [
  {
    id: "1",
    endereco: "Rua das Flores, 123, São Paulo - SP",
    verredito: "Viável",
    confianca: 95,
    data: "2025-08-17"
  },
  {
    id: "2", 
    endereco: "Av. Paulista, 1000, São Paulo - SP",
    verredito: "Parcialmente Viável",
    confianca: 78,
    data: "2025-08-16"
  },
  {
    id: "3",
    endereco: "Rua do Comércio, 456, Rio de Janeiro - RJ",
    verredito: "Viável",
    confianca: 92,
    data: "2025-08-15"
  },
  {
    id: "4",
    endereco: "Rua das Palmeiras, 789, Belo Horizonte - MG",
    verredito: "Não Viável",
    confianca: 85,
    data: "2025-08-14"
  },
  {
    id: "5",
    endereco: "Av. Brasil, 2000, Brasília - DF",
    verredito: "Viável",
    confianca: 88,
    data: "2025-08-13"
  }
];

function getVerdictBadge(verredito: Analysis["verredito"]) {
  switch (verredito) {
    case "Viável":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Viável</Badge>;
    case "Não Viável":
      return <Badge variant="destructive">Não Viável</Badge>;
    case "Parcialmente Viável":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcialmente Viável</Badge>;
    default:
      return <Badge variant="secondary">{verredito}</Badge>;
  }
}

function getConfidenceBadge(confianca: number) {
  if (confianca >= 90) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{confianca}%</Badge>;
  } else if (confianca >= 70) {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{confianca}%</Badge>;
  } else {
    return <Badge variant="destructive">{confianca}%</Badge>;
  }
}

export function RecentAnalyses() {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Análises Recentes</CardTitle>
        <CardDescription>
          Últimas 5 análises de viabilidade solar realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endereço</TableHead>
              <TableHead>Verredito</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAnalyses.map((analysis) => (
              <TableRow key={analysis.id}>
                <TableCell className="font-medium max-w-xs">
                  <div className="truncate" title={analysis.endereco}>
                    {analysis.endereco}
                  </div>
                </TableCell>
                <TableCell>
                  {getVerdictBadge(analysis.verredito)}
                </TableCell>
                <TableCell>
                  {getConfidenceBadge(analysis.confianca)}
                </TableCell>
                <TableCell>{formatDate(analysis.data)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar Relatório
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}