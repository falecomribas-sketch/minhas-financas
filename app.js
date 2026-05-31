/* ============================================================
   APP DE CONTROLE FINANCEIRO  —  lógica principal
   Você NÃO precisa editar este arquivo.
   ============================================================ */

// ---------- Inicializa Firebase ----------
firebase.initializeApp(window.__FIREBASE_CONFIG__);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- Estado em memória ----------
let usuario = null;
let lancamentos = [];
let categorias = [];
let cartoes = [];
let tipoLancamentoAtual = "despesa";
let editandoId = { lanc: null, cat: null, cartao: null };

// Categorias padrão criadas no primeiro acesso
const CATEGORIAS_PADRAO = [
  { nome: "Alimentação", icone: "🍔", cor: "#d83933", tipo: "despesa" },
  { nome: "Transporte", icone: "🚗", cor: "#2563eb", tipo: "despesa" },
  { nome: "Moradia", icone: "🏠", cor: "#7c3aed", tipo: "despesa" },
  { nome: "Lazer", icone: "🎬", cor: "#ea580c", tipo: "despesa" },
  { nome: "Saúde", icone: "💊", cor: "#0891b2", tipo: "despesa" },
  { nome: "Outros", icone: "📦", cor: "#6b7280", tipo: "despesa" },
  { nome: "Salário", icone: "💵", cor: "#119E3F", tipo: "receita" },
  { nome: "Extra", icone: "✨", cor: "#16a34a", tipo: "receita" },
];

// ---------- Atalhos ----------
const $ = (id) => document.getElementById(id);
const moeda = (v) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesDe = (dataStr) => (dataStr || "").slice(0, 7); // "2026-05"

// ============================================================
//  AUTENTICAÇÃO
// ============================================================
let modoCadastro = false;

$("link-cadastrar").onclick = () => alternarModo(true);
$("link-voltar-login").onclick = () => alternarModo(false);

function alternarModo(cadastro) {
  modoCadastro = cadastro;
  $("btn-entrar").textContent = cadastro ? "Criar conta" : "Entrar";
  $("modo-cadastro-link").classList.toggle("oculto", cadastro);
  $("modo-login-link").classList.toggle("oculto", !cadastro);
  $("login-erro").classList.add("oculto");
}

$("btn-entrar").onclick = async () => {
  const email = $("login-email").value.trim();
  const senha = $("login-senha").value;
  if (!email || !senha) return mostrarErroLogin("Preencha e-mail e senha.");
  try {
    if (modoCadastro) {
      await auth.createUserWithEmailAndPassword(email, senha);
    } else {
      await auth.signInWithEmailAndPassword(email, senha);
    }
  } catch (e) {
    mostrarErroLogin(traduzErro(e.code));
  }
};

$("login-senha").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("btn-entrar").click();
});

$("btn-sair").onclick = () => auth.signOut();

function mostrarErroLogin(msg) {
  const el = $("login-erro");
  el.textContent = msg;
  el.classList.remove("oculto");
}

function traduzErro(code) {
  const m = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já tem conta. Faça login.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  };
  return m[code] || "Ocorreu um erro. Tente novamente.";
}

// Detecta login/logout
auth.onAuthStateChanged(async (u) => {
  if (u) {
    usuario = u;
    $("tela-login").classList.add("oculto");
    $("tela-app").classList.remove("oculto");
    $("header-email").textContent = u.email;
    await carregarTudo();
  } else {
    usuario = null;
    $("tela-app").classList.add("oculto");
    $("tela-login").classList.remove("oculto");
    $("login-email").value = "";
    $("login-senha").value = "";
  }
});

// ============================================================
//  ACESSO AO FIRESTORE
//  Estrutura: usuarios/{uid}/{colecao}/{doc}
// ============================================================
const col = (nome) => db.collection("usuarios").doc(usuario.uid).collection(nome);

async function carregarTudo() {
  $("carregando-inicial").classList.remove("oculto");
  const [snapCat, snapLanc, snapCard] = await Promise.all([
    col("categorias").get(),
    col("lancamentos").get(),
    col("cartoes").get(),
  ]);

  categorias = snapCat.docs.map((d) => ({ id: d.id, ...d.data() }));
  lancamentos = snapLanc.docs.map((d) => ({ id: d.id, ...d.data() }));
  cartoes = snapCard.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Cria categorias padrão no primeiro acesso
  if (categorias.length === 0) {
    for (const c of CATEGORIAS_PADRAO) {
      const ref = await col("categorias").add(c);
      categorias.push({ id: ref.id, ...c });
    }
  }

  $("carregando-inicial").classList.add("oculto");
  prepararFiltrosDeMes();
  renderTudo();
}

function renderTudo() {
  renderResumo();
  renderLancamentos();
  renderCartoes();
  renderCategorias();
  renderRelatorios();
  preencherSelectsCategoria();
  preencherSelectCartao();
}

// ============================================================
//  NAVEGAÇÃO ENTRE ABAS
// ============================================================
document.querySelectorAll("nav button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.remove("ativo"));
    b.classList.add("ativo");
    document.querySelectorAll(".pagina").forEach((p) => p.classList.remove("ativa"));
    $("pagina-" + b.dataset.pagina).classList.add("ativa");
  };
});

// ============================================================
//  FILTROS DE MÊS
// ============================================================
function listaMeses() {
  const set = new Set(lancamentos.map((l) => mesDe(l.data)));
  set.add(mesDe(hoje()));
  return [...set].filter(Boolean).sort().reverse();
}
function rotuloMes(m) {
  const [a, mes] = m.split("-");
  const nomes = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[+mes]}/${a}`;
}
function prepararFiltrosDeMes() {
  const meses = listaMeses();
  [$("filtro-mes"), $("rel-mes")].forEach((sel) => {
    const atual = sel.value;
    sel.innerHTML = meses.map((m) => `<option value="${m}">${rotuloMes(m)}</option>`).join("");
    if (meses.includes(atual)) sel.value = atual;
  });
}
$("filtro-mes").onchange = renderLancamentos;
$("filtro-tipo").onchange = renderLancamentos;
$("filtro-categoria").onchange = renderLancamentos;
$("rel-mes").onchange = renderRelatorios;

// ============================================================
//  RESUMO
// ============================================================
function renderResumo() {
  const mes = mesDe(hoje());
  const doMes = lancamentos.filter((l) => mesDe(l.data) === mes);
  const rec = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const desp = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
  $("r-receitas").textContent = moeda(rec);
  $("r-despesas").textContent = moeda(desp);
  const saldo = rec - desp;
  const elSaldo = $("r-saldo");
  elSaldo.textContent = moeda(saldo);
  elSaldo.className = "valor " + (saldo >= 0 ? "pos" : "neg");

  const ultimos = [...lancamentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
  $("r-ultimos").innerHTML = ultimos.length
    ? ultimos.map(itemHTML).join("")
    : `<div class="vazio">Nenhum lançamento ainda. Vá em "Lançamentos" e adicione o primeiro!</div>`;
}

// ============================================================
//  LANÇAMENTOS
// ============================================================
function categoriaPorId(id) {
  return categorias.find((c) => c.id === id) || { nome: "Sem categoria", icone: "❓", cor: "#6b7280" };
}
function cartaoPorId(id) {
  return cartoes.find((c) => c.id === id);
}

function itemHTML(l) {
  const cat = categoriaPorId(l.categoriaId);
  const card = l.cartaoId ? cartaoPorId(l.cartaoId) : null;
  const meta = [rotuloData(l.data), cat.nome, card ? "💳 " + card.nome : null].filter(Boolean).join(" · ");
  const sinal = l.tipo === "receita" ? "+" : "−";
  return `<div class="item">
    <div class="bolinha" style="background:${cat.cor}22">${cat.icone}</div>
    <div class="info">
      <div class="titulo">${escapar(l.descricao)}</div>
      <div class="meta">${meta}</div>
    </div>
    <div class="montante ${l.tipo}">${sinal} ${moeda(l.valor)}</div>
    <div class="acoes">
      <button onclick="editarLancamento('${l.id}')" title="Editar">✏️</button>
      <button onclick="excluirLancamento('${l.id}')" title="Excluir">🗑️</button>
    </div>
  </div>`;
}

function rotuloData(d) {
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}`;
}

function renderLancamentos() {
  const mes = $("filtro-mes").value;
  const tipo = $("filtro-tipo").value;
  const catF = $("filtro-categoria").value;

  let lista = lancamentos.filter((l) => mesDe(l.data) === mes);
  if (tipo !== "todos") lista = lista.filter((l) => l.tipo === tipo);
  if (catF !== "todas") lista = lista.filter((l) => l.categoriaId === catF);
  lista.sort((a, b) => b.data.localeCompare(a.data));

  $("lista-lancamentos").innerHTML = lista.length
    ? lista.map(itemHTML).join("")
    : `<div class="vazio">Nenhum lançamento neste filtro.</div>`;
}

// --- Modal de lançamento ---
$("btn-novo-lancamento").onclick = () => abrirModalLanc();
$("seg-receita").onclick = () => setTipoLanc("receita");
$("seg-despesa").onclick = () => setTipoLanc("despesa");
$("lanc-cancelar").onclick = () => $("modal-lancamento").classList.add("oculto");

function setTipoLanc(t) {
  tipoLancamentoAtual = t;
  $("seg-receita").className = t === "receita" ? "sel-rec" : "";
  $("seg-despesa").className = t === "despesa" ? "sel-desp" : "";
  $("campo-cartao").style.display = t === "despesa" ? "block" : "none";
  preencherSelectsCategoria();
}

function abrirModalLanc(lanc = null) {
  editandoId.lanc = lanc ? lanc.id : null;
  $("titulo-modal-lanc").textContent = lanc ? "Editar lançamento" : "Novo lançamento";
  setTipoLanc(lanc ? lanc.tipo : "despesa");
  $("lanc-desc").value = lanc ? lanc.descricao : "";
  $("lanc-valor").value = lanc ? lanc.valor : "";
  $("lanc-data").value = lanc ? lanc.data : hoje();
  preencherSelectsCategoria();
  if (lanc) $("lanc-categoria").value = lanc.categoriaId;
  $("lanc-cartao").value = lanc && lanc.cartaoId ? lanc.cartaoId : "";
  $("modal-lancamento").classList.remove("oculto");
}

$("lanc-salvar").onclick = async () => {
  const desc = $("lanc-desc").value.trim();
  const valor = parseFloat($("lanc-valor").value);
  const data = $("lanc-data").value;
  const categoriaId = $("lanc-categoria").value;
  const cartaoId = tipoLancamentoAtual === "despesa" ? $("lanc-cartao").value : "";
  if (!desc || !valor || valor <= 0 || !data) return alert("Preencha descrição, valor e data.");

  const dados = { descricao: desc, valor, data, tipo: tipoLancamentoAtual, categoriaId, cartaoId };

  if (editandoId.lanc) {
    await col("lancamentos").doc(editandoId.lanc).update(dados);
    const i = lancamentos.findIndex((l) => l.id === editandoId.lanc);
    lancamentos[i] = { id: editandoId.lanc, ...dados };
  } else {
    const ref = await col("lancamentos").add(dados);
    lancamentos.push({ id: ref.id, ...dados });
  }
  $("modal-lancamento").classList.add("oculto");
  prepararFiltrosDeMes();
  renderTudo();
};

window.editarLancamento = (id) => abrirModalLanc(lancamentos.find((l) => l.id === id));
window.excluirLancamento = async (id) => {
  if (!confirm("Excluir este lançamento?")) return;
  await col("lancamentos").doc(id).delete();
  lancamentos = lancamentos.filter((l) => l.id !== id);
  renderTudo();
};

// ============================================================
//  CATEGORIAS
// ============================================================
function preencherSelectsCategoria() {
  const doTipo = categorias.filter((c) => c.tipo === tipoLancamentoAtual);
  $("lanc-categoria").innerHTML = doTipo.map((c) => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join("");
  $("filtro-categoria").innerHTML =
    `<option value="todas">Todas categorias</option>` +
    categorias.map((c) => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join("");
}

function renderCategorias() {
  $("grade-categorias").innerHTML = categorias.length
    ? categorias.map((c) => `
        <div class="cat-card">
          <div class="bolinha" style="background:${c.cor}22">${c.icone}</div>
          <div class="nome">${escapar(c.nome)}<div style="font-size:11px;color:#6b7280;font-weight:400">${c.tipo}</div></div>
          <button onclick="editarCategoria('${c.id}')">✏️</button>
          <button onclick="excluirCategoria('${c.id}')">🗑️</button>
        </div>`).join("")
    : `<div class="vazio">Nenhuma categoria.</div>`;
}

$("btn-nova-categoria").onclick = () => abrirModalCat();
$("cat-cancelar").onclick = () => $("modal-categoria").classList.add("oculto");

function abrirModalCat(cat = null) {
  editandoId.cat = cat ? cat.id : null;
  $("titulo-modal-cat").textContent = cat ? "Editar categoria" : "Nova categoria";
  $("cat-nome").value = cat ? cat.nome : "";
  $("cat-icone").value = cat ? cat.icone : "";
  $("cat-cor").value = cat ? cat.cor : "#119E3F";
  $("cat-tipo").value = cat ? cat.tipo : "despesa";
  $("modal-categoria").classList.remove("oculto");
}

$("cat-salvar").onclick = async () => {
  const nome = $("cat-nome").value.trim();
  const icone = $("cat-icone").value.trim() || "📦";
  const cor = $("cat-cor").value;
  const tipo = $("cat-tipo").value;
  if (!nome) return alert("Digite o nome da categoria.");
  const dados = { nome, icone, cor, tipo };

  if (editandoId.cat) {
    await col("categorias").doc(editandoId.cat).update(dados);
    const i = categorias.findIndex((c) => c.id === editandoId.cat);
    categorias[i] = { id: editandoId.cat, ...dados };
  } else {
    const ref = await col("categorias").add(dados);
    categorias.push({ id: ref.id, ...dados });
  }
  $("modal-categoria").classList.add("oculto");
  renderTudo();
};

window.editarCategoria = (id) => abrirModalCat(categorias.find((c) => c.id === id));
window.excluirCategoria = async (id) => {
  const usada = lancamentos.some((l) => l.categoriaId === id);
  if (usada && !confirm("Há lançamentos nesta categoria. Excluir mesmo assim?")) return;
  if (!usada && !confirm("Excluir esta categoria?")) return;
  await col("categorias").doc(id).delete();
  categorias = categorias.filter((c) => c.id !== id);
  renderTudo();
};

// ============================================================
//  CARTÕES
// ============================================================
function gastoNoCartao(cartaoId) {
  const mes = mesDe(hoje());
  return lancamentos
    .filter((l) => l.cartaoId === cartaoId && l.tipo === "despesa" && mesDe(l.data) === mes)
    .reduce((s, l) => s + Number(l.valor), 0);
}

function preencherSelectCartao() {
  $("lanc-cartao").innerHTML =
    `<option value="">Nenhum / à vista</option>` +
    cartoes.map((c) => `<option value="${c.id}">💳 ${c.nome}</option>`).join("");
}

function renderCartoes() {
  $("lista-cartoes").innerHTML = cartoes.length
    ? cartoes.map((c) => {
        const usado = gastoNoCartao(c.id);
        const pct = c.limite > 0 ? Math.min(100, (usado / c.limite) * 100) : 0;
        return `<div class="item">
          <div class="bolinha" style="background:${c.cor}22">💳</div>
          <div class="info">
            <div class="titulo">${escapar(c.nome)}</div>
            <div class="meta">Fatura atual: ${moeda(usado)} de ${moeda(c.limite)} · fecha dia ${c.fechamento || "-"}</div>
            <div class="trilho" style="height:8px;background:#f3f4f6;border-radius:6px;margin-top:6px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${c.cor};border-radius:6px"></div>
            </div>
          </div>
          <div class="acoes">
            <button onclick="editarCartao('${c.id}')">✏️</button>
            <button onclick="excluirCartao('${c.id}')">🗑️</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="vazio">Nenhum cartão cadastrado.</div>`;
}

$("btn-novo-cartao").onclick = () => abrirModalCartao();
$("cartao-cancelar").onclick = () => $("modal-cartao").classList.add("oculto");

function abrirModalCartao(c = null) {
  editandoId.cartao = c ? c.id : null;
  $("titulo-modal-cartao").textContent = c ? "Editar cartão" : "Novo cartão";
  $("cartao-nome").value = c ? c.nome : "";
  $("cartao-limite").value = c ? c.limite : "";
  $("cartao-fechamento").value = c ? c.fechamento : "";
  $("cartao-cor").value = c ? c.cor : "#820AD1";
  $("modal-cartao").classList.remove("oculto");
}

$("cartao-salvar").onclick = async () => {
  const nome = $("cartao-nome").value.trim();
  const limite = parseFloat($("cartao-limite").value) || 0;
  const fechamento = parseInt($("cartao-fechamento").value) || null;
  const cor = $("cartao-cor").value;
  if (!nome) return alert("Digite o nome do cartão.");
  const dados = { nome, limite, fechamento, cor };

  if (editandoId.cartao) {
    await col("cartoes").doc(editandoId.cartao).update(dados);
    const i = cartoes.findIndex((c) => c.id === editandoId.cartao);
    cartoes[i] = { id: editandoId.cartao, ...dados };
  } else {
    const ref = await col("cartoes").add(dados);
    cartoes.push({ id: ref.id, ...dados });
  }
  $("modal-cartao").classList.add("oculto");
  renderTudo();
};

window.editarCartao = (id) => abrirModalCartao(cartoes.find((c) => c.id === id));
window.excluirCartao = async (id) => {
  if (!confirm("Excluir este cartão? Os lançamentos ligados a ele continuarão existindo.")) return;
  await col("cartoes").doc(id).delete();
  cartoes = cartoes.filter((c) => c.id !== id);
  // remove vínculo dos lançamentos
  for (const l of lancamentos.filter((l) => l.cartaoId === id)) {
    await col("lancamentos").doc(l.id).update({ cartaoId: "" });
    l.cartaoId = "";
  }
  renderTudo();
};

// ============================================================
//  RELATÓRIOS
// ============================================================
let graficoRD = null;

function renderRelatorios() {
  const mes = $("rel-mes").value || mesDe(hoje());
  const doMes = lancamentos.filter((l) => mesDe(l.data) === mes);
  const rec = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const desp = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);

  // gráfico receitas x despesas
  const ctx = $("grafico-rd");
  if (graficoRD) graficoRD.destroy();
  graficoRD = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Receitas", "Despesas"],
      datasets: [{ data: [rec, desp], backgroundColor: ["#119E3F", "#d83933"], borderRadius: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "R$ " + v } } },
    },
  });

  // barras por categoria (despesas)
  const porCat = {};
  doMes.filter((l) => l.tipo === "despesa").forEach((l) => {
    porCat[l.categoriaId] = (porCat[l.categoriaId] || 0) + Number(l.valor);
  });
  const entradas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const max = entradas.length ? entradas[0][1] : 1;

  $("barras-categoria").innerHTML = entradas.length
    ? entradas.map(([id, val]) => {
        const c = categoriaPorId(id);
        const pct = (val / max) * 100;
        return `<div class="barra-cat">
          <div class="topo"><span>${c.icone} ${escapar(c.nome)}</span><span><b>${moeda(val)}</b></span></div>
          <div class="trilho"><div class="preench" style="width:${pct}%;background:${c.cor}"></div></div>
        </div>`;
      }).join("")
    : `<div class="vazio">Sem despesas neste mês.</div>`;
}

// ============================================================
//  UTIL
// ============================================================
function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Fecha modais ao clicar no fundo escuro
document.querySelectorAll(".modal-fundo").forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m) m.classList.add("oculto"); });
});
