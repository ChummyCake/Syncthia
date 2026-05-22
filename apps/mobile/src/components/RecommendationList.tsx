import { ProviderRecommendation } from "@syncthia/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

interface RecommendationListProps {
  recommendations: ProviderRecommendation[];
}

export function RecommendationList({ recommendations }: RecommendationListProps) {
  return (
    <View style={styles.list}>
      {recommendations.map((recommendation) => (
        <View key={recommendation.provider} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors[recommendation.provider] }]} />
          <View style={styles.content}>
            <Text style={styles.label}>
              {recommendation.label}
              {recommendation.isActive ? " active" : ""}
            </Text>
            <Text style={styles.reason} numberOfLines={2}>
              {recommendation.reasons.length > 0
                ? recommendation.reasons.join(", ")
                : "available"}
            </Text>
          </View>
          <Text style={styles.score}>{recommendation.score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm
  },
  row: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: spacing.md
  },
  dot: {
    borderRadius: 6,
    height: 12,
    marginRight: spacing.sm,
    width: 12
  },
  content: {
    flex: 1
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  reason: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  score: {
    color: colors.dark,
    fontSize: 14,
    fontWeight: "800"
  }
});
