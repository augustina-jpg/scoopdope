import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/notifications' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private redisClients: Redis[] = [];

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  afterInit(server: Server) {
    const redisUrl = this.configService.get<string>('redis.url');
    if (!redisUrl) {
      this.logger.warn('No Redis URL configured — using in-memory adapter');
      return;
    }
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    this.redisClients = [pubClient, subClient];
    server.adapter(createAdapter(pubClient, subClient));
    this.logger.log('Redis adapter attached to Socket.IO');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.redisClients.map((client) => client.quit()));
    this.redisClients = [];
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    const cookieHeader = client.handshake.headers?.cookie;
    if (typeof cookieHeader === 'string') {
      for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === 'access_token') {
          return decodeURIComponent(rest.join('='));
        }
      }
    }

    return undefined;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const userId = payload.sub;
      client.data.userId = userId;
      client.join(`user:${userId}`);

      // Send full initial notifications on connect
      const notifications = await this.notificationRepo.find({
        where: { userId },
        order: { isRead: 'ASC', createdAt: 'DESC' },
      });
      client.emit('notifications:init', notifications);

      // Re-deliver unread notifications as individual events so the
      // frontend can trigger sounds / visual feedback for ones the
      // user missed while offline.
      const unreadNotifications = await this.notificationRepo.find({
        where: { userId, isRead: false },
        order: { createdAt: 'ASC' },
      });
      for (const notification of unreadNotifications) {
        client.emit('notification', notification);
      }

      this.logger.debug(`Client connected: ${client.id}, user: ${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('notifications:joinRoom')
  handleJoinRoom(client: Socket, room: string): void {
    const userId = client.data?.userId as string | undefined;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    if (typeof room !== 'string' || !room.startsWith(`user:${userId}`)) {
      this.logger.warn(
        `Client ${client.id} (user ${userId}) attempted to join unauthorized room: ${room}`,
      );
      return;
    }
    client.join(room);
  }

  @SubscribeMessage('notifications:markRead')
  async handleMarkRead(
    client: Socket,
    ids: string[],
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    try {
      // Update notifications in database
      await this.notificationRepo
        .createQueryBuilder()
        .update(Notification)
        .set({ isRead: true })
        .where('id IN (:...ids)', { ids })
        .andWhere('userId = :userId', { userId })
        .execute();
      
      // Confirm back to client
      client.emit('notifications:read', ids);
    } catch (error) {
      this.logger.error('Error marking notifications as read:', error);
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
