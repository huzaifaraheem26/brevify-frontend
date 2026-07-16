(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    mode: 'url',
    isLoading: false,
    streamTimer: null,
    cursorTimer: null,
    words: [],
    wordIndex: 0,
    currentSummary: '',
  };

  const urlInput = $('#urlInput');
  const textInput = $('#textInput');
  const clearUrl = $('#clearUrl');

  const tabs = $$('.tab');
  const panels = $$('.panel');

  const summarizeBtn = $('#summarizeBtn');
  const summarizeBtnText = $('#summarizeBtnText');
  const progressWrap = $('#progressWrap');
  const progressWrapText = $('#progressWrapText');

  const statusLine = $('#statusLine');
  const statusStep = $('#statusStep');
  const progressFill = $('#progressFill');
  const progressDetail = $('#progressDetail');

  const statusLineText = $('#statusLineText');
  const statusStepText = $('#statusStepText');
  const progressFillText = $('#progressFillText');
  const progressDetailText = $('#progressDetailText');

  const outputWrap = $('#outputWrap');
  const streamText = $('#streamText');
  const cursor = $('#cursor');

  const blogTitle = $('#blogTitle');
  const origWords = $('#origWords');
  const sumWords = $('#sumWords');
  const timeSaved = $('#timeSaved');

  const copyBtn = $('#copyBtn');
  const downloadBtn = $('#downloadBtn');
  const shareBtn = $('#shareBtn');
  const regenBtn = $('#regenBtn');
  const saveBtn = $('#saveBtn');

  const ratingRow = $('#ratingRow');
  const ratingButtons = $$('.btn-rate');

  // Ensure textarea counter updates
const updateCharCount = () => {
  const v = textInput.value || '';
  const max = 10000;
  const current = Math.min(v.length, 10000);
  charCount.textContent = `${current.toLocaleString()} / ${max.toLocaleString()}`;
  
  // Add warning colors
  charCount.classList.remove('warning', 'danger');
  if (current > max * 0.85) {
    charCount.classList.add('warning');
  }
  if (current > max * 0.95) {
    charCount.classList.add('danger');
  }
};

  // Tab switching
  const setTab = (tabName) => {
    state.mode = tabName;

    tabs.forEach((t) => {
      const active = t.dataset.tab === tabName;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    panels.forEach((p) => {
      const active = p.dataset.panel === tabName;
      p.classList.toggle('is-active', active);
      if (!active) p.hidden = true;
      if (active) p.hidden = false;
    });

    // Show/hide progress wrappers for each tab
    const showProgress = false;
    progressWrap.classList.toggle('show', showProgress);
    progressWrapText.classList.toggle('show', showProgress);

    clearUrl.classList.toggle('show', (urlInput.value || '').trim().length > 0 && tabName === 'url');
  };

  tabs.forEach((t) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
  });

  urlInput.addEventListener('input', () => {
    const has = (urlInput.value || '').trim().length > 0;
    clearUrl.classList.toggle('show', has);
  });

  clearUrl.addEventListener('click', () => {
    urlInput.value = '';
    clearUrl.classList.remove('show');
    urlInput.focus();
  });

  textInput.addEventListener('input', () => {
    updateCharCount();
  });
  updateCharCount();

  // Fixed defaults now that the length/language/style controls have been removed
  state.length = 'long';
  state.style = 'bullets';

  // State machine helpers
  const setButtonLoading = (btn, on) => {
    if (!btn) return;
    btn.classList.toggle('loading', on);
    const spark = btn.querySelector('.btn-spark');
    const text = btn.querySelector('.btn-text');
    if (on) {
      text.textContent = 'Analyzing...';
      btn.setAttribute('disabled', 'true');
    } else {
      text.textContent = 'Summarize Now →';
      btn.removeAttribute('disabled');
    }
  };

  const setProgress = (wrapEl, fillEl, lineEl, stepEl, detailEl, pct, stepLabel, statusLabel) => {
    wrapEl.classList.add('show');
    fillEl.style.width = `${pct}%`;
    lineEl.textContent = statusLabel;
    stepEl.textContent = stepLabel;
    detailEl.textContent = detailEl.dataset.template
      ? detailEl.dataset.template.replace('{step}', stepLabel)
      : detailEl.textContent;
  };

  const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const normalizeText = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const estimateOriginal = (inputText) => {
    const t = normalizeText(inputText);
    if (!t) return { words: 0, minutes: 0 };
    const words = t.split(' ').filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 150));
    return { words, minutes };
  };

  // STREAM WORDS WITH AUTO SCROLL
const streamWords = async ({ text, onWord, onDone, delayMs = 30 }) => {
    const words = (text || '').split(/(\s+)/).filter(w => w !== '');
    state.words = words;
    state.wordIndex = 0;

    // Cursor start
    cursor.style.opacity = '1';

    // Clear old
    streamText.innerHTML = '';

    const total = words.length;
    const summaryContainer = document.querySelector('.summary-body');
    
    const tickProgress = (idx) => {
        const pct = Math.min(95, Math.round((idx / total) * 95));
        const wrap = state.mode === 'url' ? progressWrap : progressWrapText;
        const fill = state.mode === 'url' ? progressFill : progressFillText;
        fill.style.width = `${pct}%`;
    };

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        state.wordIndex = i;
        if (w === '\n') continue;
        onWord(w);
        tickProgress(i);
        
        // =============================================
        // AUTO SCROLL WITH STREAMING
        // =============================================
        // Scroll every 5 words to keep summary in view
        if (i % 5 === 0 || i === words.length - 1) {
            if (summaryContainer) {
                summaryContainer.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
            }
        }
        
        await new Promise((r) => setTimeout(r, delayMs));
    }

    // Final scroll to complete summary
    if (summaryContainer) {
        summaryContainer.scrollIntoView({
            behavior: 'smooth',
            block: 'end'
        });
    }

    onDone();
};


  const getCurrentInputText = () => {
    if (state.mode === 'url') return urlInput.value;
    return textInput.value;
  };

  const setOutputMeta = ({ title, originalWords, summaryWords, timeSavedMinutes }) => {
    blogTitle.textContent = title || '—';
    origWords.textContent = originalWords.toLocaleString();
    sumWords.textContent = summaryWords.toLocaleString();
    timeSaved.textContent = `${timeSavedMinutes} min`;
  };

  const resetStreamingUI = () => {
    outputWrap.hidden = true;
    streamText.innerHTML = '';
    cursor.style.opacity = '1';
    ratingRow.style.display = 'none';
  };

  const showResultsShell = () => {
    outputWrap.hidden = false;
    ratingRow.style.display = 'flex';
  };

  const triggerCopy = async () => {
    const text = streamText.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy Summary'), 1800);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy Summary'), 1800);
    }
  };

  const triggerDownload = () => {
    const text = streamText.textContent.trim();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `brevify-summary-${ts}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const triggerShare = async () => {
    const text = streamText.textContent.trim();
    const payload = { title: 'BREVIFY Summary', text };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch (e) {
      // continue to clipboard
    }
    await triggerCopy();
    alert('Summary copied. Your browser does not support native sharing.');
  };

  const saveSummary = () => {
    const text = streamText.textContent.trim();
    const title = blogTitle.textContent || 'Brevify Summary';
    const item = {
      title,
      text,
      savedAt: new Date().toISOString(),
      length: state.length,
      style: state.style,
    };
    const key = 'brevify_summaries';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.unshift(item);
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
    saveBtn.textContent = '✓ Saved!';
    setTimeout(() => (saveBtn.textContent = 'Save Summary'), 1800);
  };

  const updateStatusSequence = (mode) => {
    const wrap = mode === 'url' ? progressWrap : progressWrapText;
    const line = mode === 'url' ? statusLine : statusLineText;
    const step = mode === 'url' ? statusStep : statusStepText;
    const fill = mode === 'url' ? progressFill : progressFillText;
    const detail = mode === 'url' ? progressDetail : progressDetailText;

    wrap.classList.add('show');
    fill.style.width = '0%';
    line.textContent = 'Fetching article...';
    step.textContent = '01/03';
    detail.textContent = 'Fetching article...';
    return { wrap, line, step, fill, detail };
  };

  const cycleStatus = async (mode) => {
    const wrap = mode === 'url' ? progressWrap : progressWrapText;
    const line = mode === 'url' ? statusLine : statusLineText;
    const step = mode === 'url' ? statusStep : statusStepText;
    const fill = mode === 'url' ? progressFill : progressFillText;

    const steps = [
  { label: 'Fetching article...', pctTo: 35, step: '01/03', wait: 200 },
  { label: 'Analyzing content...', pctTo: 70, step: '02/03', wait: 300 },
  { label: 'Generating summary...', pctTo: 90, step: '03/03', wait: 300 },
];

    for (const s of steps) {
      line.textContent = s.label;
      step.textContent = s.step;
      // ease fill
      const start = parseFloat(fill.style.width || '0') || 0;
      const delta = s.pctTo - start;
      const t0 = performance.now();
      const dur = s.wait;
      await new Promise((resolve) => {
        const tick = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          fill.style.width = `${Math.round(start + delta * k)}%`;
          if (k >= 1) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }

    fill.style.width = '90%';
    return wrap;
  };

  const handleSummarize = async () => {
    if (state.isLoading) return;

    const inputText = getCurrentInputText();

    if (!inputText || inputText.trim().length < 3) {
        alert("Paste a blog URL or article text to summarize.");
        return;
    }

    if (state.mode === "url") {
        if (!inputText.startsWith("http://") && !inputText.startsWith("https://")) {
            alert("Please enter a valid URL starting with http:// or https://");
            return;
        }
    }

    const titleGuess = state.mode === "url"
        ? inputText.replace(/^https?:\/\//, "").split("/")[0]
        : "Pasted Article";

    const original = estimateOriginal(inputText);

    state.isLoading = true;

    resetStreamingUI();
    showResultsShell();

    const btn = state.mode === "url" ? summarizeBtn : summarizeBtnText;

    setButtonLoading(btn, true);

    try {
        updateStatusSequence(state.mode);
        await cycleStatus(state.mode);

        // Log what we're sending
        console.log("Sending to backend:", { text: inputText.substring(0, 100) + "..." });

        const response = await fetch("http://localhost:3000/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: inputText
            })
        });

        const data = await response.json();

        // Handle error response
        if (!response.ok) {
            throw new Error(data.message || "Server error");
        }

        if (!data.success) {
            throw new Error(data.message);
        }

        let finalText = data.summary;

        // Clean up the summary
        finalText = finalText
            .replace(/#{1,6}/g, "")
            .replace(/\*\*/g, "")
            .trim();

        if (!finalText || finalText.length < 10) {
            throw new Error("Generated summary is too short");
        }

        const summaryWordsCount = normalizeText(finalText)
            .split(" ")
            .filter(Boolean)
            .length;

        setOutputMeta({
            title: titleGuess,
            originalWords: original.words,
            summaryWords: summaryWordsCount,
            timeSavedMinutes: Math.max(1, Math.round(original.minutes * 0.6))
        });

        await streamWords({
            text: finalText,
            onWord: (word) => {
                streamText.append(word);
            },
            onDone: () => {
                cursor.style.opacity = "0";
                const fill = state.mode === "url" ? progressFill : progressFillText;
                fill.style.width = "100%";
                const line = state.mode === "url" ? statusLine : statusLineText;
                line.textContent = "Done.";
            },
            delayMs: 25
        });

        state.currentSummary = finalText;

    } catch (error) {
        console.error("Summarize Error:", error);
        alert(error.message || "Failed to summarize. Please try again.");

        // Hide output on error
        outputWrap.hidden = true;

    } finally {
        state.isLoading = false;
        setButtonLoading(btn, false);
    }
};

  summarizeBtn.addEventListener('click', handleSummarize);
  // Copy/download/share/save/regenerate/rating
  copyBtn.addEventListener('click', triggerCopy);
  downloadBtn.addEventListener('click', triggerDownload);
  shareBtn.addEventListener('click', triggerShare);
  saveBtn.addEventListener('click', saveSummary);

// REGENERATE BUTTON - URL MODE FIX
regenBtn.addEventListener("click", async () => {
    // Get input from URL input field only
    const urlInput = document.getElementById('urlInput');
    const inputText = urlInput.value.trim();
    
    if (!inputText) {
        alert("Please paste a URL first.");
        return;
    }
    
    if (!inputText.startsWith('http://') && !inputText.startsWith('https://')) {
        alert("Please enter a valid URL starting with http:// or https://");
        return;
    }
    
    // Show loading state
    regenBtn.classList.add('loading');
    regenBtn.textContent = 'Regenerating...';
    
    try {
        const response = await fetch("http://localhost:3000/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: inputText
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || "Regenerate failed");
        }
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        // Update summary with streaming effect
        const streamText = document.getElementById('streamText');
        const cursor = document.getElementById('cursor');
        
        // Clear old summary
        streamText.innerHTML = '';
        cursor.style.opacity = '1';
        
        // Stream new summary word by word
        const words = data.summary.split(/(\s+)/).filter(w => w !== '');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            currentText += word;
            streamText.textContent = currentText;
            
            // Update summary word count
            const summaryWords = currentText.trim().split(/\s+/).filter(w => w.length > 0).length;
            document.getElementById('sumWords').textContent = summaryWords;
            
            // Random delay for streaming effect
            await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
        }
        
        cursor.style.opacity = '0';
        
        // Update original words
        const origWords = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;
        document.getElementById('origWords').textContent = origWords;
        
        // Update time saved
        const origTime = Math.ceil(origWords / 200);
        const sumWords = data.summary.trim().split(/\s+/).filter(w => w.length > 0).length;
        const sumTime = Math.ceil(sumWords / 200);
        const saved = origTime - sumTime;
        document.getElementById('timeSaved').textContent = saved > 0 ? saved + ' min' : '0 min';
        
        // Update blog title
        const titleGuess = inputText.replace(/^https?:\/\//, "").split("/")[0];
        document.getElementById('blogTitle').textContent = titleGuess;
        
        // Show output if hidden
        document.getElementById('outputWrap').hidden = false;
        
    } catch (error) {
        console.error("Regenerate Error:", error);
        alert("Failed to regenerate summary: " + error.message);
    } finally {
        regenBtn.classList.remove('loading');
        regenBtn.textContent = 'Regenerate';
    }
});
  ratingButtons.forEach((b) => {
    b.addEventListener('click', () => {
      const up = b.dataset.rate === 'up';
      ratingButtons.forEach((x) => x.style.borderColor = 'rgba(124,58,237,0.14)');
      b.style.borderColor = up ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)';
      b.textContent = up ? '✓ Helpful' : '✗ Not helpful';
      setTimeout(() => {
        // restore label
        b.textContent = up ? '👍 Thumbs up' : '👎 Thumbs down';
      }, 1600);
    });
  });

  // Scroll reveal
  const revealEls = $$('.reveal');
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));

  // Stats arcs count-up (simple)
  const stats = $$('.stat-arc');
  const animateCount = (el, target) => {
    const start = performance.now();
    const dur = 1100;
    const from = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(from + (target - from) * k).toLocaleString();
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io2 = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const el = e.target;
        const target = parseFloat(el.dataset.target || '0');
        animateCount(el, target);
        io2.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  stats.forEach((s) => io2.observe(s));

  // FAQ accordion
  $$('#faq .faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    const plus = item.querySelector('.faq-plus');
    q.addEventListener('click', () => {
      const isOpen = !a.hidden;
      // close siblings
      $$('#faq .faq-a').forEach((sibA) => {
        sibA.hidden = true;
      });
      $$('#faq .faq-q').forEach((sibQ) => {
        sibQ.setAttribute('aria-expanded', 'false');
      });
      $$('#faq .faq-plus').forEach((sibPlus) => {
        sibPlus.textContent = '+';
        sibPlus.style.transform = 'translateY(0)';
      });

      if (!isOpen) {
        a.hidden = false;
        q.setAttribute('aria-expanded', 'true');
        plus.textContent = '−';
      } else {
        a.hidden = true;
        q.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Smooth anchor scroll
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll], a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!hash || hash === '#') return;
    const el = document.querySelector(hash);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Cursor blink toggle while streaming
  cursor.style.opacity = '1';
})();
const summarizeBtnText = document.getElementById("summarizeBtnText");

summarizeBtnText.addEventListener("click", async () => {

    const text = document.getElementById("textInput").value;

    if (!text.trim()) {
        alert("Please enter some text.");
        return;
    }

    try {

        // Button loading start
        summarizeBtnText.classList.add("loading");

        const startTime = Date.now();

        const response = await fetch("http://localhost:3000/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text
            })
        });


        const data = await response.json();

        console.log(data);


        // Show Output Card
        outputWrap.hidden = false;


        // Show Summary
        streamText.textContent = data.summary;



        // =========================
        // WORD COUNT CALCULATION
        // =========================

        const originalWords = text
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0)
            .length;


        const summaryWords = data.summary
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0)
            .length;



        // Calculate Time Saved
        const originalReadingTime = Math.ceil(originalWords / 200);
        const summaryReadingTime = Math.ceil(summaryWords / 200);

        const timeSaved = originalReadingTime - summaryReadingTime;



        // =========================
        // UPDATE STATS
        // =========================

        document.getElementById("origWords").textContent = originalWords;

        document.getElementById("sumWords").textContent = summaryWords;

        document.getElementById("timeSaved").textContent = 
            timeSaved > 0 ? timeSaved + " min" : "0 min";



        // Optional Blog Title
        document.getElementById("blogTitle").textContent = 
            "Text Summary";


        // Stop Loading
        summarizeBtnText.classList.remove("loading");


    } catch (error) {

        console.error(error);

        summarizeBtnText.classList.remove("loading");

        alert("Backend Error");

    }

});