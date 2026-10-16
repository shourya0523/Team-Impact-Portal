import {
  MarkNotificationsReadRequest,
  Me,
  NotificationList,
  NotificationPrefs,
  RegisterDeviceRequest,
  UnregisterDeviceRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { prefsOf } from '../activity';
import { summaryOf } from '../fixtures';
import type { MockUser } from '../fixtures';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** The notification list, marking read, and the switches that govern what gets generated. */
export const registerNotificationRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  /** Newest first; anything about a community the reader can no longer see is left out. */
  const listFor = (u: MockUser): NotificationList => {
    const mine = world.notifications.filter((n) => {
      if (n.userId !== u.id) return false;
      const c = world.communities.find((x) => x.id === n.communityId);
      return !!c && world.canSeeCommunity(c, u);
    });
    return {
      items: [...mine]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => ({
          id: n.id,
          kind: n.kind,
          actor: n.actorId ? summaryOf(world.user(n.actorId)!) : null,
          text: n.text,
          target: n.target,
          read: n.read,
          createdAt: n.createdAt,
        })),
      unreadCount: mine.filter((n) => !n.read).length,
    };
  };

  app.get('/notifications', { schema: { response: { 200: NotificationList } } }, async (request) =>
    listFor(viewer(request)),
  );

  app.post(
    '/notifications/read',
    { schema: { body: MarkNotificationsReadRequest, response: { 200: NotificationList } } },
    async (request) => {
      const u = viewer(request);
      const ids = request.body.ids;
      for (const n of world.notifications) {
        if (n.userId === u.id && (!ids || ids.includes(n.id))) n.read = true;
      }
      return listFor(u);
    },
  );

  app.put(
    '/me/notification-prefs',
    { schema: { body: NotificationPrefs.partial(), response: { 200: Me } } },
    async (request) => {
      const u = viewer(request);
      world.notificationPrefs.set(u.id, { ...prefsOf(world, u.id), ...request.body });
      return world.me(u);
    },
  );

  /**
   * Register this phone for push. A phone belongs to whoever signed in on it last, so a token
   * already held by anyone (including the same user) is replaced rather than duplicated.
   */
  app.post('/me/devices', { schema: { body: RegisterDeviceRequest } }, async (request, reply) => {
    const u = viewer(request);
    const { token, platform } = request.body;
    const i = world.devices.findIndex((d) => d.token === token);
    if (i !== -1) world.devices.splice(i, 1);
    world.devices.push({ userId: u.id, token, platform, createdAt: new Date().toISOString() });
    return reply.status(204).send();
  });

  /** Stop pushing to one of your own phones. */
  app.delete(
    '/me/devices',
    { schema: { body: UnregisterDeviceRequest } },
    async (request, reply) => {
      const u = viewer(request);
      const i = world.devices.findIndex((d) => d.userId === u.id && d.token === request.body.token);
      if (i === -1) throw httpError(404, 'This phone isn’t registered to you');
      world.devices.splice(i, 1);
      return reply.status(204).send();
    },
  );
};
