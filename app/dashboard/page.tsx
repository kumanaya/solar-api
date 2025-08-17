import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecentAnalyses } from "@/components/dashboard/recent-analyses";
import { NewAnalysisCard } from "@/components/dashboard/new-analysis-card";
import { ShortcutCards } from "@/components/dashboard/shortcut-cards";
import { CalendarDays, Users, Activity, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  const stats = [
    {
      title: "Total Users",
      value: "1,234",
      description: "+20.1% from last month",
      icon: Users,
      trend: "up"
    },
    {
      title: "Active Sessions",
      value: "573",
      description: "+5.2% from last hour", 
      icon: Activity,
      trend: "up"
    },
    {
      title: "Revenue",
      value: "$12,345",
      description: "+12.5% from last month",
      icon: TrendingUp,
      trend: "up"
    },
    {
      title: "Events",
      value: "89",
      description: "3 events today",
      icon: CalendarDays,
      trend: "neutral"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Bem-vindo de volta, {user.user?.email?.split('@')[0]}!
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral</CardTitle>
            <CardDescription>
              Resumo das atividades recentes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Sistema Operacional</p>
                  <p className="text-xs text-muted-foreground">
                    Última atualização há 2 horas
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Online
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Base de Dados</p>
                  <p className="text-xs text-muted-foreground">
                    Conexão estável
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Conectado
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">API Status</p>
                  <p className="text-xs text-muted-foreground">
                    Todas as rotas funcionando
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Ativo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>
              Últimas ações realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 bg-sky-500 rounded-full"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Login realizado</p>
                  <p className="text-xs text-muted-foreground">Agora</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 bg-green-500 rounded-full"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Dashboard carregado</p>
                  <p className="text-xs text-muted-foreground">Há 1 minuto</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex h-2 w-2 bg-orange-500 rounded-full"></div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Sistema atualizado</p>
                  <p className="text-xs text-muted-foreground">Há 2 horas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nova seção para nova análise */}
      <NewAnalysisCard />

      {/* Cards de atalhos */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Atalhos Rápidos</h2>
        <ShortcutCards />
      </div>

      {/* Nova seção para análises recentes */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <RecentAnalyses />
      </div>
    </div>
  );
}