import { jsPDF } from 'jspdf';
import { Store, Order, CashTransaction } from '../types';

interface DailyReportData {
  store: Store;
  dateString: string; // YYYY-MM-DD
  orders: Order[];
  cashTransactions: CashTransaction[];
}

export function generateDailyReportPDF({
  store,
  dateString,
  orders,
  cashTransactions
}: DailyReportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // Format date DD/MM/YYYY
  const [year, month, day] = dateString.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR');

  // Colors
  const primaryColor: [number, number, number] = [234, 88, 12]; // Orange-600
  const darkColor: [number, number, number] = [30, 41, 59]; // Slate-800
  const grayColor: [number, number, number] = [100, 116, 139]; // Slate-500
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate-50

  // 1. Header Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(store.name.toUpperCase(), margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('RELATÓRIO DIÁRIO DE VENDAS & FECHAMENTO DE CAIXA (PDV)', margin, 18);

  const rightHeaderText = `Data: ${formattedDate}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(rightHeaderText, pageWidth - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Emissão: ${generatedAt}`, pageWidth - margin, 18, { align: 'right' });

  y = 32;

  // Filter orders and transactions for the day (completed or active)
  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  // Financial Computations
  const totalSalesAmount = validOrders.reduce((sum, o) => sum + o.total, 0);
  
  // Payment methods breakdown
  let cashSales = 0;
  let pixSales = 0;
  let creditSales = 0;
  let debitSales = 0;

  validOrders.forEach(o => {
    if (o.paymentMethod === 'dinheiro') cashSales += o.total;
    else if (o.paymentMethod === 'pix') pixSales += o.total;
    else if (o.paymentMethod === 'cartao_credito') creditSales += o.total;
    else if (o.paymentMethod === 'cartao_debito') debitSales += o.total;
  });

  // Cash In / Out manual entries
  const manualCashIn = cashTransactions
    .filter(t => t.type === 'in' && t.category !== 'venda')
    .reduce((sum, t) => sum + t.amount, 0);

  const manualCashOut = cashTransactions
    .filter(t => t.type === 'out')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCashInflow = totalSalesAmount + manualCashIn;
  const netCashBalance = totalCashInflow - manualCashOut;

  // 2. Financial Summary Cards (Top Metrics)
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'S');

  const colWidth = (pageWidth - margin * 2) / 4;

  // Metric 1: Total Vendas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('TOTAL DE VENDAS', margin + 4, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text(`R$ ${totalSalesAmount.toFixed(2)}`, margin + 4, y + 17);
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text(`${validOrders.length} pedido(s) realizados`, margin + 4, y + 23);

  // Metric 2: Entradas Extras / Reforço
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('REFORÇOS / ENTRADAS', margin + colWidth + 4, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text(`+ R$ ${manualCashIn.toFixed(2)}`, margin + colWidth + 4, y + 17);
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Aportes manuais no caixa', margin + colWidth + 4, y + 23);

  // Metric 3: Saídas / Sangrias
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('SAÍDAS / SANGRIAS', margin + colWidth * 2 + 4, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(239, 68, 68); // Red-500
  doc.text(`- R$ ${manualCashOut.toFixed(2)}`, margin + colWidth * 2 + 4, y + 17);
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Despesas e retiradas', margin + colWidth * 2 + 4, y + 23);

  // Metric 4: Saldo Líquido do Caixa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text('SALDO LÍQUIDO DO DIA', margin + colWidth * 3 + 4, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(netCashBalance >= 0 ? 30 : 239, netCashBalance >= 0 ? 41 : 68, netCashBalance >= 0 ? 59 : 68);
  doc.text(`R$ ${netCashBalance.toFixed(2)}`, margin + colWidth * 3 + 4, y + 17);
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text('Resultado final apurado', margin + colWidth * 3 + 4, y + 23);

  y += 36;

  // 3. Vendas por Forma de Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text('1. RECEBIMENTOS POR FORMA DE PAGAMENTO', margin, y);
  y += 4;

  const payMethodsCols = [
    { label: 'Dinheiro', value: cashSales, count: validOrders.filter(o => o.paymentMethod === 'dinheiro').length },
    { label: 'PIX', value: pixSales, count: validOrders.filter(o => o.paymentMethod === 'pix').length },
    { label: 'Cartão de Crédito', value: creditSales, count: validOrders.filter(o => o.paymentMethod === 'cartao_credito').length },
    { label: 'Cartão de Débito', value: debitSales, count: validOrders.filter(o => o.paymentMethod === 'cartao_debito').length }
  ];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Forma de Pagamento', margin + 3, y + 5);
  doc.text('Qtd Pedidos', margin + 60, y + 5);
  doc.text('Valor Total (R$)', margin + 110, y + 5);
  doc.text('% do Total', pageWidth - margin - 5, y + 5, { align: 'right' });
  y += 7;

  payMethodsCols.forEach(pm => {
    const percent = totalSalesAmount > 0 ? ((pm.value / totalSalesAmount) * 100).toFixed(1) : '0.0';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...darkColor);
    doc.text(pm.label, margin + 3, y + 4.5);
    doc.text(`${pm.count} un`, margin + 60, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${pm.value.toFixed(2)}`, margin + 110, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${percent}%`, pageWidth - margin - 5, y + 4.5, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 6, pageWidth - margin, y + 6);
    y += 6;
  });

  y += 6;

  // 4. Detalhamento dos Pedidos e Vendas do Dia
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text(`2. DETALHAMENTO DAS VENDAS DO DIA (${orders.length} pedidos)`, margin, y);
  y += 4;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Hora', margin + 2, y + 5);
  doc.text('Pedido / Cliente', margin + 18, y + 5);
  doc.text('Tipo', margin + 78, y + 5);
  doc.text('Pagamento', margin + 106, y + 5);
  doc.text('Status', margin + 138, y + 5);
  doc.text('Total (R$)', pageWidth - margin - 2, y + 5, { align: 'right' });
  y += 7;

  if (orders.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Nenhum pedido registrado nesta data.', margin + 4, y + 6);
    y += 10;
  } else {
    orders.forEach((order) => {
      // Check page overflow
      if (y > pageHeight - 25) {
        doc.addPage();
        y = margin;
      }

      const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const clientStr = `${order.code} - ${order.customerName}`;
      const typeMap: Record<string, string> = { delivery: 'Entrega', pickup: 'Retirada', table: `Mesa ${order.tableNumber || ''}` };
      const payMap: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Crédito', cartao_debito: 'Débito' };
      const statusMap: Record<string, string> = {
        pending: 'Pendente',
        preparing: 'Em Preparo',
        delivering: 'Em Entrega',
        completed: 'Concluído',
        cancelled: 'Cancelado'
      };

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkColor);
      doc.text(timeStr, margin + 2, y + 4.5);

      doc.setFont('helvetica', 'bold');
      const truncatedClient = clientStr.length > 32 ? clientStr.substring(0, 30) + '...' : clientStr;
      doc.text(truncatedClient, margin + 18, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.text(typeMap[order.receiptType] || order.receiptType, margin + 78, y + 4.5);
      doc.text(payMap[order.paymentMethod] || order.paymentMethod, margin + 106, y + 4.5);
      
      // Status styling
      if (order.status === 'cancelled') {
        doc.setTextColor(239, 68, 68);
      } else if (order.status === 'completed') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(234, 88, 12);
      }
      doc.text(statusMap[order.status] || order.status, margin + 138, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text(`R$ ${order.total.toFixed(2)}`, pageWidth - margin - 2, y + 4.5, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      y += 6;
    });
  }

  y += 6;

  // 5. Movimentações de Caixa Extras (Entradas e Saídas manuais)
  if (y > pageHeight - 35) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text(`3. FLUXO DE CAIXA: ENTRADAS & SAÍDAS AVULSAS (${cashTransactions.length} registros)`, margin, y);
  y += 4;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Hora', margin + 2, y + 5);
  doc.text('Tipo', margin + 20, y + 5);
  doc.text('Categoria', margin + 45, y + 5);
  doc.text('Descrição', margin + 80, y + 5);
  doc.text('Valor (R$)', pageWidth - margin - 2, y + 5, { align: 'right' });
  y += 7;

  if (cashTransactions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Nenhuma movimentação avulsa de caixa registrada para esta data.', margin + 4, y + 6);
    y += 10;
  } else {
    cashTransactions.forEach(trans => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = margin;
      }

      const timeStr = trans.createdAt ? new Date(trans.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const isEntry = trans.type === 'in';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...darkColor);
      doc.text(timeStr, margin + 2, y + 4.5);

      doc.setFont('helvetica', 'bold');
      if (isEntry) {
        doc.setTextColor(16, 185, 129);
        doc.text('ENTRADA (+)', margin + 20, y + 4.5);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text('SAÍDA (-)', margin + 20, y + 4.5);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grayColor);
      doc.text(trans.category.toUpperCase(), margin + 45, y + 4.5);

      doc.setTextColor(...darkColor);
      const desc = trans.description.length > 40 ? trans.description.substring(0, 38) + '...' : trans.description;
      doc.text(desc, margin + 80, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isEntry ? 16 : 239, isEntry ? 185 : 68, isEntry ? 129 : 68);
      const sign = isEntry ? '+ R$ ' : '- R$ ';
      doc.text(`${sign}${trans.amount.toFixed(2)}`, pageWidth - margin - 2, y + 4.5, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      y += 6;
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `Página ${i} de ${totalPages} • Relatório Gerado pelo Cardápio Web PDV • ${store.name}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // Trigger download in browser
  const filename = `relatorio_caixa_${store.slug}_${dateString}.pdf`;
  doc.save(filename);
}
