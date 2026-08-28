import { setTimeout as sleep } from 'node:timers/promises';
import type {
  APIBan,
  APIChannel,
  APIEmoji,
  APIEntitlement,
  APIGuild,
  APIGuildMember,
  APIMessage,
  APIRole,
  APISKU,
  APISticker,
  APIUser,
  APIWebhook,
  ApplicationCommandPermissionType,
  RESTPutAPIApplicationCommandPermissionsJSONBody,
  RESTPutAPIApplicationRoleConnectionMetadataJSONBody,
  RESTPutAPIApplicationRoleConnectionMetadataResult,
} from 'discord-api-types/v10';

import { DiscordSentMessage } from '../messages/DiscordSentMessage.js';
import {
  createMessageRequestInit,
  type BaseDiscordMessageOptions,
  type DiscordCreateThreadOptions,
  type DiscordReaction,
  type DiscordSendMessageOptions,
  type DiscordStartThreadOptions,
  type DiscordWebhookSendOptions,
} from '../messages/message-payloads.js';
import { DiscordWebhook } from '../webhooks/DiscordWebhook.js';

import type { DiscordChannelEditOptions } from '../messages/message-payloads.js';

export type DiscordMemberEditOptions = {
	nick?: string | null;
	roles?: string[];
	/** Timeout until this ISO timestamp (max 28 days); null clears it. */
	communicationDisabledUntil?: string | null;
};

export type DiscordRoleOptions = {
	name?: string;
	permissions?: string;
	color?: number;
	hoist?: boolean;
	mentionable?: boolean;
	unicodeEmoji?: string;
};

type FetchLike = typeof fetch;

export type DiscordRestClientOptions = {
  token: string;
  applicationId: string;
  apiBaseUrl?: string;
  maxRetries?: number;
  fetchImplementation?: FetchLike;
};

export class DiscordRestClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  /** Bucket id -> observed remaining/reset state. */
  private readonly buckets = new Map<
    string,
    { remaining: number | null; resetAt: number }
  >();
  /** Normalised route -> bucket id, learned from X-RateLimit headers. */
  private readonly routeBuckets = new Map<string, string>();

  constructor(private readonly options: DiscordRestClientOptions) {
    this.fetchImpl = options.fetchImplementation ?? fetch;
    this.baseUrl = options.apiBaseUrl ?? 'https://discord.com/api/v10';
    this.maxRetries = options.maxRetries ?? 3;
  }

  async request<T>(
    path: string,
    init: RequestInit & { authenticated?: boolean } = {},
  ): Promise<T> {
    let lastError: unknown;
    const { authenticated = true, ...requestInit } = init;
    const routeKey = this.routeKey(path, requestInit);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      // Respect the last observed per-bucket budget before spending a call.
      await this.waitForBucket(routeKey);

      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...requestInit,
          headers: {
            ...(authenticated ? { Authorization: `Bot ${this.options.token}` } : {}),
            ...getDefaultContentTypeHeader(requestInit.body),
            ...(requestInit.headers ?? {}),
          },
        });
      } catch (error) {
        lastError = this.createRequestError(path, requestInit.method, error);
        if (attempt < this.maxRetries) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        break;
      }

      // Learn/refresh the bucket budget from every response.
      this.updateRateLimitState(routeKey, response);

      if (response.status === 429) {
        const retryAfterSeconds = await this.readRetryAfter(response);
        if (attempt < this.maxRetries) {
          await sleep(Math.ceil(retryAfterSeconds * 1000));
          continue;
        }

        lastError = new Error(
          `[DiscordRestClient] ${requestInit.method ?? 'GET'} ${path} failed: 429`,
        );
        break;
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const responseText = await response.text();
        if (!responseText) return undefined as T;
        return JSON.parse(responseText) as T;
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await sleep(150 * (attempt + 1));
        continue;
      }

      const errorBody = await response.text();
      lastError = new Error(
        `[DiscordRestClient] ${requestInit.method ?? 'GET'} ${path} failed: ${response.status}${errorBody ? ` ${errorBody}` : ''}`,
      );
      break;
    }
    throw lastError instanceof Error ? lastError : new Error('[DiscordRestClient] unknown request failure');
  }

  /**
   * Normalises a path into a stable route key: numeric ids become `:id`
   * except for major parameters (channel/guild/webhook roots).
   */
  private routeKey(path: string, init: RequestInit): string {
    const method = (init.method ?? 'GET').toUpperCase();
    const parts = path.split('?')[0].split('/').filter(Boolean);

    const masked = parts.map((part, index) => {
      const previous = parts[index - 1];
      if (previous === 'channels' || previous === 'guilds' || previous === 'webhooks') {
        return part; // major parameter — kept verbatim
      }
      if (part === '@me' || part === '@original') return part;
      return /^\d{15,}$/.test(part) ? ':id' : part;
    });

    return `${method} ${masked.join('/')}`;
  }

  private async waitForBucket(routeKey: string): Promise<void> {
    const bucketId = this.routeBuckets.get(routeKey);
    if (!bucketId) return;

    const bucket = this.buckets.get(bucketId);
    if (!bucket || bucket.remaining === null || bucket.remaining > 0) return;

    const waitMs = bucket.resetAt - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs + 5); // small buffer for clock skew
    } else {
      bucket.remaining = null; // stale entry — let it refresh
    }
  }

  private updateRateLimitState(routeKey: string, response: Response): void {
    const bucketId = response.headers.get('x-ratelimit-bucket');
    if (!bucketId) return;

    this.routeBuckets.set(routeKey, bucketId);

    const bucket = this.buckets.get(bucketId) ?? { remaining: null, resetAt: 0 };
    const remaining = response.headers.get('x-ratelimit-remaining');
    const resetAfter = response.headers.get('x-ratelimit-reset-after');

    if (remaining !== null) bucket.remaining = Number(remaining);
    if (resetAfter !== null) bucket.resetAt = Date.now() + Number(resetAfter) * 1000;

    this.buckets.set(bucketId, bucket);
  }

  /** Reads retry_after from the 429 body first (float seconds), then headers. */
  private async readRetryAfter(response: Response): Promise<number> {
    try {
      const bodyText = await response.clone().text();
      if (bodyText) {
        const parsed = JSON.parse(bodyText) as { retry_after?: number };
        if (typeof parsed.retry_after === 'number') return parsed.retry_after;
      }
    } catch {
      // fall through to header parsing
    }

    const headerValue = response.headers.get('retry-after');
    return headerValue !== null ? Number(headerValue) : 1;
  }

  private createRequestError(path: string, method: string | undefined, error: unknown): Error {
    const message =
      error instanceof Error ? error.message : String(error);

    return new Error(
      `[DiscordRestClient] ${method ?? 'GET'} ${path} failed: ${message}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  createFollowup(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}`, {
      method: 'POST',
      body: JSON.stringify(body),
      authenticated: false,
    });
  }

  editOriginal(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      authenticated: false,
    });
  }

  /** Deletes the original interaction response. */
  async deleteOriginal(interactionToken: string): Promise<void> {
    await this.request(`/webhooks/${this.options.applicationId}/${interactionToken}/messages/@original`, {
      method: 'DELETE',
      authenticated: false,
    });
  }

  /** Deletes a follow-up message previously sent for this interaction. */
  async deleteFollowup(interactionToken: string, messageId: string): Promise<void> {
    await this.request(
      `/webhooks/${this.options.applicationId}/${interactionToken}/messages/${messageId}`,
      { method: 'DELETE', authenticated: false },
    );
  }

  async createFollowupMessage(
    interactionToken: string,
    options: BaseDiscordMessageOptions,
  ): Promise<DiscordSentMessage> {
    const requestInit = createMessageRequestInit(options);
    const message = await this.request<APIMessage>(
      `/webhooks/${this.options.applicationId}/${interactionToken}`,
      {
        method: 'POST',
        ...requestInit,
        authenticated: false,
      },
    );

    return new DiscordSentMessage(this, message);
  }

  async editOriginalMessage(
    interactionToken: string,
    options: BaseDiscordMessageOptions,
  ): Promise<DiscordSentMessage> {
    const requestInit = createMessageRequestInit(options);
    const message = await this.request<APIMessage>(
      `/webhooks/${this.options.applicationId}/${interactionToken}/messages/@original`,
      {
        method: 'PATCH',
        ...requestInit,
        authenticated: false,
      },
    );

    return new DiscordSentMessage(this, message);
  }

  async sendMessage(options: DiscordSendMessageOptions): Promise<DiscordSentMessage> {
    const { channelId, ...messageOptions } = options;
    const requestInit = createMessageRequestInit(messageOptions);
    const message = await this.request<APIMessage>(`/channels/${channelId}/messages`, {
      method: 'POST',
      ...requestInit,
    });

    return new DiscordSentMessage(this, message);
  }

  send(options: DiscordSendMessageOptions): Promise<DiscordSentMessage> {
    return this.sendMessage(options);
  }

  async startThread(options: DiscordStartThreadOptions): Promise<APIChannel> {
    const { channelId, messageId, reason, ...body } = options;

    return this.request<APIChannel>(`/channels/${channelId}/messages/${messageId}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        auto_archive_duration: body.autoArchiveDuration,
        rate_limit_per_user: body.rateLimitPerUser,
        name: body.name,
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  /**
   * Creates a thread directly in a channel (no source message), e.g. for
   * forum channels or standalone public/private threads.
   */
  async createThread(options: DiscordCreateThreadOptions): Promise<APIChannel> {
    const { channelId, reason, autoArchiveDuration, rateLimitPerUser, type, invitable, name } = options;

    return this.request<APIChannel>(`/channels/${channelId}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        ...(autoArchiveDuration !== undefined ? { auto_archive_duration: autoArchiveDuration } : {}),
        ...(rateLimitPerUser !== undefined ? { rate_limit_per_user: rateLimitPerUser } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(invitable !== undefined ? { invitable } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async editMessage(
    channelId: string,
    messageId: string,
    options: BaseDiscordMessageOptions,
  ): Promise<DiscordSentMessage> {
    const requestInit = createMessageRequestInit(options);
    const message = await this.request<APIMessage>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      ...requestInit,
    });

    return new DiscordSentMessage(this, message);
  }

  async deleteMessage(channelId: string, messageId: string, reason?: string): Promise<void> {
    await this.request(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async pinMessage(channelId: string, messageId: string, reason?: string): Promise<void> {
    await this.request(`/channels/${channelId}/pins/${messageId}`, {
      method: 'PUT',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async unpinMessage(channelId: string, messageId: string, reason?: string): Promise<void> {
    await this.request(`/channels/${channelId}/pins/${messageId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async crosspostMessage(channelId: string, messageId: string): Promise<APIMessage> {
    return this.request<APIMessage>(`/channels/${channelId}/messages/${messageId}/crosspost`, {
      method: 'POST',
    });
  }

  /** Sends a message through an existing webhook without instantiating {@link DiscordWebhook}. */
  async sendWebhookMessage(
    webhookId: string,
    webhookToken: string,
    options: DiscordWebhookSendOptions,
  ): Promise<DiscordSentMessage> {
    return this.webhook(webhookId, webhookToken).send(options);
  }

  // ---- Message reads & bulk operations (v0.7) ----

  async fetchMessage(channelId: string, messageId: string): Promise<DiscordSentMessage> {
    const message = await this.request<APIMessage>(`/channels/${channelId}/messages/${messageId}`);
    return new DiscordSentMessage(this, message);
  }

  /** Lists channel messages; at most one of before/after/around per call. */
  async fetchMessages(
    channelId: string,
    options: { limit?: number; before?: string; after?: string; around?: string } = {},
  ): Promise<APIMessage[]> {
    const { limit, before, after, around } = options;
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (before) params.set('before', before);
    if (after) params.set('after', after);
    if (around) params.set('around', around);

    const query = params.size > 0 ? `?${params.toString()}` : '';
    return this.request<APIMessage[]>(`/channels/${channelId}/messages${query}`);
  }

  /** Bulk-deletes 2–100 messages (all must be younger than 14 days). */
  async bulkDeleteMessages(channelId: string, messageIds: readonly string[], reason?: string): Promise<void> {
    if (messageIds.length < 2 || messageIds.length > 100) {
      throw new Error('[DiscordRestClient] bulk delete accepts between 2 and 100 messages');
    }

    await this.request(`/channels/${channelId}/messages/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ messages: [...messageIds] }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Typing & reactions (v0.7) ----

  async triggerTyping(channelId: string): Promise<void> {
    await this.request(`/channels/${channelId}/typing`, { method: 'POST' });
  }

  /** Lists the users who reacted with the given emoji (paginated). */
  async fetchReactors(
    channelId: string,
    messageId: string,
    reaction: DiscordReaction,
    options: { limit?: number; after?: string; type?: number } = {},
  ): Promise<APIUser[]> {
    const { limit, after, type } = options;
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (after) params.set('after', after);
    if (type !== undefined) params.set('type', String(type));

    const query = params.size > 0 ? `?${params.toString()}` : '';
    return this.request<APIUser>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeDiscordReaction(reaction)}${query}`,
    ).then((result) => result as unknown as APIUser[]);
  }

  async removeOwnReaction(channelId: string, messageId: string, reaction: DiscordReaction): Promise<void> {
    await this.request(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeDiscordReaction(reaction)}/@me`,
      { method: 'DELETE' },
    );
  }

  async removeUserReaction(
    channelId: string,
    messageId: string,
    userId: string,
    reaction: DiscordReaction,
    reason?: string,
  ): Promise<void> {
    await this.request(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeDiscordReaction(reaction)}/${userId}`,
      { method: 'DELETE', headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined },
    );
  }

  async removeAllReactions(channelId: string, messageId: string, reason?: string): Promise<void> {
    await this.request(`/channels/${channelId}/messages/${messageId}/reactions`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async removeAllReactionsForEmoji(
    channelId: string,
    messageId: string,
    reaction: DiscordReaction,
    reason?: string,
  ): Promise<void> {
    await this.request(`/channels/${channelId}/messages/${messageId}/reactions/${encodeDiscordReaction(reaction)}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Channels (v0.7) ----

  async fetchChannel(channelId: string): Promise<APIChannel> {
    return this.request<APIChannel>(`/channels/${channelId}`);
  }

  /** Edits channel fields; thread-only options are sent only when provided. */
  async editChannel(
    channelId: string,
    options: DiscordChannelEditOptions,
    reason?: string,
  ): Promise<APIChannel> {
    return this.request<APIChannel>(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.topic !== undefined ? { topic: options.topic } : {}),
        ...(options.nsfw !== undefined ? { nsfw: options.nsfw } : {}),
        ...(options.rateLimitPerUser !== undefined
          ? { rate_limit_per_user: options.rateLimitPerUser }
          : {}),
        ...(options.archived !== undefined ? { archived: options.archived } : {}),
        ...(options.locked !== undefined ? { locked: options.locked } : {}),
        ...(options.autoArchiveDuration !== undefined
          ? { auto_archive_duration: options.autoArchiveDuration }
          : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async deleteChannel(channelId: string, reason?: string): Promise<void> {
    await this.request(`/channels/${channelId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  /** Follows an announcement channel into the target channel. */
  async followAnnouncementChannel(
    sourceChannelId: string,
    targetChannelId: string,
    reason?: string,
  ): Promise<void> {
    await this.request(`/channels/${sourceChannelId}/followers`, {
      method: 'POST',
      body: JSON.stringify({ webhook_channel_id: targetChannelId }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Polls (v0.7) ----

  /** Immediately ends a poll the app authored. */
  async endPoll(channelId: string, messageId: string): Promise<APIMessage> {
    return this.request<APIMessage>(`/channels/${channelId}/polls/${messageId}/expire`, {
      method: 'POST',
    });
  }

  /** Lists users who voted for a poll answer (up to 100 per call). */
  async fetchPollAnswerVoters(
    channelId: string,
    messageId: string,
    answerId: number,
  ): Promise<APIUser[]> {
    return this.request<APIUser[]>(
      `/channels/${channelId}/polls/${messageId}/answers/${answerId}/voters`,
    );
  }

  // ---- Guild basics (v0.8) ----

  async fetchGuild(guildId: string, withCounts = false): Promise<APIGuild> {
    return this.request<APIGuild>(
      `/guilds/${guildId}${withCounts ? '?with_counts=true' : ''}`,
    );
  }

  async listGuildChannels(guildId: string): Promise<APIChannel[]> {
    return this.request<APIChannel[]>(`/guilds/${guildId}/channels`);
  }

  // ---- Members & moderation (v0.8) ----

  async fetchMember(guildId: string, userId: string): Promise<APIGuildMember> {
    return this.request<APIGuildMember>(`/guilds/${guildId}/members/${userId}`);
  }

  async listMembers(
    guildId: string,
    options: { limit?: number; after?: string } = {},
  ): Promise<APIGuildMember[]> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.after) params.set('after', options.after);
    const query = params.size > 0 ? `?${params.toString()}` : '';

    return this.request<APIGuildMember[]>(`/guilds/${guildId}/members${query}`);
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await this.request(`/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  /** Bans a member; `deleteMessageSeconds` removes up to 7 days of messages. */
  async banMember(
    guildId: string,
    userId: string,
    options: { deleteMessageSeconds?: number; reason?: string } = {},
  ): Promise<void> {
    const { deleteMessageSeconds, reason } = options;
    await this.request(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...(deleteMessageSeconds !== undefined
          ? { delete_message_seconds: deleteMessageSeconds }
          : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async unbanMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await this.request(`/guilds/${guildId}/bans/${userId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async listBans(guildId: string): Promise<APIBan[]> {
    return this.request<APIBan[]>(`/guilds/${guildId}/bans`);
  }

  async editMember(
    guildId: string,
    userId: string,
    options: DiscordMemberEditOptions,
    reason?: string,
  ): Promise<APIGuildMember> {
    return this.request<APIGuildMember>(`/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(options.nick !== undefined ? { nick: options.nick } : {}),
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.communicationDisabledUntil !== undefined
          ? { communication_disabled_until: options.communicationDisabledUntil }
          : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  /** Times out a member for the given duration (ms); null clears the timeout. */
  timeoutMember(
    guildId: string,
    userId: string,
    durationMs: number | null,
    reason?: string,
  ): Promise<APIGuildMember> {
    const communicationDisabledUntil =
      durationMs === null ? null : new Date(Date.now() + durationMs).toISOString();

    return this.editMember(
      guildId,
      userId,
      { communicationDisabledUntil },
      reason,
    );
  }

  // ---- Roles (v0.8) ----

  async listRoles(guildId: string): Promise<APIRole[]> {
    return this.request<APIRole[]>(`/guilds/${guildId}/roles`);
  }

  async createRole(
    guildId: string,
    options: DiscordRoleOptions,
    reason?: string,
  ): Promise<APIRole> {
    return this.request<APIRole>(`/guilds/${guildId}/roles`, {
      method: 'POST',
      body: JSON.stringify({
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.permissions !== undefined ? { permissions: options.permissions } : {}),
        ...(options.color !== undefined ? { color: options.color } : {}),
        ...(options.hoist !== undefined ? { hoist: options.hoist } : {}),
        ...(options.mentionable !== undefined ? { mentionable: options.mentionable } : {}),
        ...(options.unicodeEmoji !== undefined ? { unicode_emoji: options.unicodeEmoji } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async editRole(
    guildId: string,
    roleId: string,
    options: DiscordRoleOptions,
    reason?: string,
  ): Promise<APIRole> {
    return this.request<APIRole>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.permissions !== undefined ? { permissions: options.permissions } : {}),
        ...(options.color !== undefined ? { color: options.color } : {}),
        ...(options.hoist !== undefined ? { hoist: options.hoist } : {}),
        ...(options.mentionable !== undefined ? { mentionable: options.mentionable } : {}),
        ...(options.unicodeEmoji !== undefined ? { unicode_emoji: options.unicodeEmoji } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async deleteRole(guildId: string, roleId: string, reason?: string): Promise<void> {
    await this.request(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  /** Reorders roles; entries are `{ id, position }` pairs. */
  async reorderRoles(
    guildId: string,
    positions: ReadonlyArray<{ id: string; position: number }>,
    reason?: string,
  ): Promise<APIRole[]> {
    return this.request<APIRole[]>(`/guilds/${guildId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify(positions),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async addRoleToMember(
    guildId: string,
    userId: string,
    roleId: string,
    reason?: string,
  ): Promise<void> {
    await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async removeRoleFromMember(
    guildId: string,
    userId: string,
    roleId: string,
    reason?: string,
  ): Promise<void> {
    await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Emoji & stickers (v0.8) ----

  async listGuildEmojis(guildId: string): Promise<APIEmoji[]> {
    return this.request<APIEmoji[]>(`/guilds/${guildId}/emojis`);
  }

  async fetchGuildEmoji(guildId: string, emojiId: string): Promise<APIEmoji> {
    return this.request<APIEmoji>(`/guilds/${guildId}/emojis/${emojiId}`);
  }

  /** Creates an emoji; `imageData` must be a data URI (base64). */
  async createGuildEmoji(
    guildId: string,
    options: { name: string; imageData: string; roles?: string[] },
    reason?: string,
  ): Promise<APIEmoji> {
    return this.request<APIEmoji>(`/guilds/${guildId}/emojis`, {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        image: options.imageData,
        ...(options.roles ? { roles: options.roles } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async editGuildEmoji(
    guildId: string,
    emojiId: string,
    options: { name?: string; roles?: string[] },
    reason?: string,
  ): Promise<APIEmoji> {
    return this.request<APIEmoji>(`/guilds/${guildId}/emojis/${emojiId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async deleteGuildEmoji(guildId: string, emojiId: string, reason?: string): Promise<void> {
    await this.request(`/guilds/${guildId}/emojis/${emojiId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async listGuildStickers(guildId: string): Promise<APISticker[]> {
    return this.request<APISticker[]>(`/guilds/${guildId}/stickers`);
  }

  async fetchSticker(stickerId: string): Promise<APISticker> {
    return this.request<APISticker>(`/stickers/${stickerId}`);
  }

  async deleteGuildSticker(guildId: string, stickerId: string, reason?: string): Promise<void> {
    await this.request(`/guilds/${guildId}/stickers/${stickerId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Webhooks (v0.8) ----

  async listChannelWebhooks(channelId: string): Promise<APIWebhook[]> {
    return this.request<APIWebhook[]>(`/channels/${channelId}/webhooks`);
  }

  async listGuildWebhooks(guildId: string): Promise<APIWebhook[]> {
    return this.request<APIWebhook[]>(`/guilds/${guildId}/webhooks`);
  }

  async createWebhook(
    channelId: string,
    options: { name: string; avatar?: string },
    reason?: string,
  ): Promise<APIWebhook> {
    return this.request<APIWebhook>(`/channels/${channelId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        ...(options.avatar ? { avatar: options.avatar } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async fetchWebhook(webhookId: string): Promise<APIWebhook> {
    return this.request<APIWebhook>(`/webhooks/${webhookId}`);
  }

  /** Fetches a webhook using only its token — no bot auth required. */
  async fetchWebhookWithToken(webhookId: string, webhookToken: string): Promise<APIWebhook> {
    return this.request<APIWebhook>(`/webhooks/${webhookId}/${webhookToken}`, {
      authenticated: false,
    });
  }

  async editWebhook(
    webhookId: string,
    options: { name?: string; avatar?: string | null; channelId?: string },
    reason?: string,
  ): Promise<APIWebhook> {
    return this.request<APIWebhook>(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.avatar !== undefined ? { avatar: options.avatar } : {}),
        ...(options.channelId !== undefined ? { channel_id: options.channelId } : {}),
      }),
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  async deleteWebhook(webhookId: string, reason?: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
    });
  }

  // ---- Entitlements & SKUs (v0.8) ----

  async listSKUs(): Promise<APISKU[]> {
    return this.request<APISKU[]>(`/applications/${this.options.applicationId}/skus`);
  }

  async listEntitlements(
    options: {
      userId?: string;
      skuIds?: readonly string[];
      guildId?: string;
      before?: string;
      after?: string;
      limit?: number;
      excludeEnded?: boolean;
    } = {},
  ): Promise<APIEntitlement[]> {
    const params = new URLSearchParams();
    if (options.userId) params.set('user_id', options.userId);
    if (options.skuIds?.length) params.set('sku_ids', options.skuIds.join(','));
    if (options.guildId) params.set('guild_id', options.guildId);
    if (options.before) params.set('before', options.before);
    if (options.after) params.set('after', options.after);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.excludeEnded !== undefined)
      params.set('exclude_ended', String(options.excludeEnded));

    const query = params.size > 0 ? `?${params.toString()}` : '';
    return this.request<APIEntitlement[]>(
      `/applications/${this.options.applicationId}/entitlements${query}`,
    );
  }

  /** Consumes a one-time-purchase entitlement. */
  async consumeEntitlement(entitlementId: string): Promise<void> {
    await this.request(`/applications/${this.options.applicationId}/entitlements/${entitlementId}/consume`, {
      method: 'POST',
    });
  }

  // ---- Application command permissions (v0.8) ----

  async getCommandPermissions(
    guildId: string,
    commandId: string,
  ): Promise<RESTPutAPIApplicationCommandPermissionsJSONBody> {
    return this.request(
      `/applications/${this.options.applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
    );
  }

  /** Fully replaces a command's permission overrides for a guild. */
  async setCommandPermissions(
    guildId: string,
    commandId: string,
    permissions: ReadonlyArray<{
      id: string;
      type: ApplicationCommandPermissionType;
      permission: boolean;
    }>,
    reason?: string,
  ): Promise<void> {
    await this.request(
      `/applications/${this.options.applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
        headers: reason ? { 'X-Audit-Log-Reason': reason } : undefined,
      },
    );
  }

  addReaction(
    channelId: string,
    messageId: string,
    reaction: DiscordReaction,
  ): Promise<void> {
    return this.request<void>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeDiscordReaction(reaction)}/@me`,
      {
        method: 'PUT',
      },
    );
  }

  webhook(id: string, token: string): DiscordWebhook {
    return new DiscordWebhook(this, id, token);
  }

  putApplicationRoleConnectionMetadata(
    body: RESTPutAPIApplicationRoleConnectionMetadataJSONBody,
  ): Promise<RESTPutAPIApplicationRoleConnectionMetadataResult> {
    return this.request(`/applications/${this.options.applicationId}/role-connections/metadata`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
}

function getDefaultContentTypeHeader(body: RequestInit['body']): HeadersInit {
  return body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
}

function encodeDiscordReaction(reaction: DiscordReaction): string {
  if (typeof reaction !== 'string') {
    return encodeURIComponent(reaction.id ? `${reaction.name}:${reaction.id}` : reaction.name);
  }

  const trimmed = reaction.trim();

  const customEmojiMatch = trimmed.match(/^<a?:([^:>]+):(\d+)>$/);
  if (customEmojiMatch) {
    const [, name, id] = customEmojiMatch;
    return encodeURIComponent(`${name}:${id}`);
  }

  if (/^[^:\s]+:\d+$/.test(trimmed)) {
    return encodeURIComponent(trimmed);
  }

  return encodeURIComponent(trimmed);
}
