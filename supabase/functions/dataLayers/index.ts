// deno-lint-ignore-file no-explicit-any
// Edge Function – Google Solar API Data Layers (GeoTIFFs)

/// <reference lib="dom" />

// @ts-expect-error Deno types no edge
declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (r: Request) => Response | Promise<Response>): void;
};

// @ts-expect-error Import from URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.5";
// @ts-expect-error Import from URL
import { z } from "https://esm.sh/zod@3.23.8";

/* ========= ENV ========= */
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const GOOGLE_SOLAR_API_KEY = GOOGLE_MAPS_API_KEY; // mesma key
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/* ========= TYPES ========= */
interface SolarDate {
  year: number;
  month: number;
  day: number;
}

type GeoTiffUnion =
  | string
  | {
      downloadUrl: string;
      imageDateRange?: SolarDate;
      pixelSizeMeters: number;
      regionCode?: string;
    };

type ImageryQuality = "LOW" | "MEDIUM" | "HIGH" | "BASE";

/* ========= SCHEMAS ========= */
const SolarDateSchema = z.object({
  year: z.number(),
  month: z.number(),
  day: z.number(),
});

const GeoTiffUnionSchema = z.union([
  z.string().url(),
  z.object({
    downloadUrl: z.string().url(),
    imageDateRange: SolarDateSchema.optional(),
    pixelSizeMeters: z.number(),
    regionCode: z.string().optional(),
  }),
]);

const DataLayersRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(1).max(1000).default(100),
  view: z
    .enum([
      "FULL_LAYERS",
      "DSM_LAYER",
      "IMAGERY_LAYER",
      "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
      "IMAGERY_AND_ALL_FLUX_LAYERS",
    ])
    .default("FULL_LAYERS"),
  requiredQuality: z.enum(["LOW", "MEDIUM", "HIGH"]).default("HIGH"),
  pixelSizeMeters: z.number().min(0.1).max(1).default(0.1),
  exactQualityRequired: z.boolean().default(false),
});

export const DataLayersResponseSchema = z.object({
  imageryDate: SolarDateSchema,
  imageryProcessedDate: SolarDateSchema,
  dsmUrl: GeoTiffUnionSchema,
  rgbUrl: GeoTiffUnionSchema,
  maskUrl: GeoTiffUnionSchema,
  annualFluxUrl: GeoTiffUnionSchema,
  monthlyFluxUrl: GeoTiffUnionSchema,
  hourlyShadeUrls: z.array(GeoTiffUnionSchema),
  imageryQuality: z
    .enum(["LOW", "MEDIUM", "HIGH"])
    .or(z.literal("BASE")) as unknown as z.ZodType<ImageryQuality>,
});

/* ========= HELPERS ========= */

// CORS
function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Retorna uma URL final de download para o GeoTIFF usando SEMPRE o endpoint geoTiff:get com key.
 * Aceita:
 * - string já em geoTiff:get (com ou sem key)
 * - objeto { downloadUrl, ... } (link de download com ?id=...)
 */
function toGeoTiffGetUrl(layer: GeoTiffUnion): {
  url: string;
  meta: {
    imageDateRange?: SolarDate;
    pixelSizeMeters?: number;
    regionCode?: string;
  };
} {
  if (!GOOGLE_SOLAR_API_KEY) {
    throw new Error("Google Solar API key não configurada");
  }

  let id: string | null = null;
  let meta: {
    imageDateRange?: SolarDate;
    pixelSizeMeters?: number;
    regionCode?: string;
  } = {};

  if (typeof layer === "string") {
    const u = new URL(layer);
    // Pode já ser /geoTiff:get?id=... ou outro formato com ?id=
    id = u.searchParams.get("id");
    meta = {};
  } else {
    // formato objeto com downloadUrl
    const u = new URL(layer.downloadUrl);
    id = u.searchParams.get("id");
    meta = {
      imageDateRange: layer.imageDateRange,
      pixelSizeMeters: layer.pixelSizeMeters,
      regionCode: layer.regionCode,
    };
  }

  if (!id) throw new Error("GeoTIFF sem parâmetro 'id'");

  // monta geoTiff:get com key (se a URL original já tinha key, vamos padronizar nossa própria)
  const finalUrl = `https://solar.googleapis.com/v1/solar/geoTiff:get?id=${encodeURIComponent(
    id
  )}&key=${GOOGLE_SOLAR_API_KEY}`;

  return { url: finalUrl, meta };
}

/* ========= GOOGLE SOLAR DATA LAYERS API ========= */

async function getGoogleSolarDataLayers(params: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  view: string;
  requiredQuality: string;
  pixelSizeMeters: number;
  exactQualityRequired: boolean;
}) {
  if (!GOOGLE_SOLAR_API_KEY) {
    throw new Error("Google Solar API key não configurada");
  }

  const queryParams = new URLSearchParams({
    "location.latitude": params.latitude.toString(),
    "location.longitude": params.longitude.toString(),
    radiusMeters: params.radiusMeters.toString(),
    view: params.view,
    requiredQuality: params.requiredQuality,
    pixelSizeMeters: params.pixelSizeMeters.toString(),
    exactQualityRequired: params.exactQualityRequired.toString(),
    key: GOOGLE_SOLAR_API_KEY,
  });

  const url = `https://solar.googleapis.com/v1/dataLayers:get?${queryParams}`;
  console.log(`Requesting Google Solar Data Layers: ${url}`);

  const res = await fetchWithTimeout(url, 15000);
  const data = await res.json();

  if (!res.ok || (data as any).error) {
    console.error("Google Solar API error:", (data as any).error || "Unknown");
    throw new Error(
      `Google Solar API error: ${
        (data as any).error?.message || "Unknown error"
      }`
    );
  }

  // valida no schema já com unions
  return DataLayersResponseSchema.parse(data);
}

/* ========= STORAGE FUNCTIONS ========= */

async function downloadAndStoreGeoTiff(
  layer: GeoTiffUnion,
  filename: string,
  supabase: ReturnType<typeof createClient>
): Promise<{
  publicUrl: string | null;
  meta: {
    imageDateRange?: SolarDate;
    pixelSizeMeters?: number;
    regionCode?: string;
  };
}> {
  try {
    const { url, meta } = toGeoTiffGetUrl(layer);
    console.log(`Downloading GeoTIFF via geoTiff:get: ${filename}`);

    const response = await fetchWithTimeout(url, 30000);
    if (!response.ok) {
      console.error(`Failed to download ${filename}: ${response.status}`);
      return { publicUrl: null, meta };
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("geotiffs")
      .upload(`public/${filename}`, uint8Array, {
        contentType: "image/tiff",
        upsert: true,
      });

    if (error) {
      console.error(`Storage upload error for ${filename}:`, error);
      return { publicUrl: null, meta };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("geotiffs")
      .getPublicUrl(`public/${filename}`);

    console.log(`Stored ${filename} at: ${publicUrlData.publicUrl}`);
    return { publicUrl: publicUrlData.publicUrl, meta };
  } catch (error) {
    console.error(`Error processing ${filename}:`, error);
    return { publicUrl: null, meta: {} };
  }
}

interface LayerMetadata {
  date?: SolarDate;
  pixelSize?: number;
  regionCode?: string;
}

interface LayerData {
  url: string;
  title: string;
  description: string;
  metadata: LayerMetadata;
}

interface HourlyShadeData extends LayerData {
  hour: number;
}

interface StoredLayers {
  [key: string]: LayerData | HourlyShadeData[];
}

async function processAndStoreDataLayers(
  dataLayersResponse: z.infer<typeof DataLayersResponseSchema>,
  analysisId: string,
  supabase: ReturnType<typeof createClient>
) {
  const storedLayers: StoredLayers = {};
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Cria base do nome dos arquivos
  const baseFilename = `${analysisId}_${timestamp}`;

  // Layers principais
  const layerMappings = [
    {
      key: "dsmUrl" as const,
      filename: `${baseFilename}_dsm.tiff`,
      title: "Modelo Digital de Superfície",
      info: "Representa a elevação da superfície incluindo edifícios e vegetação",
    },
    {
      key: "rgbUrl" as const,
      filename: `${baseFilename}_rgb.tiff`,
      title: "Imagem de Satélite",
      info: "Imagem aérea de alta resolução da área analisada",
    },
    {
      key: "maskUrl" as const,
      filename: `${baseFilename}_mask.tiff`,
      title: "Máscara de Área",
      info: "Identifica áreas adequadas para instalação solar",
    },
    {
      key: "annualFluxUrl" as const,
      filename: `${baseFilename}_annual_flux.tiff`,
      title: "Fluxo Solar Anual",
      info: "Irradiação solar total ao longo do ano",
    },
    {
      key: "monthlyFluxUrl" as const,
      filename: `${baseFilename}_monthly_flux.tiff`,
      title: "Fluxo Solar Mensal",
      info: "Variação mensal da irradiação solar",
    },
  ];

  for (const mapping of layerMappings) {
    const layer = dataLayersResponse[mapping.key];
    if (layer) {
      const { publicUrl, meta } = await downloadAndStoreGeoTiff(
        layer,
        mapping.filename,
        supabase
      );
      if (publicUrl) {
        storedLayers[mapping.key] = {
          url: publicUrl,
          title: mapping.title,
          description: mapping.info,
          metadata: {
            date:
              typeof layer === "string"
                ? undefined
                : layer.imageDateRange ?? meta.imageDateRange,
            pixelSize:
              typeof layer === "string"
                ? meta.pixelSizeMeters
                : layer.pixelSizeMeters ?? meta.pixelSizeMeters,
            regionCode:
              typeof layer === "string"
                ? meta.regionCode
                : layer.regionCode ?? meta.regionCode,
          },
        };
      }
    }
  }

  // Processar SOMENTE as imagens de sombra realmente disponíveis (array pode ser de qualquer tamanho)
  if (Array.isArray(dataLayersResponse.hourlyShadeUrls)) {
    const hourlyShadeData: Array<{
      url: string;
      title: string;
      description: string;
      hour: number;
      metadata: LayerMetadata;
    }> = [];

    for (let idx = 0; idx < dataLayersResponse.hourlyShadeUrls.length; idx++) {
      const shadeData = dataLayersResponse.hourlyShadeUrls[idx];
      if (shadeData) {
        const filename = `${baseFilename}_shade_${idx
          .toString()
          .padStart(2, "0")}h.tiff`;
        const { publicUrl, meta } = await downloadAndStoreGeoTiff(
          shadeData,
          filename,
          supabase
        );
        if (publicUrl) {
          hourlyShadeData.push({
            url: publicUrl,
            title: `Sombreamento ${idx}:00h`,
            description: `Análise de sombreamento às ${idx}:00 horas`,
            hour: idx,
            metadata: {
              date:
                typeof shadeData === "string"
                  ? undefined
                  : shadeData.imageDateRange ?? meta.imageDateRange,
              pixelSize:
                typeof shadeData === "string"
                  ? meta.pixelSizeMeters
                  : shadeData.pixelSizeMeters ?? meta.pixelSizeMeters,
              regionCode:
                typeof shadeData === "string"
                  ? meta.regionCode
                  : shadeData.regionCode ?? meta.regionCode,
            },
          });
        }
      }
    }

    if (hourlyShadeData.length > 0) {
      storedLayers["hourlyShadeUrls"] = hourlyShadeData;
    }
  }

  // Metadados padrão do DSM (ajuste conforme necessidade)
  const dsmMeta =
    typeof dataLayersResponse.dsmUrl === "string"
      ? {}
      : {
          pixelSizeMeters: dataLayersResponse.dsmUrl.pixelSizeMeters,
          regionCode: dataLayersResponse.dsmUrl.regionCode,
        };

  return {
    storedLayers,
    metadata: {
      imageryDate: dataLayersResponse.imageryDate,
      imageryProcessedDate: dataLayersResponse.imageryProcessedDate,
      imageryQuality: dataLayersResponse.imageryQuality,
      pixelSizeMeters: (dsmMeta as any).pixelSizeMeters ?? 0.1,
      regionCode: (dsmMeta as any).regionCode ?? "BR",
    },
  };
}

/* ========= DATABASE ========= */

interface DataLayersMetadata {
  imageryDate: SolarDate;
  imageryProcessedDate: SolarDate;
  imageryQuality: ImageryQuality;
  pixelSizeMeters: number;
  regionCode: string;
}

async function saveDataLayersToDatabase(
  analysisId: string,
  userId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  storedLayers: StoredLayers,
  metadata: DataLayersMetadata,
  originalResponse: z.infer<typeof DataLayersResponseSchema>,
  supabase: ReturnType<typeof createClient>
) {
  try {
    console.log("Saving data layers to database for analysis:", analysisId);

    const insertData = {
      analysis_id: analysisId,
      user_id: userId,
      latitude,
      longitude,
      radius_meters: radiusMeters,
      imagery_date: metadata.imageryDate,
      imagery_processed_date: metadata.imageryProcessedDate,
      imagery_quality: metadata.imageryQuality,
      pixel_size_meters: metadata.pixelSizeMeters,
      region_code: metadata.regionCode,
      stored_layers: storedLayers,
      google_response: originalResponse,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("data_layers")
      .insert(insertData)
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Database save error:", JSON.stringify(error, null, 2));
      return null;
    }

    console.log("Data layers saved successfully:", data);
    return { id: data.id, createdAt: data.created_at };
  } catch (error) {
    console.error("Database save exception:", error);
    return null;
  }
}

/* ========= AUTH ========= */

async function verifyAuth(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      error: "Missing or invalid Authorization header",
    };
  }
  const token = auth.replace("Bearer ", "").trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false as const, error: "Supabase env not configured" };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false as const, error: "Invalid or expired token" };
  }
  return {
    ok: true as const,
    user: { id: data.user.id, email: data.user.email ?? undefined },
  };
}

/* ========= HANDLER ========= */

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth
    const auth = await verifyAuth(req);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error }),
        {
          status: 401,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const json = await req.json();
    const input = DataLayersRequestSchema.parse(json);

    console.log("Processing data layers request:", input);

    // Create Supabase client with user context
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: "",
      });
    }

    // Get Google Solar Data Layers
    const dataLayersResponse = await getGoogleSolarDataLayers({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
      view: input.view,
      requiredQuality: input.requiredQuality,
      pixelSizeMeters: input.pixelSizeMeters,
      exactQualityRequired: input.exactQualityRequired,
    });

    console.log(
      "Received data layers response keys:",
      Object.keys(dataLayersResponse)
    );

    // Generate analysis ID
    const analysisId = crypto.randomUUID();

    // Process and store GeoTIFF files
    const { storedLayers, metadata } = await processAndStoreDataLayers(
      dataLayersResponse,
      analysisId,
      supabase
    );

    console.log("Processed and stored layers:", Object.keys(storedLayers));

    // Save to database
    const savedResult = await saveDataLayersToDatabase(
      analysisId,
      auth.user.id,
      input.latitude,
      input.longitude,
      input.radiusMeters,
      storedLayers,
      metadata,
      dataLayersResponse,
      supabase
    );

    // Prepare response
    const responseData = {
      id: savedResult?.id || analysisId,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
      imageryQuality: metadata.imageryQuality,
      imageryDate: metadata.imageryDate,
      storedLayers,
      layerCount: Object.keys(storedLayers).length,
      createdAt: savedResult?.createdAt || new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Data layers processing error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Content-Type": "application/json",
      },
    });
  }
});
