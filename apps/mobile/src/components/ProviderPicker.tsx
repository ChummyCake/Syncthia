import { Ionicons } from "@expo/vector-icons";
import { Provider, PROVIDER_LABELS, PROVIDERS } from "@syncthia/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

interface ProviderPickerProps {
  value: Provider;
  disabledProvider?: Provider;
  onChange: (provider: Provider) => void;
}

const iconNames: Record<Provider, keyof typeof Ionicons.glyphMap> = {
  messenger: "chatbubble-ellipses",
  discord: "game-controller",
  zalo: "call"
};

export function ProviderPicker({ value, disabledProvider, onChange }: ProviderPickerProps) {
  return (
    <View style={styles.grid}>
      {PROVIDERS.map((provider) => {
        const selected = value === provider;
        const disabled = disabledProvider === provider;
        const accent = colors[provider];

        return (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(provider)}
            style={[
              styles.option,
              selected && { borderColor: accent, backgroundColor: "#f8fbff" },
              disabled && styles.disabled
            ]}
          >
            <Ionicons name={iconNames[provider]} size={22} color={disabled ? colors.muted : accent} />
            <Text style={[styles.optionText, selected && { color: accent }]}>
              {PROVIDER_LABELS[provider]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 82,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  disabled: {
    opacity: 0.45
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  }
});
