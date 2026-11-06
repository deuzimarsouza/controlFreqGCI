// Lista dos modelos que devem ser separados da produção geral.
// Para adicionar mais modelos, basta incluir o nome aqui.
const MODELOS_INJETADOS = [
  "SPACE 5",
  "JET 8 JUNIOR",
  "JET 8",
  "SPACE 6 JUNIOR",
  "SPACE 6",
  "DYNAMIC",
  "PROOF 3",
  "ONLY 2",
  "CITY WALL",
  "STREET WIND",
  "ONLY 3"
];

// Regras especiais:
// INTUIT é injetado.
// INTUIT 2 NÃO é injetado.
const MODELOS_INJETADOS_EXATOS = [
  "INTUIT"
];

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const SUPPORTED_FILE_PATTERN = /\.(txt|relatorio|csv)$/i;

let todosItens = [];
let itensGerais = [];
let itensInjetados = [];
let itensMizuno = [];
let itensChuteiras = [];
let itensUnderArmour = [];
let totalOficialRelatorio = 0;
let currentReportName = "";

const fileInput = document.getElementById("fileInput");
const btnChooseFile = document.getElementById("btnChooseFile");
const btnChooseFileLabel = document.getElementById("btnChooseFileLabel");
const btnExportPdf = document.getElementById("btnExportPdf");
const btnExportPdfLabel = document.getElementById("btnExportPdfLabel");
const btnExportExcel = document.getElementById("btnExportExcel");
const btnExportExcelLabel = document.getElementById("btnExportExcelLabel");

const officialTotal = document.getElementById("officialTotal");
const totalSpecial = document.getElementById("totalSpecial");
const totalFrequencia = document.getElementById("totalFrequencia");
const totalMizuno = document.getElementById("totalMizuno");
const totalChuteiras = document.getElementById("totalChuteiras");
const totalUnderArmour = document.getElementById("totalUnderArmour");
const totalGeneral = document.getElementById("totalGeneral");

const generalTable = document.getElementById("generalTable");
const specialTable = document.getElementById("specialTable");
const mizunoTable = document.getElementById("mizunoTable");
const chuteiraTable = document.getElementById("chuteiraTable");
const underArmourTable = document.getElementById("underArmourTable");
const statusMessage = document.getElementById("statusMessage");

const emptyRowTemplate = document.getElementById("emptyRowTemplate");

btnChooseFile.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) readFile(file);
});

btnExportPdf.addEventListener("click", exportProductionSummaryPdf);
btnExportExcel.addEventListener("click", exportProductionSummaryExcel);

function readFile(file) {
  if (!SUPPORTED_FILE_PATTERN.test(file.name)) {
    setStatus("Formato não suportado. Selecione um arquivo TXT, RELATORIO ou CSV.", "error");
    fileInput.value = "";
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setStatus("O arquivo excede o limite de 15 MB.", "error");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();
  clearStatus();
  setLoading(true);
  setPdfReady(false);
  setExcelReady(false);

  reader.onload = event => {
    try {
      const text = decodeReport(event.target.result);
      totalOficialRelatorio = extractOfficialTotal(text);
      todosItens = parseReport(text);
      currentReportName = file.name;
      separateItems();
      renderAll();
      updateReportStatus(file.name);
      setPdfReady(todosItens.length > 0);
      setExcelReady(todosItens.length > 0);
    } catch (error) {
      clearReport();
      setStatus("Não foi possível interpretar o relatório selecionado.", "error");
    } finally {
      setLoading(false);
      fileInput.value = "";
    }
  };

  reader.onerror = () => {
    clearReport();
    setStatus("Não foi possível ler o arquivo selecionado.", "error");
    setLoading(false);
    fileInput.value = "";
  };

  reader.readAsArrayBuffer(file);
}

function decodeReport(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function parseReport(text) {
  const lines = text.split(/\r?\n/);
  const items = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Só aceita linhas reais de produção com artigo CAB.
    // Ignora TOTAL NA FASE, TOTAL, cabeçalhos e rodapés.
    const match = line.match(/^\s*([A-Z]{2,5})\s+(CAB\S+)\s+(.+?)\s+([\d.]+)\s*$/i);

    if (!match) continue;

    const fase = match[1].trim().toUpperCase();
    const artigo = match[2].trim().toUpperCase();
    const descricaoCompleta = match[3].trim();
    const quantidade = parseReportNumber(match[4]);

    if (!fase || !artigo || !descricaoCompleta || Number.isNaN(quantidade)) continue;

    const normalized = normalizeText(`${fase} ${artigo} ${descricaoCompleta}`);
    if (normalized.includes("TOTAL")) continue;
    if (!artigo.startsWith("CAB")) continue;

    items.push({
      fase,
      artigo,
      descricao: descricaoCompleta,
      quantidade,
      tipo: "GERAL",
      modeloInjetado: ""
    });
  }

  return items;
}

function extractOfficialTotal(text) {
  const totalMatches = [...text.matchAll(/^\s*TOTAL\s*:\s*([\d.]+)\s*$/gim)];

  if (totalMatches.length === 0) return 0;

  const lastMatch = totalMatches[totalMatches.length - 1];
  return parseReportNumber(lastMatch[1]);
}

function parseReportNumber(value) {
  const normalizedValue = String(value).replace(/\./g, "");
  const number = Number(normalizedValue);
  return Number.isFinite(number) ? number : 0;
}

function separateItems() {
  itensInjetados = [];
  itensMizuno = [];
  itensChuteiras = [];
  itensUnderArmour = [];
  itensGerais = [];

  for (const item of todosItens) {
    const identifiedModel = identifySpecialModel(item.descricao);
    const brandCategory = identifyBrandCategory(item.descricao);
    const classifiedItem = {
      ...item,
      modeloInjetado: identifiedModel
    };

    // Produção Injetados:
    // classificação paralela às marcas, pois também compõe o total de frequência.
    if (identifiedModel) {
      itensInjetados.push({
        ...classifiedItem,
        tipo: "INJETADO",
      });
    }

    // As categorias descontadas de Olympikus são mutuamente exclusivas,
    // evitando que uma mesma linha seja subtraída duas vezes.
    if (brandCategory === "UNDER_ARMOUR") {
      itensUnderArmour.push({ ...classifiedItem, tipo: "UNDER ARMOUR" });
    } else if (brandCategory === "MIZUNO") {
      itensMizuno.push({ ...classifiedItem, tipo: "MIZUNO" });
    } else if (brandCategory === "CHUTEIRA") {
      itensChuteiras.push({ ...classifiedItem, tipo: "CHUTEIRA" });
    } else {
      // Injetados Olympikus continuam na produção Olympikus, conforme a
      // regra do cartão: oficial - Mizuno - Chuteiras - Under Armour.
      itensGerais.push({
        ...classifiedItem,
        tipo: "GERAL",
      });
    }
  }
}

function identifyBrandCategory(description) {
  if (isUnderArmourModel(description)) return "UNDER_ARMOUR";
  if (isMizunoModel(description)) return "MIZUNO";
  if (isChuteiraModel(description)) return "CHUTEIRA";
  return "";
}

function isMizunoModel(description) {
  const normalizedDescription = normalizeText(description);

  return (
    normalizedDescription.includes("CABEDAL MZ") ||
    normalizedDescription.includes("CABEDAL MIZUNO") ||
    normalizedDescription.includes("CABEDAL MIZ.") ||
    normalizedDescription.includes("CABEDAL MIZ ") ||
    normalizedDescription.includes("CAB. MIZUNO") ||
    normalizedDescription.includes("CAB. MIZ.") ||
    normalizedDescription.includes("CAB MZ") ||
    normalizedDescription.includes("Cab MZ NEO") ||
    normalizedDescription.includes("CAB. MIZ") ||
    normalizedDescription.includes("CAB WAVE") ||
    normalizedDescription.includes("CABEDAL WAVE") ||
    normalizedDescription.includes("CAB. WAVE") ||
    normalizedDescription.includes("COOL RIDE")
  );
}

function isChuteiraModel(description) {
  const normalizedDescription = normalizeText(description);

  return (
    normalizedDescription.includes("CAB. CH.") ||
    normalizedDescription.includes("CAB.CH.") ||
    normalizedDescription.includes("CAB. CH") ||
    normalizedDescription.includes("CAB.CH") ||
    normalizedDescription.includes("CAB CH.") ||
    normalizedDescription.includes("CAB.REGENT") ||
    normalizedDescription.includes("CAB. REGENT") ||
    normalizedDescription.includes("CAB CH ") 
  );
}

function isUnderArmourModel(description) {
  const normalizedDescription = normalizeText(description);

  return (
    normalizedDescription.includes("CAB. UA CH.") ||
    normalizedDescription.includes("CAB. UA CH") ||
    normalizedDescription.includes("CABEDAL UA CH") ||
    normalizedDescription.includes("CABEDAL UA") ||
    normalizedDescription.includes("CABED. UA") ||
    normalizedDescription.includes("CAB UA")
  );
}

function identifySpecialModel(description) {
  const normalizedDescription = normalizeText(description);

  // Primeiro testa modelos exatos, como INTUIT.
  // Essa regra evita que "INTUIT" capture "INTUIT 2".
  for (const model of MODELOS_INJETADOS_EXATOS) {
    const normalizedModel = normalizeText(model);
    const exactRegex = new RegExp(`(^|\\s|\\.|-|/)${escapeRegex(normalizedModel)}($|\\.|-|/|\\s(?!\\d))`, "i");

    if (exactRegex.test(normalizedDescription)) {
      return model;
    }
  }

  const sortedModels = [...MODELOS_INJETADOS].sort((a, b) => b.length - a.length);

  return sortedModels.find(model => {
    const normalizedModel = normalizeText(model);
    const regex = new RegExp(`(^|\\s|\\.|-|/)${escapeRegex(normalizedModel)}($|\\s|\\.|-|/)`, "i");
    return regex.test(normalizedDescription);
  }) || "";
}

function normalizeText(value) {
  return String(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderAll() {
  renderCards();
  renderTables();
  renderReportDetails();
}

function renderReportDetails() {
  const reportState = document.getElementById("reportState");
  const hasReport = Boolean(currentReportName);
  const hasItems = todosItens.length > 0;
  const isBalanced = hasItems && totalOficialRelatorio > 0
    && sumQuantity(todosItens) === totalOficialRelatorio;

  if (reportState) {
    reportState.textContent = !hasReport ? "Aguardando relatório"
      : !hasItems ? "Nenhuma linha válida"
      : isBalanced ? "Totais conferidos" : "Conferência necessária";
    reportState.dataset.state = !hasReport ? "empty" : isBalanced ? "ready" : "warning";
  }

  const groups = [
    ["general", itensGerais], ["special", itensInjetados], ["mizuno", itensMizuno],
    ["chuteira", itensChuteiras], ["underArmour", itensUnderArmour]
  ];
  for (const [id, items] of groups) {
    const total = document.getElementById(`${id}TableTotal`);
    if (total) total.textContent = formatNumber(sumQuantity(items));
  }
}

function renderCards() {
  const totalCalculado = sumQuantity(todosItens);
  const totalInjetados = sumQuantity(itensInjetados);
  const totalMizunoCalculado = sumQuantity(itensMizuno);
  const totalChuteirasCalculado = sumQuantity(itensChuteiras);
  const totalUnderArmourCalculado = sumQuantity(itensUnderArmour);

  const baseTotal = totalOficialRelatorio || totalCalculado;

  // Regra solicitada:
  // Total frequência = Total oficial do relatório - Total modelos injetados.
  const totalFrequenciaCalculado = baseTotal - totalInjetados;

  // Regra solicitada:
  // Total produção Olympikus = Total oficial do relatório - Total produção Mizuno - Total produção Chuteiras - Total produção Under Armour.
  const totalGeral =
    baseTotal - totalMizunoCalculado - totalChuteirasCalculado - totalUnderArmourCalculado;

  officialTotal.textContent = totalOficialRelatorio ? formatNumber(totalOficialRelatorio) : "—";
  totalSpecial.textContent = formatNumber(totalInjetados);
  totalFrequencia.textContent = formatNumber(totalFrequenciaCalculado);
  totalMizuno.textContent = formatNumber(totalMizunoCalculado);
  totalChuteiras.textContent = formatNumber(totalChuteirasCalculado);
  totalUnderArmour.textContent = formatNumber(totalUnderArmourCalculado);
  totalGeneral.textContent = formatNumber(totalGeral);
}

function updateReportStatus(fileName) {
  const totalCalculado = sumQuantity(todosItens);
  const totalInjetados = sumQuantity(itensInjetados);
  const totalMarcas =
    sumQuantity(itensMizuno) +
    sumQuantity(itensChuteiras) +
    sumQuantity(itensUnderArmour);

  if (todosItens.length === 0) {
    setStatus(`Nenhuma linha de produção válida foi encontrada em “${fileName}”.`, "warning");
    return;
  }

  if (!totalOficialRelatorio) {
    setStatus(
      `“${fileName}” foi processado, mas o TOTAL oficial não foi encontrado. A soma das linhas (${formatNumber(totalCalculado)}) foi usada como base.`,
      "warning"
    );
    return;
  }

  if (totalOficialRelatorio - totalInjetados < 0 || totalOficialRelatorio - totalMarcas < 0) {
    setStatus(
      `Os subtotais de “${fileName}” excedem o TOTAL oficial. Revise o formato ou as classificações do relatório.`,
      "error"
    );
    return;
  }

  if (totalCalculado !== totalOficialRelatorio) {
    setStatus(
      `Divergência em “${fileName}”: linhas somam ${formatNumber(totalCalculado)}, mas o TOTAL oficial é ${formatNumber(totalOficialRelatorio)}.`,
      "warning"
    );
    return;
  }

  clearStatus();
  showToast("PRODUÇÃO CALCULADA COM SUCESSO!");
}

function setStatus(message, type = "") {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = `status${type ? ` ${type}` : ""}`;
}

function clearStatus() {
  if (!statusMessage) return;
  statusMessage.textContent = "";
  statusMessage.className = "status hidden";
}

function setLoading(isLoading) {
  btnChooseFile.disabled = isLoading;
  btnChooseFileLabel.textContent = isLoading ? "Processando..." : "Selecionar relatório";
  btnChooseFile.setAttribute("aria-busy", String(isLoading));
}

function setPdfReady(isReady) {
  btnExportPdf.disabled = !isReady;
  btnExportPdf.title = isReady ? "Exportar resumo em PDF" : "Importe um relatório para exportar";
}

function setExcelReady(isReady) {
  btnExportExcel.disabled = !isReady;
  btnExportExcel.title = isReady ? "Exportar resumo em Excel" : "Importe um relatório para exportar";
}

function buildProductionSummary() {
  const totalCalculado = sumQuantity(todosItens);
  const totalInjetados = sumQuantity(itensInjetados);
  const totalMizunoCalculado = sumQuantity(itensMizuno);
  const totalChuteirasCalculado = sumQuantity(itensChuteiras);
  const totalUnderArmourCalculado = sumQuantity(itensUnderArmour);
  const baseTotal = totalOficialRelatorio || totalCalculado;
  const totalMizunoInjetado = sumInjectedQuantity(itensMizuno);
  const totalOlympikusInjetado = sumInjectedQuantity(itensGerais);
  const totalOlympikusCalculado =
    baseTotal - totalMizunoCalculado - totalChuteirasCalculado - totalUnderArmourCalculado;

  return {
    reportName: currentReportName,
    generatedAt: new Date().toISOString(),
    lineCount: todosItens.length,
    totalOfficial: totalOficialRelatorio,
    totalCalculated: totalCalculado,
    totalFrequency: baseTotal - totalInjetados,
    totalInjected: totalInjetados,
    totalMizuno: totalMizunoCalculado,
    totalMizunoWithInjected: totalMizunoCalculado,
    totalMizunoWithoutInjected: totalMizunoCalculado - totalMizunoInjetado,
    totalCleats: totalChuteirasCalculado,
    totalUnderArmour: totalUnderArmourCalculado,
    totalOlympikus: totalOlympikusCalculado,
    totalOlympikusWithInjected: totalOlympikusCalculado,
    totalOlympikusWithoutInjected: totalOlympikusCalculado - totalOlympikusInjetado,
    modelGroups: [
      buildPdfModelGroup("OLYMPIKUS", "Olympikus", "brand", itensGerais),
      buildPdfModelGroup("MIZUNO", "Mizuno", "brand", itensMizuno),
      buildPdfModelGroup("CHUTEIRAS", "Chuteiras", "brand", itensChuteiras),
      buildPdfModelGroup("UNDER_ARMOUR", "Under Armour", "brand", itensUnderArmour),
      buildPdfModelGroup("INJETADOS", "Injetados", "injected", itensInjetados)
    ]
  };
}

function buildPdfModelGroup(id, label, type, items) {
  const aggregatedItems = new Map();

  for (const item of items) {
    const injectedModel = item.modeloInjetado || "";
    const key = `${item.artigo}\u0000${item.descricao}\u0000${injectedModel}`;
    const existing = aggregatedItems.get(key);

    if (existing) {
      existing.quantidade += item.quantidade;
      continue;
    }

    aggregatedItems.set(key, {
      artigo: item.artigo,
      descricao: item.descricao,
      modeloInjetado: injectedModel,
      quantidade: item.quantidade
    });
  }

  const models = [...aggregatedItems.values()].sort((left, right) => {
    const byQuantity = right.quantidade - left.quantidade;
    if (byQuantity) return byQuantity;
    const byDescription = left.descricao.localeCompare(right.descricao, "pt-BR", { sensitivity: "base" });
    return byDescription || left.artigo.localeCompare(right.artigo, "pt-BR", { sensitivity: "base" });
  });

  return {
    id,
    label,
    type,
    total: sumQuantity(items),
    models
  };
}

async function exportProductionSummaryPdf() {
  if (todosItens.length === 0) return;

  btnExportPdf.disabled = true;
  btnExportPdfLabel.textContent = "Gerando PDF...";

  try {
    const summary = buildProductionSummary();
    let saved = false;

    if (window.desktop && typeof window.desktop.saveProductionPdf === "function") {
      const result = await window.desktop.saveProductionPdf(summary);
      saved = Boolean(result && result.saved);
    } else if (window.productionPdf && typeof window.productionPdf.download === "function") {
      window.productionPdf.download(summary);
      saved = true;
    } else {
      throw new Error("Gerador de PDF indisponível.");
    }

    if (saved) showToast("Resumo em PDF salvo com sucesso!");
  } catch (error) {
    setStatus("Não foi possível gerar o resumo em PDF.", "error");
  } finally {
    btnExportPdfLabel.textContent = "Gerar PDF";
    setPdfReady(todosItens.length > 0);
  }
}

function exportProductionSummaryExcel() {
  if (todosItens.length === 0) return;

  btnExportExcel.disabled = true;
  btnExportExcelLabel.textContent = "Gerando Excel...";

  try {
    const summary = buildProductionSummary();
    downloadProductionSummaryExcel(summary);
    showToast("Resumo em Excel salvo com sucesso!");
  } catch (error) {
    setStatus("Não foi possível gerar o resumo em Excel.", "error");
  } finally {
    btnExportExcelLabel.textContent = "Gerar Excel";
    setExcelReady(todosItens.length > 0);
  }
}

function downloadProductionSummaryExcel(summary) {
  const bytes = buildProductionXlsx(summary);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = defaultExcelFileName(summary.reportName);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
    link.remove();
  }, 0);
}

function buildProductionXlsx(summary) {
  const workbook = buildProductionWorkbookDashboard(summary);
  const entries = buildXlsxEntries(workbook, summary);
  return buildZip(entries);
}

function buildProductionWorkbook(summary) {
  const generatedAt = new Date(summary.generatedAt);
  const generatedAtLabel = Number.isNaN(generatedAt.getTime())
    ? "Nao informado"
    : generatedAt.toLocaleString("pt-BR");
  const classifiedRows = summary.modelGroups.flatMap(group =>
    group.models.map(model => [
      group.label,
      group.type === "injected" ? "Injetado" : "Marca",
      model.artigo,
      model.descricao,
      model.modeloInjetado || "",
      model.quantidade
    ])
  );

  return [
    {
      name: "Resumo",
      columns: [24, 22, 58],
      freezeRows: 4,
      autoFilter: "A4:C15",
      merges: ["A1:C1", "A2:C2"],
      rows: [
        excelRow([excelCell("RESUMO GERAL DE PRODUCAO", "title")], 30),
        excelRow([excelCell(`Relatorio: ${summary.reportName || "Relatorio de producao"} | Gerado em: ${generatedAtLabel}`, "subtitle")], 22),
        excelRow([]),
        excelRow(["Indicador", "Valor", "Observacao"].map(value => excelCell(value, "header")), 22),
        excelRow([excelCell("Modelos processados", "label"), excelCell(summary.lineCount, "number"), "Linhas validas encontradas no relatorio"]),
        excelRow([excelCell("Total oficial", "label"), excelCell(summary.totalOfficial, "number"), "Total informado no arquivo"]),
        excelRow([excelCell("Soma calculada", "label"), excelCell(summary.totalCalculated, "number"), "Soma das linhas lidas pelo sistema"]),
        excelRow([excelCell("Total frequencia", "label"), excelCell(summary.totalFrequency, "number"), "Total oficial menos modelos injetados"]),
        excelRow([excelCell("Total injetados", "label"), excelCell(summary.totalInjected, "number"), "Classificacao paralela as marcas"]),
        excelRow([excelCell("Total Mizuno", "label"), excelCell(summary.totalMizuno, "number"), "Produção classificada como Mizuno"]),
        excelRow([excelCell("Total Chuteiras", "label"), excelCell(summary.totalCleats, "number"), "Produção classificada como Chuteiras"]),
        excelRow([excelCell("Total Under Armour", "label"), excelCell(summary.totalUnderArmour, "number"), "Produção classificada como Under Armour"]),
        excelRow([excelCell("Total Olympikus", "label"), excelCell(summary.totalOlympikus, "number"), "Total oficial menos Mizuno, Chuteiras e Under Armour"]),
        excelRow([]),
        excelRow([excelCell("Observacao", "label"), "", excelCell("Modelos injetados sao uma classificacao paralela as marcas e tambem compoem o calculo de frequencia.", "note")], 38)
      ]
    },
    {
      name: "Classificados",
      columns: [18, 14, 16, 54, 22, 14],
      freezeRows: 4,
      autoFilter: `A4:F${Math.max(4, classifiedRows.length + 4)}`,
      merges: ["A1:F1", "A2:F2"],
      rows: [
        excelRow([excelCell("MODELOS E CLASSIFICACOES", "title")], 30),
        excelRow([excelCell("Todos os modelos classificados, ordenados por quantidade em cada categoria.", "subtitle")], 22),
        excelRow([]),
        excelRow(["Classificacao", "Tipo", "Artigo", "Descricao", "Modelo injetado", "Quantidade"].map(value => excelCell(value, "header")), 22),
        ...classifiedRows.map(row => excelRow([
          row[0],
          row[1],
          row[2],
          row[3],
          row[4],
          excelCell(row[5], "number")
        ]))
      ]
    },
    ...summary.modelGroups.map(group => ({
      name: group.label,
      columns: [16, 58, 22, 14],
      freezeRows: 4,
      autoFilter: `A4:D${Math.max(4, group.models.length + 4)}`,
      merges: ["A1:D1", "A2:D2"],
      rows: [
        excelRow([excelCell(`PRODUCAO ${normalizeText(group.label)}`, "title")], 30),
        excelRow([excelCell(`Total da classificacao: ${formatNumber(group.total)}`, "subtitle")], 22),
        excelRow([]),
        excelRow(["Artigo", "Descricao", "Modelo injetado", "Quantidade"].map(value => excelCell(value, "header")), 22),
        ...group.models.map(model => excelRow([
          model.artigo,
          model.descricao,
          model.modeloInjetado || "",
          excelCell(model.quantidade, "number")
        ])),
        excelRow([]),
        excelRow([excelCell("TOTAL", "totalLabel"), "", "", excelCell(group.total, "totalNumber")], 24)
      ]
    }))
  ];
}

function buildProductionWorkbookDashboard(summary) {
  const generatedAt = new Date(summary.generatedAt);
  const generatedAtLabel = Number.isNaN(generatedAt.getTime())
    ? "Nao informado"
    : generatedAt.toLocaleString("pt-BR");
  const classifiedRows = summary.modelGroups.flatMap(group =>
    group.models.map(model => [
      group.label,
      group.type === "injected" ? "Injetado" : "Marca",
      model.artigo,
      model.descricao,
      model.modeloInjetado || "",
      model.quantidade
    ])
  );

  return [
    {
      name: "Resumo",
      columns: [24, 20, 24, 20],
      freezeRows: 3,
      merges: ["A1:D1", "A2:D2"],
      rows: [
        excelRow([excelCell("DASHBOARD DE PRODUCAO", "title")], 30),
        excelRow([excelCell(`${summary.reportName || "Relatorio de producao"} | ${generatedAtLabel}`, "subtitle")], 22),
        excelRow([]),
        excelRow([
          excelCell("Total oficial", "dashboardLabel"),
          excelCell("Total frequencia", "dashboardLabel"),
          excelCell("Modelos injetados", "dashboardLabel"),
          excelCell("Olympikus", "dashboardLabel")
        ], 22),
        excelRow([
          excelCell(summary.totalOfficial, "dashboardValue"),
          excelCell(summary.totalFrequency, "dashboardValue"),
          excelCell(summary.totalInjected, "dashboardValue"),
          excelCell(summary.totalOlympikus, "dashboardValue")
        ], 34),
        excelRow([
          excelCell("Mizuno", "dashboardLabel"),
          excelCell("Chuteiras", "dashboardLabel"),
          excelCell("Under Armour", "dashboardLabel"),
          excelCell("Modelos processados", "dashboardLabel")
        ], 22),
        excelRow([
          excelCell(summary.totalMizuno, "dashboardValue"),
          excelCell(summary.totalCleats, "dashboardValue"),
          excelCell(summary.totalUnderArmour, "dashboardValue"),
          excelCell(summary.lineCount, "dashboardValue")
        ], 34)
      ]
    },
    {
      name: "Classificados",
      columns: [18, 14, 16, 54, 22, 14],
      freezeRows: 4,
      autoFilter: `A4:F${Math.max(4, classifiedRows.length + 4)}`,
      merges: ["A1:F1", "A2:F2"],
      rows: [
        excelRow([excelCell("MODELOS E CLASSIFICACOES", "title")], 30),
        excelRow([excelCell("Todos os modelos classificados, ordenados por quantidade em cada categoria.", "subtitle")], 22),
        excelRow([]),
        excelRow(["Classificacao", "Tipo", "Artigo", "Descricao", "Modelo injetado", "Quantidade"].map(value => excelCell(value, "header")), 22),
        ...classifiedRows.map(row => excelRow([
          row[0],
          row[1],
          row[2],
          row[3],
          row[4],
          excelCell(row[5], "number")
        ]))
      ]
    },
    ...summary.modelGroups.map(group => ({
      name: group.label,
      columns: [16, 58, 22, 14],
      freezeRows: 4,
      autoFilter: `A4:D${Math.max(4, group.models.length + 4)}`,
      merges: ["A1:D1", "A2:D2"],
      rows: [
        excelRow([excelCell(`PRODUCAO ${normalizeText(group.label)}`, "title")], 30),
        excelRow([excelCell(`Total da classificacao: ${formatNumber(group.total)}`, "subtitle")], 22),
        excelRow([]),
        excelRow(["Artigo", "Descricao", "Modelo injetado", "Quantidade"].map(value => excelCell(value, "header")), 22),
        ...group.models.map(model => excelRow([
          model.artigo,
          model.descricao,
          model.modeloInjetado || "",
          excelCell(model.quantidade, "number")
        ])),
        excelRow([]),
        excelRow([excelCell("TOTAL", "totalLabel"), "", "", excelCell(group.total, "totalNumber")], 24)
      ]
    }))
  ];
}

function excelRow(cells, height) {
  return { cells, height };
}

function excelCell(value, style = "normal") {
  return { value, style };
}

function buildXlsxEntries(sheets, summary) {
  return [
    { path: "[Content_Types].xml", content: buildXlsxContentTypes(sheets.length) },
    { path: "_rels/.rels", content: buildXlsxRootRelationships() },
    { path: "docProps/core.xml", content: buildXlsxCoreProperties(summary) },
    { path: "docProps/app.xml", content: buildXlsxAppProperties(sheets) },
    { path: "xl/workbook.xml", content: buildXlsxWorkbook(sheets) },
    { path: "xl/_rels/workbook.xml.rels", content: buildXlsxWorkbookRelationships(sheets.length) },
    { path: "xl/styles.xml", content: buildXlsxStyles() },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: buildXlsxWorksheet(sheet)
    }))
  ];
}

function buildXlsxContentTypes(sheetCount) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_item, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function buildXlsxRootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildXlsxCoreProperties(summary) {
  const createdAt = new Date(summary.generatedAt);
  const isoDate = Number.isNaN(createdAt.getTime())
    ? new Date().toISOString()
    : createdAt.toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Resumo de Producao</dc:title>
  <dc:subject>Controle de Particao de Producao</dc:subject>
  <dc:creator>Deuzimar Souza</dc:creator>
  <cp:lastModifiedBy>Projeto Controle de Particao de Producao</cp:lastModifiedBy>
  <cp:keywords>producao; relatorio; classificados; modelos</cp:keywords>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(isoDate)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(isoDate)}</dcterms:modified>
</cp:coreProperties>`;
}

function buildXlsxAppProperties(sheets) {
  const titles = sheets
    .map(sheet => `<vt:lpstr>${escapeXml(toExcelSheetName(sheet.name))}</vt:lpstr>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector>
  </TitlesOfParts>
  <Company>Projeto Controle de Particao de Producao</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`;
}

function buildXlsxWorkbook(sheets) {
  const sheetNodes = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(toExcelSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="24826"/>
  <workbookPr defaultThemeVersion="166925"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="15000"/></bookViews>
  <sheets>${sheetNodes}</sheets>
  <calcPr calcId="191029"/>
</workbook>`;
}

function buildXlsxWorkbookRelationships(sheetCount) {
  const sheetRelationships = Array.from({ length: sheetCount }, (_item, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  const stylesRelationshipId = sheetCount + 1;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelationships}
  <Relationship Id="rId${stylesRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildXlsxStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="9"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="3" fontId="3" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="3" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

function buildXlsxWorksheet(sheet) {
  const rowCount = Math.max(1, sheet.rows.length);
  const columnCount = Math.max(1, sheet.columns.length, ...sheet.rows.map(row => row.cells.length));
  const dimension = `A1:${excelColumnName(columnCount)}${rowCount}`;
  const columns = Array.from({ length: columnCount }, (_item, index) => {
    const width = sheet.columns[index] || 16;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const sheetRows = sheet.rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const height = row.height ? ` ht="${row.height}" customHeight="1"` : "";
    const cells = row.cells.map((cell, columnIndex) =>
      buildXlsxCell(cell, rowNumber, columnIndex + 1)
    ).join("");

    return `<row r="${rowNumber}"${height}>${cells}</row>`;
  }).join("");
  const pane = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>`
    : "";
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${escapeXml(sheet.autoFilter)}"/>` : "";
  const merges = sheet.merges && sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${escapeXml(ref)}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>${sheetRows}</sheetData>
  ${autoFilter}
  ${merges}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
}

function buildXlsxCell(cellInput, rowNumber, columnNumber) {
  const cell = cellInput && typeof cellInput === "object" && Object.prototype.hasOwnProperty.call(cellInput, "value")
    ? cellInput
    : excelCell(cellInput);
  const value = cell.value ?? "";
  const styleIndex = getXlsxStyleIndex(cell.style);
  const reference = `${excelColumnName(columnNumber)}${rowNumber}`;

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${styleIndex}"><v>${value}</v></c>`;
  }

  return `<c r="${reference}" s="${styleIndex}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function getXlsxStyleIndex(style) {
  const styles = {
    normal: 0,
    title: 1,
    subtitle: 2,
    header: 3,
    number: 4,
    label: 5,
    totalLabel: 5,
    totalNumber: 6,
    note: 7,
    dashboardLabel: 8,
    dashboardValue: 9
  };

  return styles[style] ?? 0;
}

function excelColumnName(columnNumber) {
  let number = columnNumber;
  let name = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }

  return name;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const encodedEntries = entries.map(entry => ({
    pathBytes: encodeUtf8(entry.path),
    contentBytes: encodeUtf8(entry.content),
    path: entry.path
  }));
  const { time, date } = getZipDateParts(new Date());

  for (const entry of encodedEntries) {
    const crc = crc32(entry.contentBytes);
    const localHeader = createZipLocalHeader(entry.pathBytes, entry.contentBytes.length, crc, time, date);
    const centralHeader = createZipCentralHeader(entry.pathBytes, entry.contentBytes.length, crc, time, date, offset);

    localParts.push(localHeader, entry.contentBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.contentBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const localDirectory = concatBytes(localParts);
  const endRecord = createZipEndRecord(encodedEntries.length, centralDirectory.length, localDirectory.length);

  return concatBytes([localDirectory, centralDirectory, endRecord]);
}

function createZipLocalHeader(pathBytes, size, crc, time, date) {
  const header = new Uint8Array(30 + pathBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, pathBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(pathBytes, 30);

  return header;
}

function createZipCentralHeader(pathBytes, size, crc, time, date, offset) {
  const header = new Uint8Array(46 + pathBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, pathBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(pathBytes, 46);

  return header;
}

function createZipEndRecord(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

function getZipDateParts(value) {
  const year = Math.max(1980, value.getFullYear());
  const date = ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);

  return { date, time };
}

function concatBytes(parts) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

function encodeUtf8(value) {
  return new TextEncoder().encode(String(value));
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function toExcelSheetName(value) {
  const name = String(value || "Planilha")
    .replace(/[:\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);

  return name || "Planilha";
}

function defaultExcelFileName(reportName) {
  const baseName = String(reportName || "Relatorio-Producao")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "Relatorio-Producao";

  return `Resumo-Producao-${baseName}.xlsx`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clearReport() {
  totalOficialRelatorio = 0;
  currentReportName = "";
  todosItens = [];
  separateItems();
  renderAll();
  setPdfReady(false);
  setExcelReady(false);
}

function showToast(message) {
  const toast = document.getElementById("toastModal");
  const toastMessage = document.getElementById("toastMessage");

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");

  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

const TABLE_VISIBLE_ITEMS = 4;
let tableViewportUpdatePending = false;

function scheduleTableViewportUpdate() {
  if (tableViewportUpdatePending) return;
  tableViewportUpdatePending = true;
  window.requestAnimationFrame(() => {
    tableViewportUpdatePending = false;
    for (const viewport of document.querySelectorAll(".production-grid .table-wrap")) {
      const table = viewport.querySelector("table");
      const rows = table?.tBodies[0]?.rows;
      if (!rows?.length) continue;

      // Measure complete rows so wrapped descriptions remain fully readable.
      const lastVisibleRow = rows[Math.min(TABLE_VISIBLE_ITEMS, rows.length) - 1];
      const height = Math.ceil(
        lastVisibleRow.getBoundingClientRect().bottom - table.getBoundingClientRect().top
      );
      if (height > 0) {
        const size = `${height}px`;
        if (viewport.style.getPropertyValue("--table-viewport-height") !== size) {
          viewport.style.setProperty("--table-viewport-height", size);
        }
      }
    }
  });
}

function initializeTableViewports() {
  if (typeof window.ResizeObserver === "function") {
    const observer = new window.ResizeObserver(scheduleTableViewportUpdate);
    for (const table of document.querySelectorAll(".production-grid table")) {
      observer.observe(table);
    }
  }
  window.addEventListener("resize", scheduleTableViewportUpdate);
  window.addEventListener("afterprint", scheduleTableViewportUpdate);
}

function renderTables() {
  renderTable(generalTable, itensGerais);
  renderTable(specialTable, itensInjetados);
  renderTable(mizunoTable, itensMizuno);
  renderTable(chuteiraTable, itensChuteiras);
  renderTable(underArmourTable, itensUnderArmour);
  for (const viewport of document.querySelectorAll(".production-grid .table-wrap")) {
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }
  scheduleTableViewportUpdate();
}

function renderTable(tbody, items) {
  tbody.replaceChildren();

  if (items.length === 0) {
    const emptyRow = emptyRowTemplate.content.cloneNode(true);
    const title = emptyRow.querySelector(".empty strong");
    const description = emptyRow.querySelector(".empty span");
    if (!currentReportName) {
      if (title) title.textContent = "Aguardando relatório";
      if (description) description.textContent = "Importe um arquivo para visualizar a produção.";
    } else {
      if (title) title.textContent = "Nenhum item nesta categoria";
      if (description) description.textContent = "O relatório lido não contém itens deste grupo.";
    }
    tbody.appendChild(emptyRow);
    return;
  }

  for (const item of sortItemsByQuantity(items)) {
    const tr = document.createElement("tr");
    const values = [
      item.artigo,
      item.descricao,
      formatNumber(item.quantidade)
    ];

    values.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;

      if (index === 1) {
        td.title = value;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }
}

function sortItemsByQuantity(items) {
  return [...items].sort((left, right) => {
    const byQuantity = right.quantidade - left.quantidade;
    if (byQuantity) return byQuantity;

    const byDescription = left.descricao.localeCompare(right.descricao, "pt-BR", { sensitivity: "base" });
    return byDescription || left.artigo.localeCompare(right.artigo, "pt-BR", { sensitivity: "base" });
  });
}

function sumQuantity(items) {
  return items.reduce((total, item) => total + item.quantidade, 0);
}

function sumInjectedQuantity(items) {
  return sumQuantity(items.filter(item => Boolean(item.modeloInjetado)));
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

initializeTableViewports();
renderAll();
