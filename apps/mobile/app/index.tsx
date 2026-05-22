import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import { Provider, recommendProviders } from "@syncthia/shared";
import { ActionButton } from "../src/components/ActionButton";
import { ProviderPicker } from "../src/components/ProviderPicker";
import { RecommendationList } from "../src/components/RecommendationList";
import { createSession } from "../src/lib/api";
import { registerDeviceForPush } from "../src/notifications/register-device";
import { useSessionStore } from "../src/store/session-store";
import { colors, spacing } from "../src/theme";
import { createLocalId } from "../src/utils/id";

const signals = ["simple", "long_call"] as const;

export default function HomeScreen() {
  const [activeProvider, setActiveProvider] = useState<Provider>("messenger");
  const [yourName, setYourName] = useState("You");
  const [partnerName, setPartnerName] = useState("Partner");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSessionResponse = useSessionStore((state) => state.setSessionResponse);
  const setCurrentParticipantId = useSessionStore((state) => state.setCurrentParticipantId);

  const recommendations = useMemo(
    () =>
      recommendProviders({
        signals: [...signals],
        activeProvider
      }),
    [activeProvider]
  );

  async function handleCreateSession() {
    setIsSubmitting(true);
    const you = createLocalId("user");
    const partner = createLocalId("user");

    try {
      const response = await createSession({
        activeProvider,
        participants: [
          { id: you, displayName: yourName.trim() || "You" },
          { id: partner, displayName: partnerName.trim() || "Partner" }
        ]
      });

      setSessionResponse(response);
      setCurrentParticipantId(you);
      void registerDeviceForPush(you);
      router.push({
        pathname: "/session/[sessionId]",
        params: {
          sessionId: response.session.id,
          participantId: you
        }
      });
    } catch (error) {
      Alert.alert("Session could not start", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Start a call session</Text>
          <Text style={styles.subtitle}>One active provider: Messenger, Discord, or Zalo.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <TextInput
            value={yourName}
            onChangeText={setYourName}
            placeholder="Your name"
            style={styles.input}
          />
          <TextInput
            value={partnerName}
            onChangeText={setPartnerName}
            placeholder="Partner name"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active provider</Text>
          <ProviderPicker value={activeProvider} onChange={setActiveProvider} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendation</Text>
          <RecommendationList recommendations={recommendations} />
        </View>

        {isSubmitting ? (
          <ActivityIndicator color={colors.messenger} size="large" />
        ) : (
          <ActionButton label="Create session" icon="add-circle" onPress={handleCreateSession} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1
  },
  container: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  header: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
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
  }
});
