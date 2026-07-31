/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Treasury Admin Manager - js/treasury-admin.js
   Complete treasury, budget, statements, and financial management
   ============================================================ */

'use strict';

class TreasuryAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._currentDashboard = null;
    this._allTransactions = [];
    this._editingTransactionId = null;
    this._currentRotaryYear = DateUtils.getCurrentRotaryYear();
  }

  /* ============================================================
     TREASURY OVERVIEW
     ============================================================ */
  async renderOverview(container, dashboard) {
    this._currentDashboard = dashboard;

    const [summaryData, recentTransactions, budgetData] = await Promise.all([
      this.loadTreasurySummary(),
      this.loadRecentTransactions(10),
      this.loadBudgetSummary()
    ]);

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="indian-rupee"></i> Treasury Overview
          </h1>
          <p class="admin-section-subtitle">
            Rotary Year ${this._currentRotaryYear} — Financial Summary
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('MANAGE_TREASURY') ? `
          <button class="btn btn-primary" onclick="treasuryAdmin.showTransactionForm()">
            <i data-lucide="plus-circle"></i>
            <span>Add Transaction</span>
          </button>` : ''}
          ${this.auth.can('DOWNLOAD_TREASURY') ? `
          <button class="btn btn-outline" onclick="treasuryAdmin.showStatementDownload()">
            <i data-lucide="download"></i>
            <span>Download Statement</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Financial Summary Cards -->
      <div class="treasury-summary-grid" id="treasury-summary-grid">
        ${this.renderSummaryCards(summaryData)}
      </div>

      <!-- Dashboard Grid -->
      <div class="treasury-dashboard-grid">

        <!-- Monthly Breakdown -->
        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="bar-chart"></i> Monthly Breakdown</h3>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="input-wrap neu-inset" style="padding:6px 12px;min-width:120px;">
                <input type="text"
                       id="treasury-year-select"
                       class="form-input"
                       value="${this._currentRotaryYear}"
                       placeholder="YYYY-YY"
                       style="font-size:0.82rem;text-align:center;width:90px;"
                       title="Type any Rotary Year e.g. 2025-26, 2030-31"
                       onchange="treasuryAdmin.loadMonthlyBreakdown(this.value)"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();treasuryAdmin.loadMonthlyBreakdown(this.value);}" />
              </div>
              <button class="btn btn-outline btn-sm"
                      onclick="treasuryAdmin.loadMonthlyBreakdown(document.getElementById('treasury-year-select').value)">
                <i data-lucide="refresh-cw"></i>
              </button>
            </div>
          </div>
          <div id="treasury-monthly-breakdown" style="padding:16px 20px;">
            ${this.renderMonthlyBreakdown(summaryData.monthly || [])}
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="admin-card neu-card">
          <div class="admin-card-header">
            <h3><i data-lucide="list"></i> Recent Transactions</h3>
            <button class="btn btn-outline btn-sm"
                    onclick="treasuryAdmin.renderTransactions(document.getElementById('admin-content'), treasuryAdmin._currentDashboard)">
              <span>View All</span>
              <i data-lucide="arrow-right"></i>
            </button>
          </div>
          <div id="treasury-recent-transactions">
            ${this.renderRecentTransactionsList(recentTransactions)}
          </div>
        </div>
      </div>

      <!-- Budget vs Actual -->
      ${budgetData && budgetData.length > 0 ? `
      <div class="admin-card neu-card" style="margin-top:20px;">
        <div class="admin-card-header">
          <h3><i data-lucide="target"></i> Budget vs Actual</h3>
        </div>
        <div style="padding:16px 20px;">
          ${this.renderBudgetComparison(budgetData)}
        </div>
      </div>` : ''}

      <!-- Category-wise Analysis -->
      <div class="admin-card neu-card" style="margin-top:20px;">
        <div class="admin-card-header">
          <h3><i data-lucide="pie-chart"></i> Category-wise Analysis</h3>
        </div>
        <div id="treasury-category-analysis" style="padding:16px 20px;">
          ${this.renderCategoryAnalysis(summaryData.categories || {})}
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  async loadTreasurySummary() {
    try {
      const { data: transactions, error } = await this.db
        .from('treasury_transactions')
        .select('*')
        .order('transaction_date', { ascending: true });

      if (error) throw error;

      const all = transactions || [];
      const totalIncome = all
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const totalExpense = all
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const balance = all.length > 0
        ? parseFloat(all[all.length - 1].balance || 0)
        : 0;

      const now = new Date();
      const currentMonthTrans = all.filter(t => {
        const td = new Date(t.transaction_date);
        return td.getMonth() === now.getMonth() &&
          td.getFullYear() === now.getFullYear();
      });
      const monthIncome = currentMonthTrans
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const monthExpense = currentMonthTrans
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      // Monthly breakdown
      const monthly = {};
      all.forEach(t => {
        const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
        if (!monthly[key]) {
          monthly[key] = { income: 0, expense: 0, month: t.month, year: t.year };
        }
        if (t.transaction_type === 'income') {
          monthly[key].income += parseFloat(t.amount || 0);
        } else {
          monthly[key].expense += parseFloat(t.amount || 0);
        }
      });

      // Category breakdown
      const categories = {};
      all.forEach(t => {
        const cat = t.category || 'Uncategorized';
        if (!categories[cat]) categories[cat] = { income: 0, expense: 0 };
        if (t.transaction_type === 'income') {
          categories[cat].income += parseFloat(t.amount || 0);
        } else {
          categories[cat].expense += parseFloat(t.amount || 0);
        }
      });

      return {
        totalIncome,
        totalExpense,
        balance,
        transactionCount: all.length,
        monthIncome,
        monthExpense,
        monthly: Object.values(monthly).sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        }),
        categories
      };
    } catch (e) {
      console.warn('Treasury summary error:', e);
      return {
        totalIncome: 0, totalExpense: 0, balance: 0,
        transactionCount: 0, monthIncome: 0, monthExpense: 0,
        monthly: [], categories: {}
      };
    }
  }

  async loadRecentTransactions(limit = 10) {
    try {
      const { data } = await this.db
        .from('treasury_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    } catch (e) {
      return [];
    }
  }

  async loadBudgetSummary() {
    try {
      const { data } = await this.db
        .from('treasury_budget')
        .select('*')
        .eq('rotary_year', this._currentRotaryYear);
      return data || [];
    } catch (e) {
      return [];
    }
  }

  renderSummaryCards(summary) {
    return `
      <div class="treasury-cards-row">
        <div class="treasury-main-card neu-card">
          <div class="treasury-main-card-label">Current Balance</div>
          <div class="treasury-main-card-value ${(summary.balance || 0) >= 0 ? 'positive' : 'negative'}">
            ${StringUtils.formatCurrency(summary.balance || 0)}
          </div>
          <div class="treasury-main-card-meta">
            ${summary.transactionCount || 0} total transactions
          </div>
        </div>
        <div class="treasury-stat-cards">
          <div class="treasury-stat-card neu-card income">
            <div class="treasury-stat-icon">
              <i data-lucide="trending-up"></i>
            </div>
            <div class="treasury-stat-info">
              <span class="treasury-stat-label">Total Income</span>
              <span class="treasury-stat-value">
                ${StringUtils.formatCurrency(summary.totalIncome || 0)}
              </span>
            </div>
          </div>
          <div class="treasury-stat-card neu-card expense">
            <div class="treasury-stat-icon">
              <i data-lucide="trending-down"></i>
            </div>
            <div class="treasury-stat-info">
              <span class="treasury-stat-label">Total Expenses</span>
              <span class="treasury-stat-value">
                ${StringUtils.formatCurrency(summary.totalExpense || 0)}
              </span>
            </div>
          </div>
          <div class="treasury-stat-card neu-card month-income">
            <div class="treasury-stat-icon">
              <i data-lucide="arrow-up-circle"></i>
            </div>
            <div class="treasury-stat-info">
              <span class="treasury-stat-label">This Month Income</span>
              <span class="treasury-stat-value">
                ${StringUtils.formatCurrency(summary.monthIncome || 0)}
              </span>
            </div>
          </div>
          <div class="treasury-stat-card neu-card month-expense">
            <div class="treasury-stat-icon">
              <i data-lucide="arrow-down-circle"></i>
            </div>
            <div class="treasury-stat-info">
              <span class="treasury-stat-label">This Month Expenses</span>
              <span class="treasury-stat-value">
                ${StringUtils.formatCurrency(summary.monthExpense || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderMonthlyBreakdown(monthly) {
    if (!monthly || monthly.length === 0) {
      return `<div class="admin-empty-state">
        <i data-lucide="bar-chart"></i><p>No data available</p>
      </div>`;
    }

    const maxAmount = Math.max(
      ...monthly.map(m => Math.max(m.income || 0, m.expense || 0)), 1
    );

    return `
      <div class="treasury-monthly-table">
        <div class="treasury-monthly-header">
          <span>Month</span>
          <span>Income</span>
          <span>Expense</span>
          <span>Net</span>
          <span>Chart</span>
        </div>
        ${monthly.slice(0, 12).map(m => {
          const net = (m.income || 0) - (m.expense || 0);
          const incomeWidth = maxAmount > 0
            ? ((m.income || 0) / maxAmount) * 100 : 0;
          const expenseWidth = maxAmount > 0
            ? ((m.expense || 0) / maxAmount) * 100 : 0;
          return `
            <div class="treasury-monthly-row">
              <span class="treasury-month-label">
                ${DateUtils.getMonthName(m.month)} ${m.year}
              </span>
              <span class="treasury-amount income-text">
                ${StringUtils.formatCurrency(m.income || 0)}
              </span>
              <span class="treasury-amount expense-text">
                ${StringUtils.formatCurrency(m.expense || 0)}
              </span>
              <span class="treasury-amount ${net >= 0 ? 'positive-text' : 'negative-text'}">
                ${StringUtils.formatCurrency(net)}
              </span>
              <div class="treasury-bar-wrap">
                <div class="treasury-bar income-bar"
                     style="width:${incomeWidth.toFixed(1)}%;"></div>
                <div class="treasury-bar expense-bar"
                     style="width:${expenseWidth.toFixed(1)}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async loadMonthlyBreakdown(rotaryYear) {
    const container = document.getElementById('treasury-monthly-breakdown');
    if (!container) return;

    if (!rotaryYear || !rotaryYear.trim()) return;

    container.innerHTML = `
      <div class="loading-single-line" style="width:200px;margin:20px auto;">
        <div class="loading-line-track">
          <div class="loading-line-fill"></div>
        </div>
      </div>
    `;

    try {
      // Parse the rotary year (format: YYYY-YY e.g., 2025-26)
      const yearParts = rotaryYear.trim().split('-');
      const startYear = parseInt(yearParts[0]);

      if (isNaN(startYear)) {
        container.innerHTML = `
          <div class="admin-empty-state">
            <p style="color:var(--danger);">Invalid year format. Use YYYY-YY (e.g., 2025-26)</p>
          </div>`;
        return;
      }

      const endYear = startYear + 1;

      const { data } = await this.db
        .from('treasury_transactions')
        .select('transaction_type, amount, month, year')
        .or(`year.eq.${startYear},year.eq.${endYear}`);

      const monthly = {};
      (data || []).forEach(t => {
        const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
        if (!monthly[key]) {
          monthly[key] = { income: 0, expense: 0, month: t.month, year: t.year };
        }
        if (t.transaction_type === 'income') {
          monthly[key].income += parseFloat(t.amount || 0);
        } else {
          monthly[key].expense += parseFloat(t.amount || 0);
        }
      });

      const sorted = Object.values(monthly).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      container.innerHTML = this.renderMonthlyBreakdown(sorted);
    } catch (e) {
      container.innerHTML = `
        <div class="admin-empty-state">
          <p>Failed to load data. Please check the year format.</p>
        </div>`;
    }
  }

  renderRecentTransactionsList(transactions) {
    if (!transactions || transactions.length === 0) {
      return `<div class="admin-empty-state">
        <i data-lucide="list"></i><p>No transactions yet</p>
      </div>`;
    }

    return transactions.map(t => {
      const isIncome = t.transaction_type === 'income';
      return `
        <div class="admin-list-item" onclick="treasuryAdmin.viewTransaction('${t.id}')">
          <div class="admin-list-icon"
               style="background:${isIncome ? 'var(--success-light)' : 'var(--danger-light)'};
                      color:${isIncome ? 'var(--success)' : 'var(--danger)'};">
            <i data-lucide="${isIncome ? 'arrow-up-circle' : 'arrow-down-circle'}"></i>
          </div>
          <div class="admin-list-info">
            <div class="admin-list-title">
              ${StringUtils.sanitize(t.particular || '')}
            </div>
            <div class="admin-list-meta">
              ${DateUtils.format(t.transaction_date, 'short')}
              ${t.category ? ` • ${StringUtils.sanitize(t.category)}` : ''}
              ${t.voucher_number ? ` • V#${StringUtils.sanitize(t.voucher_number)}` : ''}
              ${t.rotary_year ? ` • ${StringUtils.sanitize(t.rotary_year)}` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:0.9rem;font-weight:700;
                        color:${isIncome ? 'var(--success)' : 'var(--danger)'};">
              ${isIncome ? '+' : '-'}${StringUtils.formatCurrency(t.amount || 0)}
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);">
              Bal: ${StringUtils.formatCurrency(t.balance || 0)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCategoryAnalysis(categories) {
    const entries = Object.entries(categories);
    if (entries.length === 0) {
      return '<div class="admin-empty-state"><p>No category data</p></div>';
    }

    const totalAll = entries.reduce((s, [, v]) => s + (v.income || 0) + (v.expense || 0), 0) || 1;

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
        ${entries
          .sort((a, b) =>
            ((b[1].income || 0) + (b[1].expense || 0)) -
            ((a[1].income || 0) + (a[1].expense || 0))
          )
          .map(([cat, data]) => {
            const total = (data.income || 0) + (data.expense || 0);
            const pct = ((total / totalAll) * 100).toFixed(1);
            return `
              <div class="neu-card" style="padding:14px;">
                <div style="display:flex;justify-content:space-between;
                            align-items:center;margin-bottom:8px;">
                  <span style="font-size:0.82rem;font-weight:600;
                               color:var(--text-heading);">
                    ${StringUtils.sanitize(cat)}
                  </span>
                  <span style="font-size:0.72rem;color:var(--text-muted);">
                    ${pct}%
                  </span>
                </div>
                <div style="display:flex;gap:16px;font-size:0.78rem;">
                  <span style="color:var(--success);">
                    In: ${StringUtils.formatCurrency(data.income || 0)}
                  </span>
                  <span style="color:var(--danger);">
                    Out: ${StringUtils.formatCurrency(data.expense || 0)}
                  </span>
                </div>
                <div style="height:4px;border-radius:2px;background:var(--bg-secondary);
                            margin-top:8px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;
                              background:linear-gradient(90deg,var(--accent),
                              rgba(var(--accent-rgb),0.5));border-radius:2px;"></div>
                </div>
              </div>
            `;
          }).join('')}
      </div>
    `;
  }

  renderBudgetComparison(budgetData) {
    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Avenue</th>
              <th>Rotary Year</th>
              <th>Budgeted Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${budgetData.map(b => `
              <tr>
                <td style="font-weight:600;">
                  ${StringUtils.sanitize(b.category || '')}
                </td>
                <td>
                  ${b.avenue
                    ? `<span class="admin-avenue-badge"
                            style="background:${AVENUES[b.avenue]?.bgColor || 'var(--accent-light)'};
                                   color:${AVENUES[b.avenue]?.color || 'var(--accent)'};">
                        ${AVENUES[b.avenue]?.shortLabel || StringUtils.snakeToTitle(b.avenue)}
                      </span>`
                    : '<span style="color:var(--text-muted);font-size:0.78rem;">General</span>'}
                </td>
                <td style="font-size:0.82rem;color:var(--text-secondary);">
                  ${StringUtils.sanitize(b.rotary_year || '—')}
                </td>
                <td style="font-weight:700;">
                  ${StringUtils.formatCurrency(b.budgeted_amount || 0)}
                </td>
                <td style="font-size:0.8rem;color:var(--text-muted);">
                  ${StringUtils.sanitize(b.notes || '—')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ============================================================
     TRANSACTIONS LIST
     ============================================================ */
  async renderTransactions(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: transactions, error } = await this.db
      .from('treasury_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      dashboard?.showToast('Failed to load transactions', 'error');
      return;
    }

    this._allTransactions = transactions || [];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="list"></i> All Transactions
          </h1>
          <p class="admin-section-subtitle">
            ${transactions?.length || 0} transactions recorded
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('MANAGE_TREASURY') ? `
          <button class="btn btn-primary"
                  onclick="treasuryAdmin.showTransactionForm()">
            <i data-lucide="plus-circle"></i>
            <span>Add Transaction</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row" style="flex-wrap:wrap;gap:10px;">
          <div class="input-wrap neu-inset" style="flex:1;min-width:200px;max-width:280px;">
            <i data-lucide="search"
               style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;"></i>
            <input type="text" id="txn-search" class="form-input"
                   placeholder="Search transactions..."
                   oninput="treasuryAdmin.applyTransactionFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:130px;">
            <select id="txn-type-filter" class="form-select"
                    onchange="treasuryAdmin.applyTransactionFilters()">
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:180px;">
            <select id="txn-category-filter" class="form-select"
                    onchange="treasuryAdmin.applyTransactionFilters()">
              <option value="">All Categories</option>
              ${TRANSACTION_CATEGORIES.map(c =>
                `<option value="${c}">${c}</option>`
              ).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="input-wrap neu-inset" style="min-width:130px;padding:8px 12px;">
            <input type="date" id="txn-from-date" class="form-input"
                   placeholder="From date"
                   onchange="treasuryAdmin.applyTransactionFilters()"
                   style="font-size:0.82rem;" />
          </div>
          <div class="input-wrap neu-inset" style="min-width:130px;padding:8px 12px;">
            <input type="date" id="txn-to-date" class="form-input"
                   placeholder="To date"
                   onchange="treasuryAdmin.applyTransactionFilters()"
                   style="font-size:0.82rem;" />
          </div>
          <div class="input-wrap neu-inset" style="min-width:110px;padding:8px 12px;">
            <input type="text" id="txn-year-filter" class="form-input"
                   placeholder="e.g. 2025-26"
                   title="Filter by Rotary Year (YYYY-YY)"
                   oninput="treasuryAdmin.applyTransactionFilters()"
                   style="font-size:0.82rem;" />
          </div>
          <button class="btn btn-outline btn-sm"
                  onclick="treasuryAdmin.resetTransactionFilters()">
            <i data-lucide="x"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="txn-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Particular</th>
                <th>Category</th>
                <th>Rotary Year</th>
                <th>Voucher</th>
                <th style="text-align:right;">Income (Rs.)</th>
                <th style="text-align:right;">Expense (Rs.)</th>
                <th style="text-align:right;">Balance (Rs.)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="txn-table-body">
              ${this.renderTransactionRows(transactions || [])}
            </tbody>
          </table>
        </div>
        <div class="treasury-table-footer" id="txn-table-footer">
          ${this.renderTransactionSummaryFooter(transactions || [])}
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  renderTransactionRows(transactions) {
    if (!transactions || transactions.length === 0) {
      return `<tr><td colspan="10" class="admin-table-empty">
        <i data-lucide="indian-rupee"></i>
        <span>No transactions found</span>
      </td></tr>`;
    }

    return transactions.map((t, i) => {
      const isIncome = t.transaction_type === 'income';
      return `
        <tr data-txn-id="${t.id}"
            data-type="${t.transaction_type}"
            data-category="${StringUtils.sanitize(t.category || '')}"
            data-date="${t.transaction_date || ''}"
            data-rotary-year="${StringUtils.sanitize(t.rotary_year || '')}">
          <td style="color:var(--text-muted);font-size:0.82rem;">${i + 1}</td>
          <td style="white-space:nowrap;font-size:0.84rem;">
            ${DateUtils.format(t.transaction_date, 'short')}
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-heading);max-width:200px;
                        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                 title="${StringUtils.sanitize(t.particular || '')}">
              ${StringUtils.sanitize(t.particular || '')}
            </div>
            ${t.description ? `
            <div style="font-size:0.72rem;color:var(--text-muted);max-width:200px;
                        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${StringUtils.sanitize(t.description)}
            </div>` : ''}
          </td>
          <td>
            <span style="font-size:0.78rem;padding:2px 8px;border-radius:var(--border-radius-full);
                         background:var(--bg-secondary);color:var(--text-secondary);">
              ${StringUtils.sanitize(t.category || '—')}
            </span>
          </td>
          <td style="font-size:0.78rem;color:var(--text-secondary);">
            ${StringUtils.sanitize(t.rotary_year || '—')}
          </td>
          <td style="font-size:0.82rem;color:var(--text-muted);">
            ${StringUtils.sanitize(t.voucher_number || '—')}
          </td>
          <td style="text-align:right;font-weight:600;color:var(--success);font-size:0.88rem;">
            ${isIncome ? StringUtils.formatCurrency(t.amount || 0) : '—'}
          </td>
          <td style="text-align:right;font-weight:600;color:var(--danger);font-size:0.88rem;">
            ${!isIncome ? StringUtils.formatCurrency(t.amount || 0) : '—'}
          </td>
          <td style="text-align:right;font-weight:700;font-size:0.88rem;
                     color:${parseFloat(t.balance || 0) >= 0
                       ? 'var(--accent)' : 'var(--danger)'};">
            ${StringUtils.formatCurrency(t.balance || 0)}
          </td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-action-btn"
                      onclick="treasuryAdmin.viewTransaction('${t.id}')"
                      title="View Details">
                <i data-lucide="eye"></i>
              </button>
              ${this.auth.can('MANAGE_TREASURY') ? `
              <button class="admin-action-btn"
                      onclick="treasuryAdmin.showTransactionForm('${t.id}')"
                      title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button class="admin-action-btn admin-action-danger"
                      onclick="treasuryAdmin.deleteTransaction('${t.id}')"
                      title="Delete">
                <i data-lucide="trash-2"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTransactionSummaryFooter(transactions) {
    const totalIncome = (transactions || [])
      .filter(t => t.transaction_type === 'income')
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalExpense = (transactions || [])
      .filter(t => t.transaction_type === 'expense')
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const finalBalance = transactions && transactions.length > 0
      ? parseFloat(transactions[0].balance || 0) : 0;

    return `
      <div class="treasury-footer-row">
        <div class="treasury-footer-item">
          <span>Total Income</span>
          <span class="income-text">${StringUtils.formatCurrency(totalIncome)}</span>
        </div>
        <div class="treasury-footer-item">
          <span>Total Expenses</span>
          <span class="expense-text">${StringUtils.formatCurrency(totalExpense)}</span>
        </div>
        <div class="treasury-footer-item">
          <span>Net Balance</span>
          <span style="color:${finalBalance >= 0 ? 'var(--accent)' : 'var(--danger)'};">
            ${StringUtils.formatCurrency(finalBalance)}
          </span>
        </div>
      </div>
    `;
  }

  /* ============================================================
     TRANSACTION FILTERS
     ============================================================ */
  applyTransactionFilters() {
    const search = document.getElementById('txn-search')?.value?.toLowerCase() || '';
    const type = document.getElementById('txn-type-filter')?.value || '';
    const category = document.getElementById('txn-category-filter')?.value || '';
    const fromDate = document.getElementById('txn-from-date')?.value || '';
    const toDate = document.getElementById('txn-to-date')?.value || '';
    const rotaryYear = document.getElementById('txn-year-filter')?.value?.trim() || '';

    const rows = document.querySelectorAll('#txn-table-body tr[data-txn-id]');

    rows.forEach(row => {
      const particular = row.querySelector('td:nth-child(3)')?.textContent?.toLowerCase() || '';
      const rowType = row.getAttribute('data-type') || '';
      const rowCategory = row.getAttribute('data-category') || '';
      const rowDate = row.getAttribute('data-date') || '';
      const rowRotaryYear = row.getAttribute('data-rotary-year') || '';

      const matchSearch = !search || particular.includes(search);
      const matchType = !type || rowType === type;
      const matchCategory = !category || rowCategory === category;
      const matchFrom = !fromDate || rowDate >= fromDate;
      const matchTo = !toDate || rowDate <= toDate;
      const matchYear = !rotaryYear ||
        rowRotaryYear.toLowerCase().includes(rotaryYear.toLowerCase());

      row.style.display =
        (matchSearch && matchType && matchCategory &&
          matchFrom && matchTo && matchYear)
          ? '' : 'none';
    });
  }

  resetTransactionFilters() {
    const fields = [
      'txn-search', 'txn-type-filter', 'txn-category-filter',
      'txn-from-date', 'txn-to-date', 'txn-year-filter'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.applyTransactionFilters();
  }

  /* ============================================================
     TRANSACTION FORM (ADD / EDIT)
     ============================================================ */
  async showTransactionForm(transactionId = null) {
    this._editingTransactionId = transactionId;
    let txnData = null;

    if (transactionId) {
      const { data } = await this.db
        .from('treasury_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      txnData = data;
    }

    const isEdit = !!txnData;
    const content = document.getElementById('admin-content');
    if (!content) return;

    // Current rotary year as default — always typeable
    const currentRY = this._currentRotaryYear ||
      DateUtils.getCurrentRotaryYear() || '2024-25';

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit Transaction' : 'Add New Transaction'}
          </h1>
        </div>
        <button class="btn btn-outline"
                onclick="treasuryAdmin.renderTransactions(
                  document.getElementById('admin-content'),
                  treasuryAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>Back</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <form id="txn-form" novalidate>
          <div class="admin-form-grid">

            <!-- Transaction Type -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="arrow-right-left"></i> Transaction Type *
              </label>
              <div class="select-wrap neu-inset">
                <select name="transaction_type" class="form-select" required>
                  <option value="income"
                    ${isEdit && txnData.transaction_type === 'income'
                      ? 'selected' : ''}>Income</option>
                  <option value="expense"
                    ${isEdit && txnData.transaction_type === 'expense'
                      ? 'selected' : ''}>Expense</option>
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Transaction Date -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar"></i> Transaction Date *
              </label>
              <div class="input-wrap neu-inset">
                <input type="date" name="transaction_date" class="form-input"
                       value="${isEdit
                         ? (txnData.transaction_date || '')
                         : new Date().toISOString().split('T')[0]}"
                       required />
              </div>
            </div>

            <!-- Particular -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Particular *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="particular" class="form-input"
                       placeholder="Transaction description (e.g., Membership fee collection)"
                       value="${isEdit
                         ? StringUtils.sanitize(txnData.particular || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Amount -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Amount (Rs.) *
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="amount" class="form-input"
                       placeholder="0.00" min="0.01" step="0.01"
                       value="${isEdit ? (txnData.amount || '') : ''}"
                       required />
              </div>
            </div>

            <!-- Category -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="tag"></i> Category *
              </label>
              <div class="select-wrap neu-inset">
                <select name="category" class="form-select" required>
                  <option value="">Select Category</option>
                  ${TRANSACTION_CATEGORIES.map(c =>
                    `<option value="${c}"
                      ${isEdit && txnData.category === c ? 'selected' : ''}>
                      ${c}
                    </option>`
                  ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Voucher Number -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="hash"></i> Voucher / Receipt Number
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="voucher_number" class="form-input"
                       placeholder="V-001 or R-001"
                       value="${isEdit
                         ? StringUtils.sanitize(txnData.voucher_number || '')
                         : ''}" />
              </div>
            </div>

            <!-- Rotary Year — FREE TEXT INPUT (no dropdown restriction) -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar-range"></i> Rotary Year
              </label>
              <div class="input-wrap neu-inset">
                <input type="text"
                       name="rotary_year"
                       class="form-input"
                       placeholder="e.g., 2025-26"
                       value="${isEdit
                         ? StringUtils.sanitize(txnData.rotary_year || currentRY)
                         : currentRY}"
                       title="Type any Rotary Year — Format: YYYY-YY (e.g., 2025-26, 2030-31)"
                />
              </div>
              <span style="font-size:0.68rem;color:var(--text-muted);
                           margin-top:4px;display:block;">
                Format: YYYY-YY — type any year including future years
                (e.g., 2026-27, 2030-31)
              </span>
            </div>

            <!-- Description -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="align-left"></i> Additional Description
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="description" class="form-textarea" rows="3"
                          placeholder="Additional notes or details..."
                >${isEdit
                  ? StringUtils.sanitize(txnData.description || '')
                  : ''}</textarea>
              </div>
            </div>

            <!-- Receipt Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="image"></i> Receipt / Voucher Image (Optional)
              </label>
              <div class="file-upload-wrap neu-inset">
                <input type="file" id="txn-receipt-input" class="file-input"
                       accept="image/*,application/pdf" />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span>Upload receipt or voucher image</span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    JPG, PNG, PDF — Max 10MB
                  </span>
                </div>
              </div>
              ${isEdit && txnData.receipt_url ? `
              <div style="margin-top:8px;">
                <a href="${StringUtils.sanitize(txnData.receipt_url)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="font-size:0.82rem;display:flex;align-items:center;gap:6px;">
                  <i data-lucide="file"
                     style="width:14px;height:14px;color:var(--accent);"></i>
                  View existing receipt
                </a>
              </div>` : ''}
            </div>

          </div>

          <!-- Form Actions -->
          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="treasuryAdmin.renderTransactions(
                      document.getElementById('admin-content'),
                      treasuryAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            <button type="submit" class="btn btn-primary" id="txn-submit-btn">
              <i data-lucide="${isEdit ? 'check-circle' : 'plus-circle'}"></i>
              <span>${isEdit ? 'Update Transaction' : 'Add Transaction'}</span>
            </button>
          </div>

          <div class="form-message" id="txn-form-msg"></div>
        </form>
      </div>
    `;

    this.setupTransactionFormListeners(isEdit, txnData);
    lucide.createIcons();
  }

  setupTransactionFormListeners(isEdit, txnData) {
    const form = document.getElementById('txn-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitTransactionForm(isEdit, isEdit ? txnData?.id : null);
      });
    }
  }

  async submitTransactionForm(isEdit, txnId = null) {
    const form = document.getElementById('txn-form');
    const msgEl = document.getElementById('txn-form-msg');
    const submitBtn = document.getElementById('txn-submit-btn');

    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const admin = this.auth.getAdmin();

    // Validate required fields
    if (!data.particular?.trim()) {
      this.showFormMsg(msgEl, 'Particular is required', 'error');
      return;
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      this.showFormMsg(msgEl, 'Please enter a valid amount greater than 0', 'error');
      return;
    }
    if (!data.transaction_date) {
      this.showFormMsg(msgEl, 'Transaction date is required', 'error');
      return;
    }
    if (!data.category) {
      this.showFormMsg(msgEl, 'Please select a category', 'error');
      return;
    }

    // Validate rotary year format if provided
    const rotaryYear = (data.rotary_year || '').trim();
    if (rotaryYear && !/^\d{4}-\d{2}$/.test(rotaryYear)) {
      this.showFormMsg(
        msgEl,
        'Rotary Year must be in format YYYY-YY (e.g., 2025-26, 2030-31)',
        'error'
      );
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }

    try {
      // Upload receipt if provided
      let receiptUrl = null;
      const receiptInput = document.getElementById('txn-receipt-input');
      const receiptFile = receiptInput?.files?.[0];

      if (receiptFile) {
        try {
          const filename = `receipt_${Date.now()}_${receiptFile.name
            .replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const { data: uploadData, error: uploadError } = await this.db.storage
            .from(STORAGE_BUCKETS.TREASURY)
            .upload(filename, receiptFile, {
              contentType: receiptFile.type,
              upsert: false
            });

          if (!uploadError && uploadData) {
            receiptUrl = ImageUtils.getPublicUrl(STORAGE_BUCKETS.TREASURY, uploadData.path);
          }
        } catch (e) {
          console.warn('Receipt upload failed:', e);
        }
      }

      const payload = {
        transaction_date: data.transaction_date,
        particular: data.particular.trim(),
        description: data.description?.trim() || null,
        transaction_type: data.transaction_type,
        amount: parseFloat(data.amount),
        category: data.category,
        voucher_number: data.voucher_number?.trim() || null,
        rotary_year: rotaryYear || null
      };

      if (receiptUrl) payload.receipt_url = receiptUrl;

      if (isEdit && txnId) {
        payload.updated_at = new Date().toISOString();
        const { error } = await this.db
          .from('treasury_transactions')
          .update(payload)
          .eq('id', txnId);
        if (error) throw error;
      } else {
        payload.created_by = admin?.id || null;
        const { error } = await this.db
          .from('treasury_transactions')
          .insert(payload);
        if (error) throw error;

        await this.auth.logActivity(
          admin?.id, 'TREASURY_ADDED', 'treasury_transactions', null,
          {
            type: payload.transaction_type,
            amount: payload.amount,
            particular: payload.particular,
            rotary_year: payload.rotary_year
          }
        );
      }

      this._currentDashboard?.showToast(
        isEdit ? 'Transaction updated!' : 'Transaction added!',
        'success'
      );

      await this.renderTransactions(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (error) {
      console.error('Transaction form error:', error);
      this.showFormMsg(msgEl, `Failed: ${error.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="plus-circle"></i><span>Add Transaction</span>';
        lucide.createIcons();
      }
    }
  }

  async deleteTransaction(txnId) {
    if (!this._currentDashboard) return;

    this._currentDashboard.confirmAction(
      'Delete Transaction',
      'Permanently delete this transaction? This may affect balance calculations.',
      async () => {
        try {
          await this.db
            .from('treasury_transactions')
            .delete()
            .eq('id', txnId);
          this._currentDashboard?.showToast('Transaction deleted', 'success');
          await this.renderTransactions(
            document.getElementById('admin-content'),
            this._currentDashboard
          );
        } catch (e) {
          this._currentDashboard?.showToast('Failed to delete', 'error');
        }
      },
      'trash-2'
    );
  }

  async viewTransaction(txnId) {
    try {
      const { data: txn } = await this.db
        .from('treasury_transactions')
        .select('*')
        .eq('id', txnId)
        .single();

      if (!txn) return;

      const isIncome = txn.transaction_type === 'income';

      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.id = 'txn-detail-modal';

      modal.innerHTML = `
        <div class="modal-container neu-card" style="max-width:520px;">
          <div class="modal-header">
            <h2 class="modal-title">
              <i data-lucide="${isIncome ? 'arrow-up-circle' : 'arrow-down-circle'}"
                 style="color:${isIncome ? 'var(--success)' : 'var(--danger)'}"></i>
              Transaction Details
            </h2>
            <button class="modal-close neu-btn"
                    onclick="document.getElementById('txn-detail-modal').remove();
                             document.body.style.overflow='';">
              <i data-lucide="x"></i>
            </button>
          </div>
          <div class="modal-body">
            <div style="text-align:center;margin-bottom:20px;">
              <div style="font-size:2rem;font-weight:800;
                          color:${isIncome ? 'var(--success)' : 'var(--danger)'};">
                ${isIncome ? '+' : '-'}${StringUtils.formatCurrency(txn.amount || 0)}
              </div>
              <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">
                ${isIncome ? 'Income' : 'Expense'} •
                Balance after: ${StringUtils.formatCurrency(txn.balance || 0)}
              </div>
            </div>
            <div class="modal-details-grid">
              <div class="modal-detail-item">
                <i data-lucide="file-text"></i>
                <div>
                  <span class="modal-detail-label">Particular</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(txn.particular || '')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="calendar"></i>
                <div>
                  <span class="modal-detail-label">Date</span>
                  <span class="modal-detail-value">
                    ${DateUtils.format(txn.transaction_date, 'long')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="tag"></i>
                <div>
                  <span class="modal-detail-label">Category</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(txn.category || '—')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="calendar-range"></i>
                <div>
                  <span class="modal-detail-label">Rotary Year</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(txn.rotary_year || '—')}
                  </span>
                </div>
              </div>
              ${txn.voucher_number ? `
              <div class="modal-detail-item">
                <i data-lucide="hash"></i>
                <div>
                  <span class="modal-detail-label">Voucher Number</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(txn.voucher_number)}
                  </span>
                </div>
              </div>` : ''}
              ${txn.description ? `
              <div class="modal-detail-item" style="grid-column:1/-1;">
                <i data-lucide="align-left"></i>
                <div>
                  <span class="modal-detail-label">Description</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(txn.description)}
                  </span>
                </div>
              </div>` : ''}
            </div>
            ${txn.receipt_url ? `
            <div style="margin-top:16px;">
              <a href="${StringUtils.sanitize(txn.receipt_url)}"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="btn btn-outline btn-sm">
                <i data-lucide="file"></i>
                <span>View Receipt</span>
              </a>
            </div>` : ''}
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          document.body.style.overflow = '';
        }
      });
      lucide.createIcons();
    } catch (e) {
      this._currentDashboard?.showToast('Failed to load transaction', 'error');
    }
  }

  /* ============================================================
     BUDGET MANAGEMENT
     ============================================================ */
  async renderBudget(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: budgetItems } = await this.db
      .from('treasury_budget')
      .select('*')
      .eq('rotary_year', this._currentRotaryYear)
      .order('category');

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="target"></i> Budget Planning
          </h1>
          <p class="admin-section-subtitle">
            Rotary Year ${this._currentRotaryYear}
          </p>
        </div>
        <button class="btn btn-primary"
                onclick="treasuryAdmin.showBudgetForm()">
          <i data-lucide="plus-circle"></i>
          <span>Add Budget Item</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Avenue</th>
                <th>Rotary Year</th>
                <th>Budgeted Amount</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${!budgetItems || budgetItems.length === 0
                ? `<tr><td colspan="6" class="admin-table-empty">
                    <i data-lucide="target"></i>
                    <span>No budget items for ${this._currentRotaryYear}</span>
                  </td></tr>`
                : budgetItems.map(item => `
                  <tr>
                    <td style="font-weight:600;color:var(--text-heading);">
                      ${StringUtils.sanitize(item.category || '')}
                    </td>
                    <td>
                      ${item.avenue
                        ? `<span class="admin-avenue-badge"
                                style="background:${AVENUES[item.avenue]?.bgColor || ''};
                                       color:${AVENUES[item.avenue]?.color || ''};">
                            ${AVENUES[item.avenue]?.shortLabel ||
                              StringUtils.snakeToTitle(item.avenue)}
                          </span>`
                        : '<span style="color:var(--text-muted);font-size:0.78rem;">General</span>'}
                    </td>
                    <td style="font-size:0.82rem;color:var(--text-secondary);">
                      ${StringUtils.sanitize(item.rotary_year || '—')}
                    </td>
                    <td style="font-weight:700;font-size:0.9rem;">
                      ${StringUtils.formatCurrency(item.budgeted_amount || 0)}
                    </td>
                    <td style="font-size:0.82rem;color:var(--text-muted);">
                      ${StringUtils.sanitize(item.notes || '—')}
                    </td>
                    <td>
                      <div class="admin-table-actions">
                        <button class="admin-action-btn"
                                onclick="treasuryAdmin.editBudgetItem('${item.id}')"
                                title="Edit">
                          <i data-lucide="pencil"></i>
                        </button>
                        <button class="admin-action-btn admin-action-danger"
                                onclick="treasuryAdmin.deleteBudgetItem('${item.id}')"
                                title="Delete">
                          <i data-lucide="trash-2"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
            ${budgetItems && budgetItems.length > 0 ? `
            <tfoot>
              <tr style="background:var(--bg-secondary);">
                <td colspan="3"
                    style="font-weight:700;color:var(--text-heading);padding:12px 16px;">
                  Total Budget
                </td>
                <td style="font-weight:800;font-size:1rem;color:var(--accent);padding:12px 16px;">
                  ${StringUtils.formatCurrency(
                    budgetItems.reduce((s, i) => s + parseFloat(i.budgeted_amount || 0), 0)
                  )}
                </td>
                <td colspan="2"></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  showBudgetForm(budgetItem = null) {
    const isEdit = !!budgetItem;
    const currentRY = this._currentRotaryYear ||
      DateUtils.getCurrentRotaryYear() || '2024-25';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'budget-form-modal';

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:520px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit Budget Item' : 'Add Budget Item'}
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('budget-form-modal').remove();
                           document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="budget-form">

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="tag"></i> Category *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="category" class="form-input"
                       placeholder="Budget category"
                       value="${isEdit
                         ? StringUtils.sanitize(budgetItem.category || '')
                         : ''}"
                       required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="layers"></i> Avenue (optional)
              </label>
              <div class="select-wrap neu-inset">
                <select name="avenue" class="form-select">
                  <option value="">General (no specific avenue)</option>
                  ${Object.entries(AVENUES).map(([k, v]) =>
                    `<option value="${k}"
                      ${isEdit && budgetItem.avenue === k ? 'selected' : ''}>
                      ${v.label}
                    </option>`
                  ).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Budgeted Amount (Rs.) *
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="budgeted_amount" class="form-input"
                       min="0" step="0.01" placeholder="0.00"
                       value="${isEdit ? (budgetItem.budgeted_amount || '') : ''}"
                       required />
              </div>
            </div>

            <!-- Rotary Year — FREE TEXT INPUT -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar-range"></i> Rotary Year
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="rotary_year" class="form-input"
                       placeholder="e.g., 2025-26"
                       value="${isEdit
                         ? StringUtils.sanitize(budgetItem.rotary_year || currentRY)
                         : currentRY}"
                       title="Type any Rotary Year — Format: YYYY-YY" />
              </div>
              <span style="font-size:0.68rem;color:var(--text-muted);
                           margin-top:4px;display:block;">
                Format: YYYY-YY — type any year including future years
              </span>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="file-text"></i> Notes
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="notes" class="form-textarea" rows="2"
                          placeholder="Additional notes..."
                >${isEdit
                  ? StringUtils.sanitize(budgetItem.notes || '')
                  : ''}</textarea>
              </div>
            </div>

            <div class="form-message" id="budget-form-msg"></div>

            <div class="admin-form-actions" style="padding:0;margin-top:16px;">
              <button type="button" class="btn btn-outline"
                      onclick="document.getElementById('budget-form-modal').remove();
                               document.body.style.overflow='';">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="${isEdit ? 'check-circle' : 'plus-circle'}"></i>
                <span>${isEdit ? 'Update' : 'Add Item'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('budget-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      const msgEl = document.getElementById('budget-form-msg');

      const rotaryYear = (data.rotary_year || '').trim();
      if (rotaryYear && !/^\d{4}-\d{2}$/.test(rotaryYear)) {
        if (msgEl) {
          msgEl.textContent = 'Rotary Year must be in format YYYY-YY (e.g., 2025-26)';
          msgEl.className = 'form-message error';
        }
        return;
      }

      try {
        const payload = {
          category: data.category?.trim(),
          avenue: data.avenue || null,
          budgeted_amount: parseFloat(data.budgeted_amount || 0),
          notes: data.notes?.trim() || null,
          rotary_year: rotaryYear || this._currentRotaryYear,
          created_by: this.auth.getAdmin()?.id
        };

        if (isEdit) {
          await this.db
            .from('treasury_budget')
            .update(payload)
            .eq('id', budgetItem.id);
        } else {
          await this.db.from('treasury_budget').insert(payload);
        }

        modal.remove();
        document.body.style.overflow = 'hidden';
        this._currentDashboard?.showToast(
          isEdit ? 'Budget item updated' : 'Budget item added',
          'success'
        );
        await this.renderBudget(
          document.getElementById('admin-content'),
          this._currentDashboard
        );
      } catch (err) {
        this._currentDashboard?.showToast('Failed to save budget item', 'error');
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = 'hidden';
      }
    });

    lucide.createIcons();
  }

  async editBudgetItem(itemId) {
    const { data } = await this.db
      .from('treasury_budget')
      .select('*')
      .eq('id', itemId)
      .single();
    if (data) this.showBudgetForm(data);
  }

  async deleteBudgetItem(itemId) {
    if (!confirm('Delete this budget item?')) return;
    try {
      await this.db.from('treasury_budget').delete().eq('id', itemId);
      this._currentDashboard?.showToast('Budget item deleted', 'success');
      await this.renderBudget(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to delete', 'error');
    }
  }

  /* ============================================================
     TREASURY STATEMENTS DOWNLOAD
     ============================================================ */
  renderStatements(container, dashboard) {
    this._currentDashboard = dashboard;

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="download"></i> Treasury Statements
          </h1>
          <p class="admin-section-subtitle">
            Download financial statements in Excel or CSV format
          </p>
        </div>
      </div>

      <div class="admin-card neu-card" style="max-width:600px;">
        <div style="padding:32px;">
          <form id="statement-download-form">

            <div class="admin-form-grid" style="padding:0;">
              <div class="form-group">
                <label class="form-label">
                  <i data-lucide="calendar"></i> From Date *
                </label>
                <div class="input-wrap neu-inset">
                  <input type="date" id="stmt-from-date" class="form-input" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <i data-lucide="calendar"></i> To Date *
                </label>
                <div class="input-wrap neu-inset">
                  <input type="date" id="stmt-to-date" class="form-input" required
                         value="${new Date().toISOString().split('T')[0]}" />
                </div>
              </div>

              <div class="form-group admin-form-full">
                <label class="form-label">
                  <i data-lucide="file-spreadsheet"></i> Download Format
                </label>
                <div class="select-wrap neu-inset">
                  <select id="stmt-format" class="form-select">
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="csv">CSV (.csv)</option>
                  </select>
                  <i data-lucide="chevron-down" class="select-arrow"></i>
                </div>
              </div>
            </div>

            <div class="admin-form-actions" style="padding:16px 0 0;">
              <button type="submit" class="btn btn-primary">
                <i data-lucide="download"></i>
                <span>Generate &amp; Download Statement</span>
              </button>
            </div>

            <div class="form-message" id="stmt-form-msg"></div>
          </form>

          <!-- Quick Downloads -->
          <div style="margin-top:24px;padding-top:20px;
                      border-top:1px solid var(--border-color);">
            <h4 style="font-size:0.85rem;font-weight:700;
                        color:var(--text-heading);margin-bottom:12px;">
              Quick Downloads
            </h4>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm"
                      onclick="treasuryAdmin.downloadQuickStatement('current-month')">
                <i data-lucide="calendar"></i>
                <span>This Month</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="treasuryAdmin.downloadQuickStatement('last-month')">
                <i data-lucide="calendar"></i>
                <span>Last Month</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="treasuryAdmin.downloadQuickStatement('current-year')">
                <i data-lucide="calendar-range"></i>
                <span>Current Rotary Year</span>
              </button>
              <button class="btn btn-outline btn-sm"
                      onclick="treasuryAdmin.downloadQuickStatement('all')">
                <i data-lucide="layers"></i>
                <span>All Transactions</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('statement-download-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromDate = document.getElementById('stmt-from-date')?.value;
      const toDate = document.getElementById('stmt-to-date')?.value;
      const format = document.getElementById('stmt-format')?.value || 'excel';
      const msgEl = document.getElementById('stmt-form-msg');

      if (!fromDate || !toDate) {
        if (msgEl) {
          msgEl.textContent = 'Please select both From Date and To Date';
          msgEl.className = 'form-message error';
        }
        return;
      }

      if (fromDate > toDate) {
        if (msgEl) {
          msgEl.textContent = 'From Date must be before To Date';
          msgEl.className = 'form-message error';
        }
        return;
      }

      await this.generateStatement(fromDate, toDate, format);
    });

    lucide.createIcons();
  }

  showStatementDownload() {
    this.renderStatements(
      document.getElementById('admin-content'),
      this._currentDashboard
    );
    if (this._currentDashboard) {
      this._currentDashboard.currentSection = 'treasury-statements';
      this._currentDashboard.updateBreadcrumb('treasury-statements');
    }
  }

  async downloadQuickStatement(period) {
    const now = new Date();
    let fromDate, toDate;

    switch (period) {
      case 'current-month':
        fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        toDate = now.toISOString().split('T')[0];
        break;
      case 'last-month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        fromDate = lastMonth.toISOString().split('T')[0];
        toDate = new Date(now.getFullYear(), now.getMonth(), 0)
          .toISOString().split('T')[0];
        break;
      }
      case 'current-year': {
        // Rotary year starts July 1
        const rotaryYearStart = now.getMonth() >= 6
          ? `${now.getFullYear()}-07-01`
          : `${now.getFullYear() - 1}-07-01`;
        fromDate = rotaryYearStart;
        toDate = now.toISOString().split('T')[0];
        break;
      }
      case 'all':
        fromDate = '2019-01-01';
        toDate = now.toISOString().split('T')[0];
        break;
      default:
        fromDate = '2019-01-01';
        toDate = now.toISOString().split('T')[0];
    }

    await this.generateStatement(fromDate, toDate, 'excel');
  }

  async generateStatement(fromDate, toDate, format = 'excel') {
    this._currentDashboard?.showToast('Generating statement...', 'info');

    try {
      const { data: transactions, error } = await this.db
        .from('treasury_transactions')
        .select('*')
        .gte('transaction_date', fromDate)
        .lte('transaction_date', toDate)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        this._currentDashboard?.showToast(
          'No transactions found for the selected period',
          'warning'
        );
        return;
      }

      // Calculate totals
      const totalIncome = transactions
        .filter(t => t.transaction_type === 'income')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      const totalExpense = transactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

      // Build rows for export
      const rows = transactions.map((t, i) => ({
        'S.No': i + 1,
        'Date': t.transaction_date || '',
        'Particular': t.particular || '',
        'Category': t.category || '',
        'Rotary Year': t.rotary_year || '',
        'Voucher No': t.voucher_number || '',
        'Income (Rs.)': t.transaction_type === 'income'
          ? parseFloat(t.amount || 0).toFixed(2) : '',
        'Expense (Rs.)': t.transaction_type === 'expense'
          ? parseFloat(t.amount || 0).toFixed(2) : '',
        'Balance (Rs.)': parseFloat(t.balance || 0).toFixed(2)
      }));

      // Totals row
      rows.push({
        'S.No': '',
        'Date': '',
        'Particular': 'TOTAL',
        'Category': '',
        'Rotary Year': '',
        'Voucher No': '',
        'Income (Rs.)': totalIncome.toFixed(2),
        'Expense (Rs.)': totalExpense.toFixed(2),
        'Balance (Rs.)': (totalIncome - totalExpense).toFixed(2)
      });

      if (format === 'excel' && typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { width: 6 }, { width: 14 }, { width: 35 }, { width: 20 },
          { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Treasury Statement');

        const filename = `Treasury_Statement_${fromDate}_to_${toDate}.xlsx`;
        XLSX.writeFile(wb, filename);
        this._currentDashboard?.showToast('Statement downloaded!', 'success');
      } else {
        // CSV fallback
        const headers = Object.keys(rows[0]);
        const csv = [
          headers.join(','),
          ...rows.map(row =>
            headers.map(h =>
              `"${String(row[h] || '').replace(/"/g, '""')}"`
            ).join(',')
          )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const filename = `Treasury_Statement_${fromDate}_to_${toDate}.csv`;

        if (typeof saveAs !== 'undefined') {
          saveAs(blob, filename);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }

        this._currentDashboard?.showToast('Statement (CSV) downloaded!', 'success');
      }

    } catch (error) {
      console.error('Statement generation error:', error);
      this._currentDashboard?.showToast(
        `Failed to generate statement: ${error.message}`,
        'error'
      );
    }
  }

  /* ============================================================
     HELPER
     ============================================================ */
  showFormMsg(el, message, type) {
    if (el) {
      el.textContent = message;
      el.className = `form-message ${type}`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  renderTransactionForm(container, dashboard) {
    this._currentDashboard = dashboard;
    this.showTransactionForm();
  }
}

/* ============================================================
   TREASURY ADMIN STYLES
   ============================================================ */
const treasuryStyles = `
  .treasury-summary-grid { margin-bottom: 24px; }

  .treasury-cards-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 20px;
    align-items: stretch;
  }

  .treasury-main-card {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: linear-gradient(135deg, var(--accent-light), var(--bg-card));
    position: relative;
    overflow: hidden;
  }

  .treasury-main-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: var(--accent);
  }

  .treasury-main-card-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }

  .treasury-main-card-value {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 8px;
  }

  .treasury-main-card-value.positive { color: var(--accent); }
  .treasury-main-card-value.negative { color: var(--danger); }

  .treasury-main-card-meta {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .treasury-stat-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .treasury-stat-card {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .treasury-stat-icon {
    width: 42px;
    height: 42px;
    border-radius: var(--border-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: var(--neu-shadow-sm);
  }

  .treasury-stat-card.income .treasury-stat-icon {
    background: var(--success-light);
    color: var(--success);
  }

  .treasury-stat-card.expense .treasury-stat-icon {
    background: var(--danger-light);
    color: var(--danger);
  }

  .treasury-stat-card.month-income .treasury-stat-icon {
    background: rgba(56,161,105,0.1);
    color: var(--success);
  }

  .treasury-stat-card.month-expense .treasury-stat-icon {
    background: rgba(229,62,62,0.1);
    color: var(--danger);
  }

  .treasury-stat-icon svg,
  .treasury-stat-icon i {
    width: 20px;
    height: 20px;
  }

  .treasury-stat-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .treasury-stat-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .treasury-stat-value {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text-heading);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .treasury-dashboard-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 20px;
  }

  /* Monthly Breakdown */
  .treasury-monthly-table {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .treasury-monthly-header {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 1fr 1fr;
    gap: 8px;
    padding: 8px 0;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--border-color);
  }

  .treasury-monthly-row {
    display: grid;
    grid-template-columns: 100px 1fr 1fr 1fr 1fr;
    gap: 8px;
    padding: 10px 0;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.82rem;
  }

  .treasury-monthly-row:last-child { border-bottom: none; }

  .treasury-month-label {
    font-weight: 600;
    color: var(--text-heading);
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .income-text { color: var(--success); font-weight: 600; }
  .expense-text { color: var(--danger); font-weight: 600; }
  .positive-text { color: var(--accent); font-weight: 700; }
  .negative-text { color: var(--danger); font-weight: 700; }

  .treasury-amount {
    font-size: 0.82rem;
    text-align: right;
    white-space: nowrap;
  }

  .treasury-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .treasury-bar {
    height: 4px;
    border-radius: 2px;
    transition: width 0.5s ease;
    min-width: 2px;
  }

  .income-bar { background: var(--success); }
  .expense-bar { background: var(--danger); }

  /* Table Footer */
  .treasury-table-footer {
    padding: 16px 20px;
    border-top: 2px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .treasury-footer-row {
    display: flex;
    justify-content: space-around;
    gap: 24px;
    flex-wrap: wrap;
  }

  .treasury-footer-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .treasury-footer-item span:first-child {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .treasury-footer-item span:last-child {
    font-size: 1.1rem;
    font-weight: 800;
  }

  @media (max-width: 1024px) {
    .treasury-cards-row { grid-template-columns: 1fr; }
    .treasury-dashboard-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 768px) {
    .treasury-stat-cards { grid-template-columns: 1fr; }
    .treasury-monthly-header,
    .treasury-monthly-row {
      grid-template-columns: 80px 1fr 1fr 1fr;
    }
    .treasury-monthly-header span:last-child,
    .treasury-monthly-row .treasury-bar-wrap { display: none; }
  }
`;

/* ============================================================
   INJECT TREASURY STYLES
   ============================================================ */
(function injectTreasuryStyles() {
  if (!document.getElementById('treasury-admin-styles')) {
    const style = document.createElement('style');
    style.id = 'treasury-admin-styles';
    style.textContent = treasuryStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const treasuryAdmin = new TreasuryAdminManager();
window.treasuryAdmin = treasuryAdmin;

// Connect to admin dashboard
if (window.adminDashboard) {
  window.adminDashboard.renderTreasuryOverview = async (c) => {
    await treasuryAdmin.renderOverview(c, window.adminDashboard);
  };
  window.adminDashboard.renderTransactionsList = async (c) => {
    await treasuryAdmin.renderTransactions(c, window.adminDashboard);
  };
  window.adminDashboard.renderTransactionForm = (c) => {
    treasuryAdmin.renderTransactionForm(c, window.adminDashboard);
  };
  window.adminDashboard.renderBudgetSection = async (c) => {
    await treasuryAdmin.renderBudget(c, window.adminDashboard);
  };
  window.adminDashboard.renderTreasuryStatements = (c) => {
    treasuryAdmin.renderStatements(c, window.adminDashboard);
  };
}