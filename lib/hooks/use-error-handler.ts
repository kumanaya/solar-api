import { useCallback } from 'react';
import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '@/lib/shared/error-codes';

interface ErrorHandlerOptions {
  onRetry?: () => void;
  onLogin?: () => void;
  onDrawManual?: () => void;
  onContactSupport?: () => void;
  onBuyCredits?: () => void;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const handleError = useCallback((error: string, errorCode?: string) => {
    // Se não tem código, detectar baseado na mensagem
    const code = (errorCode as ErrorCode) || ERROR_CODES.UNKNOWN_ERROR;
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
    
    // Executar ação sugerida se handler disponível
    switch (errorInfo.action) {
      case 'retry':
        if (options.onRetry) {
          console.log('Error suggests retry action');
        }
        break;
        
      case 'login':
        if (options.onLogin) {
          console.log('Error suggests login action');
          options.onLogin();
        }
        break;
        
      case 'draw_manual':
        if (options.onDrawManual) {
          console.log('Error suggests manual drawing action');
          options.onDrawManual();
        }
        break;
        
      case 'contact_support':
        if (options.onContactSupport) {
          console.log('Error suggests contact support action');
          options.onContactSupport();
        }
        break;
        
      case 'buy_credits':
        if (options.onBuyCredits) {
          console.log('Error suggests buy credits action');
          options.onBuyCredits();
        }
        break;
    }
    
    return {
      code,
      message: error,
      userMessage: errorInfo.userMessage,
      action: errorInfo.action,
      canRetry: errorInfo.action === 'retry',
      requiresAuth: errorInfo.action === 'login',
      requiresDrawing: errorInfo.action === 'draw_manual',
      requiresSupport: errorInfo.action === 'contact_support',
      requiresCredits: errorInfo.action === 'buy_credits'
    };
  }, [options]);

  const getErrorDetails = useCallback((errorCode: string) => {
    const code = errorCode as ErrorCode;
    return ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
  }, []);

  const isFootprintError = useCallback((errorCode?: string) => {
    return errorCode === ERROR_CODES.FOOTPRINT_NOT_FOUND;
  }, []);

  const isAuthError = useCallback((errorCode?: string) => {
    return errorCode === ERROR_CODES.AUTH_REQUIRED || 
           errorCode === ERROR_CODES.AUTH_EXPIRED || 
           errorCode === ERROR_CODES.AUTH_INVALID;
  }, []);

  const isNetworkError = useCallback((errorCode?: string) => {
    return errorCode === ERROR_CODES.NETWORK_ERROR ||
           errorCode === ERROR_CODES.EDGE_FUNCTION_ERROR ||
           errorCode === ERROR_CODES.FUNCTION_NOT_FOUND;
  }, []);

  const isRetryableError = useCallback((errorCode?: string) => {
    const errorInfo = errorCode ? ERROR_MESSAGES[errorCode as ErrorCode] : null;
    return errorInfo?.action === 'retry';
  }, []);

  return {
    handleError,
    getErrorDetails,
    isFootprintError,
    isAuthError,
    isNetworkError,
    isRetryableError
  };
}