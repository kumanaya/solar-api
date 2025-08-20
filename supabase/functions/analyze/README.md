# Analyze Edge Function

Edge function para análise solar que integra com Google Maps Geocoding API e Google Solar API.

## Funcionamento

### 1. Geocoding
- Recebe um endereço como input
- Usa Google Maps Geocoding API para obter coordenadas (lat, lng)
- Retorna erro se não conseguir geocodificar

### 2. Google Solar API (Prioritário)
- Tenta buscar dados solares no Google Solar API
- Se disponível, retorna análise completa com:
  - Dados reais de irradiação
  - Segmentos de telhado identificados
  - Potencial solar calculado pelo Google
  - Alta confiabilidade nos resultados

### 3. Fallback Analysis
- Se Google Solar API não tiver cobertura para a região
- Usa estimativas baseadas em:
  - Localização geográfica (irradiação regional)
  - Algoritmos de estimativa de área utilizável
  - Cálculos de sombreamento estimado
  - Menor confiabilidade, mas ainda útil

## Endpoint

```
POST /functions/v1/analyze
```

### Authentication
Esta rota requer autenticação JWT. Inclua o token no header:

```
Authorization: Bearer <jwt_token>
```

### Request Body
```json
{
  "address": "Rua das Flores, 123, São Paulo, SP"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "address": "Endereço formatado",
    "coordinates": {
      "lat": -23.5505,
      "lng": -46.6333
    },
    "coverage": {
      "google": true // ou false se usando fallback
    },
    "confidence": "Alta", // Alta | Média | Baixa
    "usableArea": 120,
    "areaSource": "google", // google | estimate | footprint
    "annualIrradiation": 1650,
    "irradiationSource": "Google Solar API",
    "shadingIndex": 0.15,
    "shadingLoss": 15,
    "estimatedProduction": 3200,
    "verdict": "Apto", // Apto | Parcial | Não apto
    "reasons": [
      "Dados Google Solar confirmam viabilidade",
      "Excelente potencial solar",
      "Área suficiente"
    ],
    "footprints": [
      {
        "id": "1",
        "coordinates": [[lng, lat], ...],
        "area": 120,
        "isActive": true
      }
    ],
    "usageFactor": 0.8,
    "googleSolarData": {} // Dados brutos do Google (quando disponível)
  }
}
```

### Error Responses

#### Authentication Error (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

#### Validation Error (400)
```json
{
  "success": false,
  "error": "Address is required"
}
```

#### Geocoding Error (400)
```json
{
  "success": false,
  "error": "Could not geocode address"
}
```

#### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Variáveis de Ambiente

### Obrigatórias
- `GOOGLE_MAPS_API_KEY`: Chave da API do Google Maps
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de service role do Supabase (opcional)

### APIs Necessárias
1. **Google Maps Geocoding API**: Para converter endereços em coordenadas
2. **Google Solar API**: Para dados solares (quando disponível)

## Deployment

```bash
# Deploy da função
supabase functions deploy analyze

# Definir variáveis de ambiente
supabase secrets set GOOGLE_MAPS_API_KEY=your_api_key
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
```

## Configuração do Google Cloud

1. Ativar APIs necessárias:
   - Maps JavaScript API
   - Geocoding API  
   - Solar API

2. Configurar chave de API com restrições adequadas

3. Definir cotas e limites conforme necessário

## Cobertura Regional

### Google Solar API
- Disponível principalmente em:
  - Estados Unidos
  - Alguns países da Europa
  - Cobertura limitada em outras regiões

### Fallback Analysis
- Funciona globalmente
- Estimativas baseadas em dados geográficos
- Menor precisão, mas cobertura universal