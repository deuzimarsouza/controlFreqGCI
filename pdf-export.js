(function setupProductionPdf(globalObject) {
  "use strict";

  const INSTITUTION_LOGO_DATA_URL = "data:image/png;base64,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";
  const INSTITUTION_LOGO_RATIO = 410 / 450;

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function toFiniteNumberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeModelGroups(groups) {
    if (!Array.isArray(groups)) return [];

    return groups.slice(0, 20).map(group => ({
      id: String(group && group.id || "").slice(0, 40),
      label: String(group && group.label || "Classificação").slice(0, 80),
      type: group && group.type === "injected" ? "injected" : "brand",
      total: toFiniteNumber(group && group.total),
      models: Array.isArray(group && group.models)
        ? group.models.slice(0, 5000).map(model => ({
            artigo: String(model && model.artigo || "—").slice(0, 80),
            descricao: String(model && model.descricao || "—").slice(0, 300),
            modeloInjetado: String(model && model.modeloInjetado || "").slice(0, 100),
            quantidade: toFiniteNumber(model && model.quantidade)
          })).sort((left, right) => right.quantidade - left.quantidade
            || left.descricao.localeCompare(right.descricao, "pt-BR", { sensitivity: "base" })
            || left.artigo.localeCompare(right.artigo, "pt-BR", { sensitivity: "base" }))
        : []
    }));
  }

  function normalizeSummary(summary = {}) {
    const totalMizuno = toFiniteNumber(summary.totalMizuno);
    const totalOlympikus = toFiniteNumber(summary.totalOlympikus);

    return {
      reportName: String(summary.reportName || "Relatório de produção").slice(0, 180),
      generatedAt: String(summary.generatedAt || new Date().toISOString()),
      lineCount: Math.max(0, Math.trunc(toFiniteNumber(summary.lineCount))),
      totalOfficial: toFiniteNumber(summary.totalOfficial),
      totalCalculated: toFiniteNumber(summary.totalCalculated),
      totalFrequency: toFiniteNumber(summary.totalFrequency),
      totalInjected: toFiniteNumber(summary.totalInjected),
      totalMizuno,
      totalMizunoWithInjected: toFiniteNumberOr(summary.totalMizunoWithInjected, totalMizuno),
      totalMizunoWithoutInjected: toFiniteNumberOr(summary.totalMizunoWithoutInjected, totalMizuno),
      totalCleats: toFiniteNumber(summary.totalCleats),
      totalUnderArmour: toFiniteNumber(summary.totalUnderArmour),
      totalOlympikus,
      totalOlympikusWithInjected: toFiniteNumberOr(summary.totalOlympikusWithInjected, totalOlympikus),
      totalOlympikusWithoutInjected: toFiniteNumberOr(summary.totalOlympikusWithoutInjected, totalOlympikus),
      modelGroups: normalizeModelGroups(summary.modelGroups)
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  function defaultFileName(reportName) {
    const baseName = String(reportName || "Relatorio-Producao")
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "Relatorio-Producao";

    return `Resumo-Producao-${baseName}.pdf`;
  }

  function fitText(doc, value, maxWidth) {
    const text = String(value || "—");
    if (doc.getTextWidth(text) <= maxWidth) return text;

    let shortened = text;
    while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened.trimEnd()}...`;
  }

  function buildDetailLayout(groups) {
    const layouts = groups.map(group => ({ group, columnCount: 1 }));
    const layoutUnits = layout => 3.4 + Math.ceil(Math.max(1, layout.group.models.length) / layout.columnCount);
    const totalUnits = () => layouts.reduce((total, layout) => total + layoutUnits(layout), 0);

    while (totalUnits() > 58) {
      const candidate = layouts
        .filter(layout => layout.columnCount < 4 && layout.group.models.length > layout.columnCount)
        .map(layout => ({
          layout,
          saving: Math.ceil(layout.group.models.length / layout.columnCount)
            - Math.ceil(layout.group.models.length / (layout.columnCount + 1))
        }))
        .sort((left, right) => right.saving - left.saving)[0];

      if (!candidate || candidate.saving <= 0) break;
      candidate.layout.columnCount += 1;
    }

    return layouts.map(layout => {
      const models = layout.group.models.length > 0 ? [...layout.group.models] : [null];
      const rowsPerColumn = Math.ceil(models.length / layout.columnCount);
      const modelColumns = Array.from({ length: layout.columnCount }, (_item, index) =>
        models.slice(index * rowsPerColumn, (index + 1) * rowsPerColumn)
      ).filter(column => column.length > 0);

      return {
        group: layout.group,
        modelColumns,
        units: 3.4 + rowsPerColumn
      };
    });
  }

  function create(summaryInput) {
    if (!globalObject.jspdf || !globalObject.jspdf.jsPDF) {
      throw new Error("Biblioteca de PDF não carregada.");
    }

    const summary = normalizeSummary(summaryInput);
    const { jsPDF } = globalObject.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = 210;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const officialFound = summary.totalOfficial > 0;
    const difference = summary.totalCalculated - summary.totalOfficial;
    const isBalanced = officialFound && difference === 0;
    const statusLabel = !officialFound
      ? "Total oficial não encontrado"
      : isBalanced
        ? "RELATÓRIO CONFERIDO"
        : `Divergência de ${formatNumber(Math.abs(difference))}`;
    const generatedAt = new Date(summary.generatedAt);
    const formattedDate = Number.isNaN(generatedAt.getTime())
      ? "—"
      : generatedAt.toLocaleString("pt-BR");

    doc.setProperties({
      title: "Resumo de Produção",
      subject: `Resumo do relatório ${summary.reportName}`,
      author: "Produção GCI",
      creator: "Produção GCI"
    });

    const headerTop = 14;
    const headerHeight = 38;
    const headerSideX = 132;
    const headerSideWidth = pageWidth - margin - headerSideX;

    doc.setFillColor(17, 24, 39);
    doc.roundedRect(margin, headerTop, contentWidth, headerHeight, 3, 3, "F");
    doc.setFillColor(55, 48, 163);
    doc.roundedRect(headerSideX, headerTop, headerSideWidth, headerHeight, 3, 3, "F");
    doc.rect(headerSideX, headerTop, 5, headerHeight, "F");

    const logoAreaRight = 46;
    const logoWidth = 16;
    const logoHeight = logoWidth * INSTITUTION_LOGO_RATIO;
    const logoX = margin + (logoAreaRight - margin - logoWidth) / 2;
    const logoY = headerTop + (headerHeight - logoHeight) / 2;
    const headerTextX = 50;
    const headerTextWidth = headerSideX - headerTextX - 2;

    doc.addImage(
      INSTITUTION_LOGO_DATA_URL,
      "PNG",
      logoX,
      logoY,
      logoWidth,
      logoHeight,
      "institution-logo",
      "FAST"
    );
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.35);
    doc.line(logoAreaRight, 20, logoAreaRight, 46);

    doc.setTextColor(199, 210, 254);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("RELATÓRIO DE LEITURAS - FREQUÊNCIA", headerTextX, 23);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14.2);
    doc.text("RESUMO GERAL DE PRODUÇÃO", headerTextX, 33);
    doc.setTextColor(226, 232, 240);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const reportLabel = `GCI: ${summary.reportName}`;
    doc.text(fitText(doc, reportLabel, headerTextWidth), headerTextX, 43);

    doc.setTextColor(199, 210, 254);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.text("RELATÓRIO GERADO EM", headerSideX + 6, 21.5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.2);
    doc.text(fitText(doc, formattedDate, headerSideWidth - 12), headerSideX + 6, 27);
    doc.setTextColor(224, 231, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(`${formatNumber(summary.lineCount)} MODELOS PROCESSADOS`, headerSideX + 6, 33.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    const compactStatusLabel = fitText(doc, statusLabel, headerSideWidth - 16);
    const pillWidth = Math.min(headerSideWidth - 12, Math.max(28, doc.getTextWidth(compactStatusLabel) + 7));
    const pillX = headerSideX + 6;
    if (isBalanced) {
      doc.setFillColor(209, 250, 229);
      doc.setTextColor(6, 95, 70);
    } else {
      doc.setFillColor(254, 243, 199);
      doc.setTextColor(146, 64, 14);
    }
    doc.roundedRect(pillX, 37, pillWidth, 7.5, 3.7, 3.7, "F");
    doc.text(compactStatusLabel, pillX + pillWidth / 2, 42, { align: "center" });

    function drawMetricCard(x, label, value) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, 62, 54, 28, 3, 3, "FD");
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(label.toUpperCase(), x + 4, 71);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.text(value, x + 4, 83);
    }

    drawMetricCard(14, "TOTAL ARCAB - LIDO", officialFound ? formatNumber(summary.totalOfficial) : "—");
    drawMetricCard(78, "TOTAL GCI - CONFERIDO", formatNumber(summary.totalCalculated));
    drawMetricCard(142, "TOTAL FREQUÊNCIA", formatNumber(summary.totalFrequency));

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("CALCULO DE PRODUÇÃO GERAL - GCI", margin, 103);

    const tableTop = 109;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, tableTop, contentWidth, 11, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("CLASSIFICAÇÃO DE PRODUÇÃO POR PROCESSOS E MARCAS", margin + 3, tableTop + 7);
    doc.text("QUANTIDADE", pageWidth - margin - 3, tableTop + 7, { align: "right" });

    const rows = [
      ["[ARCAB] OLYMPIKUS", summary.totalOlympikusWithInjected],
      ["[FREQ.] OLYMPIKUS", summary.totalOlympikusWithoutInjected],
      ["[ARCAB] MIZUNO", summary.totalMizunoWithInjected],
      ["[FREQ.] MIZUNO", summary.totalMizunoWithoutInjected],
      ["[TOTAL] UNDER ARMOUR", summary.totalUnderArmour],
      ["[TOTAL] CHUTEIRAS", summary.totalCleats],
      ["[TOTAL] INJETADOS", summary.totalInjected],
    ];

    rows.forEach(([label, value], index) => {
      const y = tableTop + 11 + index * 12;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 12, pageWidth - margin, y + 12);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(label, margin + 3, y + 7.7);
      doc.setFont("helvetica", "bold");
      doc.text(formatNumber(value), pageWidth - margin - 3, y + 7.7, { align: "right" });
    });

    const noteTop = tableTop + 11 + rows.length * 12 + 5;
    const note = "Os totais sem injetados descontam somente os modelos injetados da própria marca. O total geral de injetados permanece uma classificação paralela às marcas e também compõe o cálculo de frequência.";
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, noteTop, contentWidth, 21, "F");
    doc.setFillColor(99, 102, 241);
    doc.rect(margin, noteTop, 1.3, 21, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(note, contentWidth - 10), margin + 5, noteTop + 8, { lineHeightFactor: 1.4 });

    doc.addPage();

    doc.setTextColor(79, 70, 229);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    doc.text("DETALHAMENTO DO RELATÓRIO", margin, 17);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("MODELOS POR MARCA E INJETADOS", margin, 26);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.text("Todos os modelos desta leitura, agrupados por classificação.", margin, 32);
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.7);
    doc.line(margin, 36, pageWidth - margin, 36);

    const detailLayout = buildDetailLayout(summary.modelGroups);
    const totalDetailUnits = Math.max(1, detailLayout.reduce((total, layout) => total + layout.units, 0));
    const availableHeight = 238;
    const unitHeight = Math.min(5.2, availableHeight / totalDetailUnits);
    const headingHeight = unitHeight;
    const tableHeaderHeight = unitHeight * 0.8;
    const totalHeight = unitHeight * 1.25;
    const bodyFontSize = Math.min(6.2, Math.max(0.3, unitHeight * 1.55));

    if (summary.modelGroups.length === 0) {
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("Nenhum modelo disponível para detalhamento.", pageWidth / 2, 55, { align: "center" });
    }

    let detailY = 42;
    detailLayout.forEach(layout => {
      const group = layout.group;
      if (group.type === "injected") doc.setFillColor(154, 52, 18);
      else doc.setFillColor(51, 65, 85);
      doc.rect(margin, detailY, contentWidth, headingHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.min(7.2, bodyFontSize * 1.04));
      doc.text(fitText(doc, group.label, contentWidth - 4), margin + 2, detailY + headingHeight * 0.72);
      detailY += headingHeight;

      const columnGap = 1.2;
      const modelColumnCount = layout.modelColumns.length;
      const modelColumnWidth = (contentWidth - columnGap * (modelColumnCount - 1)) / modelColumnCount;
      const maxRows = Math.max(1, ...layout.modelColumns.map(column => column.length));

      layout.modelColumns.forEach((models, columnIndex) => {
        const columnX = margin + columnIndex * (modelColumnWidth + columnGap);
        let rowY = detailY;

        doc.setFillColor(248, 250, 252);
        doc.rect(columnX, rowY, modelColumnWidth, tableHeaderHeight, "F");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(Math.max(0.25, bodyFontSize * 0.76));
        doc.text("ART.", columnX + 1.2, rowY + tableHeaderHeight * 0.72);
        doc.text("MODELO", columnX + modelColumnWidth * 0.25, rowY + tableHeaderHeight * 0.72);
        doc.text("QTD.", columnX + modelColumnWidth - 1.2, rowY + tableHeaderHeight * 0.72, { align: "right" });
        rowY += tableHeaderHeight;

        models.forEach(model => {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.08);
          doc.line(columnX, rowY + unitHeight, columnX + modelColumnWidth, rowY + unitHeight);
          doc.setFontSize(bodyFontSize);

          if (!model) {
            doc.setTextColor(148, 163, 184);
            doc.setFont("helvetica", "italic");
            doc.text("Nenhum modelo.", columnX + modelColumnWidth / 2, rowY + unitHeight * 0.7, { align: "center" });
            return;
          }

          const articleWidth = modelColumnWidth * 0.22;
          const quantityWidth = Math.max(7, modelColumnWidth * 0.17);
          const descriptionWidth = modelColumnWidth - articleWidth - quantityWidth - 5;
          const description = group.type === "injected" && model.modeloInjetado
            ? `${model.descricao} [${model.modeloInjetado}]`
            : model.descricao;
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
          doc.text(fitText(doc, model.artigo, articleWidth), columnX + 1.2, rowY + unitHeight * 0.7);
          doc.text(fitText(doc, description, descriptionWidth), columnX + articleWidth + 2, rowY + unitHeight * 0.7);
          doc.setFont("helvetica", "bold");
          doc.text(formatNumber(model.quantidade), columnX + modelColumnWidth - 1.2, rowY + unitHeight * 0.7, { align: "right" });
          rowY += unitHeight;
        });
      });

      detailY += tableHeaderHeight + maxRows * unitHeight;
      if (group.type === "injected") {
        doc.setFillColor(255, 247, 237);
        doc.setTextColor(154, 52, 18);
      } else {
        doc.setFillColor(238, 242, 255);
        doc.setTextColor(30, 41, 59);
      }
      doc.rect(margin, detailY, contentWidth, totalHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.min(8.2, Math.max(0.3, bodyFontSize * 1.24)));
      doc.text(fitText(doc, `Total produção ${group.label}`, contentWidth * 0.75), margin + 2, detailY + totalHeight * 0.72);
      doc.text(formatNumber(group.total), pageWidth - margin - 2, detailY + totalHeight * 0.72, { align: "right" });
      detailY += totalHeight + unitHeight * 0.35;
    });

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.text("Produção GCI - Resumo pelo Controle de Produção por Marca e Processo de Preparação - de Deuzimar Souza", margin, 286);
      doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, 286, { align: "right" });
    }

    return doc;
  }

  function download(summary) {
    const doc = create(summary);
    const fileName = defaultFileName(summary && summary.reportName);
    doc.save(fileName);
    return fileName;
  }

  globalObject.productionPdf = Object.freeze({
    create,
    download,
    defaultFileName
  });
})(typeof window !== "undefined" ? window : globalThis);
