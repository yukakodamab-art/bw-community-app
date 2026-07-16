const state = {
  sessionId: null,
  frames: [],       // {id, url}
  selectedFrameId: null,
  slides: [],       // {frame1, frame2, hasTitle, kicker, headline}
};

const $ = (sel) => document.querySelector(sel);

function frameById(id) {
  return state.frames.find((f) => f.id === id);
}

// ---------- Upload ----------
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("#video-input").files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("video", file);
  fd.append("fps", $("#fps-select").value);

  $("#upload-status").textContent = "アップロード中・フレーム抽出中…（動画の長さによって数十秒かかります）";

  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");

    state.sessionId = data.session_id;
    state.frames = data.frames;
    state.slides = [makeSlide(true)];

    $("#upload-status").textContent = `完了：${data.frames.length}枚のフレームを抽出しました`;
    renderGallery();
    renderSlides();
    $("#gallery-section").classList.remove("hidden");
    $("#builder-section").classList.remove("hidden");
  } catch (err) {
    $("#upload-status").textContent = "エラー: " + err.message;
  }
});

function renderGallery() {
  const gallery = $("#gallery");
  gallery.innerHTML = "";
  state.frames.forEach((f, i) => {
    const wrap = document.createElement("div");
    wrap.className = "thumb-wrap";
    const img = document.createElement("img");
    img.src = f.url;
    img.dataset.id = f.id;
    if (f.id === state.selectedFrameId) img.classList.add("selected");
    img.addEventListener("click", () => {
      state.selectedFrameId = f.id;
      renderGallery();
    });
    const label = document.createElement("div");
    label.className = "thumb-label";
    label.textContent = `#${i + 1}`;
    wrap.appendChild(img);
    wrap.appendChild(label);
    gallery.appendChild(wrap);
  });
}

// ---------- Slide builder ----------
function makeSlide(hasTitle) {
  return { frame1: null, frame2: null, hasTitle, kicker: "", headline: "" };
}

$("#add-slide-btn").addEventListener("click", () => {
  state.slides.push(makeSlide(false));
  renderSlides();
});

function renderSlides() {
  const container = $("#slides");
  container.innerHTML = "";

  state.slides.forEach((slide, idx) => {
    const card = document.createElement("div");
    card.className = "slide-card";

    const title = document.createElement("h3");
    title.textContent = `スライド ${idx + 1}`;
    card.appendChild(title);

    if (idx === 0) {
      const toggle = document.createElement("label");
      toggle.className = "title-toggle";
      toggle.innerHTML = `<input type="checkbox" ${slide.hasTitle ? "checked" : ""}> タイトル帯をつける（1枚目のみ推奨）`;
      toggle.querySelector("input").addEventListener("change", (e) => {
        slide.hasTitle = e.target.checked;
        renderSlides();
      });
      card.appendChild(toggle);

      if (slide.hasTitle) {
        const fields = document.createElement("div");
        fields.className = "title-fields";
        fields.innerHTML = `
          <div>
            <label>キッカー（小さい行）</label>
            <input type="text" data-field="kicker" value="${slide.kicker}" placeholder="例：アレン様が突きつける">
          </div>
          <div>
            <label>見出し（大きい行）※ **単語** で赤強調</label>
            <input type="text" data-field="headline" value="${slide.headline}" placeholder="例：**浮気**の現実">
          </div>
        `;
        fields.querySelectorAll("input").forEach((inp) => {
          inp.addEventListener("input", (e) => {
            slide[e.target.dataset.field] = e.target.value;
          });
        });
        card.appendChild(fields);
      }
    }

    const slots = document.createElement("div");
    slots.className = "slots";
    ["frame1", "frame2"].forEach((slotKey, slotIdx) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      const preview = document.createElement("div");
      preview.className = "preview";
      const assigned = slide[slotKey] && frameById(slide[slotKey]);
      if (assigned) {
        const img = document.createElement("img");
        img.src = assigned.url;
        preview.appendChild(img);
      } else {
        preview.textContent = "未選択";
      }
      const btn = document.createElement("button");
      btn.className = "secondary";
      btn.textContent = `${slotIdx === 0 ? "①" : "②"}にセット`;
      btn.addEventListener("click", () => {
        if (!state.selectedFrameId) {
          alert("先にギャラリーからフレームをクリックして選択してください");
          return;
        }
        slide[slotKey] = state.selectedFrameId;
        renderSlides();
      });
      slot.appendChild(preview);
      slot.appendChild(btn);
      slots.appendChild(slot);
    });
    card.appendChild(slots);

    if (state.slides.length > 1) {
      const actions = document.createElement("div");
      actions.className = "slide-actions";
      const delBtn = document.createElement("button");
      delBtn.className = "danger";
      delBtn.textContent = "このスライドを削除";
      delBtn.addEventListener("click", () => {
        state.slides.splice(idx, 1);
        renderSlides();
      });
      actions.appendChild(delBtn);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}

// ---------- Generate ----------
$("#generate-btn").addEventListener("click", async () => {
  if (!state.sessionId) return;

  const payload = {
    session_id: state.sessionId,
    slides: state.slides.map((s) => ({
      frame1: s.frame1,
      frame2: s.frame2,
      has_title: s.hasTitle,
      kicker: s.kicker,
      headline: s.headline,
    })),
  };

  $("#generate-status").textContent = "生成中…";
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成に失敗しました");

    $("#generate-status").textContent = `完了：${data.slides.length}枚生成しました`;
    renderResults(data.slides);
    $("#result-section").classList.remove("hidden");
    $("#result-section").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    $("#generate-status").textContent = "エラー: " + err.message;
  }
});

function renderResults(slides) {
  const results = $("#results");
  results.innerHTML = "";
  slides.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <img src="${s.url}?t=${Date.now()}">
      <br>
      <a href="${s.url}" download="slide_${i + 1}.jpg">ダウンロード</a>
    `;
    results.appendChild(card);
  });
}
