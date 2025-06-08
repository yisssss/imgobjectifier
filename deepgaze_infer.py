import cv2
import os
import numpy as np
from deepgaze.saliency_map import FasaSaliencyMapping
import math

def run_deepgaze(image_path, save_folder):
    image = cv2.imread(image_path)

    # --- [1] 이미지 크기 리사이즈: 가로 1200px 기준 ---
    target_width = 1200
    h, w = image.shape[:2]
    scale_ratio = target_width / w
    new_height = int(h * scale_ratio)
    image = cv2.resize(image, (target_width, new_height))
    height, width = image.shape[:2]

    # --- [2] Saliency Map 계산 ---
    fasa = FasaSaliencyMapping(height, width)
    mask = fasa.returnMask(image, tot_bins=8, format='BGR2LAB')
    mask = cv2.GaussianBlur(mask, (3, 3), 1)

    # --- [3] 정규화: 0~255 → uint8 ---
    norm_mask = cv2.normalize(mask, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)


    # --- [4] 기능별 결과 이미지 생성 ---
    generate_viewpoint_overlay(image, norm_mask, save_folder, image_path)
    generate_centerline_overlay(image, save_folder, image_path)
    generate_focusmask_overlay(image, norm_mask, save_folder, image_path)
    generate_saliency_overlay(norm_mask, save_folder, image_path)
    generate_shape_overlay(image, save_folder, image_path)


    return True  # ✅ 결과 경로는 반환하지 않음


def generate_saliency_overlay(norm_mask, save_folder, image_path):
    color = cv2.merge([norm_mask] * 3)

    # 밝기 낮은 부분은 어두운 회색 배경으로 처리
    threshold = np.percentile(norm_mask, 30)
    mask = np.where(norm_mask >= threshold, 255, 0).astype(np.uint8)

    visible = cv2.bitwise_and(color, color, mask=mask)

    # 어두운 부분을 반투명한 회색 (#000000, 70% 불투명도 → 0.3 alpha)
    bg = np.full_like(color, (0, 0, 0), dtype=np.uint8)
    transparent_bg = cv2.addWeighted(bg, 0.7, color, 0.3, 0)

    inverse_mask = cv2.bitwise_not(mask)
    background = cv2.bitwise_and(transparent_bg, transparent_bg, mask=inverse_mask)

    result = cv2.add(visible, background)
    result_bgra = cv2.cvtColor(result, cv2.COLOR_BGR2BGRA)
    result_bgra[:, :, 3] = 255  # 완전 불투명 (opacity는 시각적 처리)

    save_overlay(result_bgra, save_folder, image_path, 'saliency')

def generate_focusmask_overlay(image, norm_mask, save_folder, image_path):
    threshold = np.percentile(norm_mask, 95)
    mask = np.where(norm_mask >= threshold, 255, 0).astype(np.uint8)

    # 배경을 #282828 색상으로 설정
    dark_gray = np.full_like(image, (40, 40, 40), dtype=np.uint8)

    # focus 영역만 원본 이미지, 나머지는 배경
    masked_rgb = cv2.bitwise_and(image, image, mask=mask)
    inverse_mask = cv2.bitwise_not(mask)
    background_only = cv2.bitwise_and(dark_gray, dark_gray, mask=inverse_mask)
    result = cv2.add(masked_rgb, background_only)
    save_overlay(result, save_folder, image_path, 'focusmask')

def generate_centerline_overlay(image, save_folder, image_path):
    overlay = draw_dominant_directions_with_arrows(image.copy())  # 원본 기반 검출
    alpha = np.any(overlay != 0, axis=2).astype(np.uint8) * 255
    out = cv2.cvtColor(overlay, cv2.COLOR_BGR2BGRA)
    out[:, :, 3] = alpha
    save_overlay(out, save_folder, image_path, 'centerline')


def generate_viewpoint_overlay(image, norm_mask, save_folder, image_path):
    _, binary_mask = cv2.threshold(norm_mask, 200, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = image.shape[:2]
    drawing = np.zeros((h, w, 3), dtype=np.uint8)
    boxes = [(cv2.boundingRect(c)) for c in contours]
    boxes = [(x, y, x + w_, y + h_) for (x, y, w_, h_) in boxes]
    merged_boxes = merge_all_boxes(boxes, padding=10)

    scored = []
    for (x1, y1, x2, y2) in merged_boxes:
        area = (x2 - x1) * (y2 - y1)
        if area > 600:
            roi = norm_mask[y1:y2, x1:x2]
            score = int(np.sum(roi))
            scored.append(((x1, y1, x2, y2), score))

    scored.sort(key=lambda x: x[1], reverse=True)
    centers = []
    filtered = []

    for idx, (box, _) in enumerate(scored):
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        centers.append((cx, cy))
        filtered.append((box, (cx, cy)))

        # 박스
        cv2.rectangle(drawing, (x1, y1), (x2, y2), (0, 0, 255), 3)

    ordered = order_points_by_flow(centers)

    for i in range(1, len(ordered)):
        cv2.line(drawing, ordered[i - 1], ordered[i], (0, 0, 255), 3)

    for idx, (cx, cy) in enumerate(ordered):
        label = f'p{idx+1}'
        nearest_box = min(filtered, key=lambda b: math.hypot(cx - b[1][0], cy - b[1][1]))[0]
        x1, y1, _, _ = nearest_box
        (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 1, 2)
        tx, ty = x1 + 5, y1 + th + 5
        cv2.rectangle(drawing, (tx - 2, ty - th - 2), (tx + tw + 2, ty + baseline + 2), (0, 0, 255), -1)
        cv2.putText(drawing, label, (tx, ty), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    out = cv2.cvtColor(drawing, cv2.COLOR_BGR2BGRA)
    out[:, :, 3] = np.any(drawing != 0, axis=2).astype(np.uint8) * 255
    save_overlay(out, save_folder, image_path, 'viewpoint')



def save_overlay(bgra, folder, image_path, tag):
    name = os.path.basename(image_path).rsplit('.', 1)[0]
    out_path = os.path.join(folder, f'{name}_{tag}.png')
    cv2.imwrite(out_path, bgra)

def save_transparent_overlay(image, folder, image_path, tag):
    bgra = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    alpha = np.any(image != 0, axis=2).astype(np.uint8) * 255
    bgra[:, :, 3] = alpha
    save_overlay(bgra, folder, image_path, tag)

def merge_all_boxes(boxes, padding=10):
    def boxes_overlap(b1, b2):
        x1_min, y1_min, x1_max, y1_max = b1
        x2_min, y2_min, x2_max, y2_max = b2
        return not (x1_max + padding < x2_min or x2_max + padding < x1_min or y1_max + padding < y2_min or y2_max + padding < y1_min)

    def merge_two(b1, b2):
        return (min(b1[0], b2[0]), min(b1[1], b2[1]), max(b1[2], b2[2]), max(b1[3], b2[3]))

    changed = True
    while changed:
        changed = False
        new_boxes, used = [], [False] * len(boxes)
        for i in range(len(boxes)):
            if used[i]: continue
            base = boxes[i]
            for j in range(i + 1, len(boxes)):
                if used[j]: continue
                if boxes_overlap(base, boxes[j]):
                    base = merge_two(base, boxes[j])
                    used[j] = True
                    changed = True
            used[i] = True
            new_boxes.append(base)
        boxes = new_boxes
    return boxes

def order_points_by_flow(points):
    if not points: return []
    ordered = [points[0]]
    unused = points[1:]
    while unused:
        last = ordered[-1]
        next_pt = min(unused, key=lambda p: math.hypot(p[0] - last[0], p[1] - last[1]))
        ordered.append(next_pt)
        unused.remove(next_pt)
    return ordered

def draw_dominant_directions_with_arrows(image, min_angle_diff=20, arrow_spacing=100, arrow_length=40):
    # --- edge 추출용은 그대로 BGR 이미지로
    gray_input = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.shape[2] == 3 else image
    blurred = cv2.GaussianBlur(gray_input, (5, 5), 5)
    edges = cv2.Canny(blurred, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 80, minLineLength=50, maxLineGap=10)
    if lines is None:
        return np.zeros((image.shape[0], image.shape[1], 4), dtype=np.uint8)  # 빈 BGRA 반환

    # 각도 계산
    angles = [(math.degrees(math.atan2(y2 - y1, x2 - x1)) + 180) % 180 for [[x1, y1, x2, y2]] in lines]
    hist, bins = np.histogram(angles, bins=36, range=(0, 180))
    top2_indices = np.argsort(hist)[-2:]
    top2_angles = sorted([(bins[i] + bins[i + 1]) / 2 for i in top2_indices])

    # 각도 필터링
    if len(top2_angles) >= 2:
        angle_diff = abs(top2_angles[1] - top2_angles[0])
        angle_diff = min(angle_diff, 180 - angle_diff)
        if angle_diff < min_angle_diff or angle_diff > (360 - min_angle_diff):
            top2_angles = [top2_angles[1]]

    # --- 빈 BGRA 이미지 생성
    h, w = image.shape[:2]
    out = np.zeros((h, w, 4), dtype=np.uint8)  # BGRA

    center = (w // 2, h // 2)
    length = max(w, h)

    for angle_deg in top2_angles:
        angle_rad = math.radians(angle_deg)
        dx, dy = math.cos(angle_rad), math.sin(angle_rad)

        # 전체 직선
        pt1 = (int(center[0] - dx * length), int(center[1] - dy * length))
        pt2 = (int(center[0] + dx * length), int(center[1] + dy * length))
        cv2.line(out, pt1, pt2, (255, 255, 255, 255), 3)

        # 중간 화살표
        num_arrows = int(length // arrow_spacing)
        for i in range(-num_arrows, num_arrows + 1):
            ax = int(center[0] + dx * i * arrow_spacing)
            ay = int(center[1] + dy * i * arrow_spacing)
            tx = int(ax + dx * arrow_length)
            ty = int(ay + dy * arrow_length)
            cv2.arrowedLine(out, (ax, ay), (tx, ty), (255, 255, 255, 255), 3, tipLength=0.4)

    return out  # BGRA: 배경 없음, 선만 있음


def generate_shape_overlay(image, save_folder, image_path):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 100, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # 투명 배경 이미지 생성 (4채널 BGRA)
    h, w = image.shape[:2]
    result = np.zeros((h, w, 4), dtype=np.uint8)

    for c in contours:
        area = cv2.contourArea(c)
        if area > 300:
            # 선만 그리기 (초록색 + 알파채널=255)
            cv2.drawContours(result, [c], -1, (0, 255, 0, 255), 2)

    save_transparent_overlay(result, save_folder, image_path, "shapes")


