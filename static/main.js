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
    
  const currentSelected = Array.from(
    document.querySelectorAll(".filter-item.selected")
  ).map((el) => el.dataset.mode);
      applyRectLabels(currentSelected);

  } else {
    // 이미지가 이미 로드돼 있을 경우 바로 표시
    const show = () => {
      img.style.display = "block";
      button.classList.add("selected");
      console.log(`[toggle] Showing ${mode}`);
      
  const currentSelected = Array.from(
    document.querySelectorAll(".filter-item.selected")
  ).map((el) => el.dataset.mode);
        applyRectLabels(currentSelected);

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
    isUploading = true;

    
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
    if (!preview) {
      console.error("[handleImageUpload] #originalPreview not found in DOM.");
      return;
    }
    const previewContainer = preview.parentElement;

    preview.src = e.target.result;
    preview.style.display = "block";

preview.onload = function () {
  console.log("[preview] Image loaded and shown.");
  previewContainer.classList.add("loaded");

  // ✅ 가로 기준 660px일 때 비율 유지한 높이
  const targetWidth = 660;
  const aspectRatio = preview.naturalHeight / preview.naturalWidth;
  const scaledHeight = targetWidth * aspectRatio;

  // ✅ 실제 slide 높이 설정
  const leftSlide = leftTrack.querySelector('[data-index="5"]');
  const rightSlide = rightTrack.querySelector('[data-index="5"]');

  if (leftSlide) leftSlide.style.height = `${scaledHeight}px`;
  if (rightSlide) rightSlide.style.height = `${scaledHeight}px`;

  leftHeights[5] = scaledHeight;
  rightHeights[5] = scaledHeight;

  moveToPlaceholder(scaledHeight);
};


    const img = new Image();
    img.onload = function () {
      const targetWidth = 1200;
      const scale = targetWidth / img.width;
      const targetHeight = img.height * scale;

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        function (blob) {
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

              // DOM 삽입된 직후 실행
              requestAnimationFrame(() => {
                const baseImg = document.getElementById("baseImage");
                const saliency = document.getElementById("saliency");

                baseImg.src = `/static/uploads/${uid}?t=${Date.now()}`;
                baseImg.style.display = "block";
                baseImg.onload = () => {
                  document
                    .querySelector(".processed-image")
                    ?.classList.add("loaded");

                  document.getElementById("loadingText").style.display = "none";

                  // ✅ 가로 기준 660px일 때 비율 유지한 높이
                  const targetWidth = 660;
                  const aspectRatio =
                    baseImg.naturalHeight / baseImg.naturalWidth;
                  const scaledHeight = targetWidth * aspectRatio;

                  // ✅ data-index="5" image-slide 높이 반영
                  const leftSlide = leftTrack.querySelector('[data-index="5"]');
                  const rightSlide =
                    rightTrack.querySelector('[data-index="5"]');

                  if (leftSlide) leftSlide.style.height = `${scaledHeight}px`;
                  if (rightSlide) rightSlide.style.height = `${scaledHeight}px`;

                  leftHeights[5] = scaledHeight;
                  rightHeights[5] = scaledHeight;

                  console.log("scaled height (width 660 기준):", scaledHeight);
                  moveToPlaceholder(scaledHeight);
                };

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
 
                const currentSelected = Array.from(
    document.querySelectorAll(".filter-item.selected")
  ).map((el) => el.dataset.mode);
        applyRectLabels(currentSelected);

                maybeSaveDummyImage();
              });
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
              let index = 5;
              // placeholder 제거
              leftTrack.querySelector(`[data-index="${index}"]`)?.remove();
              rightTrack.querySelector(`[data-index="${index}"]`)?.remove();
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
    backgroundColor: null,
    useCORS: true,
  })
    .then((canvas) => {
      // 사용자 컴퓨터에 다운로드
      canvas.toBlob((blob) => {
        const saliencySrc = document.getElementById("saliency").src;
        const filenameBase = saliencySrc.split("/").pop().split("_")[0]; // 예: "pair2"

        // ✅ 사용자 다운로드 트리거
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${filenameBase}_result.png`;
        a.click();
        URL.revokeObjectURL(url); // 메모리 정리

        // ✅ 동시에 서버 저장도 진행
        const formData = new FormData();

        const selectedModes = Array.from(
          document.querySelectorAll(".filter-item.selected")
        ).map((el) => el.dataset.mode); // 예: ["saliency", "viewpoint"]

        formData.append("filters", selectedModes.join(",")); // 예: "saliency,viewpoint"
        formData.append("image", blob, `${filenameBase}_result.png`);

        fetch("/save-result", {
          method: "POST",
          body: formData,
        }).then((res) => {
          if (res.ok) {
            alert("Result saved to server.");
          } else {
            alert("Server failed to save result.");
          }
        });
      }, "image/png");
    })
    .catch((err) => {
      console.error("Capture failed:", err);
      alert("Failed to capture the image.");
    });
}
function maybeSaveDummyImage() {
  const target = document.querySelector(".processed-image");

  html2canvas(target, {
    backgroundColor: null,
    useCORS: true,
  })
    .then((canvas) => {
      canvas.toBlob((blob) => {
        const saliencySrc = document.getElementById("saliency").src;
        const filenameBase = saliencySrc.split("/").pop().split("_")[0]; // ex: "pair2"

        const formData = new FormData();
        formData.append("image", blob, `${filenameBase}_result.png`);

        // ✅ 선택된 필터들 가져와서 JSON 형태로 전달
        const selectedModes = Array.from(
          document.querySelectorAll(".filter-item.selected")
        ).map((el) => el.dataset.mode); // ["saliency", "focusmask"]

        formData.append("filters", selectedModes.join(",")); // "saliency,focusmask"

        fetch("/save-result", {
          method: "POST",
          body: formData,
        }).then((res) => {
          if (!res.ok) {
            console.warn("Server failed to save dummy processed image");
          } else {
            console.log("Dummy processed image with filters saved.");
          }
        });
      }, "image/png");
    })
    .catch((err) => {
      console.error("[html2canvas] Failed to generate dummy:", err);
    });
}

window.addEventListener("DOMContentLoaded", () => {
  const iconPlus = document.getElementById("animatedIconPlus");
  const imageInput = document.getElementById("imgInput");

  if (iconPlus) {
    iconPlus.addEventListener("click", () => {
      iconPlus.classList.add("plusLoad"); // 업로드 상태 애니메이션
      const index = 5;

      // 1. placeholder 노드가 이미 존재하는지 찾고
      let leftPlaceholder = leftTrack.querySelector(`[data-index="${index}"]`);
      let rightPlaceholder = rightTrack.querySelector(
        `[data-index="${index}"]`
      );

      // 2. 없으면 새로 만들고 DOM에 삽입
      if (!leftPlaceholder) {
        leftPlaceholder = document.createElement("div");
        rightPlaceholder = document.createElement("div");

        leftPlaceholder.className = "image-slide";
        rightPlaceholder.className = "image-slide";
        leftPlaceholder.dataset.index = index;
        rightPlaceholder.dataset.index = index;

        leftTrack.appendChild(leftPlaceholder);
        rightTrack.appendChild(rightPlaceholder);

        leftHeights[index] = 400;
        rightHeights[index] = 400;
      }

      // ✅ 반드시 DOM에 append된 이후에 innerHTML 삽입
      leftPlaceholder.innerHTML = `
  <div class="original-image">
    <img id="originalPreview" style="display: none" />
  </div>`;
      rightPlaceholder.innerHTML = `
  <div class="processed-image-wrapper">
    <div class="processed-image">
      <p id="loadingText" class="status-text loading">Loading...</p>
      <p id="errorText" class="status-text error"></p>
      <img id="baseImage" class="image-layer base" />
      <img id="saliency" class="image-layer saliency" />
      <img id="viewpoint" class="image-layer viewpoint" />
      <img id="centerline" class="image-layer centerline" />
      <img id="focusmask" class="image-layer focusmask" />
      <img id="shapes" class="image-layer shapes" />
    </div>
  </div>`;

      // ✅ placeholder로 슬라이드 이동
      moveToPlaceholder();

      requestAnimationFrame(() => {
        imageInput.click(); // 이 시점에 originalPreview가 존재함
      });
    });

    document
      .getElementById("imgInput")
      ?.addEventListener("change", handleImageUpload);
  }

  const iconDownload = document.getElementById("animatedIconDownload");
  if (iconDownload) {
    iconDownload.addEventListener("click", () => {
      iconDownload.classList.toggle("download-check");
    });
  }
});

let selectedFilterOrder = []; // 순서 기억

function applyRectLabels(modes = []) {
  selectedFilterOrder = modes;

  document.querySelectorAll(".filter-item").forEach((btn) => {
    const label = btn.querySelector(".label");
    if (!label) return;

    // 기존 rect 제거
    label.querySelector(".rect-label")?.remove();

    const index = modes.indexOf(btn.dataset.mode);
    if (index >= 0) {
      const rect = document.createElement("div");
      rect.className = "rect-label";

      const name = document.createElement("div");
      name.className = "label-name";
      name.textContent = `S${index + 1}`;

      rect.appendChild(name);
      label.appendChild(rect);
    }
  });
}

function applyFilterSelectionFromJSON(modes = []) {
  document.querySelectorAll(".filter-item").forEach((btn) => {
    const isActive = modes.includes(btn.dataset.mode);
    btn.classList.toggle("selected", isActive);
  });
}

function animateLineSync() {
  updateFilterLines();
  requestAnimationFrame(animateLineSync);
}

animateLineSync(); // 시작 시 한 번만 호출

function updateFilterLines() {
  const svg = document.getElementById("filter-line-connector");
  svg.innerHTML = ""; // 기존 선 제거

  const visualOrder = [
    "saliency",
    "focusmask",
    "viewpoint",
    "shapes",
    "centerline",
  ];
  const labels = visualOrder
    .filter((mode) => selectedFilterOrder.includes(mode))
    .map((mode) =>
      document.querySelector(`.filter-item[data-mode="${mode}"] .label`)
    )
    .filter((label) => !!label);

  for (let i = 0; i < labels.length - 1; i++) {
    const rect1 = labels[i].getBoundingClientRect();
    const rect2 = labels[i + 1].getBoundingClientRect();

    const x1 = rect1.left + rect1.width / 2;
    const y1 = rect1.top + rect1.height / 2;
    const x2 = rect2.left + rect2.width / 2;
    const y2 = rect2.top + rect2.height / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("clip-path", "url(#line-mask)");
    console.log();

    svg.appendChild(line);
  }
}

function updateClipMask() {
  const defs = document.querySelector("#filter-line-connector defs");
  const mask = defs.querySelector("#line-mask");
  mask.innerHTML = ""; // 초기화

  document.querySelectorAll(".rect-label").forEach((rect) => {
    const r = rect.getBoundingClientRect();
    const svgRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    svgRect.setAttribute("x", r.left + window.scrollX);
    svgRect.setAttribute("y", r.top + window.scrollY);
    svgRect.setAttribute("width", r.width);
    svgRect.setAttribute("height", r.height);
    mask.appendChild(svgRect);
  });
}

const max = 5;
const leftHeights = [];
const rightHeights = [];
let loadedCount = 0;

const leftTrack = document.querySelector(".left-column .slide-track");
const rightTrack = document.querySelector(".right-column .slide-track");

for (let i = 0; i < max; i++) {
  const li = i % max;

  const leftImg = new Image();
  const rightImg = new Image();

  leftImg.src = `static/uploads/pair${li}.png`;
  rightImg.src = `static/download_images/pair${max - li - 1}_result.png`;

  leftImg.className = "image-slide";
  rightImg.className = "image-slide";

  leftImg.dataset.index = li;
  rightImg.dataset.index = li;

  leftImg.onload = () => {
    if (i < max) leftHeights[li] = leftImg.height;
    checkLoaded();
  };
  rightImg.onload = () => {
    if (i < max) rightHeights[li] = rightImg.height;
    checkLoaded();
  };

  leftTrack.appendChild(leftImg);
  rightTrack.appendChild(rightImg);
}

let index = 0;
let leftIndex = 2;
let rightIndex = 2;

let initialized = false;

function checkLoaded() {
  loadedCount++;
  if (loadedCount === max * 2 && !initialized) {
    const leftOffset =
      getCumulativeHeight(leftHeights, 0, leftIndex) +
      leftHeights[leftIndex] / 2;
    const rightOffset =
      getCumulativeHeight(rightHeights, 0, rightIndex) +
      rightHeights[rightIndex] / 2;

    leftTrack.style.transform = `translateY(calc(50vh - ${leftOffset}px))`;
    rightTrack.style.transform = `translateY(calc(50vh - ${rightOffset}px))`;
    slideStep();

    initialized = true;
    setInterval(slideStep, 4000);
  }
}

function getCumulativeHeight(arr, start, count) {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const idx = (start + i) % arr.length;
    sum += arr[idx];
  }
  return sum;
}
let isUploading = false; // ✅ 상태 플래그

function slideStep() {
  if (isUploading || index === 5) {
    console.log("[slideStep] Skipped during upload or placeholder.");
    return;
  }


  leftIndex = (leftIndex + 1) % max;
  rightIndex = (rightIndex - 1 + max) % max;

  const leftImage = leftTrack.querySelector(`[data-index="${leftIndex}"]`);
  const rightImage = rightTrack.querySelector(`[data-index="${rightIndex}"]`);

  const leftHeight = leftImage?.offsetHeight || leftHeights[leftIndex];
  const rightHeight = rightImage?.offsetHeight || rightHeights[rightIndex];
  const avgHeight = (leftHeight + rightHeight) / 2;

  const viewportHeight = window.innerHeight;
  const verticalMargin = (viewportHeight - avgHeight) / 2;

  const minHeight = 100;
  const finalHeight = Math.max(minHeight, verticalMargin);
  updateFooterDescriptions(finalHeight);
  updateHeaderFooterHeight(finalHeight);

  const leftOffset =
    getCumulativeHeight(leftHeights, 0, leftIndex) + leftHeights[leftIndex] / 2;
  const rightOffset =
    getCumulativeHeight(rightHeights, 0, rightIndex) +
    rightHeights[rightIndex] / 2;

  leftTrack.style.transform = `translateY(calc(50vh - ${leftOffset}px))`;
  rightTrack.style.transform = `translateY(calc(50vh - ${rightOffset}px))`;

  // ✅ 필터 상태 업데이트
  const currentFilename = rightImage?.src?.split("/").pop(); // 예: pair3_result.png
  const baseName = currentFilename?.split("_")[0]; // 예: pair3

  if (baseName) {
    fetch(`/static/download_images/${baseName}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.filters) {
          const filters = data.filters.split(",");
          applyFilterSelectionFromJSON(filters); // ✅ 선택된 필터 UI만 반영
          applyRectLabels(filters); // ✅ 클릭된 필터 기준으로 rect label 적용

        }
      })
      .catch((err) => {
        console.warn("filter json load failed:", err);
        highlightFilters([]); // 선택 해제
      });
  }
}

function moveToPlaceholder() {
  leftIndex = 5;
  rightIndex = 5;

  const leftImage = leftTrack.querySelector(`[data-index="${leftIndex}"]`);
  const rightImage = rightTrack.querySelector(`[data-index="${rightIndex}"]`);

  const leftHeight = leftImage?.offsetHeight || leftHeights[leftIndex];
  const rightHeight = rightImage?.offsetHeight || rightHeights[rightIndex];
  const avgHeight = (leftHeight + rightHeight) / 2;

  const viewportHeight = window.innerHeight;
  const verticalMargin = (viewportHeight - avgHeight) / 2;

  const minHeight = 100;
  const finalHeight = Math.max(minHeight, verticalMargin);
  updateFooterDescriptions(finalHeight);
  updateHeaderFooterHeight(finalHeight);

  // 강제 슬라이드 이동
  const leftOffset =
    getCumulativeHeight(leftHeights, 0, leftIndex) + leftHeights[leftIndex] / 2;
  const rightOffset =
    getCumulativeHeight(rightHeights, 0, rightIndex) +
    rightHeights[rightIndex] / 2;

  leftTrack.style.transform = `translateY(calc(50vh - ${leftOffset}px))`;
  rightTrack.style.transform = `translateY(calc(50vh - ${rightOffset}px))`;
}

function updateHeaderFooterHeight(margin) {
  const viewportHeight = window.innerHeight;
  const centerHeight = viewportHeight - 2 * margin;

  const headers = document.querySelectorAll(".header");
  const footers = document.querySelectorAll(".footer");
  const centers = document.querySelectorAll(".center");
  const filters = document.querySelectorAll(".filter-item");
  const labelbox = document.querySelectorAll(".label-box");

  const title = document.querySelector(".testTitle");

  // header 처리
  headers.forEach((header) => {
    header.style.height = `${margin}px`;
    updateInnerLines(header, margin, 10);
  });

  // footer 처리
  footers.forEach((footer) => {
    footer.style.height = `${margin}px`;
    updateInnerLines(footer, margin, 0);
  });

  // center 처리
  centers.forEach((center) => {
    center.style.height = `${centerHeight}px`;
    center.style.top = `${margin}px`; // 여기에 위치
    updateInnerLines(center, centerHeight, 10);
  });

  filters.forEach((filter) => {
    updateInnerLines(filter, margin / 2, 13);
  });

  labelbox.forEach((box) => {
    updateInnerLines(box, margin, 0);
  });

  if (title) {
    const scaleY = margin / 520; // 기준 높이 60일 때 scaleY=1
    const finalScaleY = Math.max(scaleY, 0.15);

    // scaleY: 1 → top: -8%
    // scaleY: 0.15 → top: 2%
    const topPercent = 2 + (finalScaleY - 0.15) * ((2 - 7) / (0.15 - 0.5)); // 선형 보간
    //console.log("scaleY",scaleY, "top percent",topPercent);
    title.style.transform = `translateX(-50%) scaleY(${finalScaleY})`;
    title.style.top = `-${topPercent}%`;
  }
}

function updateInnerLines(container, height, short) {
  const lines = container.querySelectorAll(
    ".left-line, .right-line, .center-line, .rightright-line, .leftbox-right-line"
  );
  lines.forEach((line) => {
    line.style.height = `${height - short}px`;
  });
}

function positionIcons() {
  const windowWidth = window.innerWidth;
  const baseWidth = 1520;
  const iconOffset = 24;

  //console.log("윈도우 넓이",windowWidth);

  const plus = document.querySelector(".icon-wrapper.plus");
  const download = document.querySelector(".icon-wrapper.download");

  if (plus) {
    plus.style.left = `${(windowWidth - baseWidth) / 2 - iconOffset}px`;
  }
  if (download) {
    download.style.right = `${(windowWidth - baseWidth) / 2 + iconOffset}px`;
  }
}

window.addEventListener("resize", positionIcons);
window.addEventListener("load", positionIcons);

function updateFooterDescriptions(margin) {
  const descriptions = document.querySelectorAll(".filter-item .description");
  const filterItems = document.querySelectorAll(".filter-item");
  const labelDescriptions = document.querySelectorAll(
    ".label-box .description"
  );

  const itemHeight = margin / 2;
  const boxHeight = margin;

  descriptions.forEach((desc) => {
    if (margin >= 120) {
      desc.style.opacity = "1";
      desc.style.maxHeight = "80px";
    } else {
      desc.style.opacity = "0";
      desc.style.maxHeight = "0";
    }
  });

  labelDescriptions.forEach((desc) => {
    if (margin >= 120) {
      desc.style.maxHeight = "100px";
    } else {
      desc.style.maxHeight = "40px";
    }
  });
  filterItems.forEach((item) => {
    item.style.height = `${itemHeight}px`;
  });
}

const defaultCursor = document.querySelector(".cursor-default");
const pointerCursor = document.querySelector(".cursor-pointer");

let isPointer = false;

document.addEventListener("mousemove", (e) => {
  const cursor = isPointer ? pointerCursor : defaultCursor;

  if (cursor) {
    cursor.style.display = "block";
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  }
});

// 커서 전환 예시
document.querySelectorAll("button, a, .clickable").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    isPointer = true;
    defaultCursor.style.display = "none";
    pointerCursor.style.display = "block";
  });

  el.addEventListener("mouseleave", () => {
    isPointer = false;
    pointerCursor.style.display = "none";
    defaultCursor.style.display = "block";
  });
});


document.addEventListener("DOMContentLoaded", () => {
  // 모든 image-slide 안의 img 클릭 시 확대
  document.querySelectorAll(".image-slide").forEach((img) => {
    img.addEventListener("click", () => {
      const overlay = document.getElementById("imageOverlay");
      const overlayImg = document.getElementById("overlayImage");
      overlayImg.src = img.src;
      overlay.style.display = "flex";
    });
  });

  // 오버레이 클릭 시 닫기
  document.getElementById("imageOverlay").addEventListener("click", () => {
    document.getElementById("imageOverlay").style.display = "none";
  });
});

