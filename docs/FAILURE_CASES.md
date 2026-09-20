# Failure Cases & Edge Condition Analysis

## 1. Extreme Pose Angles (> 45° Yaw / Pitch)
### Problem Description:
When a subject turns their head beyond $45^\circ$, the contralateral eye and mouth corner are occluded by nasal cartilage and cheek curvature. 
- The SCRFD landmark detector either hallucinates keypoint coordinates or fails to output 5 valid points.
- The 5-point affine transformation creates severe non-linear spatial stretching, distorting the canonical $112 \times 112$ crop.
- The ArcFace embedding shifts significantly, dropping genuine similarity from $\sim 0.75$ down to $\sim 0.38$, triggering an erroneous UNKNOWN rejection.

### Technical Mitigation:
1. **Multi-Image Enrollment**: Enrolling multiple poses (frontal, left 30°, right 30°, slight tilt) per person.
2. **Pose Filtering**: Calculating 3D head pose from 2D landmarks via Perspective-n-Point (PnP) and discarding frames with yaw $> 45^\circ$ with a user instruction "Please look directly at camera".

---

## 2. Severe Facial Occlusion (Masks, Heavy Glasses, Scarves)
### Problem Description:
Medical face masks occlude the lower half of the facial geometry (nose bridge, philtrum, lips, chin contour), eliminating approximately 50% of the discriminative biometric cues. Similarly, thick-rimmed sunglasses hide ocular shape and inter-pupillary distance.
- Intra-class similarity between an unmasked enrolled photo and a masked query photo typically drops by $0.20 \sim 0.35$.

### Technical Mitigation:
1. **Periocular Feature Extraction**: A dedicated auxiliary neural network trained solely on the upper-face periocular region (forehead, eyebrows, eyes, temple).
2. **Occlusion-Aware Weighting**: Landmark visibility confidence masks that discount occluded feature channels.

---

## 3. High Dynamic Range & Strong Backlighting
### Problem Description:
When a light source (such as an open window or fluorescent lamp) is positioned behind the subject:
- The camera's auto-exposure algorithm meters for the bright background, causing the subject's face to be severely underexposed (silhouette effect).
- Pixel values in the face region collapse to low values ($[0, 30]$), destroying subtle gradient textures.

### Technical Mitigation:
1. **Histogram Equalization**: Applying Contrast Limited Adaptive Histogram Equalization (CLAHE) on the luminance channel (LAB color space) prior to detection and alignment.
2. **Exposure Guidance**: Providing in-app real-time lighting feedback if average face luminosity falls below a threshold.

---

## 4. Low Resolution & Distance (> 3 Meters)
### Problem Description:
If the subject is far from the camera or using an ultra-low-resolution webcam:
- The face bounding box may contain fewer than $30 \times 30$ pixels.
- Upscaling a $30 \times 30$ crop to the $112 \times 112$ ArcFace input space introduces severe bilinear blur and interpolation artifacts.

### Technical Mitigation:
1. **Minimum Resolution Gating**: Rejection of face crops smaller than $48 \times 48$ pixels with an explicit error: `FACE_TOO_SMALL_OR_FAR`.
2. **Super-Resolution**: Prepending a lightweight super-resolution GAN (e.g. GFPGAN / Real-ESRGAN) to restore facial fidelity.

---

## 5. Monozygotic (Identical) Twins & Close Relatives
### Problem Description:
Identical twins share identical genetic heritage, facial cranial structure, and eye spacing. In 2D biometric systems, photos of twin A and twin B routinely achieve cosine similarity scores in the $0.62 \sim 0.72$ range, exceeding standard thresholds ($\tau = 0.50$).

### Technical Mitigation:
1. **Multimodal Biometrics**: Complementing 2D face recognition with secondary biometrics (fingerprint, palmprint, or iris texture).
2. **Infrared Structured Light**: Utilizing 3D depth cameras (Apple TrueDepth / Intel RealSense) to measure sub-millimeter micro-topography.
