import axios from 'axios';

/**
 * Cliente Axios customizado (SRP: Responsável pela comunicação HTTP com o Backend NestJS).
 * 
 * Configurado com withCredentials: true para permitir o recebimento e envio 
 * automático de HTTP-Only Cookies (Elite Security).
 */
const axiosServices = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api/v1',
  withCredentials: true, // Essencial para Cookies HTTP-Only
});

// Interceptor para tratar erros globais
axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aqui podemos capturar erros 401 para redirecionar ao login se necessário
    if (error.response?.status === 401) {
      // Logic para logout caso o cookie expire
    }
    return Promise.reject((error.response && error.response.data) || 'Ocorreu um erro inesperado');
  }
);

export default axiosServices;
