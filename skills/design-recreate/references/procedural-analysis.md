# Procedural Analysis (D1.14-D1.18)

> PROCEDURAL/패턴 요소 감지 시 조건부 실행되는 고급 분석 모듈. design-recreate Phase 3 의 조건부 단계.
> 결과는 Layer-by-Layer 빌드의 L1-B(CSS/SVG/Canvas) 파라미터가 된다 — [layer-build.md](layer-build.md).
>
> **실행 조건**: D1.3 Element Classification에서 `PROCEDURAL` 타입 요소가 1개 이상 감지된 경우에만 실행.
> 순수 사진/텍스트만 있는 디자인에서는 불필요.

---

## 실행 전제 조건

```
IF D1.3.elements.filter(e => e.type === 'PROCEDURAL').length > 0:
    RUN D1.14 → D1.15 → D1.16 → D1.17 → D1.18
ELSE:
    SKIP (D1.13 교차검증으로 바로 진행)
```

**환경 요구사항:**
- ImageMagick 7.x (`magick` CLI)
- Python 3.x + `pip3 install --user numpy Pillow scipy` (D1.14, D1.17 필요)
- ImageMagick에 FFTW 미포함 → FFT는 Python numpy로 대체

---

## D1.14 Frequency Domain Pattern Analysis

반복 패턴(halftone dots, grid lines, stripes, moiré)의 **정확한 주기**를 측정한다.

### 왜 필요한가?

Vision 모델은 "점들이 반복된다"고 말할 수 있지만 **정확한 간격(px)**을 알려주지 못한다.
간격이 1px만 틀려도 50개 반복이면 50px 누적 오차 → 패턴이 어긋난다.

### 방법 A: ImageMagick NCC 기반 자기상관 (FFTW 불필요)

```bash
# Step 1: 패턴 영역 크롭 (D1.3.1 좌표 사용)
magick reference.jpg -crop 400x400+100+200 +repage pattern-area.png

# Step 2: 수평 방향 자기상관 (shift 1~50px)
for shift in $(seq 1 50); do
  score=$(magick pattern-area.png \
    \( +clone -roll +${shift}+0 \) \
    -metric NCC -compare -format "%[distortion]" info: 2>&1)
  echo "${shift} ${score}"
done > /tmp/h-autocorrelation.txt

# Step 3: 수직 방향 자기상관
for shift in $(seq 1 50); do
  score=$(magick pattern-area.png \
    \( +clone -roll +0+${shift} \) \
    -metric NCC -compare -format "%[distortion]" info: 2>&1)
  echo "${shift} ${score}"
done > /tmp/v-autocorrelation.txt

# Step 4: 피크 찾기 (NCC가 가장 높은 shift = 패턴 주기)
sort -k2 -rn /tmp/h-autocorrelation.txt | head -5
sort -k2 -rn /tmp/v-autocorrelation.txt | head -5
```

**해석:**
- NCC > 0.90: 강한 반복 (규칙적 그리드/도트)
- NCC 0.70-0.90: 중간 반복 (준규칙적 패턴)
- NCC < 0.70: 약한 반복 (불규칙 패턴)
- 피크 shift 값 = 패턴 주기(px)

### 방법 B: Python FFT (더 정밀, scipy 필요)

```python
#!/usr/bin/env python3
"""pattern_frequency.py - FFT 기반 패턴 주기 분석"""
import numpy as np
from PIL import Image
from scipy.signal import find_peaks

def analyze_pattern_frequency(image_path, crop_box=None):
    img = Image.open(image_path).convert('L')
    if crop_box:
        img = img.crop(crop_box)
    arr = np.array(img, dtype=float)

    results = {}

    # 수평 주기 분석
    h_profile = np.mean(arr, axis=0)  # 열 평균 → 수평 프로파일
    h_profile -= np.mean(h_profile)
    h_fft = np.abs(np.fft.rfft(h_profile))
    h_freqs = np.fft.rfftfreq(len(h_profile))

    # DC 성분 제외 후 피크 찾기
    h_peaks, h_props = find_peaks(h_fft[1:], height=np.max(h_fft[1:])*0.3, distance=3)
    h_peaks += 1  # DC 오프셋 보정

    if len(h_peaks) > 0:
        dominant_h = h_peaks[np.argmax(h_props['peak_heights'])]
        results['horizontal'] = {
            'period_px': round(1.0 / h_freqs[dominant_h], 1),
            'frequency': float(h_freqs[dominant_h]),
            'strength': float(h_fft[dominant_h] / np.mean(h_fft[1:])),
            'all_periods': [round(1.0/h_freqs[p], 1) for p in h_peaks[:5]]
        }

    # 수직 주기 분석
    v_profile = np.mean(arr, axis=1)
    v_profile -= np.mean(v_profile)
    v_fft = np.abs(np.fft.rfft(v_profile))
    v_freqs = np.fft.rfftfreq(len(v_profile))

    v_peaks, v_props = find_peaks(v_fft[1:], height=np.max(v_fft[1:])*0.3, distance=3)
    v_peaks += 1

    if len(v_peaks) > 0:
        dominant_v = v_peaks[np.argmax(v_props['peak_heights'])]
        results['vertical'] = {
            'period_px': round(1.0 / v_freqs[dominant_v], 1),
            'frequency': float(v_freqs[dominant_v]),
            'strength': float(v_fft[dominant_v] / np.mean(v_fft[1:])),
            'all_periods': [round(1.0/v_freqs[p], 1) for p in v_peaks[:5]]
        }

    # 패턴 유형 분류
    h_period = results.get('horizontal', {}).get('period_px', 0)
    v_period = results.get('vertical', {}).get('period_px', 0)

    if h_period > 0 and v_period > 0:
        ratio = h_period / v_period if v_period > 0 else 0
        if 0.85 < ratio < 1.15:
            results['pattern_type'] = 'square_grid'
        else:
            results['pattern_type'] = 'rectangular_grid'
    elif h_period > 0:
        results['pattern_type'] = 'vertical_stripes'
    elif v_period > 0:
        results['pattern_type'] = 'horizontal_stripes'
    else:
        results['pattern_type'] = 'irregular'

    return results

if __name__ == '__main__':
    import sys, json
    result = analyze_pattern_frequency(sys.argv[1])
    print(json.dumps(result, indent=2))
```

```bash
# 실행
python3 pattern_frequency.py pattern-area.png
```

### 출력 형식

```json
{
  "horizontal": {
    "period_px": 24.3,
    "frequency": 0.0412,
    "strength": 8.7,
    "all_periods": [24.3, 12.1, 48.6]
  },
  "vertical": {
    "period_px": 24.1,
    "frequency": 0.0415,
    "strength": 9.2,
    "all_periods": [24.1, 12.0, 48.2]
  },
  "pattern_type": "square_grid"
}
```

### 신뢰도 판정

| strength | 해석 | 후속 조치 |
|----------|------|----------|
| > 8.0 | 매우 강한 주기 | period_px를 그대로 사용 |
| 4.0-8.0 | 중간 주기 | ImageMagick NCC로 교차 검증 |
| < 4.0 | 약한/불확실 | D1.15 connected components로 대체 |

---

## D1.15 Primitive Decomposition

이미지 내 **개별 도형(원, 사각형, 선)**을 식별하고 정량적 속성을 추출한다.

### 왜 필요한가?

Vision 모델은 "동그란 점들이 있다"고 말하지만, **몇 개**인지, **각각의 정확한 크기와 위치**는 알려주지 않는다.
CSS/SVG로 재현하려면 각 도형의 좌표·크기·색상이 필요하다.

### Step 1: 전경/배경 분리

```bash
# 배경색 확인 (D1.0에서 이미 확보)
BG_HEX="EAE7DA"

# Threshold로 전경 마스크 생성
magick pattern-area.png -colorspace Gray -threshold 50% mask.pgm

# 반전이 필요할 수 있음 (배경이 밝으면 그대로, 어두우면 -negate)
# 밝은 배경 + 어두운 도형: threshold 후 -negate
magick pattern-area.png -colorspace Gray -threshold 50% -negate mask.pgm
```

### Step 2: Connected Components 분석

```bash
# Connected Components로 개별 blob 식별
magick mask.pgm -connected-components 8 \
  -define connected-components:verbose=true \
  -define connected-components:area-threshold=10 \
  null: 2>&1 | tee /tmp/components.txt

# 출력 형식 (각 줄):
# id: geometry centroid area [mean-color]
# 예: 42: 18x16+234+156 243.2,163.8 228 gray(0)
```

### Step 3: 형상 분류

```bash
# 각 컴포넌트의 bounding box에서 형상 추정
# - 원: width ≈ height, area ≈ π(w/2)²
# - 사각형: width ≈ height (정사각형) 또는 width ≠ height (직사각형), area ≈ w*h
# - 선: width >> height 또는 height >> width, area ≈ w (얇은 선)
```

```python
#!/usr/bin/env python3
"""primitive_census.py - Connected Components 기반 도형 분류"""
import re, sys, json, math

def parse_components(text):
    """ImageMagick connected-components 출력 파싱"""
    primitives = []
    for line in text.strip().split('\n'):
        # 패턴: "  42: 18x16+234+156 243.2,163.8 228 gray(0)"
        m = re.match(r'\s*(\d+):\s+(\d+)x(\d+)\+(\d+)\+(\d+)\s+([\d.]+),([\d.]+)\s+(\d+)', line)
        if not m:
            continue

        cid = int(m.group(1))
        w, h = int(m.group(2)), int(m.group(3))
        x, y = int(m.group(4)), int(m.group(5))
        cx, cy = float(m.group(6)), float(m.group(7))
        area = int(m.group(8))

        if area < 10:  # 노이즈 필터링
            continue

        # 형상 분류
        aspect_ratio = w / h if h > 0 else 999
        bbox_area = w * h
        fill_ratio = area / bbox_area if bbox_area > 0 else 0
        circularity = (4 * math.pi * area) / ((2*(w+h))**2) if (w+h) > 0 else 0

        if 0.7 < aspect_ratio < 1.3 and fill_ratio > 0.65:
            shape = 'circle' if circularity > 0.6 else 'square'
        elif aspect_ratio > 3 or aspect_ratio < 0.33:
            shape = 'line'
        elif fill_ratio > 0.8:
            shape = 'rectangle'
        else:
            shape = 'irregular'

        primitives.append({
            'id': cid,
            'shape': shape,
            'x': x, 'y': y, 'width': w, 'height': h,
            'centroid': [round(cx, 1), round(cy, 1)],
            'area': area,
            'aspect_ratio': round(aspect_ratio, 2),
            'fill_ratio': round(fill_ratio, 2),
            'radius': round((w + h) / 4, 1) if shape == 'circle' else None
        })

    return primitives

def census(primitives):
    """도형 유형별 통계"""
    from collections import Counter
    shapes = Counter(p['shape'] for p in primitives)

    result = {
        'total_count': len(primitives),
        'shape_counts': dict(shapes),
        'by_shape': {}
    }

    for shape in shapes:
        subset = [p for p in primitives if p['shape'] == shape]
        sizes = [p['area'] for p in subset]
        result['by_shape'][shape] = {
            'count': len(subset),
            'size_min': min(sizes),
            'size_max': max(sizes),
            'size_mean': round(sum(sizes)/len(sizes), 1),
            'size_std': round((sum((s - sum(sizes)/len(sizes))**2 for s in sizes) / len(sizes))**0.5, 1)
        }
        if shape == 'circle':
            radii = [p['radius'] for p in subset if p['radius']]
            result['by_shape'][shape]['radius_min'] = min(radii)
            result['by_shape'][shape]['radius_max'] = max(radii)
            result['by_shape'][shape]['radius_mean'] = round(sum(radii)/len(radii), 1)

    return result

if __name__ == '__main__':
    text = sys.stdin.read()
    prims = parse_components(text)
    stats = census(prims)
    print(json.dumps({'primitives': prims, 'census': stats}, indent=2))
```

```bash
# 실행
magick mask.pgm -connected-components 8 \
  -define connected-components:verbose=true \
  -define connected-components:area-threshold=10 \
  null: 2>&1 | python3 primitive_census.py > /tmp/primitives.json
```

### Step 4: 전경/배경 색상 추출

```bash
# 전경 도형 색상 (마스크 사용)
magick pattern-area.png mask.pgm -compose Multiply -composite \
  -colors 3 -define histogram:unique-colors=true -format "%c" histogram:info:

# 배경 색상 (마스크 반전 사용)
magick pattern-area.png \( mask.pgm -negate \) -compose Multiply -composite \
  -colors 3 -define histogram:unique-colors=true -format "%c" histogram:info:
```

### 출력 형식

```json
{
  "census": {
    "total_count": 847,
    "shape_counts": { "circle": 812, "irregular": 35 },
    "by_shape": {
      "circle": {
        "count": 812,
        "radius_min": 1.5,
        "radius_max": 8.2,
        "radius_mean": 4.1,
        "size_std": 6.3
      }
    }
  },
  "colors": {
    "foreground": "#2A2420",
    "background": "#EAE7DA"
  }
}
```

---

## D1.16 Opacity & Stacking Analysis

반투명 요소의 **실제 opacity 값**과 **z-order(쌓기 순서)**를 역산한다.

### 왜 필요한가?

Vision 모델은 "반투명한 오버레이가 있다"고 말하지만 **opacity가 0.3인지 0.7인지** 구분하지 못한다.
CSS에서 `opacity: 0.3`과 `opacity: 0.7`은 완전히 다른 결과.

### Alpha Compositing 역산 공식

```
관찰된 색상(C_result)이 주어졌을 때:
C_result = alpha * C_fg + (1 - alpha) * C_bg

→ alpha = (C_result - C_bg) / (C_fg - C_bg)

조건: C_fg ≠ C_bg (전경과 배경이 같으면 계산 불가)
```

### 실행 방법

```bash
# Step 1: 배경색 확보 (오버레이가 없는 영역에서)
BG_R=$(magick reference.jpg -format "%[fx:p{50,50}.r*255]" info:)
BG_G=$(magick reference.jpg -format "%[fx:p{50,50}.g*255]" info:)
BG_B=$(magick reference.jpg -format "%[fx:p{50,50}.b*255]" info:)

# Step 2: 오버레이 영역의 관찰 색상
OV_R=$(magick reference.jpg -format "%[fx:p{500,300}.r*255]" info:)
OV_G=$(magick reference.jpg -format "%[fx:p{500,300}.g*255]" info:)
OV_B=$(magick reference.jpg -format "%[fx:p{500,300}.b*255]" info:)

# Step 3: 전경색 추정 (오버레이가 100%인 영역에서, 또는 가장 진한 곳)
FG_R=$(magick reference.jpg -format "%[fx:p{500,800}.r*255]" info:)
FG_G=$(magick reference.jpg -format "%[fx:p{500,800}.g*255]" info:)
FG_B=$(magick reference.jpg -format "%[fx:p{500,800}.b*255]" info:)

# Step 4: Alpha 계산 (각 채널별)
python3 -c "
bg = ($BG_R, $BG_G, $BG_B)
ov = ($OV_R, $OV_G, $OV_B)
fg = ($FG_R, $FG_G, $FG_B)
alphas = []
for i in range(3):
    if abs(fg[i] - bg[i]) > 10:
        a = (ov[i] - bg[i]) / (fg[i] - bg[i])
        alphas.append(max(0, min(1, a)))
if alphas:
    avg = sum(alphas) / len(alphas)
    print(f'Alpha: {avg:.2f} (channels: {[round(a,2) for a in alphas]})')
else:
    print('Cannot determine alpha (fg ≈ bg)')
"
```

### Z-Order 추론

```
오버랩 영역에서 위/아래 판별:
1. 요소 A의 경계에서 색상 전환이 sharp → A가 위에 있음
2. 요소 B의 경계에서 색상이 A의 색으로 부드럽게 변함 → B가 아래
3. 경계선 1px 프로파일로 판별:
   magick reference.jpg -crop 1x100+overlap_x+overlap_y +repage txt: | head -20
```

### 출력 형식

```json
{
  "overlays": [
    {
      "id": "dark-gradient-overlay",
      "foreground_color": "#0A0A1A",
      "observed_color": "#6B6860",
      "background_color": "#EAE7DA",
      "computed_alpha": 0.58,
      "channel_alphas": [0.57, 0.58, 0.59],
      "css": "background: rgba(10, 10, 26, 0.58)"
    }
  ],
  "z_order": ["L0-background", "L1-photo", "L4-gradient-overlay", "L5-text"]
}
```

### 신뢰도 판정

| 채널 간 alpha 편차 | 해석 |
|-------------------|------|
| < 0.03 | 높은 신뢰도 (순수 opacity) |
| 0.03-0.10 | 중간 (blend mode 가능성) |
| > 0.10 | 낮음 (blend mode 또는 gradient overlay) |

---

## D1.17 Distribution Function Extraction

패턴 내 요소의 **크기/밀도 분포 함수**를 수학적으로 추출한다.

### 왜 필요한가?

Halftone dot 크기가 중앙에서 크고 가장자리에서 작아지는 패턴을 재현하려면,
"대충 그라데이션" 이 아니라 **정확한 분포 함수 파라미터**가 필요하다.
(예: Gaussian ring - amplitude, center_radius, sigma, baseline)

### Step 1: D1.15 데이터에서 위치-크기 매핑

```python
#!/usr/bin/env python3
"""distribution_fit.py - 패턴 분포 함수 추출"""
import numpy as np
from scipy.optimize import curve_fit
import json, sys

def load_primitives(json_path):
    with open(json_path) as f:
        data = json.load(f)
    return data['primitives']

def fit_radial_distribution(primitives, center=None):
    """원형 대칭 분포 피팅 (halftone ring 패턴)"""
    if not center:
        xs = [p['centroid'][0] for p in primitives]
        ys = [p['centroid'][1] for p in primitives]
        center = (np.mean(xs), np.mean(ys))

    # 각 도형의 중심으로부터의 거리와 크기
    distances = []
    sizes = []
    for p in primitives:
        d = np.sqrt((p['centroid'][0] - center[0])**2 +
                     (p['centroid'][1] - center[1])**2)
        distances.append(d)
        sizes.append(p.get('radius', np.sqrt(p['area']/np.pi)))

    distances = np.array(distances)
    sizes = np.array(sizes)

    # Gaussian ring 모델: size(r) = A * exp(-(r-mu)^2 / (2*sigma^2)) + baseline
    def gaussian_ring(r, A, mu, sigma, baseline):
        return A * np.exp(-(r - mu)**2 / (2 * sigma**2)) + baseline

    # Linear decay 모델: size(r) = max_size - slope * r
    def linear_decay(r, max_size, slope):
        return np.maximum(max_size - slope * r, 0)

    # Inverse square 모델: size(r) = A / (r^2 + c) + baseline
    def inverse_square(r, A, c, baseline):
        return A / (r**2 + c) + baseline

    results = {}

    # 각 모델 피팅 시도
    models = {
        'gaussian_ring': (gaussian_ring, [max(sizes), np.median(distances), 50, min(sizes)]),
        'linear_decay': (linear_decay, [max(sizes), 0.01]),
        'inverse_square': (inverse_square, [max(sizes)*100, 100, min(sizes)])
    }

    for name, (func, p0) in models.items():
        try:
            popt, pcov = curve_fit(func, distances, sizes, p0=p0, maxfev=5000)
            predicted = func(distances, *popt)
            residuals = sizes - predicted
            ss_res = np.sum(residuals**2)
            ss_tot = np.sum((sizes - np.mean(sizes))**2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

            results[name] = {
                'params': {k: round(float(v), 4) for k, v in zip(
                    func.__code__.co_varnames[1:len(popt)+1], popt)},
                'r_squared': round(float(r_squared), 4),
                'rmse': round(float(np.sqrt(np.mean(residuals**2))), 4)
            }
        except Exception as e:
            results[name] = {'error': str(e)}

    # 최적 모델 선택
    valid = {k: v for k, v in results.items() if 'r_squared' in v}
    if valid:
        best = max(valid, key=lambda k: valid[k]['r_squared'])
        results['best_model'] = best
        results['best_r_squared'] = valid[best]['r_squared']

    return {
        'center': [round(center[0], 1), round(center[1], 1)],
        'distance_range': [round(float(min(distances)), 1), round(float(max(distances)), 1)],
        'size_range': [round(float(min(sizes)), 1), round(float(max(sizes)), 1)],
        'models': results
    }

def fit_linear_gradient(primitives, axis='x'):
    """선형 그라데이션 분포 (한쪽에서 다른 쪽으로 크기 변화)"""
    positions = [p['centroid'][0 if axis == 'x' else 1] for p in primitives]
    sizes = [p.get('radius', np.sqrt(p['area']/np.pi)) for p in primitives]

    positions = np.array(positions)
    sizes = np.array(sizes)

    # 선형 피팅
    coeffs = np.polyfit(positions, sizes, 1)
    predicted = np.polyval(coeffs, positions)
    ss_res = np.sum((sizes - predicted)**2)
    ss_tot = np.sum((sizes - np.mean(sizes))**2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    return {
        'axis': axis,
        'slope': round(float(coeffs[0]), 6),
        'intercept': round(float(coeffs[1]), 2),
        'r_squared': round(float(r_squared), 4),
        'direction': 'increasing' if coeffs[0] > 0 else 'decreasing'
    }

if __name__ == '__main__':
    prims = load_primitives(sys.argv[1])
    circles = [p for p in prims if p['shape'] == 'circle']

    if len(circles) > 10:
        radial = fit_radial_distribution(circles)
        linear_x = fit_linear_gradient(circles, 'x')
        linear_y = fit_linear_gradient(circles, 'y')

        output = {
            'radial_distribution': radial,
            'linear_x': linear_x,
            'linear_y': linear_y,
            'recommendation': 'radial' if radial.get('best_r_squared', 0) > max(
                linear_x['r_squared'], linear_y['r_squared']) else 'linear'
        }
        print(json.dumps(output, indent=2))
    else:
        print(json.dumps({'error': 'Not enough circles for distribution fitting', 'count': len(circles)}))
```

```bash
# 실행
python3 distribution_fit.py /tmp/primitives.json
```

### 출력 형식

```json
{
  "radial_distribution": {
    "center": [400.0, 300.0],
    "models": {
      "gaussian_ring": {
        "params": { "A": 6.2, "mu": 120.5, "sigma": 45.3, "baseline": 1.8 },
        "r_squared": 0.89,
        "rmse": 0.82
      },
      "best_model": "gaussian_ring",
      "best_r_squared": 0.89
    }
  },
  "recommendation": "radial"
}
```

### CSS/JS 구현 매핑

| 분포 모델 | JS 구현 |
|-----------|---------|
| gaussian_ring | `radius = A * Math.exp(-(dist-mu)**2 / (2*sigma**2)) + baseline` |
| linear_decay | `radius = Math.max(maxSize - slope * dist, 0)` |
| inverse_square | `radius = A / (dist**2 + c) + baseline` |

---

## D1.18 Micro-Region Systematic Sampling

5개소 스팟 체크 대신 **NxN 그리드 기반 체계적 색상 샘플링**으로 전체 이미지의 색상 분포를 정밀 매핑한다.

### 왜 필요한가?

D1.0의 5개소 샘플링은 배경이 단색일 때는 충분하지만,
그라데이션·다색 영역·미세 색상 변화가 있으면 놓친다.
NxN 그리드로 체계적으로 샘플링하면 색상 맵을 완전히 재구성할 수 있다.

### Step 1: Grid Sampling

```bash
# 10x10 그리드 (100개 샘플) — 배경 분석용
IMG_W=$(magick identify -format "%w" reference.jpg)
IMG_H=$(magick identify -format "%h" reference.jpg)
GRID_N=10

for row in $(seq 0 $((GRID_N-1))); do
  for col in $(seq 0 $((GRID_N-1))); do
    x=$(( (col * IMG_W / GRID_N) + (IMG_W / GRID_N / 2) ))
    y=$(( (row * IMG_H / GRID_N) + (IMG_H / GRID_N / 2) ))
    hex=$(magick reference.jpg -format "%[hex:p{${x},${y}}]" info:)
    echo "${row},${col},${x},${y},#${hex}"
  done
done > /tmp/grid-samples.csv
```

### Step 2: Area-Averaged Sampling (노이즈 감소)

```bash
# 단일 픽셀 대신 10x10 영역 평균 → 노이즈에 강건
for row in $(seq 0 $((GRID_N-1))); do
  for col in $(seq 0 $((GRID_N-1))); do
    x=$(( (col * IMG_W / GRID_N) + (IMG_W / GRID_N / 2) - 5 ))
    y=$(( (row * IMG_H / GRID_N) + (IMG_H / GRID_N / 2) - 5 ))
    hex=$(magick reference.jpg -crop 10x10+${x}+${y} +repage \
      -scale 1x1! -format "%[hex:p{0,0}]" info:)
    echo "${row},${col},${x},${y},#${hex}"
  done
done > /tmp/grid-averaged.csv
```

### Step 3: 통계 분석

```python
#!/usr/bin/env python3
"""grid_analysis.py - 그리드 샘플링 통계 분석"""
import csv, sys, json
from collections import Counter

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def rgb_distance(c1, c2):
    return sum((a-b)**2 for a,b in zip(c1,c2))**0.5

def analyze_grid(csv_path):
    samples = []
    with open(csv_path) as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) >= 5:
                samples.append({
                    'row': int(parts[0]), 'col': int(parts[1]),
                    'x': int(parts[2]), 'y': int(parts[3]),
                    'hex': parts[4], 'rgb': hex_to_rgb(parts[4])
                })

    if not samples:
        return {'error': 'No samples'}

    # 전체 통계
    rgbs = [s['rgb'] for s in samples]
    r_vals = [c[0] for c in rgbs]
    g_vals = [c[1] for c in rgbs]
    b_vals = [c[2] for c in rgbs]

    mean_rgb = (round(sum(r_vals)/len(r_vals)),
                round(sum(g_vals)/len(g_vals)),
                round(sum(b_vals)/len(b_vals)))

    # 색상 클러스터링 (단순 버전: 거리 기반)
    clusters = []
    for s in samples:
        placed = False
        for c in clusters:
            if rgb_distance(s['rgb'], c['center']) < 30:
                c['members'].append(s)
                # 중심 업데이트
                members = c['members']
                c['center'] = tuple(round(sum(m['rgb'][i] for m in members)/len(members))
                                   for i in range(3))
                placed = True
                break
        if not placed:
            clusters.append({'center': s['rgb'], 'members': [s]})

    # 가장 큰 클러스터 = 배경
    clusters.sort(key=lambda c: len(c['members']), reverse=True)

    # 이상치 감지 (배경 클러스터에서 먼 샘플)
    bg_cluster = clusters[0] if clusters else None
    anomalies = []
    if bg_cluster:
        for s in samples:
            dist = rgb_distance(s['rgb'], bg_cluster['center'])
            if dist > 50:
                anomalies.append({
                    'position': [s['row'], s['col']],
                    'pixel': [s['x'], s['y']],
                    'hex': s['hex'],
                    'distance_from_bg': round(dist, 1)
                })

    # 그라데이션 감지 (행/열 방향으로 색상이 점진적 변화?)
    rows = {}
    for s in samples:
        rows.setdefault(s['row'], []).append(s)

    h_gradient = False
    v_gradient = False

    for row_samples in rows.values():
        row_samples.sort(key=lambda s: s['col'])
        if len(row_samples) >= 3:
            brightnesses = [sum(s['rgb'])/3 for s in row_samples]
            diffs = [brightnesses[i+1] - brightnesses[i] for i in range(len(brightnesses)-1)]
            if all(d > 0 for d in diffs) or all(d < 0 for d in diffs):
                h_gradient = True

    return {
        'sample_count': len(samples),
        'mean_color': '#%02X%02X%02X' % mean_rgb,
        'color_clusters': [
            {
                'hex': '#%02X%02X%02X' % c['center'],
                'count': len(c['members']),
                'percentage': round(len(c['members'])/len(samples)*100, 1)
            }
            for c in clusters[:5]
        ],
        'anomalies': anomalies[:10],
        'has_gradient': h_gradient or v_gradient,
        'gradient_direction': 'horizontal' if h_gradient else ('vertical' if v_gradient else 'none'),
        'is_uniform': len(anomalies) < len(samples) * 0.1
    }

if __name__ == '__main__':
    result = analyze_grid(sys.argv[1])
    print(json.dumps(result, indent=2))
```

```bash
python3 grid_analysis.py /tmp/grid-averaged.csv
```

### 출력 형식

```json
{
  "sample_count": 100,
  "mean_color": "#EAE7DA",
  "color_clusters": [
    { "hex": "#EAE7DA", "count": 85, "percentage": 85.0 },
    { "hex": "#2A2420", "count": 12, "percentage": 12.0 },
    { "hex": "#C5E320", "count": 3, "percentage": 3.0 }
  ],
  "anomalies": [
    { "position": [3, 5], "pixel": [500, 300], "hex": "#2A2420", "distance_from_bg": 180.5 }
  ],
  "has_gradient": false,
  "is_uniform": true
}
```

### 적응형 샘플링

```
이상치 발견 영역은 자동으로 밀도를 높여 재샘플링:

1차: 10x10 그리드 → 이상치 영역 식별
2차: 이상치 영역만 20x20 서브그리드로 정밀 샘플링
3차: 경계선 영역 1px 간격 프로파일링
```

---

## D1.14-D1.18 Quality Gates

각 모듈 실행 후 신뢰도를 평가하고 후속 조치를 결정한다.

```
모듈별 신뢰도 평가:

| 모듈 | 신뢰도 지표 | 높음 (>0.8) | 중간 (0.5-0.8) | 낮음 (<0.5) |
|------|-----------|------------|---------------|------------|
| D1.14 | FFT strength | period 확정 | NCC 교차 검증 | D1.15로 대체 |
| D1.15 | fill_ratio 일관성 | 도형 확정 | Vision 보완 | 수동 분석 |
| D1.16 | 채널 간 alpha 편차 | opacity 확정 | blend mode 조사 | Vision 추정 사용 |
| D1.17 | R² 값 | 함수 확정 | 2차 모델 시도 | 이산 값 사용 |
| D1.18 | 클러스터 순도 | 색상 맵 확정 | 서브그리드 확장 | Vision 보완 |
```

---

## 전체 D1 실행 DAG (v2.9.0)

```
D1.0 (ImageMagick 메타/색상)
  ↓
D1.1~D1.3 (Vision 구조 분석) ←── 병렬 실행 가능
  ↓
D1.3.1 (Bounding Box 좌표)
  ↓
D1.3.2 (Region Crop 분석)
  ↓
D1.5~D1.9 (Typography, Shape, Text) ←── 병렬 실행 가능
  ↓
D1.10 (Pixel Color)
  ↓
D1.11~D1.12 (Annotation, Texture)
  ↓
[조건부] D1.3에서 PROCEDURAL 감지 시:
  D1.14 (Frequency Analysis)
    ↓
  D1.15 (Primitive Decomposition)
    ↓
  D1.16 (Opacity Analysis)
    ↓
  D1.17 (Distribution Fitting)
    ↓
  D1.18 (Grid Sampling)
  ↓
D1.13 (Cross-Validation) ←── 항상 마지막
```
