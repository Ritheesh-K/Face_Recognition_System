import cv2
import numpy as np
from insightface.utils import face_align


class FaceAligner:
    """
    Standard 5-point facial landmark aligner.
    Transforms detected face coordinates to canonical 112x112 pixel crop
    optimized for ArcFace deep feature extraction.
    """

    REFERENCE_FACIAL_POINTS = np.array([
        [38.2946, 51.6963],  # Left Eye
        [73.5318, 51.5014],  # Right Eye
        [56.0252, 71.7366],  # Nose tip
        [41.5493, 92.3655],  # Left mouth corner
        [70.7299, 92.2041]   # Right mouth corner
    ], dtype=np.float32)

    def __init__(self, output_size: tuple[int, int] = (112, 112)):
        self.output_size = output_size

    def align(self, image: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """
        Aligns a face image to standard 112x112 dimensions using 5 landmarks.
        
        Args:
            image: BGR numpy image (H, W, 3).
            landmarks: (5, 2) numpy array of facial landmarks [left_eye, right_eye, nose, mouth_l, mouth_r].

        Returns:
            Aligned BGR face image (112, 112, 3).
        """
        if landmarks is None or len(landmarks) != 5:
            raise ValueError("Exactly 5 facial landmarks required for ArcFace alignment.")

        landmarks = np.asarray(landmarks, dtype=np.float32)

        try:
            # Use InsightFace canonical similarity transform
            aligned = face_align.norm_crop(image, landmark=landmarks, image_size=self.output_size[0])
            return aligned
        except Exception:
            # Fallback to OpenCV EstimateAffinePartial2D
            tform, _ = cv2.estimateAffinePartial2D(landmarks, self.REFERENCE_FACIAL_POINTS)
            if tform is None:
                # Direct crop if alignment fails
                h, w = image.shape[:2]
                return cv2.resize(image, self.output_size)
            aligned = cv2.warpAffine(
                image,
                tform,
                self.output_size,
                borderValue=0.0
            )
            return aligned
