import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

let alarmSound: Audio.Sound | null = null;

export async function startAlarm(): Promise<void> {
  if (alarmSound) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav'),
      { isLooping: true, volume: 1.0, shouldPlay: true }
    );
    alarmSound = sound;
  } catch {}
}

export async function stopAlarm(): Promise<void> {
  if (!alarmSound) return;
  try {
    await alarmSound.stopAsync();
    await alarmSound.unloadAsync();
  } catch {}
  alarmSound = null;
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
  } catch {}
}

export function isAlarmRunning(): boolean {
  return alarmSound !== null;
}
