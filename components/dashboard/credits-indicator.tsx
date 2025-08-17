"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Plus, Crown, Zap } from "lucide-react";

interface CreditsIndicatorProps {
  currentCredits: number;
  maxCredits: number;
  planType?: "basic" | "pro" | "enterprise";
}

export function CreditsIndicator({ 
  currentCredits = 12, 
  maxCredits = 50, 
  planType = "basic" 
}: CreditsIndicatorProps) {
  const percentage = (currentCredits / maxCredits) * 100;
  const remainingCredits = maxCredits - currentCredits;
  
  const getPlanIcon = () => {
    switch (planType) {
      case "pro":
        return <Crown className="h-3 w-3" />;
      case "enterprise":
        return <Zap className="h-3 w-3" />;
      default:
        return <CreditCard className="h-3 w-3" />;
    }
  };

  const getPlanColor = () => {
    switch (planType) {
      case "pro":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "enterprise":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
  };


  return (
    <div className="flex items-center space-x-3">
      {/* Indicador de créditos - versão desktop */}
      <div className="hidden md:flex items-center space-x-2">
        <Badge className={getPlanColor()}>
          {getPlanIcon()}
          <span className="ml-1 capitalize">{planType}</span>
        </Badge>
        
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              {currentCredits}/{maxCredits}
            </span>
            <span className="text-xs text-muted-foreground">créditos</span>
          </div>
          <Progress 
            value={percentage} 
            className="h-1 w-20"
          />
        </div>
        
        <span className="text-xs text-muted-foreground hidden lg:block">
          {remainingCredits} restantes
        </span>
      </div>

      {/* Indicador de créditos - versão mobile */}
      <div className="flex md:hidden items-center space-x-1">
        <Badge className={getPlanColor()}>
          {getPlanIcon()}
          <span className="ml-1">{currentCredits}/{maxCredits}</span>
        </Badge>
      </div>

      {/* Botão de upgrade/adicionar créditos */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="hidden sm:flex items-center space-x-1"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden lg:inline">Adicionar Créditos</span>
            <span className="lg:hidden">Créditos</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            Comprar Créditos
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Crown className="mr-2 h-4 w-4" />
            Upgrade para Pro
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Zap className="mr-2 h-4 w-4" />
            Plano Enterprise
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Botão mobile simplificado */}
      <Button 
        variant="outline" 
        size="icon"
        className="sm:hidden h-8 w-8"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}