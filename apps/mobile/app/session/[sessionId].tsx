import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  Provider,
  PROVIDER_LABELS,
  buildProviderLaunchTarget,
  otherProviders,
  recommendProviders
} from "@syncthia/shared";
import {
  acceptProposal,
  confirmJoined,
  createSwitchProposal,
  getSession,
  rejectProposal
} from "../../src/lib/api";
import { ActionButton } from "../../src/components/ActionButton";
import { ProviderPicker } from "../../src/components/ProviderPicker";
import { RecommendationList } from "../../src/components/RecommendationList";
import { useSessionSocket } from "../../src/hooks/use-session-socket";
import { launchProvider } from "../../src/providers/provider-launch";
import { useSessionStore } from "../../src/store/session-store";
import { colors, spacing } from "../../src/theme";

const reasonPresets = [
  "long call",
  "streaming",
  "gaming",
  "Zalo-first contact"
];

export default function SessionScreen() {
  const params = useLocalSearchParams<{ sessionId: string; participantId?: string }>();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;
  useSessionSocket(sessionId);

  const session = useSessionStore((state) => state.session);
  const proposals = useSessionStore((state) => state.proposals);
  const providerEndpoints = useSessionStore((state) => state.providerEndpoints);
  const currentParticipantId = useSessionStore((state) => state.currentParticipantId);
  const setCurrentParticipantId = useSessionStore((state) => state.setCurrentParticipantId);
  const setSessionResponse = useSessionStore((state) => state.setSessionResponse);
  const upsertProposal = useSessionStore((state) => state.upsertProposal);
  const [toProvider, setToProvider] = useState<Provider>("discord");
  const [reason, setReason] = useState("streaming");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (params.participantId) {
      setCurrentParticipantId(params.participantId);
    }
  }, [params.participantId, setCurrentParticipantId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void getSession(sessionId)
      .then((response) => {
        setSessionResponse(response);
        if (!currentParticipantId && response.session.participants[0]) {
          setCurrentParticipantId(response.session.participants[0].id);
        }
      })
      .catch((error) => {
        Alert.alert("Session unavailable", error instanceof Error ? error.message : "Unknown error");
      });
  }, [currentParticipantId, sessionId, setCurrentParticipantId, setSessionResponse]);

  useEffect(() => {
    if (session?.activeProvider && toProvider === session.activeProvider) {
      setToProvider(otherProviders(session.activeProvider)[0]);
    }
  }, [session?.activeProvider, toProvider]);

  const currentParticipant = session?.participants.find(
    (participant) => participant.id === currentParticipantId
  );
  const otherParticipant = session?.participants.find(
    (participant) => participant.id !== currentParticipantId
  );
  const activeProposal = proposals.find((proposal) =>
    ["proposed", "accepted", "launching"].includes(proposal.status)
  );
  const recommendations = useMemo(
    () =>
      recommendProviders({
        signals: reasonToSignals(reason),
        activeProvider: session?.activeProvider
      }),
    [reason, session?.activeProvider]
  );

  async function handleCopyInvite(participantId: string) {
    const url = `syncthia://session/${sessionId}?participantId=${participantId}`;
    await Clipboard.setStringAsync(url);
    Alert.alert("Invite copied", url);
  }

  async function handleCreateProposal() {
    if (!session || !currentParticipant || !otherParticipant) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await createSwitchProposal({
        sessionId: session.id,
        requesterId: currentParticipant.id,
        recipientId: otherParticipant.id,
        toProvider,
        reason
      });
      upsertProposal(response.proposal);
    } catch (error) {
      Alert.alert("Switch not proposed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAccept() {
    if (!activeProposal || !currentParticipant) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await acceptProposal({
        proposalId: activeProposal.id,
        participantId: currentParticipant.id
      });
      upsertProposal(response.proposal);
      if (response.launchTarget) {
        await launchProvider(response.launchTarget);
      }
    } catch (error) {
      Alert.alert("Switch not accepted", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReject() {
    if (!activeProposal || !currentParticipant) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await rejectProposal({
        proposalId: activeProposal.id,
        participantId: currentParticipant.id
      });
      upsertProposal(response.proposal);
    } catch (error) {
      Alert.alert("Switch not rejected", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLaunch() {
    if (!activeProposal) {
      return;
    }

    const endpoint = providerEndpoints.find(
      (candidate) => candidate.provider === activeProposal.toProvider
    );
    await launchProvider(buildProviderLaunchTarget(activeProposal.toProvider, endpoint));
  }

  async function handleConfirmJoined() {
    if (!activeProposal || !currentParticipant) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await confirmJoined({
        proposalId: activeProposal.id,
        participantId: currentParticipant.id
      });
      setSessionResponse({
        session: response.session,
        proposals: proposals.map((proposal) =>
          proposal.id === response.proposal.id ? response.proposal : proposal
        )
      });
    } catch (error) {
      Alert.alert("Join not confirmed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsBusy(false);
    }
  }

  if (!session || !currentParticipant) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.messenger} size="large" />
      </View>
    );
  }

  const isRecipient = activeProposal?.recipientId === currentParticipant.id;
  const canLaunch = activeProposal?.status === "launching";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBand}>
        <Text style={styles.kicker}>Active provider</Text>
        <Text style={[styles.activeProvider, { color: colors[session.activeProvider] }]}>
          {PROVIDER_LABELS[session.activeProvider]}
        </Text>
        <Text style={styles.meta}>
          {currentParticipant.displayName} with {otherParticipant?.displayName ?? "Partner"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participant</Text>
        <View style={styles.segmented}>
          {session.participants.map((participant) => (
            <Pressable
              key={participant.id}
              onPress={() => setCurrentParticipantId(participant.id)}
              style={[
                styles.segment,
                participant.id === currentParticipant.id && styles.segmentActive
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  participant.id === currentParticipant.id && styles.segmentTextActive
                ]}
              >
                {participant.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite</Text>
        <View style={styles.actionRow}>
          {session.participants.map((participant) => (
            <ActionButton
              key={participant.id}
              label={participant.displayName}
              icon="copy"
              tone="neutral"
              onPress={() => handleCopyInvite(participant.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Switch provider</Text>
        <ProviderPicker
          value={toProvider}
          disabledProvider={session.activeProvider}
          onChange={setToProvider}
        />
        <View style={styles.chips}>
          {reasonPresets.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setReason(preset)}
              style={[styles.chip, reason === preset && styles.chipActive]}
            >
              <Text style={[styles.chipText, reason === preset && styles.chipTextActive]}>
                {preset}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason"
          style={styles.input}
        />
        <RecommendationList recommendations={recommendations} />
        <ActionButton
          label="Propose switch"
          icon="swap-horizontal"
          disabled={isBusy || Boolean(activeProposal)}
          onPress={handleCreateProposal}
        />
      </View>

      {activeProposal ? (
        <View style={styles.proposal}>
          <Text style={styles.sectionTitle}>Current proposal</Text>
          <Text style={styles.proposalText}>
            {PROVIDER_LABELS[activeProposal.fromProvider]} to{" "}
            {PROVIDER_LABELS[activeProposal.toProvider]}: {activeProposal.reason}
          </Text>
          <Text style={styles.meta}>Status: {activeProposal.status}</Text>

          {isRecipient && activeProposal.status === "proposed" ? (
            <View style={styles.actionRow}>
              <ActionButton
                label="Accept"
                icon="checkmark"
                tone="success"
                disabled={isBusy}
                onPress={handleAccept}
              />
              <ActionButton
                label="Reject"
                icon="close"
                tone="danger"
                disabled={isBusy}
                onPress={handleReject}
              />
            </View>
          ) : null}

          {canLaunch ? (
            <View style={styles.actionRow}>
              <ActionButton
                label="Launch"
                icon="open"
                tone="neutral"
                onPress={handleLaunch}
              />
              <ActionButton
                label="I joined"
                icon="checkmark-done"
                tone="success"
                disabled={isBusy}
                onPress={handleConfirmJoined}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function reasonToSignals(reason: string) {
  const normalized = reason.toLowerCase();
  return [
    normalized.includes("stream") ? "streaming" : undefined,
    normalized.includes("game") ? "gaming" : undefined,
    normalized.includes("long") ? "long_call" : undefined,
    normalized.includes("zalo") ? "zalo_first" : undefined,
    normalized.includes("vietnam") ? "vietnam" : undefined,
    normalized.includes("simple") ? "simple" : undefined
  ].filter(Boolean) as Parameters<typeof recommendProviders>[0]["signals"];
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  container: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  topBand: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  activeProvider: {
    fontSize: 30,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
    fontSize: 13
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  segmented: {
    backgroundColor: "#e5edf5",
    borderRadius: 8,
    flexDirection: "row",
    padding: 4
  },
  segment: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 40,
    justifyContent: "center"
  },
  segmentActive: {
    backgroundColor: colors.surface
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.text
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  chipText: {
    color: colors.text,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#ffffff"
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  proposal: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  proposalText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
