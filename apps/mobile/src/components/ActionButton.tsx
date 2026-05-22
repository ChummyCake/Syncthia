import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing } from "../theme";

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "danger" | "neutral";
  disabled?: boolean;
  onPress: () => void;
}

export function ActionButton({
  label,
  icon,
  tone = "primary",
  disabled,
  onPress
}: ActionButtonProps) {
  const backgroundColor =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : tone === "neutral"
          ? colors.dark
          : colors.messenger;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor }, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color="#ffffff" />
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    color: "#ffffff",
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800"
  }
});
