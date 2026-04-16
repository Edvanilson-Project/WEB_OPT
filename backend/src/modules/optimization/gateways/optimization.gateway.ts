import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import * as cookie from 'cookie';

/**
 * Gateway de Otimização (WebSockets).
 * 
 * Responsável pelo feedback em tempo real do processamento do Solver Python.
 * Utiliza 'Rooms' do Socket.io para garantir que eventos de uma empresa
 * nunca vazem para outra.
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Em produção, restringir para os domínios permitidos
    credentials: true,
  },
  namespace: 'optimization',
})
export class OptimizationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OptimizationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Gerencia a conexão inicial.
   * Valida o JWT do cookie 'otimiz_auth' e agrupa o socket em uma sala por Empresa.
   */
  async handleConnection(client: Socket) {
    try {
      const bCookie = client.handshake.headers.cookie;
      if (!bCookie) throw new Error('No cookie provided');

      const cookies = cookie.parse(bCookie);
      const token = cookies['otimiz_auth'];

      if (!token) throw new Error('Auth token not found');

      // Validação do Token (Extraído do JwtModule exportado no AuthModule)
      const payload = this.jwtService.verify(token);
      const companyId = payload.companyId;

      if (!companyId) throw new Error('Invalid token payload: missing companyId');

      // Juntar à sala da empresa: 'company_ROOM_ID'
      const roomName = `company_${companyId}`;
      await client.join(roomName);

      this.logger.log(`Client ${client.id} conectado e associado à sala ${roomName}`);
    } catch (err) {
      this.logger.warn(`Falha na conexão WS: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} desconectado.`);
  }

  /**
   * Envia atualização de status para todos os usuários de uma empresa específica.
   * 
   * @param companyId ID da empresa
   * @param data Payload de status (processing, completed, etc)
   */
  emitStatusUpdate(companyId: number, data: any) {
    const roomName = `company_${companyId}`;
    this.server.to(roomName).emit('optimization_status_changed', data);
    this.logger.debug(`Status emitido para sala ${roomName}: ${data.status}`);
  }

  /**
   * Evento de teste/debug para validar a conexão.
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: 'WS Connection Active' };
  }
}
