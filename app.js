/* Agios Growth · comportamento compartilhado das 3 páginas. Sem bibliotecas. */
(function () {
  "use strict";
  var C = window.AG_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  window.dataLayer = window.dataLayer || [];

  /* ---------- config → textos da página ---------- */
  $$("[data-config='email']").forEach(function (el) {
    if (C.email) { el.innerHTML = '<a href="mailto:' + C.email + '">' + C.email + "</a>"; }
    else { el.textContent = "pelo WhatsApp de atendimento"; }
  });

  /* ---------- UTMs, fbclid, fbp, event_id ---------- */
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "p"];
  (function captureParams() {
    var q = new URLSearchParams(location.search);
    KEYS.forEach(function (k) { var v = q.get(k); if (v) store.set("ag_" + k, v); });
  })();
  function cookie(n) {
    var m = document.cookie.match(new RegExp("(^| )" + n + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : "";
  }
  function eventId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- Google Tag Manager (só com ID e com consentimento) ---------- */
  function loadGTM() {
    if (!C.gtmId || window.__agGtm) return;
    window.__agGtm = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(C.gtmId);
    document.head.appendChild(s);
  }
  (function consent() {
    if (!C.gtmId) return;
    var v = store.get("ag_consent") || (function () { try { return localStorage.getItem("ag_consent") || ""; } catch (e) { return ""; } })();
    if (v === "granted") { loadGTM(); return; }
    if (v === "denied") return;
    var bar = $("#cookie");
    if (!bar) return;
    bar.classList.add("on");
    function decide(val) {
      try { localStorage.setItem("ag_consent", val); } catch (e) {}
      store.set("ag_consent", val);
      bar.classList.remove("on");
      if (val === "granted") loadGTM();
    }
    $("#cookie-ok").addEventListener("click", function () { decide("granted"); });
    $("#cookie-no").addEventListener("click", function () { decide("denied"); });
  })();

  /* ---------- máscara e validação ---------- */
  function maskPhone(v) {
    var d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  /* ---------- formulário de aplicação (index) ---------- */
  var form = $("#form-lead");
  if (form) {
    var wa = $("#f-whatsapp");
    wa.addEventListener("input", function () { wa.value = maskPhone(wa.value); });

    var rules = {
      nome: function (v) { return v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 ? "" : "Informe nome e sobrenome."; },
      cidade: function (v) { return v.trim().length >= 2 ? "" : "Informe sua cidade."; },
      whatsapp: function (v) { var n = v.replace(/\D/g, ""); return n.length === 11 && n.charAt(2) === "9" ? "" : "Use o formato (DD) 9XXXX-XXXX."; },
      descricao: function (v) { return v.trim().length >= 15 ? "" : "Conte em uma frase o que você ensina e onde trava hoje."; }
    };
    function check(name) {
      var el = form.elements[name], msg = rules[name](el.value);
      var box = el.closest(".field");
      box.classList.toggle("bad", !!msg);
      $(".err", box).textContent = msg;
      el.setAttribute("aria-invalid", msg ? "true" : "false");
      return !msg;
    }
    Object.keys(rules).forEach(function (n) {
      form.elements[n].addEventListener("blur", function () { check(n); });
    });

    var sending = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var msg = $("#fmsg"); msg.textContent = "";
      var ok = true, first = null;
      Object.keys(rules).forEach(function (n) { if (!check(n)) { ok = false; first = first || form.elements[n]; } });
      if (!ok) { first.focus(); return; }
      if (form.elements.empresa.value) { return; } /* isca: robô preencheu */

      sending = true;
      var btn = $("button[type=submit]", form);
      btn.disabled = true; btn.textContent = "Enviando…";

      var id = eventId("ag");
      var data = {
        nome: form.elements.nome.value.trim(),
        cidade: form.elements.cidade.value.trim(),
        whatsapp: form.elements.whatsapp.value,
        descricao: form.elements.descricao.value.trim(),
        event_id: id,
        fbp: cookie("_fbp"),
        pagina: location.origin + location.pathname,
        horario: new Date().toISOString()
      };
      KEYS.forEach(function (k) { data[k === "p" ? "promessa" : k] = store.get("ag_" + k); });
      data.fbc = "";
      store.set("ag_nome", data.nome.split(/\s+/)[0]);
      store.set("ag_event_id", id);

      window.dataLayer.push({ event: "generate_lead", event_id: id, lead_source: "lp_infoprodutores" });

      var done = function () { location.href = "obrigado.html"; };
      if (!C.webhookUrl) {
        console.warn("[Agios] config.js sem webhookUrl: o lead NÃO foi enviado a nenhum destino.");
        return done();
      }
      var send = fetch(C.webhookUrl, { method: "POST", mode: "no-cors", keepalive: true, body: new URLSearchParams(data) });
      Promise.race([send, new Promise(function (r) { setTimeout(r, 2500); })]).then(done, function () {
        sending = false; btn.disabled = false; btn.textContent = "Enviar para análise";
        msg.textContent = "Não consegui enviar agora. Confira sua conexão e tente de novo.";
      });
    });
  }

  /* ---------- botões que levam ao formulário ---------- */
  $$("[data-go-form]").forEach(function (a) {
    a.addEventListener("click", function () {
      setTimeout(function () { var f = $("#f-nome"); if (f) f.focus({ preventScroll: true }); }, 450);
    });
  });

  /* ---------- obrigado ---------- */
  var tyName = $("#ty-nome");
  if (tyName) {
    var n = store.get("ag_nome");
    if (n) tyName.textContent = ", " + n;
  }
  var waBtn = $("#btn-wa");
  if (waBtn) {
    var num = (C.whatsapp || "").replace(/\D/g, "");
    var txt = encodeURIComponent(C.whatsappMsg || "");
    waBtn.href = num ? "https://wa.me/" + num + "?text=" + txt : "https://wa.me/?text=" + txt;
    waBtn.addEventListener("click", function () {
      window.dataLayer.push({ event: "join_group", event_id: eventId("ag_wa"), cta: "whatsapp_obrigado" });
    });
  }

  /* ---------- inclinação 3D dos cards (só com mouse, sem reduzir movimento) ---------- */
  var fine = window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  var calm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (fine && !calm) {
    $$(".sol").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        c.style.setProperty("--ry", (x * 9).toFixed(2) + "deg");
        c.style.setProperty("--rx", (-y * 9).toFixed(2) + "deg");
      });
      c.addEventListener("pointerleave", function () {
        c.style.setProperty("--ry", "0deg"); c.style.setProperty("--rx", "0deg");
      });
    });
  }
})();
