
    // ============================================================
    // EDIT PRICES HERE. Values are in INR and USD respectively.
    // GST is shown separately as an additional estimated tax amount.
    // ============================================================
    const PRICING_CONFIG = {
      baseLayout: {
        "2": { inr: 4000, usd: 75 },
        "4": { inr: 18000, usd: 320 },
        "6": { inr: 32000, usd: 550 }
      },
      componentAllowance: 30,
      extraComponent: { inr: 50, usd: 1 },
      startingPoint: {
        verified: { inr: 0, usd: 0, label: "Verified KiCad schematic" },
        pdf: { inr: 2500, usd: 45, label: "PDF / hand-drawn schematic" },
        scratch: { inr: 6000, usd: 110, label: "Full circuit design from scratch" }
      },
      complexity: {
        fine: { inr: 2000, usd: 35, label: "Fine-pitch QFN / BGA / 0201" },
        highspeed: { inr: 2500, usd: 45, label: "High-speed / impedance control" },
        rf: { inr: 2000, usd: 35, label: "RF / antenna layout" },
        mechanical: { inr: 1500, usd: 25, label: "Strict enclosure constraints" }
      },
      addons: {
        bom: { inr: 1500, usd: 25, label: "BOM optimization & sourcing" },
        step: { inr: 1000, usd: 20, label: "3D STEP export" },
        footprints: { inr: 400, usd: 8, label: "Custom KiCad footprints", perPart: true }
      },
      rushMultiplier: 1.35,
      standardDays: "7–10 days",
      rushDays: "3–4 days",
      estimateBuffer: 0.10,
      gstRate: 0.18
    }

    // ================= ENQUIRY INTEGRATION SETTINGS =================
    // Set these after creating your Supabase project and Edge Function.
    const ENQUIRY_CONFIG = {
      // Example: https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-enquiry
      endpoint: "https://bqhluvmuihrqjgbjonkb.supabase.co/functions/v1/submit-enquiry",
      // International format, digits only, no +, spaces or punctuation.
      // Example for India: "919876543210"
      whatsappNumber: "917058064354"
    };
;

    (() => {
      const $ = (id) => document.getElementById(id);
      const STORAGE_KEY = "jaswikVenturesPricingConfigV1";
      let config = structuredCloneSafe(PRICING_CONFIG);
      let currency = "inr";
      const fmt = (amount) => currency === "inr"
        ? new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:0 }).format(amount)
        : new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(amount);
      function structuredCloneSafe(obj){ return JSON.parse(JSON.stringify(obj)); }
      function getChecked(name){ return document.querySelector(`input[name="${name}"]:checked`).value; }
      function addRow(label, amount, rows){ if(amount !== 0) rows.push({label, amount}); }

      function calculate(){
        const layer = $("layers").value;
        const parts = Number($("components").value);
        const excess = Math.max(0, parts - Number(config.componentAllowance || 30));
        const starting = getChecked("starting");
        const rush = getChecked("speed") === "rush";
        const rows = [];
        let subtotal = 0;
        const base = config.baseLayout[layer][currency];
        rows.push({label:`${layer === "6" ? "6+ layer" : layer + "-layer"} base PCB layout`, amount:base});
        subtotal += base;

        const componentCost = excess * config.extraComponent[currency];
        addRow(`Additional components (${excess} × ${fmt(config.extraComponent[currency])})`, componentCost, rows);
        subtotal += componentCost;

        const startCost = config.startingPoint[starting][currency];
        addRow(config.startingPoint[starting].label, startCost, rows);
        subtotal += startCost;

        document.querySelectorAll(".complexity:checked").forEach(el => {
          const item = config.complexity[el.value];
          rows.push({label:item.label, amount:item[currency]});
          subtotal += item[currency];
        });
        document.querySelectorAll(".addon:checked").forEach(el => {
          const item = config.addons[el.value];
          let amount = item[currency];
          let label = item.label;
          if(item.perPart){ const count = Math.max(1, Math.min(100, Number($("customParts").value) || 1)); amount *= count; label += ` (${count} part${count===1?"":"s"})`; }
          rows.push({label, amount}); subtotal += amount;
        });

        const multiplier = rush ? Number(config.rushMultiplier) : 1;
        const total = subtotal * multiplier;
        if(rush) rows.push({label:`Rush scheduling (${multiplier.toFixed(2)}×)`, amount:total-subtotal});
        const gstRate = Number(config.gstRate ?? 0.18);
        const gst = total * gstRate;
        const totalWithGst = total + gst;
        $("priceRange").textContent = fmt(totalWithGst);
        $("baseTotal").textContent = `Design charges before GST: ${fmt(total)} · GST (${(gstRate*100).toFixed(0)}%) included below`;
        $("deliveryDays").textContent = rush ? config.rushDays : config.standardDays;
        $("componentValue").textContent = `${parts} parts`;
        $("breakdown").innerHTML = rows.map(row => `<div class="break-row"><span>${escapeHtml(row.label)}</span><span>${fmt(row.amount)}</span></div>`).join("") +
          `<div class="break-row total"><span>Design subtotal (before GST)</span><span>${fmt(total)}</span></div>`;
        $("taxBreakdown").innerHTML =
          `<div class="break-row"><span>GST (${(gstRate*100).toFixed(0)}%) — extra</span><span>${fmt(gst)}</span></div>` +
          `<div class="break-row total"><span>Final quotation total (including GST)</span><span>${fmt(totalWithGst)}</span></div>`;
        return {layer,parts,starting,rush,rows,total,gst,gstRate,totalWithGst,delivery:rush?config.rushDays:config.standardDays};
      }
      function escapeHtml(value){return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

      function quoteText(result){
        const complexities = [...document.querySelectorAll(".complexity:checked")].map(el=>config.complexity[el.value].label);
        const addons = [...document.querySelectorAll(".addon:checked")].map(el=>{
          const item=config.addons[el.value];
          return item.perPart ? `${item.label} (${Math.max(1,Number($("customParts").value)||1)} part(s))` : item.label;
        });
        return [
          "PCB DESIGN QUOTATION — Jaswik Ventures",
          `Currency: ${currency.toUpperCase()}`,
          `Board: ${result.layer === "6" ? "6+ Layers" : result.layer + "-Layer"} | Estimated components: ${result.parts}`,
          `Starting point: ${config.startingPoint[result.starting].label}`,
          `Technical complexity: ${complexities.length?complexities.join(", "):"None selected"}`,
          `Add-on deliverables: ${addons.length?addons.join(", "):"None selected"}`,
          `Turnaround: ${result.rush?"Rush":"Standard"} (${result.delivery})`,
          "",
          "QUOTATION BREAKDOWN:",
          ...result.rows.map(row=>`- ${row.label}: ${fmt(row.amount)}`),
          `Design subtotal before GST: ${fmt(result.total)}`,
          `GST (${(result.gstRate*100).toFixed(0)}%): ${fmt(result.gst)}`,
          `FINAL QUOTATION TOTAL (INCLUDING GST): ${fmt(result.totalWithGst)}`,
          `Target delivery: ${result.delivery}`,
          "",
          "Quotation terms: This quotation is based on the project scope and specifications selected/provided at the time of quotation. It covers only the services and deliverables listed. Changes to approved design requirements, additional features or services, or revisions outside the agreed scope may incur additional charges. Any additional work will be quoted separately and started only after customer approval. PCB fabrication, components and shipping are excluded unless specifically listed."
        ].join("\n");
      }

      function render(){
        const footprintOption = document.querySelector('input.addon[value="footprints"]');
        $("customParts").disabled = !(footprintOption && footprintOption.checked);
        return calculate();
      }
      // Sliders update on input; change also supports radio/checkbox interactions across browsers.
      document.querySelectorAll("#layers,#components,#customParts,input[name='starting'],input[name='speed'],.complexity,.addon").forEach(el=>{
        el.addEventListener("input",render);
        el.addEventListener("change",render);
      });
      $("inrBtn").addEventListener("click",()=>{currency="inr";$("inrBtn").classList.add("active");$("usdBtn").classList.remove("active");render();});
      $("usdBtn").addEventListener("click",()=>{currency="usd";$("usdBtn").classList.add("active");$("inrBtn").classList.remove("active");render();});
      $("customerMobile").addEventListener("input",()=>{
        const digits=$("customerMobile").value.replace(/\D/g,"");
        $("customerMobile").setCustomValidity(digits.length>=8 && digits.length<=15 ? "" : "Enter a valid mobile number with 8–15 digits, including country code if needed.");
      });
      const enquiryStatus = $("enquiryStatus");
      function setEnquiryStatus(message, state=""){
        enquiryStatus.textContent = message;
        enquiryStatus.dataset.state = state;
      }
      function getEnquiryPayload(){
        const customerName = $("customerName").value.trim();
        const customerMobile = $("customerMobile").value.trim();
        const digits = customerMobile.replace(/\D/g,"");
        $("customerName").setCustomValidity(customerName.length >= 2 ? "" : "Please enter your name.");
        $("customerMobile").setCustomValidity(digits.length >= 8 && digits.length <= 15 ? "" : "Enter a valid mobile number with 8–15 digits.");
        if (!$("enquiryForm").reportValidity()) return null;
        const result = render();
        return {
          customer_name: customerName,
          mobile_number: customerMobile,
          currency: currency.toUpperCase(),
          layer_count: result.layer === "6" ? "6+" : result.layer,
          component_count: result.parts,
          starting_point: config.startingPoint[result.starting].label,
          technical_complexity: [...document.querySelectorAll(".complexity:checked")].map(el=>config.complexity[el.value].label),
          addons: [...document.querySelectorAll(".addon:checked")].map(el=>{
            const item=config.addons[el.value];
            return item.perPart ? `${item.label} (${Math.max(1,Number($("customParts").value)||1)} part(s))` : item.label;
          }),
          custom_parts: Number($("customParts").value)||0,
          turnaround: result.rush ? "Rush (3–4 days)" : "Standard (7–10 days)",
          design_subtotal: Number(result.total.toFixed(2)),
          gst_rate: Number(result.gstRate),
          gst_amount: Number(result.gst.toFixed(2)),
          quotation_total: Number(result.totalWithGst.toFixed(2)),
          delivery_days: result.delivery,
          quote_breakdown: result.rows.map(row=>({label:row.label,amount:Number(row.amount.toFixed(2))})),
          quote_text: quoteText(result),
          website: $("website").value
        };
      }
      $("enquiryForm").addEventListener("submit", async (event)=>{
        event.preventDefault();
        const submitButton = $("contactQuote");
        const payload = getEnquiryPayload();
        if (!payload) return;
        if (payload.website) return; // honeypot: silently reject bots
        if (!ENQUIRY_CONFIG.endpoint || ENQUIRY_CONFIG.endpoint.includes("PASTE_YOUR_")){
          setEnquiryStatus("Website submission is not configured yet. Please contact info@jaswikventures.in while setup is completed.","error");
          return;
        }
        submitButton.disabled = true;
        submitButton.textContent = "Submitting…";
        setEnquiryStatus("Submitting your enquiry securely…","pending");
        try {
          const response = await fetch(ENQUIRY_CONFIG.endpoint,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(payload)
          });
          const data = await response.json().catch(()=>({}));
          if (!response.ok) throw new Error(data.error || "Submission failed. Please try again.");
          setEnquiryStatus(`Enquiry received successfully. Your reference number is ${data.enquiry_id || "confirmed"}. We will contact you shortly.`,"success");
          $("enquiryForm").reset();
          render();
        } catch(error) {
          setEnquiryStatus(`${error.message} You can alternatively enquire via WhatsApp.`,"error");
        } finally {
          submitButton.disabled = false;
          submitButton.innerHTML = 'Send Enquiry <span>↗</span>';
        }
      });
      $("whatsappEnquiry").addEventListener("click",()=>{
        const payload = getEnquiryPayload();
        if (!payload) return;
        if (!ENQUIRY_CONFIG.whatsappNumber){
          setEnquiryStatus("WhatsApp destination is not configured yet. Add your full WhatsApp Business number in ENQUIRY_CONFIG.","error");
          return;
        }
        const message = `Hello Jaswik Ventures, I would like to enquire about this PCB design project.\n\nCustomer: ${payload.customer_name}\nMobile: ${payload.mobile_number}\n\n${payload.quote_text}\n\nDesign subtotal: ${payload.currency} ${payload.design_subtotal}\nGST: ${payload.currency} ${payload.gst_amount}\nTotal including GST: ${payload.currency} ${payload.quotation_total}\n\nPlease contact me to discuss the project.`;
        const phone = ENQUIRY_CONFIG.whatsappNumber.replace(/\D/g,"");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer");
      });

      $("menuBtn").addEventListener("click",()=>{const open=$("navLinks").classList.toggle("open");$("menuBtn").setAttribute("aria-expanded",String(open));$("menuBtn").textContent=open?"×":"☰";});
      $("navLinks").querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{$("navLinks").classList.remove("open");$("menuBtn").setAttribute("aria-expanded","false");$("menuBtn").textContent="☰";}));
      // Decorative tank-level animation (illustrative only; not live device telemetry).
      const tankFill = $("tankWaterFill"), tankLine = $("tankWaterline"), tankPercent = $("tankPercent");
      if (tankFill && tankLine && tankPercent) {
        const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
          tankFill.style.height = "58%"; tankLine.style.bottom = "58%"; tankPercent.textContent = "58%";
        } else {
          const animateTank = (now) => {
            const level = 22 + (Math.sin(now / 5200) + 1) * 32; // smoothly cycles between 22% and 86%
            const value = Math.round(level);
            tankFill.style.height = level.toFixed(1) + "%";
            tankLine.style.bottom = level.toFixed(1) + "%";
            tankPercent.textContent = value + "%";
            window.requestAnimationFrame(animateTank);
          };
          window.requestAnimationFrame(animateTank);
        }
      }
      $("year").textContent="2026";
      try { render(); }
      catch(error) {
        console.error("PCB calculator initialization failed:", error);
        $("priceRange").textContent = "Calculator unavailable";
        $("baseTotal").textContent = "Please reload the page or reset saved pricing.";
        $("breakdown").textContent = "There is a calculator configuration issue. Please contact Jaswik Ventures for assistance.";
      }
    })();
  