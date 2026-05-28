import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  PROVIDER_LABELS,
  PROVIDERS,
  Provider,
  recommendProviders
} from "@syncthia/shared";
import { ActionButton } from "../src/components/ActionButton";
import { ProviderPicker } from "../src/components/ProviderPicker";
import { RecommendationList } from "../src/components/RecommendationList";
import { createSession, updateProviderPreferences } from "../src/lib/api";
import { registerDeviceForPush } from "../src/notifications/register-device";
import { useSessionStore } from "../src/store/session-store";
import { colors, spacing } from "../src/theme";
import { createLocalId } from "../src/utils/id";

const signals = ["simple", "long_call"] as const;

export default function HomeScreen() {
  const [localUserId] = useState(() => createLocalId("user"));
  const [activeProvider, setActiveProvider] = useState<Provider>("messenger");
  const [installedProviders, setInstalledProviders] = useState<Provider[]>([
    ...PROVIDERS
  ]);
  const [yourName, setYourName] = useState("You");
  const [partnerName, setPartnerName] = useState("Partner");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setSessionResponse = useSessionStore((state) => state.setSessionResponse);
  const setCurrentParticipantId = useSessionStore((state) => state.setCurrentParticipantId);

  const recommendations = useMemo(
    () =>
      recommendProviders({
        signals: [...signals],
        preferredProvider: activeProvider,
        installedProviders,
        activeProvider
      }),
    [activeProvider, installedProviders]
  );

  function toggleInstalledProvider(provider: Provider) {
    setInstalledProviders((providers) => {
      const next = providers.includes(provider)
        ? providers.filter((candidate) => candidate !== provider)
        : [...providers, provider];

      if (next.length === 0) {
        return providers;
      }

      if (!next.includes(activeProvider)) {
        setActiveProvider(next[0]);
      }

      return next;
    });
  }

  function handleActiveProviderChange(provider: Provider) {
    setActiveProvider(provider);
    setInstalledProviders((providers) =>
      providers.includes(provider) ? providers : [...providers, provider]
    );
  }

  async function handleCreateSession() {
    setIsSubmitting(true);
    const you = localUserId;
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
      void registerDeviceForPush(you).catch(() => undefined);
      void updateProviderPreferences({
        userId: you,
        preferredProvider: activeProvider,
        installedProviders,
        signals: [...signals]
      }).catch(() => undefined);
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
          <ProviderPicker
            value={activeProvider}
            onChange={handleActiveProviderChange}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Installed apps</Text>
          <View style={styles.installedGrid}>
            {PROVIDERS.map((provider) => {
              const selected = installedProviders.includes(provider);
              return (
                <Pressable
                  key={provider}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleInstalledProvider(provider)}
                  style={[
                    styles.installedOption,
                    selected && { borderColor: colors[provider] }
                  ]}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={selected ? colors[provider] : colors.muted}
                  />
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.installedText}
                  >
                    {PROVIDER_LABELS[provider]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
  installedGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  installedOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 62,
    paddingHorizontal: spacing.sm
  },
  installedText: {
    alignSelf: "stretch",
    textAlign: "center",
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
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
