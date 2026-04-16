import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (companyId: number): Socket => {
  if (!socket) {
    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socket = io(`${baseUrl}/operations`, {
      query: { companyId: companyId.toString() },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to socket.io server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket.io server');
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
