import { View, Text, StyleSheet } from 'react-native';
import { M3, spacing, radii, typography } from './theme';

export const DISCLAIMER_TEXT =
  'Totdat de KNBSB dit in de app heeft opgelost, kun je deze site gebruiken. Deze site is echter niet leidend voor de locatie en datum van je wedstrijden. Controleer daarom altijd de KNBSB\u2011app voor de meest actuele informatie over tegenstander, locatie en aanvangstijd. Quick en/of de maker zijn hiervoor niet verantwoordelijk.';

export function DisclaimerFooter() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: M3.surfaceContainerHigh,
    borderRadius: radii.md,
  },
  text: {
    ...typography.labelSmall,
    color: M3.onSurfaceVariant,
    textAlign: 'center',
  },
});
