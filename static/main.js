let uid = null;

function showOverlay(mode) {
  if (!uid) {
    alert("Please upload an image first.");
    return;
  }

  const nameOnly = uid.split(".")[0];
  const overlayUrl = `/static/results/${nameOnly}_${mode}.png?t=${Date.now()}`;
  const img = document.getElementById(mode);
  const button = document.querySelector(`.filter-item[data-mode="${mode}"]`);

  const isVisible = window.getComputedStyle(img).display !== "none";

  if (isVisible) {
    img.style.display = "none";
    button.classList.remove("selected");
    console.log(`[toggle] Hiding ${mode}`);
  } else {
    // 이미지가 이미 로드돼 있을 경우 바로 표시
    const show = () => {
      img.style.display = "block";
      button.classList.add("selected");
      console.log(`[toggle] Showing ${mode}`);
    };

    if (img.complete && img.naturalWidth !== 0) {
      show();
    } else {
      img.onload = show;
      img.onerror = () => {
        console.error(`Failed to load ${mode} image: ${overlayUrl}`);
        alert(`Failed to load overlay image for "${mode}".`);
      };
      img.src = overlayUrl;
    }
  }
}


function showError(message) {
  document.getElementById("loadingText").style.display = "none";
  const errorText = document.getElementById("errorText");
  errorText.innerHTML = message;
  errorText.style.display = "block";
  console.error("[showError]", message);
}



function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    console.warn("[handleImageUpload] No file selected.");
    return;
  }

  console.log(`[handleImageUpload] Selected file: ${file.name}`);

  document.getElementById("loadingText").style.display = "block";
  document.getElementById("loadingText").textContent = "Image objectifying···";
  document.getElementById("errorText").style.display = "none";

  const reader = new FileReader();

  reader.onload = function (e) {
    const preview = document.getElementById("originalPreview");
    const previewContainer = preview.parentElement;

    preview.src = e.target.result;
    preview.style.display = "block";

    preview.onload = function () {
      console.log("[preview] Image loaded and shown.");
      previewContainer.classList.add("loaded");
    };

    const img = new Image();
    img.onload = function () {
      const targetWidth = 1200;
      const scale = targetWidth / img.width;
      const targetHeight = img.height * scale;

      console.log(`[resize] width: ${targetWidth}, height: ${targetHeight}`);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        function (blob) {
          console.log("[upload] Blob created, sending to server...");

          const formData = new FormData();
          formData.append("image", blob, file.name);

          fetch("/upload", {
            method: "POST",
            body: formData,
          })
            .then((res) => {
              console.log("[upload] Server responded:", res.status);
              if (!res.ok) throw new Error("Server returned non-200 status");
              return res.text(); // ✅ JSON이 아닌 텍스트 받기 (즉 uid)
            })
            .then((text) => {
              console.log("[upload] Upload success, uid:", text);
              uid = text;

              const baseImg = document.getElementById("baseImage");
              baseImg.src = `/static/uploads/${uid}`;
              baseImg.style.display = "block";

              const processedImage = baseImg.parentElement;
              processedImage.classList.add("loaded");

              const saliency = document.getElementById("saliency");
              saliency.src = `/static/results/${
                uid.split(".")[0]
              }_saliency.png?t=${Date.now()}`;
              saliency.style.display = "block";

              document
                .querySelectorAll(".filter-item")
                .forEach((btn) => btn.classList.remove("selected"));
              document
                .querySelector('.filter-item[data-mode="saliency"]')
                ?.classList.add("selected");

              document.getElementById("loadingText").style.display = "none";
            })
            .catch((err) => {
              console.error("[upload] Upload failed:", err);
              showError(
                "Failed to load result image.<br><br>Possible reasons:<ul>" +
                  "<li>File name is not in English</li>" +
                  "<li>Unsupported file extension</li>" +
                  "<li>Server error or processing failure</li>" +
                  "</ul>"
              );
            });
        },
        "image/jpeg",
        0.95
      );
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

function downloadResult() {
  const target = document.querySelector(".processed-image");

  html2canvas(target, {
    backgroundColor: null, // 투명 배경 유지 (원하면 '#282828' 등 지정 가능)
    useCORS: true           // cross-origin 이미지 허용
  }).then((canvas) => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "captured_result.png";
    link.click();
  }).catch((err) => {
    console.error("Capture failed:", err);
    alert("Failed to capture the image.");
  });
}

