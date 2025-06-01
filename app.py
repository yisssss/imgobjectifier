from flask import Flask, request, render_template, send_from_directory
import os
from deepgaze_infer import run_deepgaze
from werkzeug.utils import secure_filename
import unicodedata

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
RESULT_FOLDER = 'static/results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    clear_folder(UPLOAD_FOLDER)
    clear_folder(RESULT_FOLDER)


    file = request.files['image']
    filename = safe_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    run_deepgaze(filepath, RESULT_FOLDER)

    return filename

# 한글 파일명 안전하게 정리
def safe_filename(filename):
    # 한글/특수문자 제거 → NFC 정규화 → secure_filename
    filename = unicodedata.normalize('NFC', filename)
    return secure_filename(filename)


import glob

UPLOAD_FOLDER = 'static/uploads'
RESULT_FOLDER = 'static/results'

def clear_folder(folder_path):
    files = glob.glob(os.path.join(folder_path, '*'))
    for f in files:
        try:
            os.remove(f)
        except Exception as e:
            print(f"파일 삭제 실패: {f} → {e}")

#if __name__ == '__main__':
    #app.run()
    #app.run(debug=True)


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
