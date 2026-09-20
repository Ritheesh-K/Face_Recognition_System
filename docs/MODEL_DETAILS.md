# Model Details & Architectural Specification

## 1. Face Detector: SCRFD (Sample and Computation Redistribution)
- **Model Variant**: SCRFD 500M params (`det_500m.onnx`)
- **Framework**: InsightFace / ONNX Runtime
- **Input Dimension**: Dynamic shape, default resized to $320 \times 320$ or $640 \times 640$
- **Inference Provider**: `CPUExecutionProvider`
- **Output Anchors**:
  1. Face Bounding Box $[x_1, y_1, x_2, y_2]$
  2. Detection Confidence Score $\in [0.0, 1.0]$
  3. 5 Facial Landmark Keypoints:
     - Left Eye $(x_{\text{le}}, y_{\text{le}})$
     - Right Eye $(x_{\text{re}}, y_{\text{re}})$
     - Nose Tip $(x_{\text{nose}}, y_{\text{nose}})$
     - Left Mouth Corner $(x_{\text{ml}}, y_{\text{ml}})$
     - Right Mouth Corner $(x_{\text{mr}}, y_{\text{mr}})$

### Why SCRFD?
Compared to older detectors (Haar cascades, Dlib HOG, MTCNN), SCRFD uses neural architecture search to optimize computation allocation across feature scales. It provides state-of-the-art scale invariance (detecting tiny faces down to $16 \times 16$ pixels) while running in ~15ms on standard desktop CPUs without requiring GPU acceleration.

---

## 2. Face Aligner: 5-Point Affine Similarity Transformation
- **Input**: Raw BGR image + 5 detected facial landmarks
- **Target Space**: Canonical $112 \times 112 \times 3$ RGB bounding crop
- **Canonical Reference Anchor Coordinates**:
  ```python
  REFERENCE_POINTS = [
      [38.2946, 51.6963],  # Left Eye
      [73.5318, 51.5014],  # Right Eye
      [56.0252, 71.7366],  # Nose Tip
      [41.5493, 92.3655],  # Left Mouth Corner
      [70.7299, 92.2041]   # Right Mouth Corner
  ]
  ```
- **Mathematical Operation**:
  Calculates partial affine transformation matrix $M \in \mathbb{R}^{2 \times 3}$ minimizing landmark displacement:
  $$M^* = \arg\min_M \sum_{i=1}^{5} \| M \cdot [x_i, y_i, 1]^T - x_i^{\text{ref}} \|_2^2$$
  Applies bilinear interpolation warping to output standard $112 \times 112$ canonical face.

---

## 3. Deep Feature Extractor: ArcFace (Additive Angular Margin)
- **Model Backbone**: MobileFaceNet / ResNet50 (`w600k_mbf.onnx`)
- **Training Dataset**: MS1MV2 (3.9M images, 85,742 identities)
- **Output Feature Dimension**: 512 continuous float values ($512 \times 4 = 2,048$ bytes)
- **Loss Function**: ArcFace Angular Margin Loss:
  $$\mathcal{L} = -\log \frac{e^{s \cos(\theta_{y_i} + m)}}{e^{s \cos(\theta_{y_i} + m)} + \sum_{j \neq y_i} e^{s \cos \theta_j}}$$
  - Scale factor $s = 64$
  - Additive angular margin $m = 0.50$ radians ($\approx 28.6^\circ$)

### Why ArcFace?
Unlike traditional softmax loss or triplet loss, ArcFace directly optimizes the angular margin on a normalized hypersphere. This enforces intra-class compactness and inter-class discrepancy, producing feature vectors where Euclidean dot product equals cosine distance.
