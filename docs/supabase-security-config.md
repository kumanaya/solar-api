# Configurações de Segurança do Supabase

## Configurações de Autenticação que precisam ser ajustadas no Dashboard do Supabase

### 1. Proteção contra Senhas Vazadas
**Status**: ⚠️ DESABILITADO  
**Ação**: Habilitar no Dashboard  
**Caminho**: Authentication > Settings > Password Security  
**Configuração**: Ativar "Leaked password protection"  
**Benefício**: Previne uso de senhas comprometidas verificando contra HaveIBeenPwned.org

### 2. Opções de MFA Insuficientes
**Status**: ⚠️ LIMITADO  
**Ação**: Habilitar mais métodos MFA  
**Caminho**: Authentication > Settings > Multi-Factor Authentication  
**Opções recomendadas**:
- TOTP (Time-based One-Time Password)
- SMS (se aplicável)
- Authenticator apps

### 3. Problemas de Sistema (Não podem ser corrigidos pela aplicação)

#### 3.1 Tabela spatial_ref_sys sem RLS
**Status**: ❌ ERRO (Sistema PostGIS)  
**Ação**: IGNORAR - É uma tabela do sistema PostGIS  
**Motivo**: Não temos permissão para modificar tabelas do sistema PostGIS  
**Impacto**: Baixo - Tabela de referência do sistema de coordenadas

#### 3.2 Extension postgis no schema public
**Status**: ⚠️ AVISO (Sistema)  
**Ação**: IGNORAR - Extension do sistema  
**Motivo**: PostGIS é instalado automaticamente pelo Supabase no schema public  
**Impacto**: Baixo - Funcionalidade necessária para operações geoespaciais

## Correções Aplicadas Automaticamente ✅

### 1. Performance RLS - Políticas de Análises
- ✅ Otimizadas para usar `(select auth.uid())` em vez de `auth.uid()`
- ✅ Melhora significativa de performance em consultas com muitas linhas

### 2. RLS habilitado em building_footprints
- ✅ Tabela agora protegida por RLS
- ✅ Leitura permitida para usuários autenticados
- ✅ Modificação restrita ao service role

### 3. Funções com search_path seguro
- ✅ `find_nearby_buildings` corrigida
- ✅ `find_closest_building` corrigida
- ✅ search_path explícito definido para segurança

### 4. Índices não utilizados removidos
- ✅ `idx_building_footprints_bounds` removido
- ✅ `idx_building_footprints_area` removido
- ✅ `idx_analyses_created_at` removido
- ✅ `idx_analyses_address` removido
- ✅ Mantidos apenas índices essenciais para performance

## Próximos Passos

1. **Acesso ao Dashboard Supabase**: Configure proteção contra senhas vazadas
2. **MFA**: Ative opções adicionais de autenticação multifator
3. **Monitoramento**: Verifique se as correções melhoraram a performance
4. **Revisão**: Execute advisor novamente em 1 semana para verificar impacto

## Status Geral
- ✅ **Problemas Críticos**: Resolvidos
- ⚠️ **Avisos de Performance**: Resolvidos
- ⚠️ **Configurações Auth**: Pendentes (requerem acesso ao dashboard)
- ❌ **Problemas de Sistema**: Não resolvíveis (aceitáveis)