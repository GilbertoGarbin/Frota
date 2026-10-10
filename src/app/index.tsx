import { StyleSheet, Text, View } from 'react-native';

// Rota provisória — o Expo Router exige ao menos uma. Será substituída pelas telas reais.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Frota</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E293B',
  },
});
