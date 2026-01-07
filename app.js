// app.js - shared behavior across pages
(() => {
  "use strict";

  // ================================
  // Keys / helpers
  // ================================
  const STORAGE = {
    ITINERARY: "taniti_itinerary_v1",
    PLAN_BOOKING: "taniti_plan_booking"
  };

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ================================
  // Itinerary
  // ================================
  function getItinerary() {
    const items = readJSON(STORAGE.ITINERARY, []);
    return Array.isArray(items) ? items : [];
  }

  function setItinerary(items) {
    writeJSON(STORAGE.ITINERARY, Array.isArray(items) ? items : []);
  }

  function updateItineraryBadge() {
    const badge = $("[data-itinerary-count]");
    if (badge) badge.textContent = String(getItinerary().length);
  }

  function flashButtonAdded(btn) {
    const original = btn.textContent;

    btn.textContent = "Added ✓";
    btn.disabled = true;
    btn.style.opacity = "0.75";

    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
      btn.style.opacity = "1";
    }, 900);
  }

  function addToItineraryFromButton(btn) {
    const id = btn?.dataset?.addId;
    if (!id) return;

    const item = {
      id,
      type: btn.dataset.addType || "Item",
      title: btn.dataset.addTitle || "Untitled",
      meta: btn.dataset.addMeta || "",
      addedAt: new Date().toISOString()
    };

    const items = getItinerary();
    if (!items.some((x) => x.id === id)) {
      items.push(item);
      setItinerary(items);
    }

    updateItineraryBadge();
    flashButtonAdded(btn);
  }

  function wireAddButtons() {
    $$("[data-add-id]").forEach((btn) => {
      btn.addEventListener("click", () => addToItineraryFromButton(btn));
    });
  }

  function renderItineraryPage() {
    const mount = $("[data-itinerary-mount]");
    if (!mount) return;

    const items = getItinerary();
    mount.innerHTML = "";

    if (items.length === 0) {
      mount.innerHTML =
        `<p class="sub">No items yet. Browse Activities or Stay and add something.</p>`;
      return;
    }

    for (const item of items) {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <p class="item-title">${escapeHtml(item.title)}</p>
          <p class="item-meta">${escapeHtml(item.type)} • ${escapeHtml(item.meta)}</p>
        </div>
        <button class="btn ghost" type="button" data-remove-id="${escapeHtml(item.id)}">Remove</button>
      `;
      mount.appendChild(el);
    }

    $$("[data-remove-id]", mount).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.removeId;
        const updated = getItinerary().filter((x) => x.id !== id);
        setItinerary(updated);
        updateItineraryBadge();
        renderItineraryPage();
      });
    });
  }

  function wireClearButton() {
    const clearBtn = $("[data-clear-itinerary]");
    if (!clearBtn) return;

    clearBtn.addEventListener("click", () => {
      setItinerary([]);
      updateItineraryBadge();
      renderItineraryPage();
    });
  }

  // ================================
  // Nav active state
  // ================================
  function setActiveNav() {
    const page = document.body?.dataset?.page;
    if (!page) return;

    $$("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === page);
    });
  }

  // ================================
  // Cycling filter utility (Activities / Stay)
  // ================================
  function createCyclingFilters({
    rootSelector,
    buttonIds,
    options,
    initialState,
    cardSelector,
    matches,
    updateLabels,
    updateActiveStyles
  }) {
    if (rootSelector && !$(rootSelector)) return;

    const buttons = Object.fromEntries(
      Object.entries(buttonIds).map(([key, id]) => [key, document.getElementById(id)])
    );

    // Require all filter buttons (plus reset)
    if (Object.values(buttons).some((el) => !el)) return;

    const cards = $$(cardSelector);
    const state = { ...initialState };

    function cycle(current, list) {
      const i = list.indexOf(current);
      return list[(i + 1) % list.length];
    }

    function apply() {
      cards.forEach((card) => {
        card.classList.toggle("is-hidden", !matches(card, state));
      });
    }

    function sync() {
      updateLabels(buttons, state);
      updateActiveStyles(buttons, state);
      apply();
    }

    // Wire filter buttons (not reset)
    Object.keys(options).forEach((key) => {
      buttons[key].addEventListener("click", () => {
        state[key] = cycle(state[key], options[key]);
        sync();
      });
    });

    // Reset
    buttons.reset.addEventListener("click", () => {
      Object.assign(state, initialState);
      sync();
    });

    // Init
    sync();
  }

  // ================================
  // Activities filters
  // ================================
  function initActivitiesFilters() {
    createCyclingFilters({
      rootSelector: "[data-page='activities']",
      buttonIds: {
        category: "filterCategory",
        duration: "filterDuration",
        family: "filterFamily",
        location: "filterLocation",
        reset: "filterReset"
      },
      options: {
        category: ["All", "Adventure", "Culture", "Relaxation"],
        duration: ["All", "Short", "Half-day", "Full-day"],
        family: ["Any", "Yes", "No"],
        location: ["All", "Taniti City", "Yellow Leaf Bay", "Rainforest", "Volcano"]
      },
      initialState: {
        category: "All",
        duration: "All",
        family: "Any",
        location: "All"
      },
      cardSelector: "[data-activity]",
      matches: (card, state) => {
        const c = card.dataset.category || "";
        const d = card.dataset.duration || "";
        const f = card.dataset.family || "";
        const l = card.dataset.location || "";

        const okCategory = state.category === "All" || c === state.category;
        const okDuration = state.duration === "All" || d === state.duration;
        const okFamily = state.family === "Any" || f === state.family;
        const okLocation = state.location === "All" || l === state.location;

        return okCategory && okDuration && okFamily && okLocation;
      },
      updateActiveStyles: (btn, state) => {
        btn.category.classList.toggle("active", state.category !== "All");
        btn.duration.classList.toggle("active", state.duration !== "All");
        btn.family.classList.toggle("active", state.family !== "Any");
        btn.location.classList.toggle("active", state.location !== "All");
      },
      updateLabels: (btn, state) => {
        btn.category.textContent = `Category: ${state.category}`;
        btn.duration.textContent = `Duration: ${state.duration}`;
        btn.family.textContent = `Family: ${state.family}`;
        btn.location.textContent = `Location: ${state.location}`;
      }
    });
  }

  // ================================
  // Stay filters
  // ================================
  function initStayFilters() {
    createCyclingFilters({
      rootSelector: "[data-page='stay']",
      buttonIds: {
        type: "stayType",
        price: "stayPrice",
        rating: "stayRating",
        area: "stayArea",
        reset: "stayReset"
      },
      options: {
        type: ["All", "Resort", "Hotel", "B&B", "Hostel"],
        price: ["All", "Budget", "Mid-range", "Premium"],
        rating: ["All", "3+", "4+", "5"],
        area: ["All", "Taniti City", "Beachfront", "Rainforest"]
      },
      initialState: {
        type: "All",
        price: "All",
        rating: "All",
        area: "All"
      },
      cardSelector: "[data-stay]",
      matches: (card, state) => {
        const t = card.dataset.type || "";
        const p = card.dataset.price || "";
        const r = card.dataset.rating || "";
        const a = card.dataset.area || "";

        const okType = state.type === "All" || t === state.type;
        const okPrice = state.price === "All" || p === state.price;
        const okRating = state.rating === "All" || r === state.rating;
        const okArea = state.area === "All" || a === state.area;

        return okType && okPrice && okRating && okArea;
      },
      updateActiveStyles: (btn, state) => {
        btn.type.classList.toggle("active", state.type !== "All");
        btn.price.classList.toggle("active", state.price !== "All");
        btn.rating.classList.toggle("active", state.rating !== "All");
        btn.area.classList.toggle("active", state.area !== "All");
      },
      updateLabels: (btn, state) => {
        btn.type.textContent = `Type: ${state.type}`;
        btn.price.textContent = `Price: ${state.price}`;
        btn.rating.textContent = `Rating: ${state.rating}`;
        btn.area.textContent = `Area: ${state.area}`;
      }
    });
  }

  // ================================
  // Plan & Book
  // ================================
  function initPlanAndBook() {
    const btnA = document.getElementById("planActivities");
    const btnL = document.getElementById("planLodging");
    const btnT = document.getElementById("planTransport");

    const dateInput = document.getElementById("planDate");
    const optionDisplay = document.getElementById("planOptionDisplay");
    const continueBtn = document.getElementById("planContinue");
    const helper = document.getElementById("planHelper");

    const saveDraftBtn = document.getElementById("planSaveDraft");
    const submitBtn = document.getElementById("planSubmit");
    const status = document.getElementById("planStatus");

    if (!btnA || !btnL || !btnT || !dateInput || !optionDisplay || !continueBtn) return;

    const state = { option: "Activities", date: "" };

    const saved = readJSON(STORAGE.PLAN_BOOKING, null);
    if (saved && typeof saved === "object") {
      if (typeof saved.option === "string") state.option = saved.option;
      if (typeof saved.date === "string") state.date = saved.date;
    }

    function persist() {
      writeJSON(STORAGE.PLAN_BOOKING, state);
    }

    function validate() {
      const ok = Boolean(state.date);
      continueBtn.disabled = !ok;
      continueBtn.style.opacity = ok ? "1" : "0.6";
    }

    function setOption(option) {
      state.option = option;

      btnA.classList.toggle("active", option === "Activities");
      btnL.classList.toggle("active", option === "Lodging");
      btnT.classList.toggle("active", option === "Transport");

      optionDisplay.textContent = option;
      if (helper) helper.textContent = `Selected: ${option}. Choose a date to continue.`;

      persist();
      validate();
    }

    btnA.addEventListener("click", () => setOption("Activities"));
    btnL.addEventListener("click", () => setOption("Lodging"));
    btnT.addEventListener("click", () => setOption("Transport"));

    dateInput.addEventListener("input", (e) => {
      state.date = e.target.value || "";
      persist();
      validate();
    });

    continueBtn.addEventListener("click", () => {
      if (!state.date) return;

      if (helper) {
        helper.textContent = `Great — ${state.option} on ${state.date}. Fill in details below, then submit.`;
      }

      const card = continueBtn.closest(".card");
      const top = (card ? card.offsetTop : continueBtn.offsetTop) + 250;
      window.scrollTo({ top, behavior: "smooth" });
    });

    if (saveDraftBtn) {
      saveDraftBtn.addEventListener("click", () => {
        persist();
        if (status) status.textContent = "Draft saved (prototype).";
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (!state.date) {
          if (status) status.textContent = "Please choose a date before submitting.";
          return;
        }
        if (status) status.textContent = `Submitted request (prototype): ${state.option} on ${state.date}.`;
      });
    }

    // Init UI
    dateInput.value = state.date;
    setOption(state.option);
    validate();
  }

  // ================================
  // Init
  // ================================
  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    updateItineraryBadge();

    wireAddButtons();
    renderItineraryPage();
    wireClearButton();

    initActivitiesFilters();
    initStayFilters();
    initPlanAndBook();
  });
})();
