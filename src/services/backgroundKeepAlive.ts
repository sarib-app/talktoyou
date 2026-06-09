import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

let activeSound: Audio.Sound | null = null;

export async function startKeepAlive(): Promise<void> {
  if (activeSound) return;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav'),
      { isLooping: true, volume: 0, shouldPlay: true }
    );

    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && !status.isPlaying && !status.didJustFinish) {
        sound.playAsync().catch(() => {});
      }
    });

    activeSound = sound;
  } catch {}
}

export async function stopKeepAlive(): Promise<void> {
  if (!activeSound) return;
  try {
    await activeSound.stopAsync();
    await activeSound.unloadAsync();
  } catch {}
  activeSound = null;
}
