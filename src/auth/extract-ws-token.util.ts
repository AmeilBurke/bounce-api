import { Socket } from 'socket.io';

export function extractWsToken(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token;
  if (authToken) return authToken;

  const [type, bearerToken] = client.handshake.headers.authorization?.split(' ') ?? [];
  if (type === 'Bearer') return bearerToken;

  // fallback for clients (like Postman) that can't send socket.io's `auth` object
  const headerToken = client.handshake.headers.token;
  return typeof headerToken === 'string' ? headerToken : undefined;
}