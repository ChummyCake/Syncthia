import {
  CallSession,
  Provider,
  ProviderEndpoint,
  ProviderLaunchTarget,
  ProviderRecommendation,
  SwitchProposal
} from "@syncthia/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export interface SessionResponse {
  session: CallSession;
  providerEndpoints: ProviderEndpoint[];
  proposals: SwitchProposal[];
  recommendations: ProviderRecommendation[];
}

export async function createSession(input: {
  activeProvider: Provider;
  participants: { id: string; displayName: string }[];
  providerEndpoints?: ProviderEndpoint[];
}): Promise<SessionResponse> {
  return apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return apiFetch(`/sessions/${sessionId}`);
}

export async function updateProviderEndpoint(input: {
  sessionId: string;
  endpoint: ProviderEndpoint;
}): Promise<SessionResponse> {
  return apiFetch(
    `/sessions/${input.sessionId}/provider-endpoints/${input.endpoint.provider}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        handle: input.endpoint.handle,
        appUrl: input.endpoint.appUrl,
        webUrl: input.endpoint.webUrl
      })
    }
  );
}

export async function createSwitchProposal(input: {
  sessionId: string;
  requesterId: string;
  recipientId: string;
  toProvider: Provider;
  reason: string;
}): Promise<{ proposal: SwitchProposal; recommendations: ProviderRecommendation[] }> {
  return apiFetch(`/sessions/${input.sessionId}/switch-proposals`, {
    method: "POST",
    body: JSON.stringify({
      requesterId: input.requesterId,
      recipientId: input.recipientId,
      toProvider: input.toProvider,
      reason: input.reason
    })
  });
}

export async function acceptProposal(input: {
  proposalId: string;
  participantId: string;
}): Promise<{ proposal: SwitchProposal; launchTarget?: ProviderLaunchTarget }> {
  return apiFetch(`/switch-proposals/${input.proposalId}/accept`, {
    method: "POST",
    body: JSON.stringify({ participantId: input.participantId })
  });
}

export async function rejectProposal(input: {
  proposalId: string;
  participantId: string;
}): Promise<{ proposal: SwitchProposal }> {
  return apiFetch(`/switch-proposals/${input.proposalId}/reject`, {
    method: "POST",
    body: JSON.stringify({ participantId: input.participantId })
  });
}

export async function confirmJoined(input: {
  proposalId: string;
  participantId: string;
}): Promise<{ session: CallSession; proposal: SwitchProposal }> {
  return apiFetch(`/switch-proposals/${input.proposalId}/confirm-joined`, {
    method: "POST",
    body: JSON.stringify({ participantId: input.participantId })
  });
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
