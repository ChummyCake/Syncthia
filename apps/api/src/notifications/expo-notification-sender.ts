import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PROVIDER_LABELS, isProvider } from "@syncthia/shared";
import type {
  NotificationDelivery,
  NotificationSender
} from "./notification-sender";

const DEFAULT_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: unknown;
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[] | ExpoPushTicket;
}

interface ExpoPushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, unknown>;
}

@Injectable()
export class ExpoNotificationSender implements NotificationSender {
  constructor(private readonly config: ConfigService) {}

  async send(delivery: NotificationDelivery): Promise<void> {
    const messages = this.toMessages(delivery);
    if (messages.length === 0) {
      return;
    }

    const response = await fetch(this.pushUrl(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(messages)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || `Expo push request failed with HTTP ${response.status}.`
      );
    }

    const body = (await response.json()) as ExpoPushResponse;
    const tickets = Array.isArray(body.data)
      ? body.data
      : body.data
        ? [body.data]
        : [];
    const failedTickets = tickets.filter((ticket) => ticket.status === "error");

    if (failedTickets.length > 0) {
      throw new Error(
        failedTickets
          .map(formatTicketError)
          .join("; ")
      );
    }
  }

  private pushUrl(): string {
    return this.config.get<string>("EXPO_PUSH_URL") ?? DEFAULT_EXPO_PUSH_URL;
  }

  private headers() {
    const accessToken = this.config.get<string>("EXPO_ACCESS_TOKEN");
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    };
  }

  private toMessages(delivery: NotificationDelivery): ExpoPushMessage[] {
    const proposal = isJsonObject(delivery.job.payload)
      ? delivery.job.payload
      : {};
    const content = notificationContent(delivery.job.type, proposal);

    return delivery.devices.map((device) => ({
      to: device.pushToken,
      sound: "default",
      title: content.title,
      body: content.body,
      data: {
        type: delivery.job.type,
        proposalId: delivery.job.proposalId,
        sessionId: proposal.sessionId,
        fromProvider: proposal.fromProvider,
        toProvider: proposal.toProvider,
        status: proposal.status
      }
    }));
  }
}

function notificationContent(
  type: NotificationDelivery["job"]["type"],
  proposal: Record<string, unknown>
) {
  const toProvider = providerLabel(proposal.toProvider);

  if (type === "switch.launching") {
    return {
      title: "Switch accepted",
      body: toProvider
        ? `Open ${toProvider} and confirm once you have joined.`
        : "Open the new provider and confirm once you have joined."
    };
  }

  if (type === "switch.expired") {
    return {
      title: "Switch expired",
      body: "The provider switch request expired."
    };
  }

  const reason = typeof proposal.reason === "string" && proposal.reason.trim()
    ? `: ${proposal.reason.trim()}`
    : ".";

  return {
    title: "Switch proposed",
    body: toProvider
      ? `Switch to ${toProvider}${reason}`
      : "A provider switch is waiting for your response."
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerLabel(value: unknown): string | undefined {
  return isProvider(value) ? PROVIDER_LABELS[value] : undefined;
}

function formatTicketError(ticket: ExpoPushTicket): string {
  const detail = ticket.details && isJsonObject(ticket.details)
    ? ticket.details.error
    : undefined;
  const detailMessage = typeof detail === "string" ? ` (${detail})` : "";

  return `${ticket.message ?? "Expo push ticket failed."}${detailMessage}`;
}
