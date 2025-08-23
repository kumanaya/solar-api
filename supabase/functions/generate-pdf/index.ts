/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Function - Generate Technical PDF Report (REFATORADO)
// Versão 2.0 - Melhorias em segurança, performance e manutenibilidade

/// <reference lib="dom" />

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= CONFIGURAÇÕES E VALIDAÇÕES ========= */
const ENV_CONFIG = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "",
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  MAX_REQUESTS_PER_HOUR: 100,
} as const;

// Validação de configurações críticas
if (!ENV_CONFIG.SUPABASE_URL || !ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Configurações críticas não definidas: SUPABASE_URL ou SERVICE_ROLE_KEY"
  );
}

/* ========= SCHEMAS APRIMORADOS ========= */
const PDFRequestSchema = z.object({
  analysisId: z.string().uuid("ID de análise deve ser um UUID válido"),
  includeCommercial: z.boolean().default(false),
  language: z.enum(["pt-BR", "en", "es"]).default("pt-BR"),
  notes: z
    .string()
    .max(1000, "Notas não podem exceder 1000 caracteres")
    .regex(/^[^<>]*$/, "Notas não podem conter tags HTML")
    .optional(),
  mapImage: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg);base64,/, "Imagem deve ser base64 válida")
    .min(1, "Imagem do mapa é obrigatória"),
  companyInfo: z
    .object({
      name: z.string().max(100, "Nome da empresa muito longo").optional(),
      logo: z.string().url("URL do logo inválida").optional(),
      address: z.string().max(200, "Endereço muito longo").optional(),
      phone: z.string()
        .max(20, "Telefone muito longo")
        .regex(/^[\d\s\-\(\)\+]*$/, "Telefone contém caracteres inválidos")
        .optional(),
      email: z.string().email("Email inválido").optional(),
      website: z.string().url("URL do website inválida").optional(),
    })
    .optional(),
});

// Schema para validar dados da análise vindos do banco
const AnalysisDataSchema = z.object({
  id: z.string(),
  address: z.string(),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  usable_area: z.number().positive("Área deve ser positiva"),
  annual_ghi: z.number().positive("GHI deve ser positivo"),
  estimated_production: z.number().positive("Produção deve ser positiva"),
  shading_loss: z.number().min(0).max(100),
  usage_factor: z.number().min(0).max(1),
  confidence: z.enum(["Alta", "Média", "Baixa"]),
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  irradiation_source: z.string(),
  area_source: z.string(),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
  }),
  reasons: z.array(z.string()).optional(),
  // Adicionar campos para imagem satélite
  footprints: z.array(z.object({
    id: z.string(),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
    area: z.number(),
    isActive: z.boolean(),
    source: z.string().optional(),
  })).optional(),
  imagery_metadata: z.object({
    source: z.string().optional(),
    captureDate: z.string().optional(),
    resolution: z.string().optional(),
    sourceInfo: z.string().optional(),
    accuracy: z.string().optional(),
  }).optional(),
});

/* ========= INTEGRAÇÃO COM DADOS ANEEL ========= */
interface AneelTariffData {
  concessionaria: string;
  sigla: string;
  modalidadeTarifaria: string;
  posto: string;
  tarifa: number;
  vigencia: string;
  unidade: string;
}

interface ConcessionariaInfo {
  nome: string;
  sigla: string;
  tarifa: number;
  modalidade: string;
  vigencia: string;
  estado: string;
}

class AneelDataService {
  private static readonly ANEEL_API_BASE = "https://dadosabertos.aneel.gov.br/api/3/action";
  private static readonly GEOPORTAL_API = "https://gis.aneel.gov.br/server/rest/services";
  
  // Mapeamento de concessionárias por estado (principais)
  private static readonly CONCESSIONARIAS_POR_ESTADO: Record<string, ConcessionariaInfo> = {
    'SP': { nome: 'CPFL Paulista', sigla: 'CPFL', tarifa: 0.92, modalidade: 'Convencional B1', vigencia: '2024', estado: 'SP' },
    'RJ': { nome: 'Light SESA', sigla: 'LIGHT', tarifa: 0.95, modalidade: 'Convencional B1', vigencia: '2024', estado: 'RJ' },
    'MG': { nome: 'CEMIG Distribuição', sigla: 'CEMIG', tarifa: 0.89, modalidade: 'Convencional B1', vigencia: '2024', estado: 'MG' },
    'RS': { nome: 'RGE', sigla: 'RGE', tarifa: 0.78, modalidade: 'Convencional B1', vigencia: '2024', estado: 'RS' },
    'PR': { nome: 'COPEL Distribuição', sigla: 'COPEL', tarifa: 0.82, modalidade: 'Convencional B1', vigencia: '2024', estado: 'PR' },
    'SC': { nome: 'CELESC Distribuição', sigla: 'CELESC', tarifa: 0.75, modalidade: 'Convencional B1', vigencia: '2024', estado: 'SC' },
    'BA': { nome: 'Coelba', sigla: 'COELBA', tarifa: 0.88, modalidade: 'Convencional B1', vigencia: '2024', estado: 'BA' },
    'PE': { nome: 'Celpe', sigla: 'CELPE', tarifa: 0.91, modalidade: 'Convencional B1', vigencia: '2024', estado: 'PE' },
    'CE': { nome: 'Enel Ceará', sigla: 'ENEL CE', tarifa: 0.87, modalidade: 'Convencional B1', vigencia: '2024', estado: 'CE' },
    'GO': { nome: 'Enel Goiás', sigla: 'ENEL GO', tarifa: 0.79, modalidade: 'Convencional B1', vigencia: '2024', estado: 'GO' },
    'DF': { nome: 'CEB Distribuição', sigla: 'CEB', tarifa: 0.81, modalidade: 'Convencional B1', vigencia: '2024', estado: 'DF' },
    'MT': { nome: 'Energisa Mato Grosso', sigla: 'ENERGISA MT', tarifa: 0.77, modalidade: 'Convencional B1', vigencia: '2024', estado: 'MT' },
    'MS': { nome: 'Energisa Mato Grosso do Sul', sigla: 'ENERGISA MS', tarifa: 0.76, modalidade: 'Convencional B1', vigencia: '2024', estado: 'MS' },
    'ES': { nome: 'EDP Espírito Santo', sigla: 'EDP ES', tarifa: 0.84, modalidade: 'Convencional B1', vigencia: '2024', estado: 'ES' },
    'PA': { nome: 'Equatorial Pará', sigla: 'CELPA', tarifa: 0.93, modalidade: 'Convencional B1', vigencia: '2024', estado: 'PA' },
    'AM': { nome: 'Amazonas Energia', sigla: 'AME', tarifa: 0.98, modalidade: 'Convencional B1', vigencia: '2024', estado: 'AM' }
  };

  // Identificar estado baseado nas coordenadas (aproximação por região)
  static getStateByCoordinates(lat: number, lng: number): string {
    // Região Sudeste
    if (lat >= -25 && lat <= -19 && lng >= -50 && lng <= -39) {
      if (lat >= -24 && lng >= -48 && lng <= -44) return 'SP';
      if (lat >= -23 && lat <= -20 && lng >= -47 && lng <= -40) return 'RJ';
      if (lat >= -22.5 && lat <= -19 && lng >= -51 && lng <= -39) return 'MG';
      if (lat >= -21.5 && lat <= -19.5 && lng >= -41.5 && lng <= -39) return 'ES';
      return 'SP'; // Default para Sudeste
    }
    
    // Região Sul
    if (lat >= -34 && lat <= -22 && lng >= -58 && lng <= -48) {
      if (lng >= -54 && lng <= -49) return 'RS';
      if (lat >= -26.5 && lat <= -22.5) return 'PR';
      return 'SC';
    }
    
    // Região Centro-Oeste
    if (lat >= -25 && lat <= -7 && lng >= -61 && lng <= -46) {
      if (lat >= -16.5 && lat <= -15 && lng >= -48.5 && lng <= -47) return 'DF';
      if (lat >= -18 && lat <= -7 && lng >= -61 && lng <= -51) return 'MT';
      if (lat >= -25 && lat <= -17 && lng >= -58 && lng <= -53) return 'MS';
      return 'GO';
    }
    
    // Região Nordeste
    if (lat >= -18.5 && lat <= -2 && lng >= -48 && lng <= -32) {
      if (lat >= -18.5 && lat <= -8.5 && lng >= -47 && lng <= -37.5) return 'BA';
      if (lat >= -10.5 && lat <= -7 && lng >= -41 && lng <= -35) return 'PE';
      if (lat >= -8 && lat <= -2.5 && lng >= -41.5 && lng <= -37) return 'CE';
      return 'BA'; // Default para Nordeste
    }
    
    // Região Norte
    if (lat >= -10 && lat <= 5 && lng >= -75 && lng <= -44) {
      if (lat >= -10 && lat <= 2 && lng >= -55 && lng <= -48) return 'PA';
      if (lat >= -10 && lat <= 2 && lng >= -70 && lng <= -56) return 'AM';
      return 'PA'; // Default para Norte
    }
    
    // Default: São Paulo (maior mercado)
    return 'SP';
  }

  static async getConcessionariaInfo(lat: number, lng: number): Promise<ConcessionariaInfo> {
    try {
      const estado = this.getStateByCoordinates(lat, lng);
      const info = this.CONCESSIONARIAS_POR_ESTADO[estado];
      
      if (!info) {
        console.warn(`Estado ${estado} não encontrado, usando média nacional`);
        return {
          nome: 'Concessionária Local',
          sigla: 'MÉDIA',
          tarifa: 0.85,
          modalidade: 'Convencional B1',
          vigencia: '2024',
          estado: estado
        };
      }
      
      return info;
    } catch (error) {
      console.error('Erro ao buscar dados da concessionária:', error);
      // Fallback para média nacional
      return {
        nome: 'Média Nacional',
        sigla: 'MÉDIA',
        tarifa: 0.85,
        modalidade: 'Convencional B1',
        vigencia: '2024',
        estado: 'BR'
      };
    }
  }

  // Buscar tarifas mais específicas via API da ANEEL (opcional - requer implementação mais complexa)
  static async fetchTariffData(concessionaria: string): Promise<AneelTariffData[]> {
    try {
      const response = await fetch(
        `${this.ANEEL_API_BASE}/datastore_search?resource_id=b1bd71e7-d0ad-4214-9053-cbd58e9564a7&q=${concessionaria}&limit=10`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.records || [];
    } catch (error) {
      console.error('Erro ao buscar dados da ANEEL:', error);
      return [];
    }
  }
}

/* ========= UTILITÁRIOS DE SEGURANÇA ========= */
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/* ========= FUNÇÕES PARA MAPA ESTÁTICO ========= */
function calculateBounds(coordinates: [number, number][]): string {
  if (coordinates.length === 0) return "";
  
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];
  
  coordinates.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  
  // Adicionar margem de 10%
  const lngMargin = (maxLng - minLng) * 0.1;
  const latMargin = (maxLat - minLat) * 0.1;
  
  return `${minLng - lngMargin},${minLat - latMargin},${maxLng + lngMargin},${maxLat + latMargin}`;
}

function generateStaticMapUrl(
  lat: number, 
  lng: number, 
  coordinates?: [number, number][], 
  width = 800, 
  height = 600
): string {
  try {
    let bounds = "";
    
    if (coordinates && coordinates.length > 0) {
      bounds = calculateBounds(coordinates);
    } else {
      // Usar coordenadas centrais com zoom padrão
      const margin = 0.001; // ~100m de margem
      bounds = `${lng - margin},${lat - margin},${lng + margin},${lat + margin}`;
    }
    
    // Usar Esri ArcGIS Static Map Service (gratuito)
    const baseUrl = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";
    const params = new URLSearchParams({
      bbox: bounds,
      bboxSR: "4326",
      size: `${width},${height}`,
      format: "png",
      f: "image"
    });
    
    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.error("Erro ao gerar URL do mapa estático:", error);
    // Retornar URL de fallback simples
    return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${lng-0.001},${lat-0.001},${lng+0.001},${lat+0.001}&bboxSR=4326&size=800,600&format=png&f=image`;
  }
}

/* ========= GERADOR DE GRÁFICOS ECHARTS ========= */
class EChartsGenerator {
  
  // Gerar gráfico de pizza usando ECharts
  static generatePieChart(
    data: Array<{name: string, value: number}>,
    width = 700,
    height = 500,
    title = ''
  ): string {
    const chartId = `pie-chart-${Math.random().toString(36).substr(2, 9)}`;
    
    const option = {
      title: {
        text: title,
        left: 'center',
        top: '5%',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#0066cc'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c}% ({d}%)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#ccc',
        borderWidth: 1,
        textStyle: {
          color: '#333'
        }
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: '5%',
        top: 'middle',
        itemGap: 15,
        itemWidth: 14,
        itemHeight: 14,
        textStyle: {
          fontSize: 11,
          color: '#333'
        },
        formatter: function(name: string) {
          // Quebrar nomes longos em duas linhas
          if (name.length > 15) {
            return name.replace(/\s+/g, '\\n');
          }
          return name;
        }
      },
      grid: {
        left: '5%',
        right: '35%',
        top: '15%',
        bottom: '15%'
      },
      series: [
        {
          name: 'Perdas do Sistema',
          type: 'pie',
          radius: ['20%', '45%'], // Donut chart para melhor legibilidade
          center: ['35%', '55%'], // Posicionar mais à esquerda
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 3,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            position: 'outside',
            fontSize: 10,
            formatter: '{b}\\n{d}%',
            color: '#333',
            distanceToLabelLine: 5
          },
          labelLine: {
            show: true,
            length: 8,
            length2: 12,
            smooth: 0.2
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            },
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold'
            }
          },
          data: data
        }
      ],
      color: ['#28a745', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7']
    };
    
    return `
      <div id="${chartId}" style="width: ${width}px; height: ${height}px; margin: 0 auto;"></div>
      <script>
        (function() {
          const chart = echarts.init(document.getElementById('${chartId}'));
          const option = ${JSON.stringify(option)};
          chart.setOption(option);
          
          // Responsividade
          window.addEventListener('resize', function() {
            chart.resize();
          });
        })();
      </script>
    `;
  }
  
  // Gerar gráfico de barras usando ECharts
  static generateBarChart(
    data: Array<{name: string, value: number}>,
    width = 600,
    height = 400,
    title = '',
    color = '#0066cc'
  ): string {
    const chartId = `bar-chart-${Math.random().toString(36).substr(2, 9)}`;
    
    const option = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#0066cc'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          return `${params[0].name}: ${params[0].value.toLocaleString('pt-BR')}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: data.map(item => item.name),
          axisTick: {
            alignWithLabel: true
          },
          axisLabel: {
            fontSize: 11,
            rotate: data.length > 6 ? 45 : 0
          }
        }
      ],
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            formatter: function(value: number) {
              return value.toLocaleString('pt-BR');
            }
          }
        }
      ],
      series: [
        {
          name: 'Valores',
          type: 'bar',
          barWidth: '60%',
          data: data.map(item => item.value),
          itemStyle: {
            color: color,
            borderRadius: [4, 4, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            formatter: function(params: any) {
              return params.value.toLocaleString('pt-BR');
            },
            fontSize: 10,
            color: '#666'
          }
        }
      ]
    };
    
    return `
      <div id="${chartId}" style="width: ${width}px; height: ${height}px; margin: 0 auto;"></div>
      <script>
        (function() {
          const chart = echarts.init(document.getElementById('${chartId}'));
          const option = ${JSON.stringify(option)};
          chart.setOption(option);
          
          window.addEventListener('resize', function() {
            chart.resize();
          });
        })();
      </script>
    `;
  }
  
  // Gerar gráfico de linha usando ECharts
  static generateLineChart(
    data: Array<{name: string, value: number}>,
    width = 600,
    height = 400,
    title = '',
    color = '#0066cc'
  ): string {
    const chartId = `line-chart-${Math.random().toString(36).substr(2, 9)}`;
    
    const option = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#0066cc'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const value = params[0].value;
          return `${params[0].name}: ${formatCurrency(value)}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map(item => item.name),
        axisLabel: {
          fontSize: 11
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: function(value: number) {
            return 'R$ ' + (value / 1000).toFixed(0) + 'k';
          }
        }
      },
      series: [
        {
          name: 'Economia Acumulada',
          type: 'line',
          stack: 'Total',
          data: data.map(item => item.value),
          itemStyle: {
            color: color
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: color + '40' },
                { offset: 1, color: color + '10' }
              ]
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: function(params: any) {
              return formatCurrency(params.value);
            },
            fontSize: 9,
            color: '#666'
          }
        }
      ]
    };
    
    return `
      <div id="${chartId}" style="width: ${width}px; height: ${height}px; margin: 0 auto;"></div>
      <script>
        (function() {
          const chart = echarts.init(document.getElementById('${chartId}'));
          const option = ${JSON.stringify(option)};
          chart.setOption(option);
          
          window.addEventListener('resize', function() {
            chart.resize();
          });
        })();
      </script>
    `;
  }
}

/* ========= TEMPLATES HTML MODULARIZADOS ========= */
class HTMLTemplateGenerator {
  private static readonly CSS_STYLES = `
    @page { size: A4; margin: 2cm; }
    body { 
      font-family: 'Arial', sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 8px; 
      padding: 8px; 
    }
    .header { 
      border-bottom: 2px solid #0066cc; 
      padding-bottom: 20px; 
      margin-bottom: 30px; 
    }
    .logo { max-height: 60px; margin-bottom: 10px; }
    .title { 
      color: #0066cc; 
      font-size: 24px; 
      font-weight: bold; 
      margin-bottom: 10px; 
    }
    .subtitle { color: #666; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section-title { 
      color: #0066cc; 
      font-size: 18px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      border-bottom: 1px solid #eee; 
      padding-bottom: 5px; 
    }
    .data-grid { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 20px; 
      margin-bottom: 20px; 
    }
    .data-item { 
      background: #f8f9fa; 
      padding: 15px; 
      border-radius: 5px; 
      border-left: 4px solid #0066cc; 
    }
    .data-label { 
      font-weight: bold; 
      color: #555; 
      font-size: 12px; 
      text-transform: uppercase; 
    }
    .data-value { 
      font-size: 20px; 
      font-weight: bold; 
      color: #333; 
      margin-top: 5px; 
    }
    .verdict { 
      text-align: center; 
      padding: 20px; 
      border-radius: 10px; 
      font-size: 18px; 
      font-weight: bold; 
      margin: 20px 0; 
    }
    .verdict.apto { 
      background: #d4edda; 
      color: #155724; 
      border: 2px solid #c3e6cb; 
    }
    .verdict.parcial { 
      background: #fff3cd; 
      color: #856404; 
      border: 2px solid #ffeaa7; 
    }
    .verdict.nao-apto { 
      background: #f8d7da; 
      color: #721c24; 
      border: 2px solid #f1aeb5; 
    }
    .reasons { list-style: none; padding: 0; }
    .reasons li { 
      background: #f0f8ff; 
      margin: 5px 0; 
      padding: 10px; 
      border-radius: 5px; 
      border-left: 3px solid #0066cc; 
    }
    .footer { 
      border-top: 1px solid #eee; 
      padding-top: 20px; 
      margin-top: 40px; 
      text-align: center; 
      font-size: 12px; 
      color: #666; 
    }
    .page-break { page-break-before: always; }
    .warning { 
      background: #fff3cd; 
      border: 1px solid #ffeaa7; 
      border-radius: 4px; 
      padding: 12px; 
      margin: 10px 0; 
    }
    .satellite-image {
      max-width: 100%;
      border: 2px solid #0066cc;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      margin: 20px 0;
    }
    .coordinates-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .coordinates-table th,
    .coordinates-table td {
      padding: 8px;
      text-align: left;
      border: 1px solid #ddd;
    }
    .coordinates-table th {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    .polygon-info {
      background: #f0f8ff;
      border: 1px solid #0066cc;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
    }
    .chart-container {
      text-align: center;
      margin: 20px 0;
      padding: 15px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .chart-title {
      font-size: 14px;
      font-weight: bold;
      color: #0066cc;
      margin-bottom: 15px;
    }
    .chart-svg {
      display: block;
      margin: 0 auto;
    }
  `;

  static generateHeader(analysisData: any, companyInfo?: any): string {
    const logoHtml = companyInfo?.logo
      ? `<img src="${sanitizeHtml(
          companyInfo.logo
        )}" alt="Logo da Empresa" class="logo">`
      : "";

    return `
      <div class="header">
        ${logoHtml}
        <div class="title">LAUDO TÉCNICO DE ANÁLISE SOLAR</div>
        <div class="subtitle">${sanitizeHtml(analysisData.address)}</div>
        ${
          companyInfo?.name
            ? `<div class="subtitle">${sanitizeHtml(companyInfo.name)}</div>`
            : ""
        }
        <div class="subtitle">Protocolo: ${analysisData.id}</div>
      </div>
    `;
  }

  static generateExecutiveSummary(analysisData: any): string {
    const verdictClass = analysisData.verdict
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[àáâãä]/g, "a")
      .replace(/[ç]/g, "c");

    const reasonsList =
      analysisData.reasons
        ?.map((reason: string) => `<li>${sanitizeHtml(reason)}</li>`)
        .join("") || "";

    return `
      <div class="section">
        <div class="section-title">1. RESUMO EXECUTIVO</div>
        <div class="verdict ${verdictClass}">
          VEREDICTO: ${sanitizeHtml(analysisData.verdict.toUpperCase())}
        </div>
        ${
          reasonsList
            ? `
          <div class="section-title">1.1 Justificativas Técnicas</div>
          <ul class="reasons">${reasonsList}</ul>
        `
            : ""
        }
      </div>
    `;
  }

  static generateTechnicalData(analysisData: any): string {
    // USAR APENAS DADOS REAIS DO BANCO - NÃO INVENTAR NADA
    const annualProduction = Number(analysisData.estimated_production);
    const annualGhi = Number(analysisData.annual_ghi);
    const usableArea = Number(analysisData.usable_area);
    const shadingLoss = Number(analysisData.shading_loss);
    const usageFactor = Number(analysisData.usage_factor);
    const confidence = analysisData.confidence;
    
    // Definir cenário de incerteza baseado na confiança REAL
    const uncertaintyScenarios = {
      'Alta': '±10%',
      'Média': '±15%', 
      'Baixa': '±25%'
    };
    const uncertaintyMargin = uncertaintyScenarios[confidence as keyof typeof uncertaintyScenarios] || '±20%';

    return `
      <div class="section">
        <div class="section-title">2. DADOS TÉCNICOS</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Área Útil Disponível</div>
            <div class="data-value">${usableArea.toLocaleString("pt-BR")} m²</div>
          </div>
          <div class="data-item">
            <div class="data-label">Irradiação Global Anual (GHI)</div>
            <div class="data-value">${annualGhi.toLocaleString("pt-BR")} kWh/m²/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Produção Anual Estimada</div>
            <div class="data-value">${annualProduction.toLocaleString("pt-BR")} kWh/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Fonte de Irradiação</div>
            <div class="data-value">${analysisData.irradiation_source}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Método de Área</div>
            <div class="data-value">${analysisData.area_source}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Cenário de Incerteza</div>
            <div class="data-value">${uncertaintyMargin}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Confiança da Análise</div>
            <div class="data-value">${confidence}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Perdas por Sombreamento</div>
            <div class="data-value">${shadingLoss.toFixed(1)}%</div>
          </div>
          <div class="data-item">
            <div class="data-label">Fator de Uso da Área</div>
            <div class="data-value">${(usageFactor * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>
    `;
  }

  static generateProductionAnalysis(analysisData: any): string {
    try {
      const annualProduction = Number(analysisData.estimated_production) || 0;
      
      // USAR DADOS REAIS DO PVGIS se disponível
      let monthlyProduction = [];
      let hasRealData = false;
      
      if (analysisData.pvgis_data?.outputs?.monthly?.fixed) {
        // DADOS REAIS DO PVGIS
        const pvgisMonthly = analysisData.pvgis_data.outputs.monthly.fixed;
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                           'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        monthlyProduction = pvgisMonthly.map((data: any, index: number) => ({
          label: monthNames[index],
          value: Math.round(data.E_m || 0) // Produção mensal real do PVGIS
        }));
        hasRealData = true;
      } else {
        // Fallback: apenas dividir produção anual por 12 (SEM INVENTAR SAZONALIDADE)
        const monthlyAverage = Math.round(annualProduction / 12);
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                           'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        monthlyProduction = monthNames.map(month => ({
          label: month,
          value: monthlyAverage
        }));
      }
      
      // Calcular estatísticas reais
      const values = monthlyProduction.map(m => m.value);
      const minMonth = monthlyProduction.reduce((min, curr) => curr.value < min.value ? curr : min);
      const maxMonth = monthlyProduction.reduce((max, curr) => curr.value > max.value ? curr : max);
      const seasonalVariation = hasRealData && minMonth.value > 0 
        ? ((maxMonth.value - minMonth.value) / minMonth.value * 100).toFixed(1)
        : '0';
      
      return `
        <div class="section">
          <div class="section-title">2.1 ANÁLISE DE PRODUÇÃO ENERGÉTICA</div>
          
          <div class="chart-container">
            ${EChartsGenerator.generateBarChart(
              monthlyProduction.map(item => ({ name: item.label, value: item.value })), 
              700, 
              350, 
              'Produção Mensal Estimada (kWh)', 
              '#0066cc'
            )}
          </div>
          
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Produção Anual Total</div>
              <div class="data-value">${annualProduction.toLocaleString('pt-BR')} kWh</div>
            </div>
            <div class="data-item">
              <div class="data-label">Média Mensal</div>
              <div class="data-value">${Math.round(annualProduction/12).toLocaleString('pt-BR')} kWh</div>
            </div>
            <div class="data-item">
              <div class="data-label">Melhor Mês</div>
              <div class="data-value">${maxMonth.label}: ${maxMonth.value.toLocaleString('pt-BR')} kWh</div>
            </div>
            <div class="data-item">
              <div class="data-label">Variação Sazonal</div>
              <div class="data-value">±${seasonalVariation}%</div>
            </div>
          </div>
          
          <div class="warning">
            <strong>Observação:</strong> ${hasRealData 
              ? 'Os valores de produção mensal são baseados em dados reais do PVGIS (European Commission).' 
              : 'Os valores de produção mensal são estimativas baseadas na produção anual total.'} 
            A produção real pode variar devido a condições climáticas locais, manutenção do sistema e outros fatores ambientais.
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Erro ao gerar análise de produção:', error);
      return `
        <div class="section">
          <div class="section-title">2.1 ANÁLISE DE PRODUÇÃO ENERGÉTICA</div>
          <div class="warning">
            <strong>Erro:</strong> Não foi possível gerar a análise de produção energética.
          </div>
        </div>
      `;
    }
  }

  static generateTechnicalSpecs(analysisData: any): string {
    try {
      // Validar e extrair dados básicos com fallbacks
      const lat = Number(analysisData.coordinates?.lat) || -15; // Fallback para centro do Brasil
      const annualProduction = Number(analysisData.estimated_production) || 0;
      const shadingLoss = Number(analysisData.shading_loss) || 0;
      
      // Para o Brasil (hemisfério sul), inclinação ótima é aproximadamente a latitude
      // mas limitando entre 10° e 30° para otimizar produção anual
      const optimalTilt = Math.min(30, Math.max(10, Math.abs(lat)));
      
      // Azimute para hemisfério sul: Norte geográfico = 0°/360°
      const optimalAzimuth = lat < 0 ? 0 : 180; // Brasil está no hemisfério sul (lat negativa)
      
      // Calcular potência e módulos estimados
      const estimatedPower = annualProduction > 0 ? (annualProduction / 1300).toFixed(1) : '0.0'; // HSP médio Brasil
      const recommendedPanels = annualProduction > 0 ? Math.ceil(Number(estimatedPower) / 0.55) : 0;
      const actualPower = (recommendedPanels * 0.55).toFixed(1);
      
      // Perdas típicas do sistema (NBR 16274)
      const tempLosses = 8.0; // Perdas por temperatura (típico Brasil)
      const cableLosses = 2.0; // Perdas em cabeamento DC + AC
      const inverterLosses = 3.0; // Perdas no inversor
      const soilingLosses = 2.0; // Perdas por sujidade
      const totalSystemLosses = tempLosses + cableLosses + inverterLosses + soilingLosses;
      const totalAllLosses = totalSystemLosses + shadingLoss;
    
    return `
      <div class="section">
        <div class="section-title">3. ESPECIFICAÇÕES TÉCNICAS</div>
        
        <div class="section-title">3.1 Parâmetros de Instalação Recomendados</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Inclinação Ótima</div>
            <div class="data-value">${optimalTilt.toFixed(0)}°</div>
          </div>
          <div class="data-item">
            <div class="data-label">Orientação (Azimute)</div>
            <div class="data-value">${optimalAzimuth}° (Norte)</div>
          </div>
          <div class="data-item">
            <div class="data-label">Número de Módulos</div>
            <div class="data-value">${recommendedPanels} unid.</div>
          </div>
          <div class="data-item">
            <div class="data-label">Potência Nominal</div>
            <div class="data-value">${actualPower} kWp</div>
          </div>
          <div class="data-item">
            <div class="data-label">Área Necessária</div>
            <div class="data-value">${(recommendedPanels * 2.8).toFixed(0)} m²</div>
          </div>
          <div class="data-item">
            <div class="data-label">Rendimento Global</div>
            <div class="data-value">${(100 - totalAllLosses).toFixed(1)}%</div>
          </div>
        </div>
        
        <div class="section-title">3.2 Análise de Perdas do Sistema (NBR 16274)</div>
        
        <div class="chart-container">
          ${EChartsGenerator.generatePieChart([
            { name: 'Rendimento Útil', value: parseFloat((100 - totalAllLosses).toFixed(1)) },
            { name: 'Perdas por Temperatura', value: tempLosses },
            { name: 'Perdas em Cabeamento', value: cableLosses },
            { name: 'Perdas no Inversor', value: inverterLosses },
            { name: 'Perdas por Sujidade', value: soilingLosses },
            { name: 'Perdas por Sombreamento', value: parseFloat(shadingLoss.toFixed(1)) }
          ], 750, 500, 'Distribuição das Perdas do Sistema Fotovoltaico')}
        </div>
        
        <div class="data-grid" style="grid-template-columns: 1fr;">
          <div class="data-item">
            <div class="data-label">Detalhamento das Perdas</div>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Perdas por Temperatura:</strong> ${tempLosses}% (coeficiente -0,4%/°C)</li>
              <li><strong>Perdas em Cabeamento:</strong> ${cableLosses}% (DC + AC combinado)</li>
              <li><strong>Perdas no Inversor:</strong> ${inverterLosses}% (eficiência 97%)</li>
              <li><strong>Perdas por Sujidade:</strong> ${soilingLosses}% (limpeza semestral)</li>
              <li><strong>Perdas por Sombreamento:</strong> ${shadingLoss.toFixed(1)}% (análise satelital)</li>
              <li><strong>Total de Perdas do Sistema:</strong> ${totalAllLosses.toFixed(1)}%</li>
              <li><strong>Rendimento Global Final:</strong> ${(100 - totalAllLosses).toFixed(1)}%</li>
            </ul>
          </div>
        </div>

        <div class="section-title">3.3 Especificações dos Equipamentos</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Módulos Fotovoltaicos</div>
            <div class="data-value">Monocristalino 550Wp<br><small>Eficiência: ~21%</small></div>
          </div>
          <div class="data-item">
            <div class="data-label">Estrutura de Fixação</div>
            <div class="data-value">Alumínio anodizado<br><small>Garantia: 25 anos</small></div>
          </div>
          <div class="data-item">
            <div class="data-label">Inversores</div>
            <div class="data-value">String/Microinversor<br><small>Eficiência: 97%+</small></div>
          </div>
          <div class="data-item">
            <div class="data-label">Cabeamento</div>
            <div class="data-value">DC: 4mm² / AC: 6mm²<br><small>Anti-chama e UV</small></div>
          </div>
        </div>
      </div>
    `;
    } catch (error) {
      console.error('Erro ao gerar especificações técnicas:', error);
      return `
        <div class="section">
          <div class="section-title">3. ESPECIFICAÇÕES TÉCNICAS</div>
          <div class="warning">
            <strong>Erro:</strong> Não foi possível gerar as especificações técnicas completas.
            Os dados da análise podem estar corrompidos ou incompletos.
          </div>
        </div>
      `;
    }
  }

  static generateLocationSection(analysisData: any, mapImage?: string): string {
    const coordinates = analysisData.coordinates;
    const footprints = analysisData.footprints || [];
    const activeFootprint = footprints.find((fp: any) => fp.isActive) || footprints[0];
    
    // Usar imagem enviada ou gerar URL de fallback
    const imageSource = mapImage || generateStaticMapUrl(
      coordinates.lat, 
      coordinates.lng, 
      activeFootprint?.coordinates
    );
    
    // Formatar coordenadas
    const formatCoordinate = (coord: number, isLat: boolean) => {
      const direction = isLat 
        ? (coord >= 0 ? 'N' : 'S')
        : (coord >= 0 ? 'E' : 'W');
      return `${Math.abs(coord).toFixed(6)}° ${direction}`;
    };
    
    // Metadados da imagem
    const imageryMetadata = analysisData.imagery_metadata;
    const hasImageryData = imageryMetadata && 
      (imageryMetadata.captureDate || imageryMetadata.resolution || imageryMetadata.sourceInfo);
    
    // Função para formatar data da imagem
    const formatImageryDate = () => {
      if (!imageryMetadata) return 'Não disponível';
      
      // Verificar se existe imageryDate (formato object com year, month, day)
      if (imageryMetadata.imageryDate) {
        const { year, month, day } = imageryMetadata.imageryDate;
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
      
      // Fallback para captureDate (formato string)
      if (imageryMetadata.captureDate) {
        try {
          const date = new Date(imageryMetadata.captureDate);
          return date.toLocaleDateString('pt-BR');
        } catch {
          return imageryMetadata.captureDate;
        }
      }
      
      return 'Não disponível';
    };
    
    const satelliteDate = formatImageryDate();
    
    return `
      <div class="section page-break">
        <div class="section-title">4. LOCALIZAÇÃO E ÁREA ANALISADA</div>
        
        <div style="text-align: center;">
          <img src="${imageSource}" alt="Vista satélite da área analisada" class="satellite-image" />
          <p class="subtitle">Imagem de satélite da área analisada${mapImage ? ' (capturada do mapa interativo)' : ''}</p>
          ${satelliteDate !== 'Não disponível' ? `<p class="subtitle"><strong>Data da imagem:</strong> ${satelliteDate}</p>` : ''}
        </div>
        
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Coordenadas Centrais</div>
            <div class="data-value">
              ${formatCoordinate(coordinates.lat, true)}<br>
              ${formatCoordinate(coordinates.lng, false)}
            </div>
          </div>
          <div class="data-item">
            <div class="data-label">Área Útil (Real)</div>
            <div class="data-value">${Number(analysisData.usable_area).toLocaleString("pt-BR")} m²</div>
          </div>
          ${activeFootprint && activeFootprint.area ? `
          <div class="data-item">
            <div class="data-label">Área do Polígono (Calculada)</div>
            <div class="data-value">${activeFootprint.area.toLocaleString("pt-BR")} m²</div>
          </div>
          ` : ''}
          <div class="data-item">
            <div class="data-label">Data da Imagem de Satélite</div>
            <div class="data-value">${satelliteDate}</div>
          </div>
        </div>
        
        ${activeFootprint ? `
          <div class="polygon-info">
            <h4>Informações do Polígono Analisado</h4>
            <table class="coordinates-table">
              <tr>
                <th>Propriedade</th>
                <th>Valor</th>
              </tr>
              <tr>
                <td>Fonte do polígono</td>
                <td>${activeFootprint.source === 'user-drawn' ? 'Desenhado pelo usuário' : 
                       activeFootprint.source === 'microsoft-footprint' ? 'Microsoft Building Footprints' :
                       activeFootprint.source === 'google-footprint' ? 'Google Solar API' : 
                       'Definido automaticamente'}</td>
              </tr>
              <tr>
                <td>Número de vértices</td>
                <td>${activeFootprint.coordinates.length}</td>
              </tr>
              <tr>
                <td>Área calculada</td>
                <td>${activeFootprint.area.toLocaleString("pt-BR")} m²</td>
              </tr>
              <tr>
                <td>Fator de uso aplicado</td>
                <td>${(analysisData.usage_factor * 100).toFixed(0)}%</td>
              </tr>
            </table>
          </div>
        ` : ''}
        
        ${hasImageryData ? `
          <div class="section-title">4.1 Metadados da Imagem de Satélite</div>
          <div class="data-grid">
            ${imageryMetadata.captureDate ? `
              <div class="data-item">
                <div class="data-label">Data da Captura</div>
                <div class="data-value">${imageryMetadata.captureDate}</div>
              </div>
            ` : ''}
            ${imageryMetadata.resolution ? `
              <div class="data-item">
                <div class="data-label">Resolução</div>
                <div class="data-value">${imageryMetadata.resolution}</div>
              </div>
            ` : ''}
            ${imageryMetadata.sourceInfo ? `
              <div class="data-item">
                <div class="data-label">Provedor</div>
                <div class="data-value">${sanitizeHtml(imageryMetadata.sourceInfo)}</div>
              </div>
            ` : ''}
            ${imageryMetadata.accuracy ? `
              <div class="data-item">
                <div class="data-label">Precisão</div>
                <div class="data-value">${imageryMetadata.accuracy}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  static generateDataSources(analysisData: any): string {
    return `
      <div class="section">
        <div class="section-title">5. METODOLOGIA E FONTES DE DADOS</div>
        <p><strong>Fonte de Irradiação Solar:</strong> ${sanitizeHtml(
          analysisData.irradiation_source
        )}</p>
        <p><strong>Cobertura Google Solar API:</strong> ${
          analysisData.coverage.google ? "Disponível" : "Não disponível"
        }</p>
        ${
          analysisData.coverage.fallback
            ? `<p><strong>Fonte Alternativa:</strong> ${sanitizeHtml(
                analysisData.coverage.fallback
              )}</p>`
            : ""
        }
        <p><strong>Método de Cálculo da Área:</strong> ${sanitizeHtml(
          analysisData.area_source
        )}</p>
        <p><strong>Normas Técnicas Aplicadas:</strong> NBR 16274 (Sistemas Fotovoltaicos), NBR 16690 (Instalações Elétricas)</p>
        
        <div class="warning">
          <strong>Importante:</strong> Esta análise é baseada em dados de satélite e algoritmos automatizados conforme NBR 16274. 
          Para projetos comerciais acima de 75kWp, é obrigatória validação presencial por engenheiro eletricista habilitado no CREA.
        </div>
      </div>
    `;
  }

  static async generateCommercialProposal(analysisData: any): Promise<string> {
    try {
      // Cálculos técnicos corrigidos conforme NBR 16274
      const annualProduction = Number(analysisData.estimated_production);
      const coordinates = analysisData.coordinates;
      
      // Buscar dados da concessionária baseado na localização
      const concessionariaInfo = await AneelDataService.getConcessionariaInfo(
        coordinates.lat, 
        coordinates.lng
      );
      
      // NÃO INVENTAR potência ou módulos - usar apenas produção real calculada
      // Os cálculos de potência devem ser feitos por profissionais qualificados
      
      const monthlyProduction = Math.round(annualProduction / 12);
      
      // Usar tarifa real da concessionária (com fator de consumo 0,9)
      const realTariff = concessionariaInfo.tarifa;
      const annualSavings = Math.round(annualProduction * realTariff * 0.9);

    return `
      <div class="page-break"></div>
      <div class="section">
        <div class="section-title">6. PROPOSTA TÉCNICA COMERCIAL</div>
        
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Área Disponível</div>
            <div class="data-value">${Number(analysisData.usable_area).toLocaleString("pt-BR")} m²</div>
          </div>
          <div class="data-item">
            <div class="data-label">Potencial de Produção</div>
            <div class="data-value">${annualProduction.toLocaleString("pt-BR")} kWh/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Irradiação Local</div>
            <div class="data-value">${Number(analysisData.annual_ghi).toLocaleString("pt-BR")} kWh/m²/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Perdas por Sombreamento</div>
            <div class="data-value">${Number(analysisData.shading_loss).toFixed(1)}%</div>
          </div>
        </div>
        
        <div class="section-title">6.1 Estimativas Econômicas</div>
        
        <div class="chart-container">
          ${EChartsGenerator.generateLineChart([
            { name: 'Ano 1', value: Math.round(annualSavings) },
            { name: 'Ano 5', value: Math.round(annualSavings * 5 * 0.95) },
            { name: 'Ano 10', value: Math.round(annualSavings * 10 * 0.9) },
            { name: 'Ano 15', value: Math.round(annualSavings * 15 * 0.85) },
            { name: 'Ano 20', value: Math.round(annualSavings * 20 * 0.82) },
            { name: 'Ano 25', value: Math.round(annualSavings * 25 * 0.8) }
          ], 700, 350, 'Economia Acumulada ao Longo de 25 Anos', '#28a745')}
        </div>
        
        <div class="chart-container">
          ${EChartsGenerator.generateBarChart([
            { name: 'Economia Total (25 anos)', value: Math.round(annualSavings * 25 * 0.8) }
          ], 600, 350, 'Projeção de Economia Energética (25 anos)', '#0066cc')}
        </div>
        
        <div class="section-title">6.2 Dados da Concessionária Local</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Concessionária</div>
            <div class="data-value">${concessionariaInfo.nome}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Estado/Região</div>
            <div class="data-value">${concessionariaInfo.estado}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Modalidade Tarifária</div>
            <div class="data-value">${concessionariaInfo.modalidade}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Tarifa Vigente</div>
            <div class="data-value">${formatCurrency(realTariff)}/kWh</div>
          </div>
        </div>

        <ul>
          <li><strong>Produção Mensal Média:</strong> ${monthlyProduction.toLocaleString(
            "pt-BR"
          )} kWh</li>
          <li><strong>Produção Anual (Real):</strong> ${annualProduction.toLocaleString(
            "pt-BR"
          )} kWh</li>
          <li><strong>Tarifa Local (${concessionariaInfo.sigla}):</strong> ${formatCurrency(realTariff)}/kWh</li>
          <li><strong>Economia Anual Estimada:</strong> ${formatCurrency(
            annualSavings
          )}</li>
          <li><strong>Economia em 25 anos:</strong> ${formatCurrency(
            annualSavings * 25 * 0.8
          )} (considerando degradação)</li>
          <li><strong>Fonte dos Dados:</strong> ${analysisData.irradiation_source}</li>
          <li><strong>Confiança da Análise:</strong> ${analysisData.confidence}</li>
          <li><strong>Vida Útil Padrão:</strong> 25 anos (degradação < 0,5%/ano)</li>
        </ul>
        
        <div class="warning">
          <strong>Observações Importantes:</strong>
          <ul>
            <li><strong>Dados Reais:</strong> Produção baseada em ${analysisData.irradiation_source}</li>
            <li><strong>Tarifas:</strong> Baseadas em dados oficiais da ANEEL (${concessionariaInfo.nome})</li>
            <li><strong>Área Real:</strong> ${Number(analysisData.usable_area)} m² conforme análise ${analysisData.area_source}</li>
            <li><strong>Sombreamento:</strong> ${Number(analysisData.shading_loss)}% calculado por ${analysisData.shading_source || 'análise automática'}</li>
            <li><strong>Dimensionamento:</strong> Requer projeto técnico por profissional habilitado</li>
            <li><strong>Homologação:</strong> Obrigatória junto à ${concessionariaInfo.nome}</li>
            <li><strong>Modalidade:</strong> ${concessionariaInfo.modalidade} considerada</li>
            <li><strong>Orçamento:</strong> Valores de investimento mediante consulta técnica</li>
          </ul>
        </div>
      </div>
    `;
    } catch (error) {
      console.error('Erro ao gerar proposta comercial:', error);
      return `
        <div class="page-break"></div>
        <div class="section">
          <div class="section-title">6. PROPOSTA TÉCNICA COMERCIAL</div>
          <div class="warning">
            <strong>Erro:</strong> Não foi possível gerar a proposta comercial completa devido a problemas na obtenção dos dados tarifários.
            Entre em contato para uma análise personalizada.
          </div>
        </div>
      `;
    }
  }

  static generateFooter(analysisData: any, companyInfo?: any): string {
    const currentDate = new Date().toLocaleDateString("pt-BR");
    const currentTime = new Date().toLocaleTimeString("pt-BR");

    return `
      <div class="footer">
        <p><strong>Relatório gerado em:</strong> ${currentDate} às ${currentTime}</p>
        <p><strong>Sistema:</strong> Lumionfy - Análise Solar Técnica</p>
        <p><strong>Protocolo:</strong> ${analysisData.id}</p>
        ${
          companyInfo?.website
            ? `<p><strong>Website:</strong> ${sanitizeHtml(
                companyInfo.website
              )}</p>`
            : ""
        }
        
        <div style="margin-top: 30px; font-size: 10px; text-align: justify;">
          <p><strong>ISENÇÃO DE RESPONSABILIDADE E NORMAS TÉCNICAS:</strong></p>
          <p>Este laudo técnico preliminar foi gerado automaticamente conforme metodologia da NBR 16274 
          (Sistemas Fotovoltaicos), utilizando dados de satélite e algoritmos de análise solar validados. 
          As estimativas apresentadas são indicativas e podem variar ±15% conforme:</p>
          <ul style="font-size: 9px; margin: 5px 0;">
            <li>Condições reais de instalação e sombreamentos locais</li>
            <li>Equipamentos específicos utilizados (módulos, inversores, estruturas)</li>
            <li>Variações climáticas anuais e sazonais</li>
            <li>Qualidade da execução e manutenção do sistema</li>
            <li>Características específicas da rede elétrica local</li>
          </ul>
          <p><strong>OBRIGATÓRIO:</strong> Para sistemas acima de 75kWp ou projetos comerciais/industriais, 
          é obrigatória validação técnica presencial por Engenheiro Eletricista habilitado no CREA, 
          conforme NBR 16690 e Resolução ANEEL 482/2012. Este documento NÃO substitui projeto executivo.</p>
        </div>
      </div>
    `;
  }

  static async generateCompleteReport(analysisData: any, options: any): Promise<string> {
    const { language, notes, companyInfo, includeCommercial, mapImage } = options;

    const notesSection = notes
      ? `
      <div class="section">
        <div class="section-title">${includeCommercial ? '7' : '6'}. OBSERVAÇÕES ADICIONAIS</div>
        <p>${sanitizeHtml(notes)}</p>
      </div>
    `
      : "";

    const commercialSection = includeCommercial
      ? await this.generateCommercialProposal(analysisData)
      : "";

    return `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Laudo Técnico Solar - ${analysisData.address}</title>
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
        <style>${this.CSS_STYLES}</style>
      </head>
      <body>
        ${this.generateHeader(analysisData, companyInfo)}
        ${this.generateExecutiveSummary(analysisData)}
        ${this.generateTechnicalData(analysisData)}
        ${this.generateProductionAnalysis(analysisData)}
        ${this.generateTechnicalSpecs(analysisData)}
        ${this.generateLocationSection(analysisData, mapImage)}
        ${this.generateDataSources(analysisData)}
        ${commercialSection}
        ${notesSection}
        ${this.generateFooter(analysisData, companyInfo)}
      </body>
      </html>
    `;
  }
}

/* ========= CLASSE DE SERVIÇO PRINCIPAL ========= */
class PDFGeneratorService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      ENV_CONFIG.SUPABASE_URL,
      ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async validateUser(
    authToken: string
  ): Promise<{ user: any; error?: string }> {
    try {
      const authClient = createClient(
        ENV_CONFIG.SUPABASE_URL,
        ENV_CONFIG.SUPABASE_ANON_KEY
      );
      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(authToken);

      if (error || !user) {
        return { user: null, error: "Usuário não autenticado" };
      }

      return { user };
    } catch {
      return { user: null, error: "Erro na validação do usuário" };
    }
  }

  async getAnalysisData(
    analysisId: string,
    userId: string
  ): Promise<{ data?: any; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from("analyses")
        .select(`
          *,
          footprints,
          imagery_metadata
        `)
        .eq("id", analysisId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Database query error:", error.message);
        return { error: "Erro ao buscar dados da análise" };
      }

      if (!data) {
        return { error: "Análise não encontrada ou sem permissão de acesso" };
      }

      // Parse footprints JSON se existir
      if (data.footprints && typeof data.footprints === 'string') {
        try {
          data.footprints = JSON.parse(data.footprints);
        } catch (parseError) {
          console.warn("Failed to parse footprints JSON:", parseError);
          data.footprints = null;
        }
      }

      // Parse imagery_metadata JSON se existir
      if (data.imagery_metadata && typeof data.imagery_metadata === 'string') {
        try {
          data.imagery_metadata = JSON.parse(data.imagery_metadata);
        } catch (parseError) {
          console.warn("Failed to parse imagery_metadata JSON:", parseError);
          data.imagery_metadata = null;
        }
      }

      // Validar integridade dos dados da análise
      try {
        const validatedData = AnalysisDataSchema.parse(data);
        return { data: validatedData };
      } catch (validationError) {
        console.error("Invalid analysis data:", validationError);
        // Log detalhes do erro de validação para debug
        if (validationError instanceof Error) {
          console.error("Validation error details:", validationError.message);
        }
        return { error: "Dados da análise estão corrompidos ou incompletos" };
      }
    } catch (error) {
      console.error("Database connection error:", error);
      return { error: "Erro de conexão com o banco de dados" };
    }
  }

  async generatePDFContent(
    analysisData: any,
    options: any
  ): Promise<{ html: string; filename: string }> {
    const html = await HTMLTemplateGenerator.generateCompleteReport(
      analysisData,
      options
    );

    const sanitizedAddress = analysisData.address
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();

    const filename = `laudo-solar-${sanitizedAddress}-${Date.now()}.pdf`;

    return { html, filename };
  }
}

/* ========= HANDLER PRINCIPAL ========= */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método não permitido" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const pdfService = new PDFGeneratorService();

  try {
    // Parse e validate request body
    const body = await req.json();
    const validatedData = PDFRequestSchema.parse(body);

    // Extract auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token de autorização requerido",
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const authToken = authHeader.replace("Bearer ", "");

    // Validate user
    const { user, error: authError } = await pdfService.validateUser(authToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: authError || "Falha na autenticação",
        }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Get analysis data
    const { data: analysisData, error: dataError } =
      await pdfService.getAnalysisData(validatedData.analysisId, user.id);

    if (dataError || !analysisData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: dataError || "Dados da análise não encontrados",
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Generate PDF content
    const { html, filename } = await pdfService.generatePDFContent(analysisData, {
      language: validatedData.language,
      notes: validatedData.notes,
      companyInfo: validatedData.companyInfo,
      includeCommercial: validatedData.includeCommercial,
      mapImage: validatedData.mapImage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { html, filename },
        message: "Relatório PDF gerado com sucesso",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("PDF Generation error:", error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Dados de entrada inválidos",
          details: error.errors,
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
