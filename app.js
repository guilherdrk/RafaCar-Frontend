(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // BASE: tenta variável de ambiente global (__BASE_URL), depois localStorage, depois hardcode
  const BASE = () => {
    if (window.__BASE_URL) return window.__BASE_URL;
    const saved = localStorage.getItem("BASE_URL");
    if (saved) return saved;
    return "https://rafacar-project.onrender.com";
  };
  if (!BASE()) {
    console.error("BASE não está definida!");
    if (typeof toast === "function") toast("Erro: A URL do backend não foi configurada.");
  }

  // Navegação por tabs
  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$(".tab").forEach(sec => sec.classList.remove("active"));
      const el = $("#tab-" + tab);
      if (el) el.classList.add("active");
    });
  });

  // Toast simples
  function toast(msg){ const t=$("#toast"); if(!t) return; t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2200); }

  // Helpers
  const money = (v) => {
    if (v === null || v === undefined) return "—";
    try { return Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
    catch { return v; }
  };
  const pad2 = (n) => String(n).padStart(2,"0");
  const fmtMonth = (m) => pad2(m);

  async function api(path, opts={}){
    const url = BASE() + path;
    const res = await fetch(url, {
      headers: { "Content-Type":"application/json" },
      ...opts
    });
    if (!res.ok){
      const text = await res.text();
      throw new Error(`HTTP ${res.status} — ${text}`);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  }

  // ====== Veículos ======
  async function listarVeiculos(){
    const data = await api("/veiculos");
    const tbody = $("#tVeiculos");
    tbody.innerHTML = "";
    data.forEach(v => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${v.nome ?? ""}</td>
        <td>${money(v.preco)}</td>
        <td>${money(v.custo)}</td>
        <td>${v.imagemUrl ? `<a href="${v.imagemUrl}" target="_blank">link</a>`:"—"}</td>
        <td>
          <button class="icon" data-edit="${v.id}">✏️</button>
          <button class="icon" data-del="${v.id}">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // popular selects dependentes
    popularSelectVeiculos(data);

    // bind ações
    tbody.querySelectorAll("button[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => editarVeiculo(Number(btn.dataset.edit)));
    });
    tbody.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", () => removerVeiculo(Number(btn.dataset.del)));
    });
  }

  function popularSelectVeiculos(list){
    const sel = $("#vd-veiculo");
    const sel2 = $("#d-veiculo");
    [sel, sel2].forEach(s => { if (s) s.innerHTML = `<option value="">—</option>`; });
    list.forEach(v => {
      const o = document.createElement("option");
      o.value = v.id;
      o.textContent = `${v.id} — ${v.nome}`;
      if (sel) sel.appendChild(o.cloneNode(true));
      if (sel2) sel2.appendChild(o.cloneNode(true));
    });
  }

  async function salvarVeiculo(e){
    e.preventDefault();
    const id = $("#v-id").value.trim();
    const payload = {
      nome: $("#v-nome").value.trim(),
      preco: Number($("#v-preco").value),
      custo: Number($("#v-custo").value),
      imagemUrl: $("#v-imagemUrl").value.trim() || null
    };
    const path = id ? `/veiculos/${id}` : "/veiculos";
    const method = id ? "PUT" : "POST";
    await api(path, { method, body: JSON.stringify(payload) });
    toast("Veículo salvo.");
    $("#fVeiculo").reset();
    $("#v-id").value = "";
    listarVeiculos();
  }

  async function editarVeiculo(id){
    const v = await api(`/veiculos/${id}`);
    $("#v-id").value = v.id;
    $("#v-nome").value = v.nome ?? "";
    $("#v-preco").value = v.preco ?? "";
    $("#v-custo").value = v.custo ?? "";
    $("#v-imagemUrl").value = v.imagemUrl ?? "";
    toast("Editando veículo #" + id);
  }

  async function removerVeiculo(id){
    if (!confirm("Remover veículo #" + id + "?")) return;
    await api(`/veiculos/${id}`, { method: "DELETE" });
    toast("Veículo removido.");
    listarVeiculos();
  }
  const evFVeiculo = $("#fVeiculo");
  if (evFVeiculo) evFVeiculo.addEventListener("submit", salvarVeiculo);
  const evVCancel = $("#v-cancelar");
  if (evVCancel) evVCancel.addEventListener("click", () => { $("#fVeiculo").reset(); $("#v-id").value=""; });

  // ====== Vendas (adaptado para backend que usa apenas dias e precoPorDiaCustomizado) ======
  async function listarVendas(){
    const data = await api("/locacoes");
    const tbody = $("#tVendas");
    tbody.innerHTML = "";

    data.forEach(v => {
      // veiculo pode ser string (DTO) ou objeto
      const veiculoName = (typeof v.veiculo === "string") ? v.veiculo : (v.veiculo?.nome ?? (v.veiculo?.id ? `#${v.veiculo.id}` : "—"));

      // dias (obrigatório no novo backend)
      const dias = Number(v.dias ?? 1);

      // Preço unitário (por dia) vindo do DTO (precoUnitario) 
      // fallback para precoPorDia / precoPorDiaCustomizado se DTO não tiver
      const precoUnit = v.precoUnitario ?? v.precoPorDiaCustomizado ?? v.precoPorDia ?? null;

      // custoTotal, total, lucro, margem — o DTO já retorna esses campos (se não, fazemos fallback)
      const total = v.total ?? (precoUnit !== null ? Number(precoUnit) * dias : 0);
      const custoTotal = v.custoTotal ?? (v.veiculo?.custo ? Number(v.veiculo.custo) * dias : 0);
      const lucro = v.lucro ?? (total - custoTotal);
      const margem = v.margem ?? (total ? (lucro / total * 100) : 0);

      const dt = v.dataVenda ?? v.data ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.id}</td>
        <td>${veiculoName}</td>
        <td>${dias}</td>
        <td>${money(precoUnit)}</td>
        <td>${money(custoTotal)}</td>
        <td>${money(total)}</td>
        <td>${money(lucro)}</td>
        <td>${Number(margem).toFixed(2)}</td>
        <td>${dt ? new Date(dt + 'Z').toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
        <td><button class="icon" data-delv="${v.id}">🗑️</button></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("button[data-delv]").forEach(btn => {
      btn.addEventListener("click", () => removerVenda(Number(btn.dataset.delv)));
    });
  }

  async function salvarVenda(e){
    e.preventDefault();
    const veiculoId = $("#vd-veiculo").value;
    if (!veiculoId) { alert("Selecione um veículo"); return; }

    // agora o backend espera dias (nº de diárias) — não usamos quantidade
    const dias = Number($("#vd-dias")?.value || 1);

    const payload = {
      veiculo: { id: Number(veiculoId) },
      dias: dias
    };

    const precoStr = $("#vd-preco").value;
    if (precoStr && !isNaN(Number(precoStr))) {
      // enviar Campo customizado (quando cliente devolve antes das 24h)
      payload.precoPorDiaCustomizado = Number(precoStr);
    }

    const dt = $("#vd-data").value;
    if (dt) payload.dataVenda = new Date(dt).toISOString();


    await api("/locacoes", { method:"POST", body: JSON.stringify(payload) });
    toast("Venda registrada.");
    $("#fVenda").reset();
    listarVendas();
    carregarResumo();
  }

  async function removerVenda(id){
    if (!confirm("Remover venda #" + id + "?")) return;
    await api(`/locacoes/${id}`, { method:"DELETE" });
    toast("Venda removida.");
    listarVendas();
    carregarResumo();
  }
  const evFVenda = $("#fVenda");
  if (evFVenda) evFVenda.addEventListener("submit", salvarVenda);

  // ====== Despesas ======
  async function listarDespesas(){
    const data = await api("/despesas");
    const tbody = $("#tDespesas");
    tbody.innerHTML = "";
    data.forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.id}</td>
        <td>${d.descricao ?? ""}</td>
        <td>${money(d.valor)}</td>
        <td>${d.data ? new Date(d.data).toLocaleDateString("pt-BR") : "—"}</td>
        <td>${d.veiculo ? (d.veiculo.id + " — " + (d.veiculo.nome ?? "")) : "—"}</td>
        <td><button class="icon" data-deld="${d.id}">🗑️</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button[data-deld]").forEach(btn => {
      btn.addEventListener("click", () => removerDespesa(Number(btn.dataset.deld)));
    });
  }

  async function salvarDespesa(e){
    e.preventDefault();
    const veiculoId = $("#d-veiculo").value;
    const payload = {
      descricao: $("#d-descricao").value.trim(),
      valor: Number($("#d-valor").value),
    };
    const dt = $("#d-data").value;
    if (dt) payload.data = dt; // LocalDate (yyyy-MM-dd)
    if (veiculoId) payload.veiculo = { id: Number(veiculoId) };
    await api("/despesas", { method:"POST", body: JSON.stringify(payload) });
    toast("Despesa criada.");
    $("#fDespesa").reset();
    listarDespesas();
    carregarResumo();
  }
  async function removerDespesa(id){
    if (!confirm("Remover despesa #" + id + "?")) return;
    await api(`/despesas/${id}`, { method:"DELETE" });
    toast("Despesa removida.");
    listarDespesas();
    carregarResumo();
  }
  const evFDespesa = $("#fDespesa");
  if (evFDespesa) evFDespesa.addEventListener("submit", salvarDespesa);

  // ====== Resumo ======
  async function carregarResumo(){
    let linhas = [];
    try {
      linhas = await api("/financeiro/resumo-mensal");
    } catch (e) {
      console.warn("Falha no /financeiro/resumo-mensal, tentando combinar vendas+despesas...", e);
      try {
        const rec = await api("/locacoes/resumo-mensal");
        const des = await api("/despesas/resumo-mensal");
        const mapa = new Map();
        rec.forEach(r => {
          const key = `${r.ano}-${r.mes}`;
          const receita = (r.total ?? r.receita ?? r.lucro ?? 0);
          mapa.set(key, {ano:r.ano, mes:r.mes, receita: receita, despesa:0, lucro:(r.lucro ?? receita)});
        });
        des.forEach(d => {
          const key = `${d.ano}-${d.mes}`;
          const prev = mapa.get(key) || {ano:d.ano, mes:d.mes, receita:0, despesa:0, lucro:0};
          prev.despesa = (d.total ?? d.despesa ?? d.despesas ?? 0);
          prev.lucro = (prev.receita || 0) - (prev.despesa || 0);
          mapa.set(key, prev);
        });
        linhas = Array.from(mapa.values()).sort((a,b)=> (b.ano-a.ano) || (b.mes-a.mes));
      } catch (err) {
        console.warn("Fallback resumo falhou", err);
      }
    }

    const tbody = $("#tResumo");
    if (!tbody) return;
    tbody.innerHTML = "";
    const now = new Date();
    const anoAtual = now.getFullYear();
    const mesAtual = now.getMonth()+1;
    let receitaAtual=0, despesaAtual=0, lucroAtual=0;

    linhas.forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${l.ano}</td>
        <td>${fmtMonth(l.mes)}</td>
        <td>${money(l.receita)}</td>
        <td>${money((l.despesa ?? l.despesas ?? 0))}</td>
        <td>${money(l.lucro)}</td>`;
      tbody.appendChild(tr);
      if (l.ano===anoAtual && l.mes===mesAtual){
        receitaAtual = Number(l.receita||0);
        despesaAtual = Number((l.despesa ?? l.despesas ?? 0) || 0);
        lucroAtual = Number(l.lucro||0);
      }
    });
    const rEl = $("#receitaMes"), dEl = $("#despesaMes"), lEl = $("#lucroMes");
    if (rEl) rEl.textContent = money(receitaAtual);
    if (dEl) dEl.textContent = money(despesaAtual);
    if (lEl) lEl.textContent = money(lucroAtual);
  }

  async function carregarTudo(){
    try {
      await listarVeiculos();
      await listarVendas();
      await listarDespesas();
      await carregarResumo();
    } catch (e) {
      console.error(e);
      toast("Não foi possível carregar alguns dados. Verifique a URL do backend e o CORS.");
    }
  }

  // Boot
  carregarTudo();
})();
