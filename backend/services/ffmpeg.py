import ffmpeg
import os

OUTPUT_DIR = "outputs/final"
os.makedirs(OUTPUT_DIR, exist_ok=True)


async def assemble_video(
    clip_paths: list[str],
    audio_path: str,
    transition: str,
    output_filename: str,
) -> str:
    """
    Concatenate approved clips with transitions and mux original audio.
    Returns path to final MP4.
    """
    output_path = os.path.join(OUTPUT_DIR, output_filename)

    if transition == "cut":
        _hard_cut(clip_paths, audio_path, output_path)
    else:
        _dissolve(clip_paths, audio_path, output_path, transition)

    return output_path


def _hard_cut(clip_paths: list[str], audio_path: str, output_path: str):
    """Concatenate clips with hard cuts, mux audio."""
    concat_list = output_path + "_concat.txt"
    with open(concat_list, "w") as f:
        for path in clip_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")

    video = ffmpeg.input(concat_list, format="concat", safe=0)
    audio = ffmpeg.input(audio_path)

    ffmpeg.output(
        video, audio, output_path,
        vcodec="libx264", acodec="aac",
        shortest=None,
    ).overwrite_output().run()

    os.remove(concat_list)


def _dissolve(clip_paths: list[str], audio_path: str, output_path: str, transition: str):
    """
    Cross-dissolve between clips using xfade filter.
    transition: "dissolve" | "fade"
    """
    xfade_type = "dissolve" if transition == "dissolve" else "fade"
    dissolve_duration = 0.5  # seconds

    if len(clip_paths) == 1:
        _hard_cut(clip_paths, audio_path, output_path)
        return

    streams = [ffmpeg.input(p) for p in clip_paths]
    video = streams[0].video

    for i in range(1, len(streams)):
        video = ffmpeg.filter(
            [video, streams[i].video],
            "xfade",
            transition=xfade_type,
            duration=dissolve_duration,
            offset=0,
        )

    audio = ffmpeg.input(audio_path).audio

    ffmpeg.output(
        video, audio, output_path,
        vcodec="libx264", acodec="aac",
        shortest=None,
    ).overwrite_output().run()
