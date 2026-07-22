const state = {
  sessionId: null,
  frames: [],       // {id, url}
  slides: [],       // {frame1, frame2, hasTitle, kicker, headline}
};

const $ = (sel) => document.querySelector(sel);

function frameById(id) {
  return state.frames.find((f) => f.id === id);
}

// Which slide/slot gets filled by the NEXT thumbnail click.
// Returns {slideIndex, slotKey} or null if everything is already filled.
function findNextTarget() {
  for (let i = 0; i < state.slides.length; i++) {
    const s = state.slides[i];
    if (!s.frame1) return { slideIndex: i, slotKey: "frame1" };
    if (!s.frame2) return { slideIndex: i, slotKey: "frame2" };
  }
  return null;
}

// Where is a given frame currently used? (for badges) -> "1-①" etc, or null
function usageLabel(frameId) {
  for (let i = 0; i < state.slides.length; i++) {
    const s = state.slides[i];
    if (s.frame1 === frameId) return `${i + 1}枚目の①`;
    if (s.frame2 === frameId) return `${i + 1}枚目の②`;
  }
  return null;
}

// ---------- Upload ----------
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = $("#video-input").files[0];
  if (!file) {
    $("#upload-status").textContent = "先に動画ファイルを選んでください";
    return;
  }

  const fd = new FormData();
  fd.append("video", file);
  fd.append("fps", $("#fps-select").value);

  $("#upload-status").textContent = "動画を解析しています…（長さによって数十秒〜数分かかります。このままお待ちください）";
  $("#upload-form button").disabled = true;

  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");

    state.sessionId = data.session_id;
    state.frames = data.frames;
    state.slides = [makeSlide(true)];

    $("#upload-status").textContent = `完了！${data.frames.length}枚の写真が取り出せました。下から使いたい写真をクリックしてください。`;
    renderGallery();
    renderSlides();
    $("#gallery-section").classList.remove("hidden");
    $("#builder-section").classList.remove("hidden");
    $("#gallery-section").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    $("#upload-status").textContent = "うまくいきませんでした: " + err.message;
  } finally {
    $("#upload-form button").disabled = false;
  }
});

function renderGallery() {
  const gallery = $("#gallery");
  gallery.innerHTML = "";

  const target = findNextTarget();
  const hint = $("#gallery-hint");
  if (target) {
    const slotName = target.slotKey === "frame1" ? "①（上）" : "②（下）";
    hint.textContent = `次にクリックする写真は「${target.slideIndex + 1}枚目の${slotName}」に入ります`;
    hint.classList.remove("hint-done");
  } else {
    hint.textContent = "全部のスライドに写真がセットされました。下の「生成する」を押すか、スライドを追加してください。";
    hint.classList.add("hint-done");
  }

  state.frames.forEach((f, i) => {
    const wrap = document.createElement("div");
    wrap.className = "thumb-wrap";
    const img = document.createElement("img");
    img.src = f.url;
    img.dataset.id = f.id;

    const used = usageLabel(f.id);
    if (used) img.classList.add("used");

    img.addEventListener("click", () => {
      const t = findNextTarget();
      if (!t) {
        alert("すべてのスライドに写真がセットされています。新しいスライドを追加するか、既にセットした写真を外してから選んでください。");
        return;
      }
      state.slides[t.slideIndex][t.slotKey] = f.id;
      renderGallery();
      renderSlides();
    });

    const zoomBtn = document.createElement("button");
    zoomBtn.className = "zoom-btn";
    zoomBtn.type = "button";
    zoomBtn.textContent = "🔍";
    zoomBtn.title = "大きく見る";
    zoomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openLightbox(f.url);
    });

    const label = document.createElement("div");
    label.className = "thumb-label";
    label.textContent = used ? `使用中：${used}` : `#${i + 1}`;

    wrap.appendChild(img);
    wrap.appendChild(zoomBtn);
    wrap.appendChild(label);
    gallery.appendChild(wrap);
  });
}

// ---------- Lightbox (large preview) ----------
function openLightbox(url) {
  $("#lightbox-img").src = url;
  $("#lightbox").classList.remove("hidden");
}
$("#lightbox").addEventListener("click", () => {
  $("#lightbox").classList.add("hidden");
});

// ---------- Slide builder ----------
function makeSlide(hasTitle) {
  return { frame1: null, frame2: null, hasTitle, kicker: "", headline: "" };
}

$("#add-slide-btn").addEventListener("click", () => {
  state.slides.push(makeSlide(false));
  renderSlides();
  renderGallery();
});

function renderSlides() {
  const container = $("#slides");
  container.innerHTML = "";

  state.slides.forEach((slide, idx) => {
    const card = document.createElement("div");
    card.className = "slide-card";

    const title = document.createElement("h3");
    title.textContent = `${idx + 1} 枚目`;
    card.appendChild(title);

    if (idx === 0) {
      const toggle = document.createElement("label");
      toggle.className = "title-toggle";
      toggle.innerHTML = `<input type="checkbox" ${slide.hasTitle ? "checked" : ""}> 一番上に見出し（タイトル）を入れる（1枚目だけでOK）`;
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
            <label>小さい文字（上の行）</label>
            <input type="text" data-field="kicker" value="${slide.kicker}" placeholder="例：アレン様が突きつける">
          </div>
          <div>
            <label>大きい文字（下の行）※ 赤くしたい単語を **こう** はさむと赤字になります</label>
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

      const slotLabel = document.createElement("div");
      slotLabel.className = "slot-label";
      slotLabel.textContent = slotIdx === 0 ? "① 上の写真" : "② 下の写真";
      slot.appendChild(slotLabel);

      const preview = document.createElement("div");
      preview.className = "preview";
      const assigned = slide[slotKey] && frameById(slide[slotKey]);
      if (assigned) {
        const img = document.createElement("img");
        img.src = assigned.url;
        preview.appendChild(img);
      } else {
        preview.textContent = "ここに写真をクリックしてください";
      }
      slot.appendChild(preview);

      if (assigned) {
        const clearBtn = document.createElement("button");
        clearBtn.className = "secondary";
        clearBtn.textContent = "この写真を外す";
        clearBtn.addEventListener("click", () => {
          slide[slotKey] = null;
          renderSlides();
          renderGallery();
        });
        slot.appendChild(clearBtn);
      }

      slots.appendChild(slot);
    });
    card.appendChild(slots);

    if (state.slides.length > 1) {
      const actions = document.createElement("div");
      actions.className = "slide-actions";
      const delBtn = document.createElement("button");
      delBtn.className = "danger";
      delBtn.textContent = "この枚を削除";
      delBtn.addEventListener("click", () => {
        state.slides.splice(idx, 1);
        renderSlides();
        renderGallery();
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

  const incomplete = state.slides.findIndex((s) => !s.frame1 || !s.frame2);
  if (incomplete !== -1) {
    alert(`${incomplete + 1}枚目に写真が足りません。①と②の両方に写真をセットしてください。`);
    return;
  }

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

  $("#generate-status").textContent = "画像を作っています…";
  $("#generate-btn").disabled = true;
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成に失敗しました");

    $("#generate-status").textContent = `できました！${data.slides.length}枚の画像ができています。下からダウンロードしてください。`;
    renderResults(data.slides);
    $("#result-section").classList.remove("hidden");
    $("#result-section").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    $("#generate-status").textContent = "うまくいきませんでした: " + err.message;
  } finally {
    $("#generate-btn").disabled = false;
  }
});

function renderResults(slides) {
  const results = $("#results");
  results.innerHTML = "";
  slides.forEach((s, i) => {
    const bustUrl = `${s.url}?t=${Date.now()}`;
    const filename = `slide_${i + 1}.jpg`;

    const card = document.createElement("div");
    card.className = "result-card";

    const img = document.createElement("img");
    img.src = bustUrl;
    card.appendChild(img);
    card.appendChild(document.createElement("br"));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "save-btn";
    saveBtn.textContent = "この画像を保存";
    saveBtn.addEventListener("click", () => saveImage(bustUrl, filename, saveBtn));
    card.appendChild(saveBtn);

    const hint = document.createElement("p");
    hint.className = "dl-hint";
    hint.textContent = "iPhoneで保存できない時は、画像を長押しして「写真に追加」を選んでください";
    card.appendChild(hint);

    results.appendChild(card);
  });
}

// Fetch the image as data and save it, using the native share sheet on
// phones (so "写真に保存" works properly) and a normal file download on
// desktop. Also gives a clear message if the image is gone from the server
// (this app's free hosting wipes generated images after periods of
// inactivity, so images should be saved soon after they're created).
async function saveImage(url, filename, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存中…";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        "画像がサーバーから消えてしまったようです。しばらく操作がないと自動で画像が消える仕組みになっています。お手数ですが「この内容で画像を作る」を押し直してから、すぐに保存してください。"
      );
    }
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  } catch (err) {
    if (err && err.name === "AbortError") {
      // user cancelled the native share sheet - not an error
    } else {
      alert(err.message || "保存に失敗しました");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
