// Códigos de erro padronizados para toda a aplicação
// Permite frontend tratar erros específicos de forma consistente

export const ERROR_CODES = {
  // Erros de comunicação
  EDGE_FUNCTION_ERROR: 'EDGE_FUNCTION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  FUNCTION_NOT_FOUND: 'FUNCTION_NOT_FOUND',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  
  // Erros de análise
  GEOCODING_FAILED: 'GEOCODING_FAILED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  
  // Erros de footprint
  FOOTPRINT_NOT_FOUND: 'FOOTPRINT_NOT_FOUND',
  FOOTPRINT_TIMEOUT: 'FOOTPRINT_TIMEOUT',
  FOOTPRINT_INVALID: 'FOOTPRINT_INVALID',
  
  // Erros de autenticação
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  
  // Erros de créditos
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  
  // Erro genérico
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface ApiError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  action?: 'retry' | 'login' | 'draw_manual' | 'contact_support' | 'buy_credits';
}

export const ERROR_MESSAGES: Record<ErrorCode, ApiError> = {
  // Erros de comunicação
  [ERROR_CODES.EDGE_FUNCTION_ERROR]: {
    code: ERROR_CODES.EDGE_FUNCTION_ERROR,
    message: 'Edge Function returned a non-2xx status code',
    userMessage: 'Erro de comunicação com o servidor. Tente novamente.',
    action: 'retry'
  },
  
  [ERROR_CODES.NETWORK_ERROR]: {
    code: ERROR_CODES.NETWORK_ERROR,
    message: 'Network connection failed',
    userMessage: 'Erro de conexão. Verifique sua internet e tente novamente.',
    action: 'retry'
  },
  
  [ERROR_CODES.FUNCTION_NOT_FOUND]: {
    code: ERROR_CODES.FUNCTION_NOT_FOUND,
    message: 'Edge function not found',
    userMessage: 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
    action: 'contact_support'
  },
  
  [ERROR_CODES.EMPTY_RESPONSE]: {
    code: ERROR_CODES.EMPTY_RESPONSE,
    message: 'Empty response from server',
    userMessage: 'Resposta vazia do servidor. Tente novamente.',
    action: 'retry'
  },
  
  [ERROR_CODES.MALFORMED_RESPONSE]: {
    code: ERROR_CODES.MALFORMED_RESPONSE,
    message: 'Malformed response from server',
    userMessage: 'Erro ao processar resposta do servidor. Tente novamente.',
    action: 'retry'
  },
  
  // Erros de análise
  [ERROR_CODES.GEOCODING_FAILED]: {
    code: ERROR_CODES.GEOCODING_FAILED,
    message: 'Could not geocode address',
    userMessage: 'Endereço não encontrado. Verifique se está correto.',
    action: 'retry'
  },
  
  [ERROR_CODES.ANALYSIS_FAILED]: {
    code: ERROR_CODES.ANALYSIS_FAILED,
    message: 'Analysis process failed',
    userMessage: 'Falha na análise. Tente novamente.',
    action: 'retry'
  },
  
  [ERROR_CODES.INVALID_ADDRESS]: {
    code: ERROR_CODES.INVALID_ADDRESS,
    message: 'Invalid address format',
    userMessage: 'Formato de endereço inválido. Digite um endereço válido.',
    action: 'retry'
  },
  
  // Erros de footprint
  [ERROR_CODES.FOOTPRINT_NOT_FOUND]: {
    code: ERROR_CODES.FOOTPRINT_NOT_FOUND,
    message: 'No footprint found for this location',
    userMessage: 'Footprint não disponível nesta região. Desenhe o telhado manualmente.',
    action: 'draw_manual'
  },
  
  [ERROR_CODES.FOOTPRINT_TIMEOUT]: {
    code: ERROR_CODES.FOOTPRINT_TIMEOUT,
    message: 'Footprint search timeout',
    userMessage: 'Busca por footprint demorou muito. Tente novamente ou desenhe manualmente.',
    action: 'retry'
  },
  
  [ERROR_CODES.FOOTPRINT_INVALID]: {
    code: ERROR_CODES.FOOTPRINT_INVALID,
    message: 'Invalid footprint data',
    userMessage: 'Dados de footprint inválidos. Desenhe o telhado manualmente.',
    action: 'draw_manual'
  },
  
  // Erros de autenticação
  [ERROR_CODES.AUTH_REQUIRED]: {
    code: ERROR_CODES.AUTH_REQUIRED,
    message: 'Authentication required',
    userMessage: 'Você precisa estar logado para usar este recurso.',
    action: 'login'
  },
  
  [ERROR_CODES.AUTH_EXPIRED]: {
    code: ERROR_CODES.AUTH_EXPIRED,
    message: 'Authentication token expired',
    userMessage: 'Sua sessão expirou. Faça login novamente.',
    action: 'login'
  },
  
  [ERROR_CODES.AUTH_INVALID]: {
    code: ERROR_CODES.AUTH_INVALID,
    message: 'Invalid authentication token',
    userMessage: 'Sessão inválida. Faça login novamente.',
    action: 'login'
  },
  
  // Erros de créditos
  [ERROR_CODES.INSUFFICIENT_CREDITS]: {
    code: ERROR_CODES.INSUFFICIENT_CREDITS,
    message: 'Insufficient credits',
    userMessage: 'Créditos insuficientes para realizar esta operação.',
    action: 'buy_credits'
  },
  
  // Erro genérico
  [ERROR_CODES.UNKNOWN_ERROR]: {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: 'Unknown error occurred',
    userMessage: 'Erro inesperado. Tente novamente ou entre em contato com o suporte.',
    action: 'contact_support'
  }
};

// Helper para criar erros padronizados
export function createApiError(code: ErrorCode, customMessage?: string): ApiError {
  const errorInfo = ERROR_MESSAGES[code];
  return {
    ...errorInfo,
    userMessage: customMessage || errorInfo.userMessage
  };
}

// Helper para detectar tipo de erro a partir da mensagem
export function detectErrorCode(errorMessage: string): ErrorCode {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('footprint não encontrado') || message.includes('nenhum footprint encontrado')) {
    return ERROR_CODES.FOOTPRINT_NOT_FOUND;
  }
  
  if (message.includes('timeout') || message.includes('statement timeout')) {
    return ERROR_CODES.FOOTPRINT_TIMEOUT;
  }
  
  if (message.includes('autenticado') || message.includes('login') || message.includes('auth')) {
    return ERROR_CODES.AUTH_REQUIRED;
  }
  
  if (message.includes('expired') || message.includes('expirou')) {
    return ERROR_CODES.AUTH_EXPIRED;
  }
  
  if (message.includes('créditos') || message.includes('credits')) {
    return ERROR_CODES.INSUFFICIENT_CREDITS;
  }
  
  if (message.includes('geocode') || message.includes('endereço não encontrado')) {
    return ERROR_CODES.GEOCODING_FAILED;
  }
  
  if (message.includes('function not found') || message.includes('404')) {
    return ERROR_CODES.FUNCTION_NOT_FOUND;
  }
  
  if (message.includes('network') || message.includes('conexão')) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  
  if (message.includes('resposta vazia') || message.includes('empty response')) {
    return ERROR_CODES.EMPTY_RESPONSE;
  }
  
  if (message.includes('malformed') || message.includes('malformada')) {
    return ERROR_CODES.MALFORMED_RESPONSE;
  }
  
  if (message.includes('edge function') && message.includes('non-2xx')) {
    return ERROR_CODES.EDGE_FUNCTION_ERROR;
  }
  
  return ERROR_CODES.UNKNOWN_ERROR;
}