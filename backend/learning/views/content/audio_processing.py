from __future__ import annotations

import io
import itertools
import logging

import av

logger = logging.getLogger(__name__)


def audio_duration_seconds(audio_bytes: bytes) -> float | None:
    """Read the encoded duration without changing the original audio."""
    if not audio_bytes:
        return None
    try:
        source = av.open(io.BytesIO(audio_bytes), mode="r", format="mp3")
        duration = source.duration
        source.close()
    except (av.FFmpegError, OSError, ValueError) as exc:
        logger.warning("content.audio.duration_read_failed error=%s", exc.__class__.__name__)
        return None
    if duration is None or duration <= 0:
        return None
    return round(float(duration / av.time_base), 1)


def _apply_audio_filters(audio_bytes: bytes, filters: list[tuple[str, str]], log_name: str) -> bytes:
    if not audio_bytes:
        return audio_bytes
    try:
        source = av.open(io.BytesIO(audio_bytes), mode="r", format="mp3")
        frames = (frame for packet in source.demux(audio=0) for frame in packet.decode())
        first_frame = next(frames)
        graph = av.filter.Graph()
        time_base = first_frame.time_base
        if time_base is None:
            time_base_value = f"1/{first_frame.sample_rate}"
        else:
            time_base_value = f"{time_base.numerator}/{time_base.denominator}"
        input_node = graph.add(
            "abuffer",
            args=(
                f"time_base={time_base_value}:sample_rate={first_frame.sample_rate}:"
                f"sample_fmt={first_frame.format.name}:channel_layout={first_frame.layout.name}"
            ),
        )
        filter_nodes = [graph.add(filter_name, filter_args) for filter_name, filter_args in filters]
        output_node = graph.add("abuffersink")
        previous_node = input_node
        for filter_node in filter_nodes:
            previous_node.link_to(filter_node)
            previous_node = filter_node
        previous_node.link_to(output_node)
        graph.configure()

        output_buffer = io.BytesIO()
        destination = av.open(output_buffer, mode="w", format="mp3")
        stream = destination.add_stream("libmp3lame", rate=first_frame.sample_rate)
        stream.layout = first_frame.layout.name

        def write_available_frames() -> None:
            while True:
                try:
                    filtered = output_node.pull()
                except (av.BlockingIOError, av.EOFError):
                    break
                for packet in stream.encode(filtered):
                    destination.mux(packet)

        for frame in itertools.chain((first_frame,), frames):
            input_node.push(frame)
            write_available_frames()
        input_node.push(None)
        write_available_frames()
        for packet in stream.encode(None):
            destination.mux(packet)
        destination.close()
        source.close()
        processed = output_buffer.getvalue()
    except (av.FFmpegError, OSError, StopIteration, ValueError) as exc:
        logger.warning("content.audio.%s_failed error=%s", log_name, exc.__class__.__name__)
        return audio_bytes
    if len(processed) < 1024:
        logger.warning("content.audio.%s_failed error=empty_output", log_name)
        return audio_bytes
    logger.info("content.audio.%s input_bytes=%s output_bytes=%s", log_name, len(audio_bytes), len(processed))
    return processed


def _apply_audio_filter(audio_bytes: bytes, filter_name: str, filter_args: str, log_name: str) -> bytes:
    return _apply_audio_filters(audio_bytes, [(filter_name, filter_args)], log_name)


def trim_trailing_silence(audio_bytes: bytes) -> bytes:
    """Re-encode an MP3 after removing only its quiet ending for clean looping."""
    return _apply_audio_filter(
        audio_bytes,
        "silenceremove",
        "stop_periods=1:stop_duration=0.12:stop_threshold=-48dB:stop_silence=0",
        "trailing_silence_trimmed",
    )


def trim_audio_to_duration(audio_bytes: bytes, duration_seconds: int) -> bytes:
    """Keep a planned prefix of an MP3 after an inpainting context section."""
    if duration_seconds <= 0:
        return audio_bytes
    return _apply_audio_filter(
        audio_bytes,
        "atrim",
        f"duration={duration_seconds}",
        "duration_trimmed",
    )


def trim_audio_from_start(audio_bytes: bytes, seconds: int) -> bytes:
    """Drop a known generated pickup while preserving the rest of the MP3."""
    if seconds <= 0:
        return audio_bytes
    return _apply_audio_filter(
        audio_bytes,
        "atrim",
        f"start={seconds}",
        "intro_trimmed",
    )


def trim_audio_from_end(audio_bytes: bytes, seconds: int) -> bytes:
    """Drop a fixed amount from the ending of an MP3."""
    duration_seconds = audio_duration_seconds(audio_bytes)
    if seconds <= 0 or duration_seconds is None or duration_seconds <= seconds:
        return audio_bytes
    return trim_audio_to_duration(audio_bytes, duration_seconds - seconds)


def remove_audio_window(
    audio_bytes: bytes,
    start_seconds: float,
    duration_seconds: float,
    *,
    log_name: str = "middle_trimmed",
) -> bytes:
    """Remove a middle time window and retime the remaining audio without a gap."""
    if start_seconds < 0 or duration_seconds <= 0:
        return audio_bytes
    return _apply_audio_filters(
        audio_bytes,
        [
            ("aselect", f"not(between(t\\,{start_seconds}\\,{start_seconds + duration_seconds}))"),
            ("asetpts", "N/SR/TB"),
        ],
        log_name,
    )


def remove_audio_window_before_end(
    audio_bytes: bytes,
    keep_end_seconds: float,
    duration_seconds: float,
) -> bytes:
    """Remove audio just before a retained final segment."""
    total_duration_seconds = audio_duration_seconds(audio_bytes)
    start_seconds = (total_duration_seconds or 0) - keep_end_seconds - duration_seconds
    if start_seconds <= 0:
        return audio_bytes
    return remove_audio_window(
        audio_bytes,
        start_seconds,
        duration_seconds,
        log_name="outro_middle_trimmed",
    )
