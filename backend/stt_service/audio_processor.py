import os
import subprocess
import logging

logger = logging.getLogger(__name__)

def convert_to_wav(input_path: str, output_path: str, target_sample_rate=16000) -> bool:
    """
    Converts any supported audio file to a 16kHz mono WAV file using FFmpeg,
    which is required by Vosk. Bypasses pydub to avoid Python 3.13 audioop removal issues.
    """
    try:
        command = [
            "ffmpeg",
            "-y",  # Overwrite seamlessly
            "-i", input_path,
            "-ac", "1",  # Mono
            "-ar", str(target_sample_rate),
            output_path
        ]
        
        # Execute ffmpeg quietly
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        return os.path.exists(output_path)
    except Exception as e:
        logger.error(f"Error converting audio via ffmpeg: {e}")
        return False
