import cv2
import numpy as np
from PIL import Image

def handwriting_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Blue pen ink in notebook photos usually lives in this hue range.
    hsv_blue = cv2.inRange(hsv, np.array([80, 10, 20]), np.array([170, 255, 240]))
    blue_dominant = (
        (b.astype(np.int16) > r.astype(np.int16) + 8)
        & (b.astype(np.int16) > g.astype(np.int16) - 4)
        & (gray < 225)
    ).astype(np.uint8) * 255

    mask = cv2.bitwise_and(hsv_blue, blue_dominant)
    mask = cv2.medianBlur(mask, 3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(40, image.shape[1] // 12), 1))
    ruled_lines = cv2.morphologyEx(mask, cv2.MORPH_OPEN, horizontal_kernel)
    mask = cv2.subtract(mask, ruled_lines)
    return mask


def crop_to_ink(image: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0 or len(ys) == 0:
        return image, mask

    h, w = image.shape[:2]
    x1 = max(int(xs.min()) - 30, 0)
    x2 = min(int(xs.max()) + 30, w)
    y1 = max(int(ys.min()) - 30, 0)
    y2 = min(int(ys.max()) + 30, h)
    return image[y1:y2, x1:x2], mask[y1:y2, x1:x2]


def detect_handwriting_lines(image: np.ndarray) -> list[np.ndarray]:
    mask = handwriting_mask(image)
    image, mask = crop_to_ink(image, mask)
    h, w = mask.shape[:2]
    if h == 0 or w == 0:
        return []

    row_counts = (mask > 0).sum(axis=1)
    active = row_counts > max(20, int(w * 0.055))

    raw_bands = []
    start = None
    for y, is_active in enumerate(active):
        if is_active and start is None:
            start = y
        elif not is_active and start is not None:
            raw_bands.append((start, y))
            start = None
    if start is not None:
        raw_bands.append((start, h))

    merged = []
    for y1, y2 in raw_bands:
        if not merged or y1 - merged[-1][1] > 8:
            merged.append([y1, y2])
        else:
            merged[-1][1] = y2

    lines = []
    for y1, y2 in merged:
        if y2 - y1 < 8:
            continue
        band = mask[y1:y2, :]
        cols = np.where((band > 0).sum(axis=0) > 0)[0]
        if len(cols) == 0:
            continue

        x1 = max(int(cols.min()) - 18, 0)
        x2 = min(int(cols.max()) + 18, w)
        yy1 = max(y1 - 10, 0)
        yy2 = min(y2 + 10, h)
        if x2 - x1 < 35:
            continue
        lines.append(image[yy1:yy2, x1:x2])

    return lines


def split_lines_by_question(lines: list[np.ndarray], num_questions: int) -> list[list[np.ndarray]]:
    if not lines:
        return [[] for _ in range(num_questions)]
    if num_questions <= 1:
        return [lines]

    heights = [line.shape[0] for line in lines]
    # Without original y-coordinates, use roughly even grouping as fallback.
    group_size = max(1, int(np.ceil(len(lines) / num_questions)))
    groups = [lines[i * group_size:(i + 1) * group_size] for i in range(num_questions)]
    while len(groups) < num_questions:
        groups.append([])
    return groups[:num_questions]


def detect_line_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    mask = handwriting_mask(image)
    image, mask = crop_to_ink(image, mask)
    h, w = mask.shape[:2]
    if h == 0 or w == 0:
        return []

    row_counts = (mask > 0).sum(axis=1)
    active = row_counts > max(20, int(w * 0.055))
    bands = []
    start = None
    for y, is_active in enumerate(active):
        if is_active and start is None:
            start = y
        elif not is_active and start is not None:
            bands.append((start, y))
            start = None
    if start is not None:
        bands.append((start, h))

    merged = []
    for y1, y2 in bands:
        if not merged or y1 - merged[-1][1] > 8:
            merged.append([y1, y2])
        else:
            merged[-1][1] = y2

    boxes = []
    for y1, y2 in merged:
        if y2 - y1 < 8:
            continue
        band = mask[y1:y2, :]
        cols = np.where((band > 0).sum(axis=0) > 0)[0]
        if len(cols) == 0:
            continue
        x1 = max(int(cols.min()) - 18, 0)
        x2 = min(int(cols.max()) + 18, w)
        yy1 = max(y1 - 10, 0)
        yy2 = min(y2 + 10, h)
        if x2 - x1 >= 35:
            box_h = yy2 - yy1
            if box_h > 72:
                line_count = max(2, int(round(box_h / 44)))
                step = box_h / line_count
                for i in range(line_count):
                    sub_y1 = max(int(yy1 + i * step) - 4, 0)
                    sub_y2 = min(int(yy1 + (i + 1) * step) + 4, h)
                    if sub_y2 - sub_y1 >= 18:
                        boxes.append((x1, sub_y1, x2, sub_y2))
            else:
                boxes.append((x1, yy1, x2, yy2))
    return boxes


def group_line_boxes_by_question(boxes: list[tuple[int, int, int, int]], num_questions: int) -> list[list[tuple[int, int, int, int]]]:
    if not boxes:
        return [[] for _ in range(num_questions)]
    boxes = sorted(boxes, key=lambda b: b[1])
    if num_questions <= 1:
        return [boxes]

    gaps = []
    for i in range(len(boxes) - 1):
        gaps.append((boxes[i + 1][1] - boxes[i][3], i))

    split_after = sorted(
        [idx for gap, idx in sorted(gaps, reverse=True)[:num_questions - 1]]
    )

    groups = []
    start = 0
    for idx in split_after:
        groups.append(boxes[start:idx + 1])
        start = idx + 1
    groups.append(boxes[start:])

    while len(groups) < num_questions:
        groups.append([])
    return groups[:num_questions]


def crop_line_from_box(image: np.ndarray, box: tuple[int, int, int, int]) -> Image.Image:
    mask = handwriting_mask(image)
    cropped_image, _ = crop_to_ink(image, mask)
    x1, y1, x2, y2 = box
    line = cropped_image[y1:y2, x1:x2]
    rgb = cv2.cvtColor(line, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb).convert("RGB")
    if pil.height < 64:
        scale = 64 / max(pil.height, 1)
        pil = pil.resize((max(1, int(pil.width * scale)), 64), Image.Resampling.BICUBIC)
    return pil
