import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

const SLIDES = [
  { id: '1', source: require('../../assets/pic1.png') },
  { id: '2', source: require('../../assets/pic2.jpeg') },
  { id: '3', source: require('../../assets/pic3.png') },
];

const SONG_NAME = 'our song';

export default function MemoriesScreen() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const focusedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [listHeight, setListHeight] = useState(Dimensions.get('window').height);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
    let snd: Audio.Sound;
    Audio.Sound.createAsync(
      require('../../assets/song.mp3'),
      { isLooping: true, volume: 0.85, positionMillis: 53000 }
    )
      .then(({ sound }) => {
        snd = sound;
        soundRef.current = sound;
        if (focusedRef.current) {
          sound.playAsync();
          setPlaying(true);
        }
      })
      .catch(() => {});
    return () => { snd?.unloadAsync(); };
  }, []);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    if (soundRef.current) {
      soundRef.current.playAsync();
      setPlaying(true);
    }
    return () => {
      focusedRef.current = false;
      soundRef.current?.pauseAsync();
      setPlaying(false);
    };
  }, []));

  async function togglePlay() {
    if (!soundRef.current) return;
    if (playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  }

  return (
    <View
      style={styles.container}
      onLayout={e => setListHeight(e.nativeEvent.layout.height)}
    >
      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={e =>
          setCurrentIdx(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={StyleSheet.absoluteFill}
        renderItem={({ item }) => (
          <Image
            source={item.source}
            style={{ width, height: listHeight }}
            resizeMode="cover"
          />
        )}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={styles.topGradient}
      />
      <TouchableOpacity style={styles.musicPill} onPress={togglePlay} activeOpacity={0.8}>
        <Text style={[styles.musicNote, playing && styles.musicNotePlaying]}>♫</Text>
        <Text style={styles.songName}>{SONG_NAME}</Text>
        <Text style={styles.playStatus}>{playing ? '▐▐' : '▶'}</Text>
      </TouchableOpacity>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={styles.bottomGradient}
      />
      <View style={styles.captionWrap} pointerEvents="none">
        <Text style={styles.captionLine}>And when the dust covers my chest,</Text>
        <Text style={styles.captionLine}>it won't be heavier than</Text>
        <Text style={styles.captionLine}>the love i carried for you</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIdx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 130, zIndex: 2,
    pointerEvents: 'none',
  } as any,
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, zIndex: 2,
    pointerEvents: 'none',
  } as any,
  musicPill: {
    position: 'absolute', top: 58, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 3,
  },
  musicNote: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  musicNotePlaying: { color: '#fff' },
  songName: { fontSize: 13, color: '#fff', fontWeight: '600', letterSpacing: 0.4 },
  playStatus: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  captionWrap: {
    position: 'absolute', bottom: 52, left: 20, right: 20, zIndex: 4,
    alignItems: 'center', gap: 4,
  },
  captionLine: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  dots: {
    position: 'absolute', bottom: 20, width: '100%',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, zIndex: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 22, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});
