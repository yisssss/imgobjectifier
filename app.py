from flask import Flask, request, render_template, send_from_directory
import os
from deepgaze_infer import run_deepgaze
from werkzeug.utils import secure_filename
import unicodedata
import glob

import threading
import time

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
RESULT_FOLDER = 'static/results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)
MAX_IMAGES = 5
PREFIX = "pair"  # pair0, pair1, pair2...
current_index = -1

@app.route('/')
def index():
    return render_template('index.html')

import os
from flask import request
from werkzeug.utils import secure_filename

from flask import jsonify  # 선택: JSON 응답으로 바꾸려면

@app.route('/upload', methods=['POST'])
def upload():
    global current_index  # ✅ 전역 변수로 선언

    try:
        file = request.files.get('image')
        if not file:
            return 'No file uploaded', 400

        ext = file.filename.rsplit('.', 1)[-1].lower()
        if ext not in ['png', 'jpg', 'jpeg', 'webp']:
            return 'Unsupported file format', 400


        # ✅ 순환이 아니라 고정 증가 (또는 5로 나눠도 됨)
        current_index = (current_index + 1) % 5
        filename = f"pair{current_index}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)


        # PIL로 열어서 무조건 PNG로 저장
        from PIL import Image
        image = Image.open(file.stream)
        image.save(filepath, format='PNG')

        # cv2로 재확인
        import cv2
        image_cv = cv2.imread(filepath)
        if image_cv is None:
            raise ValueError(f"[upload] cv2.imread() failed for: {filepath}")
        print("[UPLOAD] 현재 업로드 폴더 파일 목록:", os.listdir(UPLOAD_FOLDER))

        # 결과 생성
        run_deepgaze(filepath, RESULT_FOLDER)

        return filename  # 또는 return jsonify({'filename': filename})

    except Exception as e:
        import traceback
        print("[UPLOAD ERROR]", traceback.format_exc())
        return "Internal Server Error", 500  # 또는 return jsonify({'error': 'Processing failed'}), 500





@app.route('/save-result', methods=['POST'])
def save_result():
    file = request.files.get('image')
    if not file:
        return 'No image', 400
    
    filters = request.form.get('filters', '')  # 예: "saliency,viewpoint"
    filename = file.filename  # 예: pair2_result.png

    # pair2 추출
    base = filename.split("_")[0]  # "pair2"
    base_path = os.path.join('static/download_images', base)

    # 이미지 저장
    file.save(f"{base_path}_result.png")

    # 필터 정보 저장
    with open(f"{base_path}.json", "w", encoding="utf-8") as f:
        f.write(f'{{"filters": "{filters}"}}')


    return 'Saved', 200


# 한글 파일명 안전하게 정리
def safe_filename(filename):
    # 한글/특수문자 제거 → NFC 정규화 → secure_filename
    filename = unicodedata.normalize('NFC', filename)
    return secure_filename(filename)


def auto_cleanup_loop():
    while True:
        keep_latest_files('static/uploads', max_keep=5, suffix_filter=['.jpg', '.png'])
        keep_latest_files('static/results', max_keep=25, suffix_filter=['.jpg', '.png'])
        time.sleep(60)  # 60초마다 한 번 정리


def keep_latest_files(folder_path, max_keep, suffix_filter=None):
    # 모든 파일 경로 가져오기 (필터 확장자 적용 가능)
    if suffix_filter:
        files = [f for ext in suffix_filter for f in glob.glob(os.path.join(folder_path, f'*{ext}'))]
    else:
        files = glob.glob(os.path.join(folder_path, '*'))

    # 수정 시간 기준으로 정렬 (오래된 순)
    files.sort(key=os.path.getmtime)

    # 오래된 파일 삭제
    excess = len(files) - max_keep
    for i in range(excess):
        try:
            os.remove(files[i])
            print(f"삭제됨: {files[i]}")
        except Exception as e:
            print(f"파일 삭제 실패: {files[i]} → {e}")


def maintain_latest_pairs():
    # 현재 업로드된 파일 리스트 확인
    uploaded_files = sorted(
        [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(('.jpg', '.png'))],
        key=lambda f: os.path.getmtime(os.path.join(UPLOAD_FOLDER, f))
    )

    # 가장 오래된 파일 제거 + 나머지를 순차 재명명
    for i, fname in enumerate(uploaded_files[-MAX_IMAGES:]):
        base, ext = os.path.splitext(fname)

        new_name = f"pair{i}{ext}"
        os.rename(os.path.join(UPLOAD_FOLDER, fname), os.path.join(UPLOAD_FOLDER, new_name))

        # 결과 이미지도 함께 이름 맞춰주기
        for res_ext in [".png", ".jpg"]:
            res_path = os.path.join(RESULT_FOLDER, f"{base}-result{res_ext}")
            if os.path.exists(res_path):
                new_res_path = os.path.join(RESULT_FOLDER, f"pair{i}-result{res_ext}")
                os.rename(res_path, new_res_path)
                break


@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 10000))
    threading.Thread(target=auto_cleanup_loop, daemon=True).start()
    app.run(host='0.0.0.0', port=port)
