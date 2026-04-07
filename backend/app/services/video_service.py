"""
Video & Image Analysis Service.

Analyses uploaded video frames or images for visible health indicators
(e.g. skin lesions, jaundice, pallor) using OpenCV and DeepFace.
This complements — but does not replace — clinical diagnosis.
"""

from __future__ import annotations

import logging
import tempfile
import os
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_VIDEO_FORMATS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
SUPPORTED_IMAGE_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _extract_frame(video_path: str, frame_num: int = 0) -> Optional[str]:
    """Extract a single frame from a video file and save as JPEG."""
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return None
        frame_path = video_path + "_frame.jpg"
        cv2.imwrite(frame_path, frame)
        return frame_path
    except Exception as exc:
        logger.warning("Frame extraction failed: %s", exc)
        return None


def _analyse_face(image_path: str) -> dict:
    """Run DeepFace emotion/attribute analysis on a face image."""
    try:
        from deepface import DeepFace
        result = DeepFace.analyze(
            img_path=image_path,
            actions=["age", "gender", "emotion"],
            enforce_detection=False,
            silent=True,
        )
        if isinstance(result, list):
            result = result[0]
        return {
            "age": result.get("age"),
            "gender": result.get("dominant_gender"),
            "emotion": result.get("dominant_emotion"),
        }
    except Exception as exc:
        logger.warning("Facial analysis failed: %s", exc)
        return {}


def _analyse_skin_color(image_path: str) -> dict:
    """
    Detect basic skin colour indicators (pallor, jaundice hints) using
    HSV colour space analysis.  This is a heuristic screening tool only.
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            return {}

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        # Skin tone range in HSV
        lower = np.array([0, 20, 70], dtype=np.uint8)
        upper = np.array([20, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower, upper)
        skin_ratio = mask.sum() / (255 * img.shape[0] * img.shape[1])

        indicators = []
        # Very pale skin (possible pallor) — low saturation
        mean_sat = float(hsv[:, :, 1].mean())
        if mean_sat < 30:
            indicators.append("possible_pallor")

        # Yellowish tint (possible jaundice) — shifted hue
        mean_hue = float(hsv[:, :, 0].mean())
        if 15 < mean_hue < 30 and mean_sat > 40:
            indicators.append("possible_jaundice_tint")

        return {"skin_ratio": round(skin_ratio, 3), "indicators": indicators}
    except Exception as exc:
        logger.warning("Skin colour analysis failed: %s", exc)
        return {}


async def analyse_media(
    media_bytes: bytes,
    filename: str,
    include_facial: bool = True,
) -> dict:
    """
    Analyse a video or image file for visible health indicators.

    Returns a dict with keys:
      - facial_attributes: age, gender, emotion (if face detected)
      - skin_indicators: heuristic colour-based indicators
      - summary: human-readable summary string
    """
    suffix = Path(filename).suffix.lower()
    is_video = suffix in SUPPORTED_VIDEO_FORMATS
    is_image = suffix in SUPPORTED_IMAGE_FORMATS

    if not (is_video or is_image):
        raise ValueError(
            f"Unsupported file format '{suffix}'. "
            f"Supported video: {', '.join(SUPPORTED_VIDEO_FORMATS)}; "
            f"image: {', '.join(SUPPORTED_IMAGE_FORMATS)}"
        )

    size_mb = len(media_bytes) / (1024 * 1024)
    max_size = settings.MAX_VIDEO_SIZE_MB if is_video else settings.MAX_IMAGE_SIZE_MB
    if size_mb > max_size:
        raise ValueError(
            f"File too large ({size_mb:.1f} MB). Maximum allowed: {max_size} MB"
        )

    # Write to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(media_bytes)
        tmp_path = tmp.name

    image_path = tmp_path
    cleanup_paths = [tmp_path]

    try:
        if is_video:
            extracted = _extract_frame(tmp_path)
            if extracted:
                image_path = extracted
                cleanup_paths.append(extracted)
            else:
                return {
                    "facial_attributes": {},
                    "skin_indicators": {},
                    "summary": "Could not extract frame from video for analysis.",
                }

        facial_attributes = _analyse_face(image_path) if include_facial else {}
        skin_indicators = _analyse_skin_color(image_path)

        # Build a readable summary
        summary_parts = []
        if facial_attributes:
            age = facial_attributes.get("age")
            gender = facial_attributes.get("gender")
            emotion = facial_attributes.get("emotion")
            if age:
                summary_parts.append(f"Estimated age: ~{age}")
            if gender:
                summary_parts.append(f"Gender presentation: {gender}")
            if emotion:
                summary_parts.append(f"Dominant emotion: {emotion}")

        indicators = skin_indicators.get("indicators", [])
        if "possible_pallor" in indicators:
            summary_parts.append(
                "Possible skin pallor detected — may warrant haematological screening."
            )
        if "possible_jaundice_tint" in indicators:
            summary_parts.append(
                "Possible jaundice tint detected — liver/biliary assessment may be advisable."
            )

        if not summary_parts:
            summary_parts.append(
                "No prominent visual health indicators detected in the media."
            )

        return {
            "facial_attributes": facial_attributes,
            "skin_indicators": skin_indicators,
            "summary": " | ".join(summary_parts),
        }

    finally:
        for path in cleanup_paths:
            try:
                os.unlink(path)
            except OSError:
                pass
