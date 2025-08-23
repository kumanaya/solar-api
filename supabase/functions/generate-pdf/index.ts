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
  confidence: z.enum(["Alta", "Média", "Baixa"]),
  verdict: z.enum(["Apto", "Parcial", "Não apto"]),
  irradiation_source: z.string(),
  area_source: z.string(),
  coverage: z.object({
    google: z.boolean(),
    fallback: z.string().optional(),
  }),
  reasons: z.array(z.string()).optional(),
});

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
    return `
      <div class="section">
        <div class="section-title">2. DADOS TÉCNICOS</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Área Útil Disponível</div>
            <div class="data-value">${Number(
              analysisData.usable_area
            ).toLocaleString("pt-BR")} m²</div>
          </div>
          <div class="data-item">
            <div class="data-label">Irradiação Global Anual</div>
            <div class="data-value">${Number(
              analysisData.annual_ghi
            ).toLocaleString("pt-BR")} kWh/m²/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Produção Anual Estimada</div>
            <div class="data-value">${Number(
              analysisData.estimated_production
            ).toLocaleString("pt-BR")} kWh/ano</div>
          </div>
          <div class="data-item">
            <div class="data-label">Confiança da Análise</div>
            <div class="data-value">${sanitizeHtml(
              analysisData.confidence
            )}</div>
          </div>
          <div class="data-item">
            <div class="data-label">Perdas por Sombreamento</div>
            <div class="data-value">${Number(analysisData.shading_loss).toFixed(
              1
            )}%</div>
          </div>
          <div class="data-item">
            <div class="data-label">Fator de Uso da Área</div>
            <div class="data-value">${Number(
              analysisData.usage_factor * 100
            ).toFixed(0)}%</div>
          </div>
        </div>
      </div>
    `;
  }

  static generateTechnicalSpecs(analysisData: any): string {
    // Calcular parâmetros técnicos baseados na localização
    const lat = Number(analysisData.coordinates.lat);
    const optimalTilt = Math.abs(lat) - 10; // Regra prática NBR 16274
    const optimalAzimuth = lat > 0 ? 180 : 0; // Norte geográfico para hemisfério sul
    
    // Perdas típicas do sistema (NBR 16274)
    const tempLosses = 8.0; // Perdas por temperatura (típico Brasil)
    const cableLosses = 2.0; // Perdas em cabeamento DC + AC
    const inverterLosses = 3.0; // Perdas no inversor
    const soilingLosses = 2.0; // Perdas por sujidade
    const totalLosses = tempLosses + cableLosses + inverterLosses + soilingLosses;
    
    return `
      <div class="section">
        <div class="section-title">3. ESPECIFICAÇÕES TÉCNICAS</div>
        
        <div class="section-title">3.1 Parâmetros de Instalação</div>
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Inclinação Recomendada</div>
            <div class="data-value">${optimalTilt.toFixed(0)}°</div>
          </div>
          <div class="data-item">
            <div class="data-label">Orientação (Azimute)</div>
            <div class="data-value">${optimalAzimuth}° (Norte)</div>
          </div>
          <div class="data-item">
            <div class="data-label">Fator de Sombreamento</div>
            <div class="data-value">${Number(analysisData.shading_loss).toFixed(1)}%</div>
          </div>
          <div class="data-item">
            <div class="data-label">Rendimento Global Estimado</div>
            <div class="data-value">${(100 - totalLosses).toFixed(1)}%</div>
          </div>
        </div>
        
        <div class="section-title">3.2 Perdas do Sistema (NBR 16274)</div>
        <ul>
          <li><strong>Perdas por Temperatura:</strong> ${tempLosses}% (coef. -0,4%/°C)</li>
          <li><strong>Perdas em Cabeamento:</strong> ${cableLosses}% (DC + AC)</li>
          <li><strong>Perdas no Inversor:</strong> ${inverterLosses}% (rendimento 97%)</li>
          <li><strong>Perdas por Sujidade:</strong> ${soilingLosses}% (manutenção semestral)</li>
          <li><strong>Perdas por Sombreamento:</strong> ${Number(analysisData.shading_loss).toFixed(1)}% (análise satellite)</li>
          <li><strong>Total de Perdas:</strong> ${(totalLosses + Number(analysisData.shading_loss)).toFixed(1)}%</li>
        </ul>
      </div>
    `;
  }

  static generateDataSources(analysisData: any): string {
    return `
      <div class="section">
        <div class="section-title">4. METODOLOGIA E FONTES DE DADOS</div>
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

  static generateCommercialProposal(analysisData: any): string {
    // Cálculos técnicos corrigidos conforme NBR 16274
    const annualProduction = Number(analysisData.estimated_production);
    
    // HSP médio Brasil: 1.300 kWh/kWp/ano (mais conservador e realista)
    const recommendedPower = Math.round(annualProduction / 1300);
    
    // Módulos padrão 550Wp - usar Math.ceil para não subdimensionar
    const panelCount = Math.ceil(recommendedPower / 0.55);
    
    // Recalcular potência real baseada no número de módulos
    const actualPower = panelCount * 0.55;
    
    const monthlyProduction = Math.round(annualProduction / 12);
    
    // Tarifa média Brasil 2024: R$ 0,85/kWh (mais realista)
    // Considerar que nem toda produção é consumida (fator 0,9)
    const annualSavings = Math.round(annualProduction * 0.85 * 0.9);

    return `
      <div class="page-break"></div>
      <div class="section">
        <div class="section-title">5. PROPOSTA TÉCNICA COMERCIAL</div>
        
        <div class="data-grid">
          <div class="data-item">
            <div class="data-label">Potência Recomendada</div>
            <div class="data-value">${actualPower.toLocaleString(
              "pt-BR",
              { minimumFractionDigits: 1, maximumFractionDigits: 1 }
            )} kWp</div>
          </div>
          <div class="data-item">
            <div class="data-label">Módulos 550Wp</div>
            <div class="data-value">${panelCount.toLocaleString(
              "pt-BR"
            )} unidades</div>
          </div>
          <div class="data-item">
            <div class="data-label">Área Necessária</div>
            <div class="data-value">${Math.round(panelCount * 2.8).toLocaleString(
              "pt-BR"
            )} m²</div>
          </div>
          <div class="data-item">
            <div class="data-label">Relação Potência/Área</div>
            <div class="data-value">${(actualPower * 1000 / Number(analysisData.usable_area)).toFixed(0)} W/m²</div>
          </div>
        </div>
        
        <div class="section-title">5.1 Estimativas Econômicas</div>
        <ul>
          <li><strong>Produção Mensal Média:</strong> ${monthlyProduction.toLocaleString(
            "pt-BR"
          )} kWh</li>
          <li><strong>Produção Anual:</strong> ${annualProduction.toLocaleString(
            "pt-BR"
          )} kWh</li>
          <li><strong>Tarifa Considerada:</strong> R$ 0,85/kWh (média nacional 2024)</li>
          <li><strong>Economia Anual Estimada:</strong> ${formatCurrency(
            annualSavings
          )}</li>
          <li><strong>Economia em 25 anos:</strong> ${formatCurrency(
            annualSavings * 25 * 0.8
          )} (considerando degradação)</li>
          <li><strong>Payback Estimado:</strong> 5 a 7 anos (depende do investimento)</li>
          <li><strong>Vida Útil Garantida:</strong> 25 anos (degradação < 0,5%/ano)</li>
        </ul>
        
        <div class="warning">
          <strong>Observações Importantes:</strong>
          <ul>
            <li>Valores baseados em tarifa média nacional (varia por concessionária)</li>
            <li>Não inclui custos de equipamentos, instalação e homologação</li>
            <li>Investimento típico: R$ 4.000 a R$ 6.000 por kWp instalado</li>
            <li>Sistema requer homologação junto à concessionária local</li>
            <li>Manutenção preventiva semestral recomendada</li>
            <li>Orçamento técnico-comercial disponível mediante consulta</li>
          </ul>
        </div>
      </div>
    `;
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

  static generateCompleteReport(analysisData: any, options: any): string {
    const { language, notes, companyInfo, includeCommercial } = options;

    const notesSection = notes
      ? `
      <div class="section">
        <div class="section-title">6. OBSERVAÇÕES ADICIONAIS</div>
        <p>${sanitizeHtml(notes)}</p>
      </div>
    `
      : "";

    const commercialSection = includeCommercial
      ? this.generateCommercialProposal(analysisData)
      : "";

    return `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Laudo Técnico Solar - ${analysisData.address}</title>
        <style>${this.CSS_STYLES}</style>
      </head>
      <body>
        ${this.generateHeader(analysisData, companyInfo)}
        ${this.generateExecutiveSummary(analysisData)}
        ${this.generateTechnicalData(analysisData)}
        ${this.generateTechnicalSpecs(analysisData)}
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
    } catch (error) {
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
        .select("*")
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

      // Validar integridade dos dados da análise
      try {
        const validatedData = AnalysisDataSchema.parse(data);
        return { data: validatedData };
      } catch (validationError) {
        console.error("Invalid analysis data:", validationError);
        return { error: "Dados da análise estão corrompidos ou incompletos" };
      }
    } catch (error) {
      console.error("Database connection error:", error);
      return { error: "Erro de conexão com o banco de dados" };
    }
  }

  generatePDFContent(
    analysisData: any,
    options: any
  ): { html: string; filename: string } {
    const html = HTMLTemplateGenerator.generateCompleteReport(
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
    const { html, filename } = pdfService.generatePDFContent(analysisData, {
      language: validatedData.language,
      notes: validatedData.notes,
      companyInfo: validatedData.companyInfo,
      includeCommercial: validatedData.includeCommercial,
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
