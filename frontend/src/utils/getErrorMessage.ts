/**
 * Extract a user-friendly error message from an unknown caught error.
 * Handles Axios-style errors (e.response.data.message), standard Error objects,
 * and arbitrary values.
 */
export function getErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
  if (error && typeof error === 'object') {
    const axiosMsg = (error as any)?.response?.data?.message;
    if (typeof axiosMsg === 'string') return axiosMsg;
    if (error instanceof Error) return error.message;
  }
  if (typeof error === 'string') return error;
  return fallback;
}
