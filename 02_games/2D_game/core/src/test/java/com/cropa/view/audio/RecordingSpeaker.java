package com.cropa.view.audio;

// ArrayList and List: the calls written down, in order. EnumMap and Map: the last volume sent to each loop.
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

// The fake Speaker of the tests, like RecordingCanvas for the renderers: it plays nothing, it only writes down what
// Jukebox asks for, so the tests check the sound without libGDX and without a sound card.
/** A speaker that writes down the sounds played and the loops started, stopped and turned up or down. */
class RecordingSpeaker implements Speaker {

    // The short sounds played, in order.
    final List<Cue> cues = new ArrayList<>();
    // "start DAY", "stop NIGHT": the starts and the stops of the loops, in order.
    final List<String> loops = new ArrayList<>();
    // The last volume sent to each loop.
    final Map<Track, Float> volumes = new EnumMap<>(Track.class);
    // The volume each short sound was played at, in the order of cues.
    final List<Float> cueVolumes = new ArrayList<>();

    @Override
    public void play(Cue cue, float volume) {
        cues.add(cue);
        cueVolumes.add(volume);
    }

    @Override
    public void start(Track track) {
        loops.add("start " + track);
        volumes.put(track, 0f);
    }

    @Override
    public void stop(Track track) {
        loops.add("stop " + track);
        volumes.remove(track);
    }

    @Override
    public void setVolume(Track track, float volume) {
        volumes.put(track, volume);
    }
}
