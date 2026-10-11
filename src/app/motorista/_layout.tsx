import { Stack } from 'expo-router';

import { PinPortao } from '@/components/pin-portao';

export default function MotoristaLayout() {
  return (
    <PinPortao>
      <Stack screenOptions={{ headerShown: false }} />
    </PinPortao>
  );
}
