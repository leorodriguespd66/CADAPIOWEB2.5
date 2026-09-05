import React, { useState, useMemo } from 'react';
import { 
  Bike, Plus, Search, Phone, DollarSign, CheckCircle2, Clock, 
  Copy, Edit2, Trash2, X, Check, MapPin, ExternalLink, Receipt, AlertCircle,
  ToggleLeft, ToggleRight, ArrowUpRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { Motoboy, Order, Store, NeighborhoodFee } from '../types';

interface MotoboysManagerProps {
  store: Store;
  motoboys: Motoboy[];
  orders: Order[];
  onUpdateMotoboys: (motoboys: Motoboy[]) => void;
  onUpdateOrders?: (orders: Order[]) => void;
  onUpdateStore?: (store: Store) => void;
  onShowToast: (msg: string) => void;
}

export default function MotoboysManager({
  store,
  motoboys,
  orders,
  onUpdateMotoboys,
  onUpdateOrders,
  onUpdateStore,
  onShowToast
}: MotoboysManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [editingMotoboy, setEditingMotoboy] = useState<Partial<Motoboy> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingReceiptMotoboy, setViewingReceiptMotoboy] = useState<Motoboy | null>(null);

  // New Neighborhood fee inline modal/state
  const [showAddNeighborhood, setShowAddNeighborhood] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newNeighborhoodFee, setNewNeighborhoodFee] = useState<number>(5);

  // Filter motoboys belonging to this store
  const storeMotoboys = useMemo(() => {
    return motoboys.filter(m => m.storeId === store.id);
  }, [motoboys, store.id]);

  const filteredMotoboys = useMemo(() => {
    if (!searchTerm.trim()) return storeMotoboys;
    const term = searchTerm.toLowerCase();
    return storeMotoboys.filter(m => 
      m.name.toLowerCase().includes(term) ||
      m.phone.toLowerCase().includes(term) ||
      (m.vehicle && m.vehicle.toLowerCase().includes(term)) ||
      (m.pixKey && m.pixKey.toLowerCase().includes(term))
    );
  }, [storeMotoboys, searchTerm]);

  // Financial and operational calculations for this store
  const completedDeliveries = useMemo(() => {
    return orders.filter(o => 
      o.storeId === store.id && 
      o.status === 'completed' && 
      o.driverId
    );
  }, [orders, store.id]);

  const totalPendingPayout = useMemo(() => {
    return completedDeliveries
      .filter(o => !o.driverFeePaid)
      .reduce((acc, o) => acc + (o.driverFee || o.deliveryFee || 0), 0);
  }, [completedDeliveries]);

  const totalPaidPayout = useMemo(() => {
    return completedDeliveries
      .filter(o => o.driverFeePaid)
      .reduce((acc, o) => acc + (o.driverFee || o.deliveryFee || 0), 0);
  }, [completedDeliveries]);

  // Open creation modal
  const handleOpenCreate = () => {
    setEditingMotoboy({
      storeId: store.id,
      name: '',
      phone: '',
      vehicle: 'Honda CG 160',
      pixKey: '',
      pixKeyType: 'telefone',
      isActive: true
    });
    setIsCreating(true);
  };

  // Open edit modal
  const handleOpenEdit = (m: Motoboy) => {
    setEditingMotoboy({ ...m });
    setIsCreating(false);
  };

  // Save or update Motoboy
  const handleSaveMotoboy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMotoboy?.name?.trim() || !editingMotoboy?.phone?.trim()) {
      alert('Nome e WhatsApp do motoboy são obrigatórios!');
      return;
    }

    const finalMotoboy: Motoboy = {
      id: editingMotoboy.id || `driver-${Date.now()}`,
      storeId: store.id,
      name: editingMotoboy.name.trim(),
      phone: editingMotoboy.phone.trim().replace(/\D/g, ''),
      vehicle: editingMotoboy.vehicle?.trim() || 'Motocicleta',
      pixKey: editingMotoboy.pixKey?.trim() || '',
      pixKeyType: editingMotoboy.pixKeyType || 'telefone',
      isActive: editingMotoboy.isActive ?? true,
      createdAt: editingMotoboy.createdAt || new Date().toISOString()
    };

    let updatedList = [...motoboys];
    if (isCreating) {
      updatedList.push(finalMotoboy);
      onShowToast(`🏍️ Motoboy ${finalMotoboy.name} cadastrado com sucesso!`);
    } else {
      updatedList = updatedList.map(m => m.id === finalMotoboy.id ? finalMotoboy : m);
      onShowToast(`✅ Dados de ${finalMotoboy.name} atualizados!`);
    }

    onUpdateMotoboys(updatedList);
    setEditingMotoboy(null);
  };

  // Toggle Motoboy active status
  const handleToggleActive = (driverId: string) => {
    const updated = motoboys.map(m => m.id === driverId ? { ...m, isActive: !m.isActive } : m);
    onUpdateMotoboys(updated);
    onShowToast('Status do motoboy atualizado.');
  };

  // Delete Motoboy
  const handleDeleteMotoboy = (driverId: string, name: string) => {
    if (!window.confirm(`Deseja realmente remover o cadastro de ${name}?`)) return;
    const updated = motoboys.filter(m => m.id !== driverId);
    onUpdateMotoboys(updated);
    onShowToast(`Motoboy ${name} removido.`);
  };

  // Mark all pending fees as paid for a specific motoboy
  const handleMarkPaid = (driverId: string, driverName: string) => {
    if (!onUpdateOrders) return;
    const nowIso = new Date().toISOString();
    let count = 0;
    let totalPaid = 0;

    const updated = orders.map(o => {
      if (o.driverId === driverId && o.status === 'completed' && !o.driverFeePaid) {
        count++;
        totalPaid += (o.driverFee || o.deliveryFee || 0);
        return {
          ...o,
          driverFeePaid: true,
          driverFeePaidAt: nowIso
        };
      }
      return o;
    });

    if (count === 0) {
      alert('Não há taxas pendentes a pagar para este motoboy.');
      return;
    }

    onUpdateOrders(updated);
    onShowToast(`💰 Repasse de R$ ${totalPaid.toFixed(2)} marcado como pago para ${driverName}!`);
  };

  // Copy PIX key to clipboard
  const handleCopyPix = (pix: string) => {
    if (!pix) {
      alert('Nenhuma chave PIX cadastrada para este entregador.');
      return;
    }
    navigator.clipboard.writeText(pix);
    onShowToast('📋 Chave PIX copiada para a área de transferência!');
  };

  // Add new neighborhood fee to the store
  const handleAddNeighborhood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeighborhoodName.trim()) return;
    if (!onUpdateStore) return;

    const existing = store.neighborhoodFees || [];
    const newFee: NeighborhoodFee = {
      id: `fee-${Date.now()}`,
      name: newNeighborhoodName.trim(),
      fee: Number(newNeighborhoodFee) || 0
    };

    const updatedStore: Store = {
      ...store,
      neighborhoodFees: [...existing, newFee]
    };

    onUpdateStore(updatedStore);
    setNewNeighborhoodName('');
    setNewNeighborhoodFee(5);
    setShowAddNeighborhood(false);
    onShowToast(`📍 Bairro ${newFee.name} com taxa de R$ ${newFee.fee.toFixed(2)} cadastrado!`);
  };

  // Helper to calculate stats per motoboy
  const getMotoboyStats = (driverId: string) => {
    const driverOrders = orders.filter(o => o.driverId === driverId && o.status === 'completed');
    const pendingOrders = driverOrders.filter(o => !o.driverFeePaid);
    const paidOrders = driverOrders.filter(o => o.driverFeePaid);

    const pendingTotal = pendingOrders.reduce((acc, o) => acc + (o.driverFee || o.deliveryFee || 0), 0);
    const paidTotal = paidOrders.reduce((acc, o) => acc + (o.driverFee || o.deliveryFee || 0), 0);

    return {
      totalCount: driverOrders.length,
      pendingCount: pendingOrders.length,
      pendingTotal,
      paidTotal,
      orders: driverOrders
    };
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="motoboys-manager-container">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Bike size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Gestão de Motoboys & Taxa por Bairro/Setor
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {store.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre seus entregadores. Cada pedido entregue credita automaticamente ao motoboy o valor configurado para o bairro ou setor do cliente.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Cadastrar Novo Motoboy</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Motoboys Cadastrados</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bike size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{storeMotoboys.length}</span>
            <span className="text-xs text-emerald-600 font-semibold">
              ({storeMotoboys.filter(m => m.isActive).length} disponíveis)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Entregadores vinculados a este restaurante</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entregas Concluídas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{completedDeliveries.length}</span>
            <span className="text-xs text-slate-500">pedidos</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Corridas despachadas e finalizadas</span>
        </div>

        <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Saldo Pendente a Pagar</span>
            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-950 font-mono">
              R$ {totalPendingPayout.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-amber-800/80 mt-1 block">A repassar pelas entregas por bairro</span>
        </div>

        <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Total Já Repassado</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-950 font-mono">
              R$ {totalPaidPayout.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-emerald-800/80 mt-1 block">Valores já liquidados aos motoboys</span>
        </div>
      </div>

      {/* Neighborhood Fees & Sector Reference Table Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tabela de Taxas por Bairro / Setor (Valor do Motoboy)
              </h3>
              <p className="text-xs text-slate-500">
                Cada entrega concluída no bairro respectivo credita exatamente esta taxa na conta do motoboy responsável.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddNeighborhood(!showAddNeighborhood)}
            className="px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer self-start sm:self-center"
          >
            <Plus size={14} />
            <span>Adicionar Bairro / Setor</span>
          </button>
        </div>

        {/* Add Neighborhood Inline Form */}
        {showAddNeighborhood && (
          <form onSubmit={handleAddNeighborhood} className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 flex flex-col sm:flex-row items-end gap-3 animate-fadeIn">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">Nome do Bairro ou Setor</label>
              <input
                type="text"
                placeholder="Ex: Setor Bueno, Jardim América, Centro..."
                value={newNeighborhoodName}
                onChange={e => setNewNeighborhoodName(e.target.value)}
                required
                className="w-full p-2 bg-white rounded-lg border border-indigo-300 text-xs font-semibold text-slate-800"
              />
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">Taxa de Entrega / Repasse (R$)</label>
              <input
                type="number"
                step="0.50"
                min="0"
                placeholder="Ex: 8.00"
                value={newNeighborhoodFee}
                onChange={e => setNewNeighborhoodFee(Number(e.target.value))}
                required
                className="w-full p-2 bg-white rounded-lg border border-indigo-300 text-xs font-mono font-bold text-slate-900"
              />
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
              >
                Salvar Bairro
              </button>
              <button
                type="button"
                onClick={() => setShowAddNeighborhood(false)}
                className="px-3 py-2 border border-slate-300 hover:bg-white text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Neighborhood Chips */}
        <div className="flex flex-wrap gap-2.5">
          {(store.neighborhoodFees || []).map(nf => (
            <div 
              key={nf.id} 
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl flex items-center space-x-2 text-xs transition"
            >
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{nf.name}</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                R$ {nf.fee.toFixed(2)}
              </span>
            </div>
          ))}

          {(!store.neighborhoodFees || store.neighborhoodFees.length === 0) && (
            <div className="text-xs text-slate-400 italic py-2">
              Nenhum bairro cadastrado especificamente. A taxa padrão de entrega da loja (R$ {store.deliveryFee?.toFixed(2) || '5.00'}) será utilizada como repasse do motoboy.
            </div>
          )}
        </div>
      </div>

      {/* Motoboys Search & Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, fone, placa ou PIX..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-orange-500 font-medium"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium self-end sm:self-center">
            Exibindo {filteredMotoboys.length} de {storeMotoboys.length} motoboys
          </span>
        </div>

        {filteredMotoboys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <Bike size={28} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Nenhum motoboy cadastrado</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Cadastre os entregadores que prestam serviço para a loja. No despacho dos pedidos pelo PDV, você selecionará o motoboy e ele receberá a taxa por bairro automaticamente.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
            >
              <Plus size={14} />
              <span>Cadastrar Primeiro Motoboy</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMotoboys.map(motoboy => {
              const stats = getMotoboyStats(motoboy.id);

              return (
                <div 
                  key={motoboy.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  {/* Header info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                        motoboy.isActive ? 'bg-orange-500' : 'bg-slate-400'
                      }`}>
                        <Bike size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{motoboy.name}</h4>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-500">{motoboy.vehicle || 'Motocicleta'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(motoboy.id)}
                      className="cursor-pointer"
                      title={motoboy.isActive ? 'Clique para desativar motoboy' : 'Clique para ativar motoboy'}
                    >
                      {motoboy.isActive ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Pausado
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Contact & PIX */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400" />
                        WhatsApp:
                      </span>
                      <a
                        href={`https://wa.me/55${motoboy.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <span>{motoboy.phone}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    {motoboy.pixKey && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                          <DollarSign size={12} className="text-slate-400" />
                          Chave PIX:
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[130px]" title={motoboy.pixKey}>
                            {motoboy.pixKey}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPix(motoboy.pixKey)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                            title="Copiar chave PIX"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Operational and Financial Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Entregas</span>
                      <span className="text-base font-black text-slate-900">{stats.totalCount}</span>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block">Saldo a Pagar</span>
                      <span className="text-base font-black text-amber-950 font-mono">
                        R$ {stats.pendingTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingReceiptMotoboy(motoboy)}
                        className="flex-1 py-2 px-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Receipt size={13} className="text-slate-500" />
                        <span>Ver Extrato por Bairro</span>
                      </button>

                      {stats.pendingTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(motoboy.id, motoboy.name)}
                          className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
                          title="Marcar repasses pendentes como pagos"
                        >
                          <Check size={13} />
                          <span>Pagar</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(motoboy)}
                          className="hover:text-slate-700 flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit2 size={12} />
                          <span>Editar</span>
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMotoboy(motoboy.id, motoboy.name)}
                          className="hover:text-red-600 flex items-center space-x-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Excluir</span>
                        </button>
                      </div>

                      {stats.paidTotal > 0 && (
                        <span className="text-[10px] text-slate-400">
                          Já pago: R$ {stats.paidTotal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------
          MODAL: CADASTRAR OU EDITAR MOTOBOY
         ---------------------------------------------------- */}
      {editingMotoboy && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            onClick={() => setEditingMotoboy(null)} 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" 
          />

          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative z-10 animate-fadeIn">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                    <Bike size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isCreating ? 'Cadastrar Novo Motoboy' : 'Editar Dados do Motoboy'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMotoboy(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMotoboy} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo do Entregador *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={editingMotoboy.name || ''}
                    onChange={e => setEditingMotoboy({ ...editingMotoboy, name: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp (com DDD) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 62999998888"
                      value={editingMotoboy.phone || ''}
                      onChange={e => setEditingMotoboy({ ...editingMotoboy, phone: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Veículo / Placa</label>
                    <input
                      type="text"
                      placeholder="Ex: CG 160 - BRA-2E19"
                      value={editingMotoboy.vehicle || ''}
                      onChange={e => setEditingMotoboy({ ...editingMotoboy, vehicle: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center space-x-1.5 text-slate-800 font-bold">
                    <DollarSign size={14} className="text-emerald-600" />
                    <span>Dados de Pagamento (PIX)</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo de Chave</label>
                      <select
                        value={editingMotoboy.pixKeyType || 'telefone'}
                        onChange={e => setEditingMotoboy({ ...editingMotoboy, pixKeyType: e.target.value as any })}
                        className="w-full p-2 bg-white rounded-lg border border-slate-300 font-semibold text-xs"
                      >
                        <option value="telefone">Telefone</option>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="aleatoria">Aleatória</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Chave PIX</label>
                      <input
                        type="text"
                        placeholder="Informe a chave PIX do motoboy"
                        value={editingMotoboy.pixKey || ''}
                        onChange={e => setEditingMotoboy({ ...editingMotoboy, pixKey: e.target.value })}
                        className="w-full p-2 bg-white rounded-lg border border-slate-300 font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Status de Disponibilidade</span>
                    <span className="text-[10px] text-slate-400">Motoboy disponível para despachos no PDV</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMotoboy({ ...editingMotoboy, isActive: !editingMotoboy.isActive })}
                    className="cursor-pointer"
                  >
                    {editingMotoboy.isActive ? (
                      <ToggleRight className="text-emerald-500" size={32} />
                    ) : (
                      <ToggleLeft className="text-slate-300" size={32} />
                    )}
                  </button>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingMotoboy(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg shadow-md cursor-pointer"
                  >
                    {isCreating ? 'Salvar Motoboy' : 'Atualizar Dados'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: EXTRATO DETALHADO DE CORRIDAS POR BAIRRO / SETOR
         ---------------------------------------------------- */}
      {viewingReceiptMotoboy && (() => {
        const stats = getMotoboyStats(viewingReceiptMotoboy.id);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div 
              onClick={() => setViewingReceiptMotoboy(null)} 
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" 
            />

            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-white">
                      <Bike size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">
                        Extrato de Corridas por Bairro: {viewingReceiptMotoboy.name}
                      </h3>
                      <p className="text-xs text-slate-300">
                        {viewingReceiptMotoboy.vehicle} • WhatsApp: {viewingReceiptMotoboy.phone}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingReceiptMotoboy(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Subheader PIX & Balance */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white px-3 py-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Chave PIX ({viewingReceiptMotoboy.pixKeyType || 'PIX'}):</span>
                      <div className="flex items-center space-x-2 font-mono font-bold text-slate-800">
                        <span>{viewingReceiptMotoboy.pixKey || 'Não cadastrada'}</span>
                        {viewingReceiptMotoboy.pixKey && (
                          <button
                            type="button"
                            onClick={() => handleCopyPix(viewingReceiptMotoboy.pixKey)}
                            className="text-orange-500 hover:text-orange-700 cursor-pointer p-0.5"
                            title="Copiar PIX"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">Pendente de Repasse</span>
                      <span className="text-base font-black text-amber-900 font-mono">
                        R$ {stats.pendingTotal.toFixed(2)}
                      </span>
                    </div>

                    {stats.pendingTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(viewingReceiptMotoboy.id, viewingReceiptMotoboy.name)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Marcar Tudo como Pago</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Deliveries list */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Histórico de Entregas Realizadas ({stats.orders.length})
                  </h4>

                  {stats.orders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Nenhuma corrida despachada e finalizada por este motoboy ainda.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {stats.orders.map(order => {
                        const fee = order.driverFee || order.deliveryFee || 0;
                        const neighborhood = order.addressNeighborhood || order.addressStreet || 'Setor / Bairro da Loja';

                        return (
                          <div 
                            key={order.id}
                            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                              order.driverFeePaid ? 'bg-white border-slate-200' : 'bg-amber-50/60 border-amber-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-slate-900">
                                  #{order.id.slice(-5)}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {order.customerName}
                                </span>
                                {order.driverFeePaid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                    Pago
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900 animate-pulse">
                                    A Repassar
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                                <MapPin size={12} className="text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-700">
                                  Bairro / Setor: <strong>{neighborhood}</strong>
                                </span>
                                <span>•</span>
                                <span>{new Date(order.createdAt).toLocaleDateString('pt-BR')} {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Taxa Creditada</span>
                                <span className="font-mono font-black text-sm text-slate-900">
                                  R$ {fee.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setViewingReceiptMotoboy(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Fechar Extrato
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
