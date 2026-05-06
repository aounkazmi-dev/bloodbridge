const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;
const API = 'http://localhost:5000/api';

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
const ToastCtx = createContext(null);

function getToken() { return localStorage.getItem('bb_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('bb_user')); } catch { return null; } }

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return React.createElement(ToastCtx.Provider, { value: addToast },
    children,
    React.createElement('div', { className: 'toast-wrap' },
      toasts.map(t => React.createElement('div', { key: t.id, className: `toast ${t.type}` },
        React.createElement('span', null, t.type === 'success' ? '✓' : '✕'),
        t.msg
      ))
    )
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function bloodBadge(bt) {
  return React.createElement('div', { className: 'blood-circle' }, bt || '—');
}
function urgencyBadge(u) {
  const map = { CRITICAL: 'badge-red', HIGH: 'badge-amber', MEDIUM: 'badge-blue', LOW: 'badge-green' };
  return React.createElement('span', { className: `badge ${map[u] || 'badge-gray'}` }, u || '—');
}
function statusBadge(s) {
  const map = { PENDING: 'badge-amber', FULFILLED: 'badge-green', REJECTED: 'badge-red',
    SCHEDULED: 'badge-blue', CANCELLED: 'badge-gray', COMPLETED: 'badge-green' };
  return React.createElement('span', { className: `badge ${map[s] || 'badge-gray'}` }, s || '—');
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function Loading() {
  return React.createElement('div', { className: 'loading' },
    React.createElement('div', { className: 'spinner' })
  );
}

function EmptyState({ icon, text }) {
  return React.createElement('div', { className: 'empty-state' },
    React.createElement('div', { className: 'empty-icon' }, icon || '🩸'),
    React.createElement('div', { className: 'empty-text' }, text || 'No data available')
  );
}

// ─── AUTH PAGES ───────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', firstname: '', lastname: '',
    phone: '', gender: 'MALE', date_of_birth: '', userrole: 'DONOR', bloodType: 'A+' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const bloodTypes = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        const d = await apiFetch('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } });
        localStorage.setItem('bb_token', d.token);
        localStorage.setItem('bb_user', JSON.stringify(d.user));
        onLogin(d.user);
      } else {
        const d = await apiFetch('/auth/register', { method: 'POST', body: form });
        localStorage.setItem('bb_token', d.token);
        localStorage.setItem('bb_user', JSON.stringify(d.user));
        onLogin(d.user);
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  const E = React.createElement;
  return E('div', { className: 'auth-page' },
    E('div', { className: 'auth-bg' },
      E('div', { className: 'auth-bg-circle', style: { width: 600, height: 600, top: -200, left: -200 } }),
      E('div', { className: 'auth-bg-circle', style: { width: 400, height: 400, bottom: -100, right: -100 } }),
    ),
    E('div', { className: 'auth-card' },
      E('div', { className: 'auth-logo' },
        E('div', { className: 'auth-logo-drop' }, E('span', { style: { fontSize: 24 } }, '🩸')),
        E('div', null,
          E('div', { style: { fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1 } }, 'Blood', E('span', { style: { color: 'var(--red)' } }, 'Bridge')),
          E('div', { style: { fontSize: 11, color: 'var(--text3)', marginTop: 2 } }, 'Blood Management System')
        )
      ),
      E('h2', { className: 'auth-title' }, mode === 'login' ? 'Welcome back' : 'Create account'),
      E('p', { className: 'auth-sub' }, mode === 'login' ? 'Sign in to your account' : 'Join the BloodBridge network'),

      mode === 'register' && E('div', { className: 'role-tabs' },
        ['DONOR','RECIPIENT'].map(r => E('div', { key: r, className: `role-tab ${form.userrole === r ? 'active' : ''}`,
          onClick: () => setForm(f => ({ ...f, userrole: r })) }, r.charAt(0) + r.slice(1).toLowerCase()))
      ),

      error && E('div', { className: 'error-msg' }, error),
      E('form', { onSubmit: submit },
        mode === 'register' && E('div', { className: 'grid2', style: { gap: 12 } },
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'First Name'), E('input', { value: form.firstname, onChange: set('firstname'), required: true, placeholder: 'First name' })
          ),
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'Last Name'), E('input', { value: form.lastname, onChange: set('lastname'), required: true, placeholder: 'Last name' })
          ),
        ),
        mode === 'register' && E('div', { style: { height: 12 } }),
        E('div', { className: 'form-group' },
          E('label', null, 'Email'), E('input', { type: 'email', value: form.email, onChange: set('email'), required: true, placeholder: 'you@email.com' })
        ),
        E('div', { className: 'form-group' },
          E('label', null, 'Password'), E('input', { type: 'password', value: form.password, onChange: set('password'), required: true, placeholder: '••••••••' })
        ),
        mode === 'register' && E('div', { className: 'grid2', style: { gap: 12 } },
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'Phone'), E('input', { value: form.phone, onChange: set('phone'), placeholder: 'Phone number' })
          ),
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'Blood Type'),
            E('select', { value: form.bloodType, onChange: set('bloodType') },
              bloodTypes.map(b => E('option', { key: b, value: b }, b))
            )
          ),
        ),
        mode === 'register' && E('div', { style: { height: 12 } }),
        mode === 'register' && E('div', { className: 'grid2', style: { gap: 12 } },
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'Gender'),
            E('select', { value: form.gender, onChange: set('gender') },
              ['MALE','FEMALE'].map(g => E('option', { key: g, value: g }, g.charAt(0) + g.slice(1).toLowerCase()))
            )
          ),
          E('div', { className: 'form-group', style: { marginBottom: 0 } },
            E('label', null, 'Date of Birth'), E('input', { type: 'date', value: form.date_of_birth, onChange: set('date_of_birth') })
          ),
        ),
        E('div', { style: { height: 12 } }),
        E('button', { className: 'btn btn-primary', style: { width: '100%', justifyContent: 'center', padding: '11px' }, disabled: loading },
          loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')
        ),
      ),
      E('div', { className: 'auth-switch' },
        mode === 'login' ? 'New to BloodBridge? ' : 'Already have an account? ',
        E('a', { onClick: () => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); } },
          mode === 'login' ? 'Create account' : 'Sign in'
        )
      )
    )
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, page, setPage, unreadCount }) {
  const E = React.createElement;
  const isAdmin = user?.role === 'ADMIN';
  const isDonor = user?.role === 'DONOR';

  const nav = (icon, label, key) =>
    E('div', { key, className: `nav-item ${page === key ? 'active' : ''}`, onClick: () => setPage(key) },
      E('span', { className: 'nav-icon' }, icon),
      E('span', null, label),
      key === 'notifications' && unreadCount > 0 && E('span', { className: 'nav-badge' }, unreadCount)
    );

  return E('div', { className: 'sidebar' },
    E('div', { className: 'sidebar-logo' },
      E('div', { className: 'logo-drop' }),
      E('div', { className: 'logo-text' }, 'Blood', E('span', null, 'Bridge'))
    ),
    E('div', { style: { flex: 1, overflowY: 'auto', paddingTop: 8 } },
      E('div', { className: 'nav-section' }, 'Overview'),
      nav('📊', 'Dashboard', 'dashboard'),
      nav('🩸', 'Blood Inventory', 'inventory'),

      (isAdmin || isDonor) && E('div', { className: 'nav-section' }, 'Donations'),
      isDonor && nav('💉', 'My Donations', 'my-donations'),
      isDonor && nav('📅', 'Appointments', 'appointments'),
      isAdmin && nav('💉', 'All Donations', 'donations'),
      isAdmin && nav('📅', 'Appointments', 'appointments'),

      E('div', { className: 'nav-section' }, 'Requests'),
      nav('🏥', user?.role === 'RECIPIENT' ? 'My Requests' : 'Blood Requests', 'requests'),

      E('div', { className: 'nav-section' }, 'Community'),
      nav('👥', 'Donors', 'donors'),
      nav('🔔', 'Notifications', 'notifications'),
      nav('💬', 'Feedback', 'feedback'),

      isAdmin && E('div', { className: 'nav-section' }, 'Administration'),
      isAdmin && nav('👤', 'Users', 'users'),
      isAdmin && nav('⚙️', 'Admin Panel', 'admin'),
    ),
    E('div', { className: 'sidebar-footer' },
      E('div', { className: 'user-pill' },
        E('div', { className: 'avatar' }, (user?.firstname?.[0] || 'U') + (user?.lastname?.[0] || '')),
        E('div', null,
          E('div', { className: 'user-name' }, `${user?.firstname} ${user?.lastname}`),
          E('div', { className: 'user-role' }, user?.role || 'User')
        )
      )
    )
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [topDonors, setTopDonors] = useState([]);
  const [pending, setPending] = useState([]);
  const chartRef = useRef(null);
  const chartInst = useRef(null);
  const E = React.createElement;

  useEffect(() => {
    apiFetch('/admin/summary').then(d => setStats(d.data)).catch(err => console.error("API error:", err.message));
    apiFetch('/donations/monthly-trends').then(d => setTrends(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/bloodbank/inventory/by-type').then(d => setInventory(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/donations/top-donors').then(d => setTopDonors(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/requests/pending').then(d => setPending(d.data || [])).catch(err => console.error("API error:", err.message));
  }, []);

  useEffect(() => {
    if (!chartRef.current || !trends.length) return;
    if (chartInst.current) chartInst.current.destroy();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = trends.map(t => `${months[t.Month - 1]} ${t.Year}`);
    const donations = trends.map(t => t.TotalDonations);
    const units = trends.map(t => t.TotalUnits);
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Donations', data: donations, backgroundColor: 'rgba(192,17,43,0.7)',
            borderColor: '#C0112B', borderWidth: 1, borderRadius: 4 },
          { label: 'Units', data: units, type: 'line', borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, tension: 0.4,
            pointBackgroundColor: '#F59E0B', pointRadius: 3, fill: true }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470', font: { size: 11 }, autoSkip: false, maxRotation: 45 } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470', font: { size: 11 } } }
        }
      }
    });
  }, [trends]);

  const maxInv = inventory.reduce((m, i) => Math.max(m, i.TotalUnitsAvailable || 0), 0) || 1;
  const bloodColors = { 'A+':'#E8344A','A-':'#C0112B','B+':'#F59E0B','B-':'#B45309',
    'AB+':'#3B82F6','AB-':'#1D4ED8','O+':'#22C55E','O-':'#16A34A' };

  return E('div', { className: 'fade-in' },
    E('div', { className: 'hero-banner' },
      E('div', null,
        E('h2', { className: 'hero-title' }, `Welcome back, ${user?.firstname}! 👋`),
        E('p', { className: 'hero-sub' }, "Here's what's happening with BloodBridge today"),
        E('div', { style: { marginTop: 14, display: 'flex', gap: 10 } },
          E('span', { className: 'badge badge-red pulse' }, '🩸 Live System'),
          pending.length > 0 && E('span', { className: 'badge badge-amber' }, `${pending.length} pending requests`)
        )
      ),
      E('div', { className: 'hero-drop float' }, '🩸')
    ),

    E('div', { className: 'stats-grid' },
      [
        { label: 'Active Donors', value: stats?.ActiveDonors ?? '—', icon: '👥', change: 'Registered donors' },
        { label: 'Active Recipients', value: stats?.ActiveRecipients ?? '—', icon: '🏥', change: 'Awaiting blood' },
        { label: 'Blood Units', value: stats?.TotalBloodUnitsAvailable ?? '—', icon: '🩸', change: 'In inventory' },
        { label: 'Pending Requests', value: stats?.PendingRequests ?? '—', icon: '⏳', change: `${stats?.FulfilledRequests || 0} fulfilled` },
      ].map((s, i) => E('div', { key: i, className: 'stat-card' },
        E('div', { className: 'stat-icon' }, s.icon),
        E('div', { className: 'stat-label' }, s.label),
        E('div', { className: 'stat-value' }, s.value),
        E('div', { className: 'stat-change' }, s.change)
      ))
    ),

    E('div', { className: 'grid2', style: { gap: 16, marginBottom: 24 } },
      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Monthly Donation Trends'),
          E('div', { className: 'chart-legend' },
            E('span', { className: 'legend-item' }, E('span', { className: 'legend-dot', style: { background: '#C0112B' } }), 'Donations'),
            E('span', { className: 'legend-item' }, E('span', { className: 'legend-dot', style: { background: '#F59E0B' } }), 'Units')
          )
        ),
        E('div', { className: 'section-card-body' },
          E('div', { className: 'chart-wrap', style: { height: 240 } },
            E('canvas', { ref: chartRef, role: 'img', 'aria-label': 'Monthly donation trends bar chart' }, 'Monthly donation trends')
          )
        )
      ),

      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Blood Inventory by Type'),
        ),
        E('div', { className: 'section-card-body', style: { padding: '12px 20px' } },
          inventory.length === 0 ? E(Loading) :
          inventory.map(inv => {
            const pct = Math.round((inv.TotalUnitsAvailable / maxInv) * 100);
            const color = bloodColors[inv.BloodType] || 'var(--red)';
            const status = pct < 20 ? 'red' : pct < 50 ? 'amber' : 'green';
            return E('div', { key: inv.BloodType, className: 'inv-item' },
              E('div', { className: 'inv-type' },
                E('div', { className: 'blood-circle', style: { background: color + '22', borderColor: color + '55', color } },
                  inv.BloodType)
              ),
              E('div', { className: 'inv-bar-wrap' },
                E('div', { className: 'inv-label' },
                  E('span', { style: { fontSize: 12, color: 'var(--text2)' } }, inv.BloodType),
                  E('span', { style: { fontSize: 12, color: 'var(--text3)' } }, `${inv.TotalUnitsAvailable} units`)
                ),
                E('div', { className: 'progress-bar' },
                  E('div', { className: `progress-fill ${status}`, style: { width: `${pct}%`, background: color } })
                )
              )
            );
          })
        )
      )
    ),

    E('div', { className: 'grid2', style: { gap: 16 } },
      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, '🏆 Top Donors'),
        ),
        E('div', { className: 'section-card-body', style: { padding: '8px 20px' } },
          topDonors.length === 0 ? E(EmptyState, { text: 'No donor data yet' }) :
          topDonors.slice(0, 8).map((d, i) =>
            E('div', { key: i, className: 'rank-item' },
              E('div', { className: 'rank-num' }, i + 1 <= 3 ? ['🥇','🥈','🥉'][i] : i + 1),
              E('div', { className: 'avatar', style: { width: 28, height: 28, fontSize: 11 } },
                (d.DonorName || d.FullName || 'U')[0]),
              E('div', { className: 'rank-name' }, d.DonorName || d.FullName || 'Unknown'),
              E('div', { className: 'rank-units', style: { marginRight: 4 } }, (d.TotalUnits || d.TotalUnitsDonated || 0) + ' u')
            )
          )
        )
      ),

      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, '🚨 Urgent Requests'),
        ),
        E('div', { className: 'section-card-body', style: { padding: 0 } },
          pending.length === 0 ? E('div', { style: { padding: 20 } }, E(EmptyState, { text: 'No pending requests' })) :
          E('div', { className: 'table-wrap' },
            E('table', null,
              E('thead', null, E('tr', null,
                E('th', null, 'Recipient'), E('th', null, 'Blood'), E('th', null, 'Urgency'), E('th', null, 'Hospital')
              )),
              E('tbody', null,
                pending.slice(0, 5).map(r => E('tr', { key: r.RequestID },
                  E('td', null, r.RecipientName),
                  E('td', null, bloodBadge(r.blood_type)),
                  E('td', null, urgencyBadge(r.UrgencyLevel)),
                  E('td', null, r.HospitalName)
                ))
              )
            )
          )
        )
      )
    )
  );
}

// ─── BLOOD INVENTORY ──────────────────────────────────────────────────────────
function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [byType, setByType] = useState([]);
  const [supplyDemand, setSupplyDemand] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const pieRef = useRef(null);
  const pieInst = useRef(null);
  const E = React.createElement;

  useEffect(() => {
    const fetches = [
      apiFetch('/bloodbank/inventory').then(d => setInventory(d.data || [])).catch(err => console.error("API error:", err.message)),
      apiFetch('/bloodbank/inventory/by-type').then(d => setByType(d.data || [])).catch(err => console.error("API error:", err.message)),
      apiFetch('/bloodbank/supply-demand').then(d => setSupplyDemand(d.data || [])).catch(err => console.error("API error:", err.message)),
      apiFetch('/bloodbank/inventory/low-stock').then(d => setLowStock(d.data || [])).catch(err => console.error("API error:", err.message)),
    ];
    Promise.all(fetches).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!byType.length) return;
    const timer = setTimeout(() => {
      if (!pieRef.current) return;
      if (pieInst.current) { pieInst.current.destroy(); pieInst.current = null; }
      const colors = ['#C0112B','#F59E0B','#3B82F6','#22C55E','#8B5CF6','#EC4899','#14B8A6','#F97316'];
      pieInst.current = new Chart(pieRef.current, {
        type: 'doughnut',
        data: {
          labels: byType.map(b => b.BloodType),
          datasets: [{ data: byType.map(b => b.TotalUnitsAvailable),
            backgroundColor: colors, borderColor: '#1A1215', borderWidth: 3 }]
        },
        options: {
          responsive: false, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '65%'
        }
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [byType, loading]);

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, 'Blood ', E('span', null, 'Inventory')),
      lowStock.length > 0 && E('span', { className: 'badge badge-red pulse' }, `⚠ ${lowStock.length} low stock alerts`)
    ),

    lowStock.length > 0 && E('div', { style: { background: 'rgba(192,17,43,0.08)', border: '1px solid rgba(192,17,43,0.2)',
      borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20 } },
      E('div', { style: { fontWeight: 500, marginBottom: 8, color: '#FF6B7A' } }, '⚠ Low Stock Alert'),
      E('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        lowStock.map((l, i) => E('span', { key: i, className: 'badge badge-red' },
          `${l.BloodType} at ${l.HospitalName} — ${l.UnitsLeft} units`
        ))
      )
    ),

    E('div', { className: 'grid2', style: { gap: 16, marginBottom: 24 } },
      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Units by Blood Type'),
          loading && E('span', { className: 'badge badge-gray', style: { fontSize: 11 } }, 'Loading...')
        ),
        E('div', { className: 'section-card-body' },
          E('div', { style: { display: 'flex', gap: 24, alignItems: 'center' } },
            E('div', { style: { width: 180, height: 180, flexShrink: 0, position: 'relative' } },
              E('canvas', { ref: pieRef, width: 180, height: 180, role: 'img', 'aria-label': 'Blood type distribution doughnut chart' }, 'Blood type distribution')
            ),
            E('div', { style: { flex: 1 } },
              byType.map((b, i) => {
                const colors = ['#C0112B','#F59E0B','#3B82F6','#22C55E','#8B5CF6','#EC4899','#14B8A6','#F97316'];
                return E('div', { key: b.BloodType, style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                  E('span', { style: { width: 10, height: 10, borderRadius: 2, background: colors[i % 8], flexShrink: 0 } }),
                  E('span', { style: { flex: 1, fontSize: 13 } }, b.BloodType),
                  E('span', { style: { fontSize: 13, fontWeight: 600, color: colors[i % 8] } }, b.TotalUnitsAvailable)
                );
              })
            )
          )
        )
      ),

      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Quick Stats')
        ),
        E('div', { className: 'section-card-body' },
          E('div', { className: 'grid2', style: { gap: 12 } },
            [
              { label: 'Total Units', value: byType.reduce((s, b) => s + (b.TotalUnitsAvailable || 0), 0), color: 'var(--red)' },
              { label: 'Blood Types', value: byType.length, color: 'var(--blue)' },
              { label: 'Low Stock', value: lowStock.length, color: 'var(--amber)' },
              { label: 'Hospitals', value: new Set(inventory.map(i => i.HospitalName)).size, color: 'var(--green)' },
            ].map((s, i) => E('div', { key: i, className: 'stat-card' },
              E('div', { className: 'stat-label' }, s.label),
              E('div', { className: 'stat-value', style: { fontSize: 24, color: s.color } }, s.value)
            ))
          )
        )
      )
    ),

    E('div', { className: 'section-card' },
      E('div', { className: 'section-card-header' },
        E('div', { className: 'section-card-title' }, 'Hospital Inventory Detail')
      ),
      E('div', { className: 'table-wrap' },
        E('table', null,
          E('thead', null, E('tr', null,
            E('th', null, 'Hospital'), E('th', null, 'Blood Type'), E('th', null, 'Units Available'), E('th', null, 'Status')
          )),
          E('tbody', null,
            inventory.length === 0 ? E('tr', null, E('td', { colSpan: 4, style: { textAlign: 'center', padding: 20 } }, 'No inventory data')) :
            inventory.map((inv, i) => {
              const units = inv.TotalUnitsAvailable || inv.units_available || 0;
              const status = units < 5 ? ['badge-red','Critical'] : units < 15 ? ['badge-amber','Low'] : ['badge-green','Good'];
              return E('tr', { key: i },
                E('td', null, inv.HospitalName || inv.hospital_name),
                E('td', null, bloodBadge(inv.BloodType || inv.blood_type)),
                E('td', null, units),
                E('td', null, E('span', { className: `badge ${status[0]}` }, status[1]))
              );
            })
          )
        )
      )
    )
  );
}

// ─── DONATIONS PAGE ───────────────────────────────────────────────────────────
function DonationsPage({ user, myOnly }) {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [banks, setBanks] = useState([]);
  const [bloodTypes, setBloodTypes] = useState([]);
  const [form, setForm] = useState({ donorID: user?.userID || '', bloodBankID: '', bloodID: '', unitsDonated: 1 });
  const toast = useContext(ToastCtx);
  const E = React.createElement;
  const isAdmin = user?.role === 'ADMIN';

  function load() {
    const path = myOnly ? '/donations/my' : '/donations';
    apiFetch(path).then(d => setDonations(d.data || [])).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    apiFetch('/admin/blood-banks').then(d => setBanks(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/admin/blood-types').then(d => setBloodTypes(d.data || [])).catch(err => console.error("API error:", err.message));
  }, [myOnly]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    try {
      await apiFetch('/donations', { method: 'POST', body: { ...form, donorID: user.userID, unitsDonated: Number(form.unitsDonated) } });
      toast('Donation recorded successfully!', 'success');
      setShowModal(false); load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteDonation(id) {
    if (!confirm('Delete this donation?')) return;
    try { await apiFetch(`/donations/${id}`, { method: 'DELETE' }); toast('Deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, myOnly ? 'My ' : 'All ', E('span', null, 'Donations')),
      E('button', { className: 'btn btn-primary', onClick: () => setShowModal(true) }, '+ Log Donation')
    ),
    E('div', { className: 'section-card' },
      E('div', { className: 'table-wrap' },
        E('table', null,
          E('thead', null, E('tr', null,
            E('th', null, 'Donor'), E('th', null, 'Blood Type'), E('th', null, 'Units'), E('th', null, 'Date'), E('th', null, 'Hospital'),
            isAdmin && E('th', null, 'Actions')
          )),
          E('tbody', null,
            donations.length === 0 ? E('tr', null, E('td', { colSpan: 6, style: { textAlign: 'center', padding: 30 } }, 'No donations found')) :
            donations.map(d => E('tr', { key: d.DonationID },
              E('td', null, d.DonorName),
              E('td', null, bloodBadge(d.blood_type)),
              E('td', null, d.UnitsDonated),
              E('td', null, fmtDate(d.DonationDate)),
              E('td', null, d.HospitalName || '—'),
              isAdmin && E('td', null, E('div', { className: 'table-actions' },
                E('button', { className: 'btn btn-danger btn-sm', onClick: () => deleteDonation(d.DonationID) }, 'Delete')
              ))
            ))
          )
        )
      )
    ),

    showModal && E('div', { className: 'modal-overlay', onClick: e => e.target === e.currentTarget && setShowModal(false) },
      E('div', { className: 'modal' },
        E('h3', { className: 'modal-title' }, '💉 Log Donation'),
        E('form', { onSubmit: submit },
          E('div', { className: 'form-group' },
            E('label', null, 'Blood Bank'),
            E('select', { value: form.bloodBankID, onChange: set('bloodBankID'), required: true },
              E('option', { value: '' }, 'Select blood bank...'),
              banks.map(b => E('option', { key: b.BloodbankID, value: b.BloodbankID }, `${b.HospitalName} — ${b.City || ''}`))
            )
          ),
          E('div', { className: 'form-group' },
            E('label', null, 'Blood Type'),
            E('select', { value: form.bloodID, onChange: set('bloodID'), required: true },
              E('option', { value: '' }, 'Select blood type...'),
              bloodTypes.map(b => E('option', { key: b.BloodID, value: b.BloodID }, b.blood_type))
            )
          ),
          E('div', { className: 'form-group' },
            E('label', null, 'Units Donated'),
            E('input', { type: 'number', min: 1, max: 10, value: form.unitsDonated, onChange: set('unitsDonated'), required: true })
          ),
          E('div', { className: 'modal-actions' },
            E('button', { type: 'button', className: 'btn btn-ghost', onClick: () => setShowModal(false) }, 'Cancel'),
            E('button', { type: 'submit', className: 'btn btn-primary' }, 'Submit Donation')
          )
        )
      )
    )
  );
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
function AppointmentsPage({ user }) {
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState({ bloodBankID: '', appointmentDate: '' });
  const toast = useContext(ToastCtx);
  const E = React.createElement;
  const isAdmin = user?.role === 'ADMIN';

  function load() {
    const path = isAdmin ? '/donations/appointments/upcoming' : '/donations/appointments/my';
    apiFetch(path).then(d => setAppts(d.data || [])).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    apiFetch('/admin/blood-banks').then(d => setBanks(d.data || [])).catch(err => console.error("API error:", err.message));
  }, []);

  async function book(e) {
    e.preventDefault();
    try {
      await apiFetch('/donations/appointments', { method: 'POST', body: form });
      toast('Appointment booked!', 'success');
      setShowModal(false); load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    try { await apiFetch(`/donations/appointments/${id}/cancel`, { method: 'PATCH' }); toast('Cancelled'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function approve(id) {
    try { await apiFetch(`/donations/appointments/${id}/approve`, { method: 'PATCH' }); toast('Appointment approved! Donor notified.'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function reject(id) {
    if (!confirm('Reject this appointment? The donor will be notified.')) return;
    try { await apiFetch(`/donations/appointments/${id}/reject`, { method: 'PATCH' }); toast('Appointment rejected. Donor notified.'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '📅 ', E('span', null, 'Appointments')),
      user?.role === 'DONOR' && E('button', { className: 'btn btn-primary', onClick: () => setShowModal(true) }, '+ Book Appointment')
    ),

    appts.length === 0 ? E(EmptyState, { icon: '📅', text: 'No appointments scheduled' }) :
    E('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
      appts.map(a => E('div', { key: a.AppointmentID, className: 'appt-card' },
        E('div', { className: 'appt-date' },
          E('div', { className: 'appt-day' }, new Date(a.AppointmentDate).getDate()),
          E('div', { className: 'appt-mon' }, new Date(a.AppointmentDate).toLocaleString('en', { month: 'short' }))
        ),
        E('div', { className: 'appt-info' },
          E('div', { className: 'appt-hospital' }, a.HospitalName),
          E('div', { className: 'appt-meta' }, fmtDate(a.AppointmentDate), a.DonorName ? ` · ${a.DonorName}` : ''),
          a.blood_type && E('div', { style: { marginTop: 4 } }, bloodBadge(a.blood_type))
        ),
        E('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' } },
          statusBadge(a.Status),
          // Admin sees approve/reject for PENDING appointments
          isAdmin && a.Status === 'PENDING' && E('div', { style: { display: 'flex', gap: 6 } },
            E('button', { className: 'btn btn-success btn-sm', onClick: () => approve(a.AppointmentID) }, '✓ Approve'),
            E('button', { className: 'btn btn-danger btn-sm', onClick: () => reject(a.AppointmentID) }, '✗ Reject')
          ),
          // Donor (or admin) can cancel a SCHEDULED appointment
          a.Status === 'SCHEDULED' && E('button', { className: 'btn btn-danger btn-sm', onClick: () => cancel(a.AppointmentID) }, 'Cancel')
        )
      ))
    ),

    showModal && E('div', { className: 'modal-overlay', onClick: e => e.target === e.currentTarget && setShowModal(false) },
      E('div', { className: 'modal' },
        E('h3', { className: 'modal-title' }, '📅 Book Appointment'),
        E('form', { onSubmit: book },
          E('div', { className: 'form-group' },
            E('label', null, 'Blood Bank / Hospital'),
            E('select', { value: form.bloodBankID, onChange: e => setForm(f => ({ ...f, bloodBankID: e.target.value })), required: true },
              E('option', { value: '' }, 'Select blood bank...'),
              banks.map(b => E('option', { key: b.BloodbankID, value: b.BloodbankID }, b.HospitalName))
            )
          ),
          E('div', { className: 'form-group' },
            E('label', null, 'Appointment Date & Time'),
            E('input', { type: 'datetime-local', value: form.appointmentDate,
              onChange: e => setForm(f => ({ ...f, appointmentDate: e.target.value })), required: true })
          ),
          E('div', { className: 'modal-actions' },
            E('button', { type: 'button', className: 'btn btn-ghost', onClick: () => setShowModal(false) }, 'Cancel'),
            E('button', { type: 'submit', className: 'btn btn-primary' }, 'Book Appointment')
          )
        )
      )
    )
  );
}

// ─── REQUESTS PAGE ────────────────────────────────────────────────────────────
function RequestsPage({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [bloodTypes, setBloodTypes] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState({ hospitalID: '', bloodID: '', unitsRequired: 1, urgencyLevel: 'MEDIUM' });
  const toast = useContext(ToastCtx);
  const E = React.createElement;
  const isAdmin = user?.role === 'ADMIN';
  const isRecipient = user?.role === 'RECIPIENT';

  function load() {
    const path = isRecipient ? '/requests/my' : '/requests/pending';
    apiFetch(path).then(d => setRequests(d.data || [])).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    apiFetch('/admin/hospitals').then(d => setHospitals(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/admin/blood-types').then(d => setBloodTypes(d.data || [])).catch(err => console.error("API error:", err.message));
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    try {
      await apiFetch('/requests', { method: 'POST', body: { ...form, unitsRequired: Number(form.unitsRequired) } });
      toast('Blood request submitted!', 'success');
      setShowModal(false); load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function fulfill(id) {
    try { await apiFetch(`/requests/${id}/fulfill`, { method: 'PATCH' }); toast('Request fulfilled!'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function reject(id) {
    try { await apiFetch(`/requests/${id}/reject`, { method: 'PATCH' }); toast('Request rejected'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function deleteReq(id) {
    if (!confirm('Delete request?')) return;
    try { await apiFetch(`/requests/${id}`, { method: 'DELETE' }); toast('Deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.UrgencyLevel === filter || r.status === filter);

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '🏥 Blood ', E('span', null, 'Requests')),
      E('button', { className: 'btn btn-primary', onClick: () => setShowModal(true) }, '+ New Request')
    ),

    E('div', { className: 'filter-bar' },
      ['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(f =>
        E('button', { key: f, className: `btn ${filter === f ? 'btn-primary' : 'btn-ghost'} btn-sm`,
          onClick: () => setFilter(f) }, f)
      )
    ),

    E('div', { className: 'section-card' },
      E('div', { className: 'table-wrap' },
        E('table', null,
          E('thead', null, E('tr', null,
            E('th', null, 'Recipient'), E('th', null, 'Blood'), E('th', null, 'Units'),
            E('th', null, 'Urgency'), E('th', null, 'Status'), E('th', null, 'Hospital'), E('th', null, 'Date'),
            (isAdmin) && E('th', null, 'Actions')
          )),
          E('tbody', null,
            filtered.length === 0 ? E('tr', null, E('td', { colSpan: 8, style: { textAlign: 'center', padding: 30 } }, 'No requests found')) :
            filtered.map(r => E('tr', { key: r.RequestID },
              E('td', null, r.RecipientName || 'Me'),
              E('td', null, bloodBadge(r.blood_type)),
              E('td', null, r.UnitsRequired),
              E('td', null, urgencyBadge(r.UrgencyLevel)),
              E('td', null, statusBadge(r.status)),
              E('td', null, r.HospitalName),
              E('td', null, fmtDate(r.RequestDate)),
              isAdmin && E('td', null,
                r.status === 'PENDING' && E('div', { className: 'table-actions' },
                  E('button', { className: 'btn btn-success btn-sm', onClick: () => fulfill(r.RequestID) }, '✓'),
                  E('button', { className: 'btn btn-danger btn-sm', onClick: () => reject(r.RequestID) }, '✗'),
                  E('button', { className: 'btn btn-ghost btn-sm', onClick: () => deleteReq(r.RequestID) }, '🗑')
                )
              )
            ))
          )
        )
      )
    ),

    showModal && E('div', { className: 'modal-overlay', onClick: e => e.target === e.currentTarget && setShowModal(false) },
      E('div', { className: 'modal' },
        E('h3', { className: 'modal-title' }, '🏥 New Blood Request'),
        E('form', { onSubmit: submit },
          E('div', { className: 'form-group' },
            E('label', null, 'Hospital'),
            E('select', { value: form.hospitalID, onChange: set('hospitalID'), required: true },
              E('option', { value: '' }, 'Select hospital...'),
              hospitals.map(h => E('option', { key: h.HospitalID, value: h.HospitalID }, h.HospitalName))
            )
          ),
          E('div', { className: 'form-group' },
            E('label', null, 'Blood Type Needed'),
            E('select', { value: form.bloodID, onChange: set('bloodID'), required: true },
              E('option', { value: '' }, 'Select blood type...'),
              bloodTypes.map(b => E('option', { key: b.BloodID, value: b.BloodID }, b.blood_type))
            )
          ),
          E('div', { className: 'grid2', style: { gap: 12 } },
            E('div', { className: 'form-group', style: { marginBottom: 0 } },
              E('label', null, 'Units Required'),
              E('input', { type: 'number', min: 1, value: form.unitsRequired, onChange: set('unitsRequired'), required: true })
            ),
            E('div', { className: 'form-group', style: { marginBottom: 0 } },
              E('label', null, 'Urgency Level'),
              E('select', { value: form.urgencyLevel, onChange: set('urgencyLevel') },
                ['LOW','MEDIUM','HIGH','CRITICAL'].map(u => E('option', { key: u, value: u }, u))
              )
            )
          ),
          E('div', { className: 'modal-actions' },
            E('button', { type: 'button', className: 'btn btn-ghost', onClick: () => setShowModal(false) }, 'Cancel'),
            E('button', { type: 'submit', className: 'btn btn-primary' }, 'Submit Request')
          )
        )
      )
    )
  );
}

// ─── DONORS PAGE ──────────────────────────────────────────────────────────────
function DonorsPage() {
  const [eligible, setEligible] = useState([]);
  const [active, setActive] = useState([]);
  const [never, setNever] = useState([]);
  const [tab, setTab] = useState('eligible');
  const [loading, setLoading] = useState(true);
  const barRef = useRef(null);
  const barInst = useRef(null);
  const E = React.createElement;

  useEffect(() => {
    Promise.all([
      apiFetch('/users/donors/eligible').then(d => setEligible(d.data || [])),
      apiFetch('/users/donors/active').then(d => setActive(d.data || [])),
      apiFetch('/users/donors/never-donated').then(d => setNever(d.data || [])).catch(() => setNever([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!barRef.current || !active.length) return;
    if (barInst.current) barInst.current.destroy();
    const colors = ['#C0112B','#F59E0B','#3B82F6','#22C55E','#8B5CF6','#EC4899','#14B8A6','#F97316'];
    barInst.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: active.map(a => a.BloodType),
        datasets: [{ label: 'Active Donors', data: active.map(a => a.TotalActiveDonors),
          backgroundColor: active.map((_, i) => colors[i % 8]), borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470' } }
        }
      }
    });
  }, [active]);

  const data = { eligible, never }[tab] || eligible;
  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '👥 Donor ', E('span', null, 'Directory'))
    ),

    E('div', { className: 'section-card', style: { marginBottom: 20 } },
      E('div', { className: 'section-card-header' }, E('div', { className: 'section-card-title' }, 'Active Donors by Blood Type')),
      E('div', { className: 'section-card-body' },
        E('div', { style: { height: 200, position: 'relative' } },
          E('canvas', { ref: barRef, role: 'img', 'aria-label': 'Bar chart of active donors by blood type' }, 'Active donors by blood type')
        )
      )
    ),

    E('div', { className: 'filter-bar' },
      [['eligible','✅ Eligible'], ['never','⚠ Never Donated']].map(([key, label]) =>
        E('button', { key, className: `btn ${tab === key ? 'btn-primary' : 'btn-ghost'} btn-sm`, onClick: () => setTab(key) }, label)
      ),
      E('span', { className: 'badge badge-green', style: { marginLeft: 'auto' } }, `${data.length} donors`)
    ),

    E('div', { className: 'section-card' },
      E('div', { className: 'table-wrap' },
        E('table', null,
          E('thead', null, E('tr', null,
            E('th', null, 'Name'), E('th', null, 'Blood Type'), E('th', null, 'Email'), E('th', null, 'Phone'),
            tab === 'eligible' && E('th', null, 'Last Donation'),
            tab === 'eligible' && E('th', null, 'Days Since')
          )),
          E('tbody', null,
            data.length === 0 ? E('tr', null, E('td', { colSpan: 6, style: { textAlign: 'center', padding: 30 } }, 'No donors found')) :
            data.map((d, i) => E('tr', { key: i },
              E('td', null, d.DonorName || d.FullName || `${d.firstname || ''} ${d.lastname || ''}`),
              E('td', null, bloodBadge(d.BloodType || d.blood_type)),
              E('td', null, d.email || '—'),
              E('td', null, d.phone || '—'),
              tab === 'eligible' && E('td', null, d.LastDonation ? fmtDate(d.LastDonation) : 'Never'),
              tab === 'eligible' && E('td', null, d.DaysSinceLastDonation != null ? `${d.DaysSinceLastDonation} days` : '—')
            ))
          )
        )
      )
    )
  );
}

// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────
function NotificationsPage({ user, onRead }) {
  const [unread, setUnread] = useState([]);
  const [read, setRead] = useState([]);
  const [tab, setTab] = useState('unread');
  const toast = useContext(ToastCtx);
  const E = React.createElement;

  function load() {
    apiFetch('/notifications/unread').then(d => { setUnread(d.data || []); onRead(d.data?.length || 0); }).catch(err => console.error("API error:", err.message));
    apiFetch('/notifications/read').then(d => setRead(d.data || [])).catch(err => console.error("API error:", err.message));
  }
  useEffect(() => { load(); }, []);

  async function markAll() {
    try { await apiFetch('/notifications/mark-all-read', { method: 'PATCH' }); toast('All marked as read'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function markOne(id) {
    try { await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }); load(); }
    catch (err) {}
  }

  const data = tab === 'unread' ? unread : read;

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '🔔 ', E('span', null, 'Notifications')),
      unread.length > 0 && E('button', { className: 'btn btn-ghost', onClick: markAll }, 'Mark all read')
    ),
    E('div', { className: 'filter-bar' },
      E('button', { className: `btn ${tab === 'unread' ? 'btn-primary' : 'btn-ghost'} btn-sm`, onClick: () => setTab('unread') },
        `Unread ${unread.length > 0 ? `(${unread.length})` : ''}`),
      E('button', { className: `btn ${tab === 'read' ? 'btn-primary' : 'btn-ghost'} btn-sm`, onClick: () => setTab('read') }, 'Read')
    ),
    E('div', { className: 'section-card' },
      data.length === 0 ? E('div', { style: { padding: 20 } }, E(EmptyState, { icon: '🔔', text: 'No notifications' })) :
      data.map(n => E('div', { key: n.NotificationID, className: `notif-item ${tab === 'unread' ? 'unread' : ''}`,
        onClick: () => tab === 'unread' && markOne(n.NotificationID) },
        E('div', { className: 'notif-msg' }, n.Message),
        E('div', { className: 'notif-time' }, fmtDate(n.GeneratedAt))
      ))
    )
  );
}

// ─── FEEDBACK PAGE ────────────────────────────────────────────────────────────
function FeedbackPage({ user }) {
  const [feedback, setFeedback] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useContext(ToastCtx);
  const E = React.createElement;
  const isAdmin = user?.role === 'ADMIN';

  function load() {
    const path = isAdmin ? '/feedback' : '/feedback/recent';
    apiFetch(path).then(d => setFeedback(d.data || [])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/feedback', { method: 'POST', body: { message } });
      toast('Feedback submitted. Thank you!', 'success');
      setMessage(''); load();
    } catch (err) { toast(err.message, 'error'); }
    setSubmitting(false);
  }

  async function deleteFeedback(id) {
    if (!confirm('Delete this feedback?')) return;
    try { await apiFetch(`/feedback/${id}`, { method: 'DELETE' }); toast('Deleted'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '💬 ', E('span', null, 'Feedback'))
    ),
    E('div', { className: 'section-card', style: { marginBottom: 20 } },
      E('div', { className: 'section-card-header' }, E('div', { className: 'section-card-title' }, 'Share your thoughts')),
      E('div', { className: 'section-card-body' },
        E('form', { onSubmit: submit },
          E('textarea', { value: message, onChange: e => setMessage(e.target.value),
            placeholder: 'Share your experience, suggestions, or concerns...', style: { minHeight: 100 } }),
          E('div', { style: { marginTop: 10 } },
            E('button', { type: 'submit', className: 'btn btn-primary', disabled: submitting || !message.trim() },
              submitting ? 'Submitting...' : 'Submit Feedback')
          )
        )
      )
    ),
    E('div', { className: 'section-card' },
      E('div', { className: 'section-card-header' }, E('div', { className: 'section-card-title' },
        isAdmin ? 'All Feedback' : 'Recent Feedback'
      )),
      feedback.length === 0 ? E('div', { style: { padding: 20 } }, E(EmptyState, { icon: '💬', text: 'No feedback yet' })) :
      feedback.map((f, i) => E('div', { key: f.FeedbackID || i, className: 'feedback-item' },
        E('div', { className: 'feedback-meta' },
          E('div', { className: 'avatar', style: { width: 28, height: 28, fontSize: 11 } },
            (f.FullName || f.DonorName || 'U')[0]),
          E('span', { style: { fontSize: 13, fontWeight: 500 } }, f.FullName || 'User'),
          f.Role && E('span', { className: 'badge badge-gray' }, f.Role),
          E('span', { style: { marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' } }, fmtDate(f.DateSubmitted || f.SubmittedAt))
        ),
        E('div', { className: 'feedback-text' }, f.Feedback || f.Message),
        isAdmin && E('div', { style: { marginTop: 8 } },
          E('button', { className: 'btn btn-danger btn-sm', onClick: () => deleteFeedback(f.FeedbackID) }, 'Delete')
        )
      ))
    )
  );
}

// ─── USERS ADMIN PAGE ──────────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useContext(ToastCtx);
  const E = React.createElement;

  function load() {
    apiFetch('/users').then(d => setUsers(d.data || [])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function deactivate(id) {
    try { await apiFetch(`/users/${id}/deactivate`, { method: 'PATCH' }); toast('User deactivated'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  const filtered = users.filter(u =>
    !search || `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '👤 User ', E('span', null, 'Management')),
      E('span', { className: 'badge badge-blue' }, `${users.length} total users`)
    ),
    E('div', { className: 'filter-bar' },
      E('div', { className: 'search-wrap', style: { flex: 1, maxWidth: 300 } },
        E('span', { className: 'search-icon' }, '🔍'),
        E('input', { placeholder: 'Search users...', value: search, onChange: e => setSearch(e.target.value) })
      )
    ),
    E('div', { className: 'section-card' },
      E('div', { className: 'table-wrap' },
        E('table', null,
          E('thead', null, E('tr', null,
            E('th', null, 'Name'), E('th', null, 'Email'), E('th', null, 'Role'),
            E('th', null, 'Blood Type'), E('th', null, 'Status'), E('th', null, 'Joined'), E('th', null, 'Actions')
          )),
          E('tbody', null,
            filtered.map(u => E('tr', { key: u.UserID },
              E('td', null, E('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                E('div', { className: 'avatar', style: { width: 28, height: 28, fontSize: 11 } },
                  (u.firstname?.[0] || 'U') + (u.lastname?.[0] || '')),
                `${u.firstname} ${u.lastname}`
              )),
              E('td', null, u.email),
              E('td', null, E('span', { className: `badge ${u.userrole === 'ADMIN' ? 'badge-red' : u.userrole === 'DONOR' ? 'badge-green' : 'badge-blue'}` }, u.userrole)),
              E('td', null, bloodBadge(u.blood_type)),
              E('td', null, E('span', { className: `badge ${u.isUseractive ? 'badge-green' : 'badge-gray'}` }, u.isUseractive ? 'Active' : 'Inactive')),
              E('td', null, fmtDate(u.registrationdate)),
              E('td', null, u.isUseractive && u.userrole !== 'ADMIN' &&
                E('button', { className: 'btn btn-danger btn-sm', onClick: () => deactivate(u.UserID) }, 'Deactivate')
              )
            ))
          )
        )
      )
    )
  );
}

// ─── ADMIN PAGE ────────────────────────────────────────────────────────────────
function AdminPage() {
  const [stats, setStats] = useState(null);
  const [feedbackByRole, setFeedbackByRole] = useState([]);
  const [topHospitals, setTopHospitals] = useState([]);
  const [fulfilledVsPending, setFulfilledVsPending] = useState([]);
  const [notifMsg, setNotifMsg] = useState('');
  const [notifTarget, setNotifTarget] = useState('ALL');
  const [sending, setSending] = useState(false);
  const fvpRef = useRef(null); const fvpInst = useRef(null);
  const hospRef = useRef(null); const hospInst = useRef(null);
  const toast = useContext(ToastCtx);
  const E = React.createElement;

  useEffect(() => {
    apiFetch('/admin/summary').then(d => setStats(d.data)).catch(err => console.error("API error:", err.message));
    apiFetch('/feedback/by-role').then(d => setFeedbackByRole(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/requests/top-hospitals').then(d => setTopHospitals(d.data || [])).catch(err => console.error("API error:", err.message));
    apiFetch('/requests/fulfilled-vs-pending').then(d => setFulfilledVsPending(d.data || [])).catch(err => console.error("API error:", err.message));
  }, []);

  useEffect(() => {
    if (!fvpRef.current || !stats) return;
    if (fvpInst.current) fvpInst.current.destroy();
    fvpInst.current = new Chart(fvpRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Fulfilled', 'Pending', 'Other'],
        datasets: [{ data: [stats.FulfilledRequests || 0, stats.PendingRequests || 0, 0],
          backgroundColor: ['#22C55E','#F59E0B','#6B7280'],
          borderColor: '#1A1215', borderWidth: 3 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '60%' }
    });
  }, [stats]);

  useEffect(() => {
    if (!hospRef.current || !topHospitals.length) return;
    if (hospInst.current) hospInst.current.destroy();
    hospInst.current = new Chart(hospRef.current, {
      type: 'bar',
      data: {
        labels: topHospitals.map(h => h.HospitalName.split(' ').slice(0,2).join(' ')),
        datasets: [{ label: 'Total Requests', data: topHospitals.map(h => h.TotalRequests),
          backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3B82F6', borderWidth: 1, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7A6470', font: { size: 11 } } }
        }
      }
    });
  }, [topHospitals]);

  async function sendBroadcast(e) {
    e.preventDefault();
    if (!notifMsg.trim()) return;
    setSending(true);
    try {
      const r = await apiFetch('/notifications/broadcast', {
        method: 'POST',
        body: { message: notifMsg, target: notifTarget }
      });
      toast(r.message || 'Notification sent', 'success');
      setNotifMsg('');
    } catch (err) { toast(err.message, 'error'); }
    setSending(false);
  }

  return E('div', { className: 'fade-in' },
    E('div', { className: 'section-header' },
      E('h2', { className: 'section-title' }, '⚙️ Admin ', E('span', null, 'Panel'))
    ),
    E('div', { className: 'stats-grid', style: { marginBottom: 20 } },
      [
        { label: 'Active Donors', value: stats?.ActiveDonors ?? '—', icon: '👥' },
        { label: 'Active Recipients', value: stats?.ActiveRecipients ?? '—', icon: '🏥' },
        { label: 'Upcoming Appointments', value: stats?.UpcomingAppointments ?? '—', icon: '📅' },
        { label: 'Donations (30d)', value: stats?.DonationsLast30Days ?? '—', icon: '💉' },
      ].map((s, i) => E('div', { key: i, className: 'stat-card' },
        E('div', { className: 'stat-icon' }, s.icon),
        E('div', { className: 'stat-label' }, s.label),
        E('div', { className: 'stat-value' }, s.value)
      ))
    ),

    E('div', { className: 'grid2', style: { gap: 16 } },
      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Request Status Overview')
        ),
        E('div', { className: 'section-card-body' },
          E('div', { style: { display: 'flex', alignItems: 'center', gap: 24 } },
            E('div', { style: { width: 160, height: 160, position: 'relative', flexShrink: 0 } },
              E('canvas', { ref: fvpRef, role: 'img', 'aria-label': 'Request status doughnut chart' }, 'Request status chart')
            ),
            E('div', null,
              [['Fulfilled', '#22C55E', stats?.FulfilledRequests], ['Pending', '#F59E0B', stats?.PendingRequests]].map(([l, c, v]) =>
                E('div', { key: l, style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
                  E('span', { style: { width: 12, height: 12, borderRadius: 2, background: c, flexShrink: 0 } }),
                  E('span', { style: { flex: 1, fontSize: 14 } }, l),
                  E('span', { style: { fontWeight: 600, color: c } }, v ?? '—')
                )
              )
            )
          )
        )
      ),

      E('div', { className: 'section-card' },
        E('div', { className: 'section-card-header' },
          E('div', { className: 'section-card-title' }, 'Top Requesting Hospitals')
        ),
        E('div', { className: 'section-card-body' },
          E('div', { style: { height: 200, position: 'relative' } },
            E('canvas', { ref: hospRef, role: 'img', 'aria-label': 'Horizontal bar chart of top hospitals' }, 'Top hospitals chart')
          )
        )
      )
    ),

    E('div', { className: 'section-card', style: { marginTop: 20 } },
      E('div', { className: 'section-card-header' },
        E('div', { className: 'section-card-title' }, '🔔 Send Broadcast Notification')
      ),
      E('div', { className: 'section-card-body' },
        E('form', { onSubmit: sendBroadcast },
          E('div', { className: 'form-group' },
            E('label', null, 'Send To'),
            E('select', { value: notifTarget, onChange: e => setNotifTarget(e.target.value) },
              E('option', { value: 'ALL' }, 'All Users'),
              E('option', { value: 'DONORS' }, 'All Donors'),
              E('option', { value: 'RECIPIENTS' }, 'All Recipients')
            )
          ),
          E('div', { className: 'form-group' },
            E('label', null, 'Message'),
            E('textarea', {
              value: notifMsg,
              onChange: e => setNotifMsg(e.target.value),
              placeholder: 'e.g. Urgent: Critical shortage of O- blood. Please consider donating!',
              style: { minHeight: 80 }
            })
          ),
          E('button', {
            type: 'submit',
            className: 'btn btn-primary',
            disabled: sending || !notifMsg.trim()
          }, sending ? 'Sending...' : 'Send Notification')
        )
      )
    )
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(getUser);
  const [page, setPage] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const E = React.createElement;

  function logout() {
    localStorage.removeItem('bb_token');
    localStorage.removeItem('bb_user');
    setUser(null);
  }

  useEffect(() => {
    if (!user) return;
    apiFetch('/notifications/unread').then(d => setUnreadCount(d.data?.length || 0)).catch(err => console.error("API error:", err.message));
  }, [user, page]);

  if (!user) return E(AuthPage, { onLogin: u => setUser(u) });

  const isAdmin = user.role === 'ADMIN';
  const isDonor = user.role === 'DONOR';

  function renderPage() {
    switch (page) {
      case 'dashboard': return E(Dashboard, { user });
      case 'inventory': return E(InventoryPage);
      case 'my-donations': return E(DonationsPage, { user, myOnly: true });
      case 'donations': return E(DonationsPage, { user, myOnly: false });
      case 'appointments': return E(AppointmentsPage, { user });
      case 'requests': return E(RequestsPage, { user });
      case 'donors': return E(DonorsPage);
      case 'notifications': return E(NotificationsPage, { user, onRead: setUnreadCount });
      case 'feedback': return E(FeedbackPage, { user });
      case 'users': return isAdmin ? E(UsersPage) : E(Dashboard, { user });
      case 'admin': return isAdmin ? E(AdminPage) : E(Dashboard, { user });
      default: return E(Dashboard, { user });
    }
  }

  const titles = {
    dashboard: 'Dashboard', inventory: 'Blood Inventory', 'my-donations': 'My Donations',
    donations: 'All Donations', appointments: 'Appointments', requests: 'Blood Requests',
    donors: 'Donor Directory', notifications: 'Notifications', feedback: 'Feedback',
    users: 'User Management', admin: 'Admin Panel'
  };

  return E('div', { style: { display: 'flex', minHeight: '100vh' } },
    E(Sidebar, { user, page, setPage, unreadCount }),
    E('div', { className: 'main' },
      E('div', { className: 'topbar' },
        E('div', { className: 'topbar-title' },
          titles[page]?.split(' ').map((w, i) => i === 0 ? w + ' ' : E('span', { key: i }, w))
        ),
        E('div', { className: 'topbar-actions' },
          E('div', { style: { position: 'relative' } },
            E('div', { className: `icon-btn has-badge`, onClick: () => { setShowNotifPanel(!showNotifPanel); setPage('notifications'); },
              title: 'Notifications' }, '🔔',
              unreadCount > 0 && E('span', { className: 'badge-count' }, unreadCount > 9 ? '9+' : unreadCount)
            )
          ),
          E('div', { className: 'icon-btn', onClick: logout, title: 'Sign out' }, '⬡'),
          E('div', { className: 'avatar', onClick: logout, title: 'Sign out',
            style: { cursor: 'pointer', width: 36, height: 36 } },
            (user.firstname?.[0] || 'U') + (user.lastname?.[0] || ''))
        )
      ),
      E('div', { className: 'content' }, renderPage())
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ToastProvider, null, React.createElement(App)));