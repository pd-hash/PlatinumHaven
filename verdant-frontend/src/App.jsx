import React, { useState, useEffect, useCallback } from 'react';
import * as api from './lib/api';

const currentMonthKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fmt = (n) => pesoFormatter.format(Number(n || 0));

const formatBookingDateTime = (value) => {
  if (!value) return '--';
  const normalized = value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateOnly = (value) => {
  if (!value) return '--';
  const normalized = String(value).replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return String(value).split('T')[0];
  return parsed.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const NAV_BY_ROLE = {
  admin:   ['dashboard','reports','housekeeping','users'],
  manager: ['dashboard','audit','rooms','housekeeping','add-ons','customers','approvals'],
  staff:   ['dashboard','reservations','housekeeping','customers','approvals'],
};

const NAV_ITEMS = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'reports', icon: 'reports', label: 'Reports' },
  { id: 'rooms', icon: 'rooms', label: 'Rooms' },
  { id: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' },
  { id: 'reservations', icon: 'reservations', label: 'Reservations' },
  { id: 'customers', icon: 'customers', label: 'Customers' },
  { id: 'add-ons', icon: 'addons', label: 'Add-Ons' },
  { id: 'users', icon: 'users', label: 'User Management' },
  { id: 'audit', icon: 'audit', label: 'Daily Audit' },
  { id: 'approvals', icon: 'approvals', label: 'Account Approvals' },
];

const can = (user, action) => {
  const perms = {
    admin:   ['manage_users','view_analytics','view_dashboard'],
    manager: ['add_room','edit_room','delete_room','add_addon','edit_addon',
              'delete_addon','view_feedback','view_audit','approve_customer'],
    staff:   ['edit_reservation','approve_reservation','approve_customer'],
  };
  return (perms[user?.role] || []).includes(action);
};

const canManageHousekeeping = (user) => ['admin', 'manager'].includes(user?.role);

const AppIcon = ({ name, size = 18, color = 'currentColor', stroke = 1.9 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="10" width="7" height="11" rx="1.5"/><rect x="3" y="12" width="7" height="9" rx="1.5"/></svg>;
    case 'reports':
      return <svg {...common}><path d="M4 19V5"/><path d="M9 19V10"/><path d="M14 19V7"/><path d="M19 19V13"/></svg>;
    case 'rooms':
      return <svg {...common}><path d="M4 18V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9"/><path d="M4 14h16"/><path d="M7 18v-2"/><path d="M17 18v-2"/></svg>;
    case 'reservations':
      return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 2v4"/><path d="M15 2v4"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>;
    case 'customers':
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'addons':
      return <svg {...common}><path d="M12 3v18"/><path d="M3 12h18"/><rect x="5" y="5" width="14" height="14" rx="2"/></svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><path d="M16 11l2 2 4-4"/></svg>;
    case 'audit':
      return <svg {...common}><path d="M4 19h16"/><path d="M7 16V8"/><path d="M12 16V5"/><path d="M17 16v-4"/></svg>;
    case 'approvals':
      return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'housekeeping':
      return <svg {...common}><path d="M5 20h14"/><path d="M9 20V9l4-4 2 2-4 4h6"/><path d="M7 14l4 4"/><path d="M15 6l3 3"/></svg>;
    case 'bookings':
      return <svg {...common}><path d="M7 2v4"/><path d="M17 2v4"/><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/></svg>;
    case 'income':
      return <svg {...common}><path d="M10 3v18"/><path d="M10 5h4a4 4 0 0 1 0 8h-4"/><path d="M7 9h8"/><path d="M7 12h7"/></svg>;
    case 'leaf':
      return <svg {...common}><path d="M19 5c-6.5 0-11 3.6-11 9 0 2.8 1.7 5 4.5 5 4.9 0 8.5-4 8.5-14Z"/><path d="M7 17c2-2.2 4.7-4 8-5"/></svg>;
    case 'user-field':
      return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0"/></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case 'eye':
      return <svg {...common}><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case 'eye-off':
      return <svg {...common}><path d="M3 3l18 18"/><path d="M10.6 6.7A10.8 10.8 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a18.4 18.4 0 0 1-4.2 4.6"/><path d="M6.1 8.2A18.2 18.2 0 0 0 2.5 12S6 17.5 12 17.5c1.1 0 2.2-.2 3.2-.5"/><path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
    case 'rating':
      return <svg {...common}><path d="m12 3 2.9 5.88 6.48.94-4.69 4.57 1.1 6.46L12 17.77 6.21 20.85l1.1-6.46-4.69-4.57 6.48-.94L12 3z"/></svg>;
    case 'checkin':
      return <svg {...common}><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 11h6"/><path d="M12 8v6"/></svg>;
    case 'checkout':
      return <svg {...common}><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 11h6"/></svg>;
    case 'arrival':
      return <svg {...common}><path d="M3 12h12"/><path d="m11 8 4 4-4 4"/><rect x="17" y="5" width="4" height="14" rx="1"/></svg>;
    case 'confirmed':
      return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'admin':
      return <svg {...common}><path d="M12 3 4 7v5c0 5 3.4 8.7 8 9 4.6-.3 8-4 8-9V7l-8-4Z"/><path d="M9.5 12.5 11 14l3.5-4"/></svg>;
    case 'manager':
      return <svg {...common}><path d="M4 19h16"/><path d="M7 16V8"/><path d="M12 16V5"/><path d="M17 16v-3"/></svg>;
    case 'staff':
      return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5V3h8v2"/><path d="M12 11h.01"/></svg>;
    case 'logout':
      return <svg {...common}><path d="M10 17l-5-5 5-5"/><path d="M5 12h12"/><path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
  }
};

const StatusBadge = ({ status }) => {
  const colors = {
    Confirmed:'#dcfce7,#1a7f4b', Pending:'#fef9c3,#b87a00', Cancelled:'#fee2e2,#c0392b',
    Completed:'#dbeafe,#2563eb', Holding:'#ede9fe,#7c3aed', Maintenance:'#ffedd5,#9a3412',
    'In Progress':'#dbeafe,#2563eb', Blocked:'#fee2e2,#c0392b',
    Available:'#dcfce7,#1a7f4b', Occupied:'#dbeafe,#2563eb', Paid:'#dcfce7,#1a7f4b',
    Refund:'#fee2e2,#c0392b', 'Low Stock':'#fef9c3,#b87a00', 'Out of Stock':'#fee2e2,#c0392b',
    Active:'#dcfce7,#1a7f4b', Inactive:'#f3f4f6,#6b7280',
    admin:'#ede9fe,#7c3aed', manager:'#dbeafe,#2563eb', staff:'#fef9c3,#b87a00',
    Morning:'#fef9c3,#b87a00', Afternoon:'#dbeafe,#2563eb', Night:'#ede9fe,#7c3aed',
  };
  const [bg, fg] = (colors[status] || '#f3f4f6,#374151').split(',');
  const roleIcon = status === 'admin' ? 'admin' : status === 'manager' ? 'manager' : status === 'staff' ? 'staff' : null;
  return <span style={{ background: bg, color: fg, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{roleIcon && <AppIcon name={roleIcon} size={12} color={fg} stroke={2.1} />}{status}</span>;
};

const Stars = ({ rating }) => <span style={{ color: '#f59e0b', fontSize: 13 }}>{'★'.repeat(rating)}{'☆'.repeat(5-rating)}</span>;
const formatRoomRating = (room) => room.rating_count > 0
  ? `★ ${Number(room.average_rating || 0).toFixed(1)} · ${room.rating_count} review${room.rating_count === 1 ? '' : 's'}`
  : '★ New';

const PasswordField = ({ value, onChange, placeholder, inputStyleOverride }) => {
  const [visible, setVisible] = useState(false);
  const attachId = async (customerId, file) => {
    if (!file) return;
    setUploadingId(customerId);
    try {
      const updated = await api.uploadCustomerValidId(customerId, file);
      setCustomers(prev => prev.map(customer => customer.id === customerId ? updated : customer));
    } catch (e) {
      alert(e.message);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 42, ...inputStyleOverride }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer' }}
      >
        <AppIcon name={visible ? 'eye' : 'eye-off'} size={16} color="#4b5563" stroke={2} />
      </button>
    </div>
  );
};

const IdPreviewThumb = ({ src, alt }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#2d6a4f' }}
    >
      <img
        src={src}
        alt={alt}
        style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 10, border: '1px solid #d1fae5', background: '#f8fafc', boxShadow: hovered ? '0 8px 22px rgba(27,58,45,0.18)' : 'none', transform: hovered ? 'scale(1.06)' : 'scale(1)', transition: 'transform 140ms ease, box-shadow 140ms ease' }}
      />
      <span style={{ fontWeight: 600, fontSize: 12 }}>View ID</span>
      {hovered && (
        <div style={{ position: 'absolute', left: 56, top: '50%', transform: 'translateY(-50%)', padding: 8, borderRadius: 16, background: '#ffffff', border: '1px solid #d1fae5', boxShadow: '0 18px 50px rgba(15,23,42,0.18)', zIndex: 20 }}>
          <img src={src} alt={alt} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
        </div>
      )}
    </a>
  );
};

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif", background: '#fff', color: '#111' };
const labelStyle = { fontSize: 12, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 };

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const ErrorMsg = ({ msg, onRetry }) => (
  <div style={{ textAlign: 'center', padding: 40 }}>
    <div style={{ color: '#ef4444', marginBottom: 12 }}>Warning: {msg}</div>
    {onRetry && <button onClick={onRetry} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', padding: '8px 20px' }}>Retry</button>}
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', width: wide ? 600 : 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>x</button>
      </div>
      {children}
    </div>
  </div>
);

const IconBadge = ({ icon, bg = '#1b3a2d', color = '#fff' }) => (
  <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <AppIcon name={icon} size={18} color={color} />
  </div>
);

const MetricCard = ({ label, value, icon, bg = '#1b3a2d', accent = '#111827', helper }) => (
  <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12 }}>
    <div>
      <div style={{color:'#6b7280',fontSize:12,marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:accent}}>{value}</div>
      {helper && <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>{helper}</div>}
    </div>
    <IconBadge icon={icon} bg={bg} />
  </div>
);

const QuickLinkCard = ({ title, copy, cta, onClick }) => (
  <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
    <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{title}</div>
    <div style={{color:'#6b7280',fontSize:13,marginBottom:18,lineHeight:1.6}}>{copy}</div>
    <button onClick={onClick} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'11px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>
      {cta}
    </button>
  </div>
);

const Topbar = ({ title, subtitle, user, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1b3a2d', margin: 0, fontFamily: "'Playfair Display',serif" }}>{title}</h1>
      {subtitle && <p style={{ color: '#6b7280', fontSize: 13, margin: '2px 0 0' }}>{subtitle}</p>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '8px 14px', borderRadius: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{user?.full_name}</div>
          <StatusBadge status={user?.role} />
        </div>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6a4f,#1b3a2d)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>
          {(user?.full_name||'U').charAt(0).toUpperCase()}
        </div>
      </div>
      {action && <div style={{ width: '100%' }}>{action}</div>}
    </div>
  </div>
);

const safeNumber = (value) => {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatCompactPeso = (value) => {
  const numeric = safeNumber(value);
  if (numeric >= 1000000) return `₱${(numeric / 1000000).toFixed(numeric >= 10000000 ? 0 : 1)}M`;
  if (numeric >= 1000) return `₱${(numeric / 1000).toFixed(numeric >= 100000 ? 0 : 1)}k`;
  return fmt(numeric);
};

const BarChart = ({ items }) => {
  const normalized = (items || []).map((item) => ({
    label: item.label,
    value: safeNumber(item.value),
  }));
  const max = Math.max(...normalized.map((item) => item.value), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 14, minHeight: 220 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0 30px', color: '#9ca3af', fontSize: 11 }}>
        {[max, max * 0.66, max * 0.33, 0].map((tick, index) => (
          <span key={index}>{formatCompactPeso(tick)}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ position: 'relative', height: 170, borderBottom: '1px solid #e5e7eb' }}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} style={{ position: 'absolute', left: 0, right: 0, top: `${row * 33.333}%`, borderTop: row === 0 ? 'none' : '1px dashed #edf2f7' }} />
          ))}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            {normalized.map((item, index) => {
              const rawHeight = (item.value / max) * 140;
              const barHeight = item.value > 0 ? Math.max(rawHeight, 8) : 0;
              return (
                <div key={`${item.label}-${index}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>{formatCompactPeso(item.value)}</div>
                  <div style={{ width: '100%', maxWidth: 48, minWidth: 18, height: barHeight, background: 'linear-gradient(180deg,#74c69d 0%,#2d6a4f 100%)', borderRadius: '10px 10px 4px 4px', boxShadow: '0 8px 18px rgba(45,106,79,0.18)' }} />
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {normalized.map((item, index) => (
            <div key={`${item.label}-tick-${index}`} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LineChart = ({ items }) => {
  const normalized = (items || []).map((item) => ({
    label: item.label,
    value: safeNumber(item.value),
  }));
  const max = Math.max(...normalized.map((item) => item.value), 1);
  const min = Math.min(...normalized.map((item) => item.value), 0);
  const range = max - min;
  const w = 520;
  const h = 190;
  const padX = 18;
  const padTop = 18;
  const padBottom = 42;
  if (normalized.length < 2) return null;
  const points = normalized.map((item, index) => {
    const x = padX + (index / (normalized.length - 1)) * (w - padX * 2);
    const yRatio = range === 0 ? 0.5 : (item.value - min) / range;
    const y = h - padBottom - yRatio * (h - padTop - padBottom);
    return { ...item, x, y };
  });
  const linePath = `M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}`;
  const areaPath = `${linePath} L ${points[points.length - 1].x},${h - padBottom} L ${points[0].x},${h - padBottom} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height:220 }}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#74c69d" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="#74c69d" stopOpacity="0.04"/>
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((row) => {
        const y = padTop + (row / 3) * (h - padTop - padBottom);
        const tickValue = max - (row / 3) * (max - min);
        return (
          <g key={row}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#edf2f7" strokeDasharray="4 4" />
            <text x="0" y={y + 4} fill="#9ca3af" fontSize="11">{formatCompactPeso(tickValue)}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#trend-fill)"/>
      <path d={linePath} fill="none" stroke="#2d6a4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#2d6a4f" strokeWidth="2.5"/>
          <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#48635a" fontSize="10" fontWeight="600">
            {formatCompactPeso(point.value)}
          </text>
          <text x={point.x} y={h - 12} textAnchor="middle" fill="#6b7280" fontSize="11">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

const Sidebar = ({ active, setActive, user, onLogout }) => {
  const allowed = NAV_BY_ROLE[user?.role] || [];
  const userInitial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: 210, minHeight: '100vh', background: '#1b3a2d', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #2d5a3d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <AppIcon name="rooms" size={18} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: "'Playfair Display',serif" }}>Platinum Haven</div>
            <div style={{ fontSize: 10, color: '#a3c9a8' }}>Hotel Management</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV_ITEMS.filter(n => allowed.includes(n.id)).map(({ id, icon, label }) => (
          <button key={id} onClick={() => setActive(id)} style={{ width: '100%', background: active===id ? '#2d6a4f' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', color: active===id ? '#fff' : '#a3c9a8', fontSize: 13, fontFamily: "'DM Sans',sans-serif", borderLeft: active===id ? '3px solid #74c69d' : '3px solid transparent' }}>
            <span style={{ minWidth: 28, height: 24, borderRadius: 6, background: active===id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><AppIcon name={icon} size={15} color={active===id ? '#fff' : '#a3c9a8'} /></span>{label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid rgba(116, 198, 157, 0.22)' }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(116,198,157,0.22)', borderRadius: 16, padding: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#74c69d,#1f6f4a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
              {userInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#f4fff7', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(254,249,195,0.16)', color: '#fde68a', fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>
                <AppIcon name="staff" size={11} color="#fde68a" stroke={2.1} />
                {user?.role}
              </div>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: '100%', background: '#f0fdf4', border: '1px solid rgba(116,198,157,0.28)', color: '#14532d', cursor: 'pointer', fontSize: 12, fontWeight: 800, borderRadius: 12, padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 18px rgba(0,0,0,0.12)' }}>
            <AppIcon name="logout" size={15} color="#14532d" stroke={2.2} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return setError('Please fill in all fields.');
    setLoading(true); setError('');
    try {
      const user = await api.login(email, password);
      if (!['admin','manager','staff'].includes(user.role)) throw new Error('Access denied. This portal is for staff only.');
      onLogin(user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, rgba(121,181,133,0.45), transparent 34%), radial-gradient(circle at bottom right, rgba(226,179,61,0.85), transparent 30%), linear-gradient(135deg,#082d0e 0%,#123719 48%,#062d0b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif", padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0) 28%)' }} />
      <div style={{ position: 'relative', background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))', borderRadius: 22, padding: '20px 18px', backdropFilter: 'blur(18px)', border: '1px solid rgba(210,237,211,0.13)', width: 'min(100%, 420px)', boxShadow: '0 30px 80px rgba(0,0,0,0.38)' }}>
        <div style={{ borderRadius: 18, padding: '28px 22px 18px', background: 'linear-gradient(180deg, rgba(17,54,22,0.72), rgba(25,61,22,0.58))', minHeight: 470 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#d9ecd1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 18px rgba(0,0,0,0.16)' }}>
            <AppIcon name="leaf" size={22} color="#2f6d3d" stroke={2} />
          </div>
          <h2 style={{ color: '#fff', margin: '0 0 6px', fontSize: 24, fontWeight: 700, textAlign: 'center', fontFamily: "'Playfair Display',serif" }}>Admin Portal</h2>
          <p style={{ color: 'rgba(223,235,219,0.65)', fontSize: 11, margin: '0 0 30px', textAlign: 'center' }}>Platinum Haven Resort Management</p>
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ ...labelStyle, color: '#d7ead7', fontSize: 11, marginBottom: 8 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6fa86d', display: 'inline-flex' }}>
                <AppIcon name="user-field" size={16} color="#6fa86d" stroke={2} />
              </span>
              <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="admin" style={{ ...inputStyle, padding: '12px 14px 12px 38px', background: 'rgba(16,64,18,0.75)', border: '1px solid rgba(72,120,62,0.42)', color: '#eef8ea', borderRadius: 10 }} />
            </div>
            <div style={{ color: 'rgba(221,233,218,0.45)', fontSize: 10, marginTop: 6 }}>Use your admin email or assigned username.</div>
          </div>
          <div style={{ marginBottom: 6, textAlign: 'left' }}>
            <label style={{ ...labelStyle, color: '#d7ead7', fontSize: 11, marginBottom: 8 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6fa86d', display: 'inline-flex' }}>
                <AppIcon name="lock" size={16} color="#6fa86d" stroke={2} />
              </span>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••••" style={{ ...inputStyle, padding: '12px 44px 12px 38px', background: 'rgba(16,64,18,0.75)', border: '1px solid rgba(72,120,62,0.42)', color: '#eef8ea', borderRadius: 10 }} />
              <button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(56,96,50,0.22)', background: 'rgba(244,247,238,0.96)', color: '#2f5a32', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <AppIcon name={showPassword ? 'eye' : 'eye-off'} size={17} color="#2f5a32" stroke={2} />
              </button>
            </div>
          </div>
          {error && <p style={{ color: '#f7b0ae', fontSize: 12, margin: '10px 0 0', textAlign: 'left' }}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '13px 16px', marginTop: 22, background: loading ? '#9f7850' : '#b78a5b', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 10px 24px rgba(0,0,0,0.2)' }}>
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            {!loading && <AppIcon name="arrow-right" size={16} color="#fff" stroke={2.2} />}
          </button>
          <div style={{ marginTop: 18, fontSize: 10, color: 'rgba(191,219,189,0.52)', textAlign: 'center' }}>
            Protected by secure encryption. Authorized access only.
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardHome = ({ user, setActive }) => {
  if (user?.role === 'manager') return <ManagerDashboard user={user} setActive={setActive} />;
  if (user?.role === 'staff') return <StaffDashboard user={user} setActive={setActive} />;
  return <AdminDashboard user={user} setActive={setActive} />;
};

const AdminDashboard = ({ user, setActive }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setStats(await api.getDashboardStats()); }
    catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <><Topbar title="Dashboard" user={user}/><Spinner/></>;
  if (error) return <><Topbar title="Dashboard" user={user}/><ErrorMsg msg={error} onRetry={load}/></>;
  return (
    <div>
      <Topbar title="Dashboard Overview" subtitle="A quick operational snapshot for Platinum Haven Resort Management." user={user}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Total Bookings" value={stats.total_bookings?.toLocaleString() || '0'} icon="bookings" bg="#2d6a4f" accent="#1b3a2d" />
        <MetricCard label="Monthly Income" value={fmt(stats.monthly_income)} icon="income" bg="#2563eb" accent="#1b3a2d" />
        <MetricCard label="Average Rating" value={stats.avg_rating || '--'} icon="rating" bg="#e91e63" accent="#1b3a2d" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:16, marginBottom:24 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>At A Glance</div>
          <div style={{color:'#6b7280',fontSize:13,marginBottom:16}}>This dashboard is focused on operational checkpoints. Detailed charts and logs stay in Reports.</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            <div style={{background:'#f0fdf4',borderRadius:10,padding:'14px 16px'}}><div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Recent Bookings</div><div style={{fontSize:20,fontWeight:700,color:'#1b3a2d'}}>{stats.recent_bookings?.length || 0}</div></div>
            <div style={{background:'#eff6ff',borderRadius:10,padding:'14px 16px'}}><div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Weekly Data Points</div><div style={{fontSize:20,fontWeight:700,color:'#1b3a2d'}}>{stats.weekly_revenue?.length || 0}</div></div>
            <div style={{background:'#fff7ed',borderRadius:10,padding:'14px 16px'}}><div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Trend Months</div><div style={{fontSize:20,fontWeight:700,color:'#1b3a2d'}}>{stats.monthly_trend?.length || 0}</div></div>
          </div>
        </div>
        <QuickLinkCard title="Reports Module" copy="Open charts, revenue trends, and recent booking logs in a dedicated reports page." cta="Open Reports" onClick={() => setActive('reports')} />
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:15}}>Latest Booking Snapshot</div>
          <button onClick={()=>setActive('reports')} style={{background:'none',border:'1px solid #d1d5db',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,color:'#374151'}}>View Full Report</button>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f9fafb'}}>{['Booking ID','Guest','Room','Status','Amount'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
          <tbody>{(stats.recent_bookings||[]).slice(0,3).map(r=>(
            <tr key={r.id} style={{borderTop:'1px solid #f3f4f6'}}>
              <td style={{padding:'10px 12px'}}>{r.reservation_no}</td>
              <td style={{padding:'10px 12px'}}>{r.guest_name}</td>
              <td style={{padding:'10px 12px',color:'#6b7280'}}>{r.room_name}</td>
              <td style={{padding:'10px 12px'}}><StatusBadge status={r.status}/></td>
              <td style={{padding:'10px 12px',fontWeight:600}}>{fmt(r.total_amount)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

const ManagerDashboard = ({ user, setActive }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [audit, rooms, pending] = await Promise.all([
        api.getDailyAudit(today),
        api.getRooms({ includeMonthlyAvailability: true, month: currentMonthKey() }),
        api.getPendingCustomers(),
      ]);
      setData({ audit, rooms, pending });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [today]);
  useEffect(() => { load(); }, [load]);
  if (loading) return <><Topbar title="Manager Dashboard" user={user}/><Spinner/></>;
  if (error) return <><Topbar title="Manager Dashboard" user={user}/><ErrorMsg msg={error} onRetry={load}/></>;

  const availableRooms = data.rooms.filter((room) => room.status === 'Available').length;
  const limitedRooms = data.rooms.filter((room) => room.monthly_availability_status === 'limited').length;
  const topStaff = [...(data.audit.staff_activity || [])].sort((a, b) => Number(b.reservations_handled) - Number(a.reservations_handled)).slice(0, 4);

  return (
    <div>
      <Topbar title="Manager Dashboard" subtitle="Track today's activity, room readiness, and team follow-ups." user={user}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Check-ins Today" value={data.audit.summary.total_check_ins} icon="checkin" bg="#2d6a4f" accent="#1b3a2d" />
        <MetricCard label="Check-outs Today" value={data.audit.summary.total_check_outs} icon="checkout" bg="#2563eb" accent="#1b3a2d" />
        <MetricCard label="Pending Approvals" value={data.pending.length} icon="approvals" bg="#b87a00" accent="#1b3a2d" />
        <MetricCard label="Available Rooms" value={availableRooms} icon="rooms" bg="#7c3aed" accent="#1b3a2d" helper={`${limitedRooms} limited this month`} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.15fr 0.85fr', gap:16, marginBottom:24 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Front Office Watchlist</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{background:'#f0fdf4',borderRadius:10,padding:'14px 16px'}}><div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Payments Collected</div><div style={{fontSize:20,fontWeight:700,color:'#1b3a2d'}}>{fmt(data.audit.summary.total_collected)}</div></div>
            <div style={{background:'#fff7ed',borderRadius:10,padding:'14px 16px'}}><div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>Tracked Staff</div><div style={{fontSize:20,fontWeight:700,color:'#1b3a2d'}}>{data.audit.staff_activity.length}</div></div>
          </div>
          <div style={{marginTop:16}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:10}}>Top Staff Activity</div>
            {topStaff.length === 0 ? <p style={{color:'#9ca3af',fontSize:13}}>No staff activity logged yet.</p> : topStaff.map((staff) => (
              <div key={staff.full_name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderTop:'1px solid #f3f4f6'}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{staff.full_name}</div><div style={{fontSize:11,color:'#6b7280',textTransform:'capitalize'}}>{staff.role}</div></div>
                <div style={{fontWeight:700,color:'#2d6a4f'}}>{staff.reservations_handled}</div>
              </div>
            ))}
          </div>
        </div>
        <QuickLinkCard title="Daily Audit" copy="Review arrivals, departures, cash flow, and staff handling activity in the audit module." cta="Open Audit" onClick={() => setActive('audit')} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <QuickLinkCard title="Room Availability" copy="Inspect which rooms are fully booked, limited, or ready for sale this month." cta="Open Rooms" onClick={() => setActive('rooms')} />
        <QuickLinkCard title="Customer Approvals" copy={`${data.pending.length} registration request(s) are waiting for review.`} cta="Review Approvals" onClick={() => setActive('approvals')} />
      </div>
    </div>
  );
};

const StaffDashboard = ({ user, setActive }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reservations, pending] = await Promise.all([
        api.getReservations(),
        api.getPendingCustomers(),
      ]);
      setData({ reservations, pending });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <><Topbar title="Staff Dashboard" user={user}/><Spinner/></>;
  if (error) return <><Topbar title="Staff Dashboard" user={user}/><ErrorMsg msg={error} onRetry={load}/></>;

  const todaysArrivals = data.reservations.filter((reservation) => (reservation.check_in || '').startsWith(today));
  const pendingReservations = data.reservations.filter((reservation) => reservation.status === 'Pending');
  const confirmedReservations = data.reservations.filter((reservation) => reservation.status === 'Confirmed');
  const recentQueue = [...data.reservations].slice(0, 5);

  return (
    <div>
      <Topbar title="Staff Dashboard" subtitle="Stay on top of arrivals, reservation follow-ups, and pending approvals." user={user}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Arrivals Today" value={todaysArrivals.length} icon="arrival" bg="#2d6a4f" accent="#1b3a2d" />
        <MetricCard label="Pending Reservations" value={pendingReservations.length} icon="reservations" bg="#b87a00" accent="#1b3a2d" />
        <MetricCard label="Confirmed Stays" value={confirmedReservations.length} icon="confirmed" bg="#2563eb" accent="#1b3a2d" />
        <MetricCard label="Pending Approvals" value={data.pending.length} icon="approvals" bg="#7c3aed" accent="#1b3a2d" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.15fr 0.85fr', gap:16, marginBottom:24 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Reservation Queue</div>
          {recentQueue.length === 0 ? <p style={{color:'#9ca3af',fontSize:13}}>No reservations yet.</p> : recentQueue.map((reservation) => (
            <div key={reservation.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderTop:'1px solid #f3f4f6'}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{reservation.guest_name}</div>
                <div style={{fontSize:11,color:'#6b7280'}}>{reservation.reservation_no} | {reservation.room_name}</div>
              </div>
              <StatusBadge status={reservation.status} />
            </div>
          ))}
        </div>
        <QuickLinkCard title="Reservation Actions" copy="Confirm, hold, or cancel bookings from the reservations module." cta="Open Reservations" onClick={() => setActive('reservations')} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <QuickLinkCard title="Customer Records" copy="Review guest contact details and previous stays before check-in." cta="Open Customers" onClick={() => setActive('customers')} />
        <QuickLinkCard title="Approval Queue" copy={`${data.pending.length} customer registration request(s) need attention.`} cta="Open Approvals" onClick={() => setActive('approvals')} />
      </div>
    </div>
  );
};

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setStats(await api.getDashboardStats()); } catch(e){setError(e.message);} finally{setLoading(false);} }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <><Topbar title="Dashboard" user={user}/><Spinner/></>;
  if (error) return <><Topbar title="Dashboard" user={user}/><ErrorMsg msg={error} onRetry={load}/></>;
  const weeklyItems = (stats.weekly_revenue || []).map((item) => ({
    label: item.label || item.week?.slice(-2) || '--',
    value: item.revenue,
  }));
  const monthlyItems = (stats.monthly_trend || []).map((item) => ({
    label: item.month || item.month_key || '--',
    value: item.revenue,
  }));
  return (
    <div>
      <Topbar title="Reports" subtitle="Revenue trends, booking activity, and recent booking logs." user={user}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <MetricCard label="Total Bookings" value={stats.total_bookings?.toLocaleString() || '0'} icon="bookings" bg="#2d6a4f" accent="#1b3a2d" />
        <MetricCard label="Monthly Income" value={fmt(stats.monthly_income)} icon="income" bg="#2563eb" accent="#1b3a2d" />
        <MetricCard label="Average Rating" value={stats.avg_rating || '--'} icon="rating" bg="#e91e63" accent="#1b3a2d" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{fontWeight:600,marginBottom:16,fontSize:14}}>Weekly Revenue</div>
          {weeklyItems.length > 0 ? <BarChart items={weeklyItems}/> : <p style={{color:'#9ca3af',fontSize:13}}>No data yet</p>}
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{fontWeight:600,marginBottom:12,fontSize:14}}>Monthly Trend</div>
          {monthlyItems.length > 1 ? <LineChart items={monthlyItems}/> : <p style={{color:'#9ca3af',fontSize:13}}>No data yet</p>}
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>Recent Bookings</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f9fafb'}}>{['Booking ID','Guest','Room','Check-in','Status','Amount'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
          <tbody>{(stats.recent_bookings||[]).map(r=>(
            <tr key={r.id} style={{borderTop:'1px solid #f3f4f6'}}>
              <td style={{padding:'10px 12px'}}>{r.reservation_no}</td>
              <td style={{padding:'10px 12px'}}>{r.guest_name}</td>
              <td style={{padding:'10px 12px',color:'#6b7280'}}>{r.room_name}</td>
              <td style={{padding:'10px 12px',color:'#6b7280'}}>{formatBookingDateTime(r.check_in)}</td>
              <td style={{padding:'10px 12px'}}><StatusBadge status={r.status}/></td>
              <td style={{padding:'10px 12px',fontWeight:600}}>{fmt(r.total_amount)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

const Rooms = ({ user }) => {
  const [rooms,setRooms]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [filter,setFilter]=useState('All Types'); const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null); const [form,setForm]=useState({}); const [saving,setSaving]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const emptyRoom={room_number:'',name:'',type:'Standard',price:'',beds:1,max_guests:2,description:'',image_url:''};
  const [addForm,setAddForm]=useState(emptyRoom);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setRooms(await api.getRooms({type:filter,search,includeMonthlyAvailability:true,month:currentMonthKey()}));}catch(e){setError(e.message);}finally{setLoading(false);}}, [filter,search]);
  useEffect(()=>{load();},[load]);
  const openEdit=(r)=>{setEditing(r);setForm({name:r.name,type:r.type,price:r.price,max_guests:r.max_guests,beds:r.beds,description:r.description||'',image_url:r.image_url||''});};
  const save=async()=>{setSaving(true);try{const u=await api.updateRoom(editing.id,form);setRooms(p=>p.map(r=>r.id===editing.id?{...r,...u}:r));setEditing(null);}catch(e){alert(e.message);}finally{setSaving(false);}};
  const saveNew=async()=>{setSaving(true);try{const c=await api.createRoom(addForm);setRooms(p=>[...p,c]);setShowAdd(false);setAddForm(emptyRoom);}catch(e){alert(e.message);}finally{setSaving(false);}};
  const remove=async(id)=>{if(!confirm('Delete?'))return;try{await api.deleteRoom(id);setRooms(p=>p.filter(r=>r.id!==id));}catch(e){alert(e.message);}};
  const COLORS={Standard:'#4a7c59',Suite:'#c8973a',Presidential:'#2d6a4f',Family:'#8b6914',Deluxe:'#1b3a2d'};
  const roomDisplayStatus = (room) => {
    if (room.monthly_availability_status === 'fully_booked' && room.status === 'Available') return 'Occupied';
    if (room.monthly_availability_status === 'unavailable' && room.status === 'Available') return 'Unavailable';
    return room.status;
  };
  const roomAvailabilityBadge = (room) => {
    if (room.monthly_availability_status === 'fully_booked') return { label: 'Fully booked this month', bg: '#fee2e2', fg: '#b91c1c' };
    if (room.monthly_availability_status === 'limited') return { label: `Open - ${room.bookable_days_this_month ?? 0} day(s) remaining`, bg: '#fef3c7', fg: '#92400e' };
    if (room.monthly_availability_status === 'unavailable') return { label: 'Unavailable this month', bg: '#e5e7eb', fg: '#374151' };
    return { label: `Open - ${room.bookable_days_this_month ?? 0} day(s) remaining`, bg: '#dcfce7', fg: '#166534' };
  };
  const monthlyAvailabilityCopy = (room) => {
    if (room.monthly_availability_status === 'fully_booked') return { label: 'Fully booked this month', bg: '#fee2e2', fg: '#b91c1c' };
    if (room.monthly_availability_status === 'limited') return { label: `Limited this month · ${room.bookable_days_this_month ?? 0} bookable day(s)`, bg: '#fef3c7', fg: '#92400e' };
    if (room.monthly_availability_status === 'unavailable') return { label: 'Unavailable this month', bg: '#e5e7eb', fg: '#374151' };
    return { label: `Open this month · ${room.bookable_days_this_month ?? 0} bookable day(s)`, bg: '#dcfce7', fg: '#166534' };
  };
  return (
    <div>
      <Topbar title="Room Management" subtitle="Manage room inventory and availability." user={user}
        action={can(user,'add_room')&&<button onClick={()=>setShowAdd(true)} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,width:'100%'}}>＋ Add Room</button>}
      />
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search room..." style={{flex:1,...inputStyle}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'9px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
          {['All Types','Standard','Suite','Presidential','Family','Deluxe'].map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
          {rooms.map(room=>(
            <div key={room.id} style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.08)',overflow:'hidden'}}>

              {/* ── ROOM IMAGE / FALLBACK ── */}
              <div style={{height:120,position:'relative',overflow:'hidden',borderRadius:'12px 12px 0 0'}}>
                {room.image_url
                  ? <img src={room.image_url} alt={room.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <div style={{height:'100%',background:`linear-gradient(135deg,${COLORS[room.type]||'#2d6a4f'}aa,${COLORS[room.type]||'#2d6a4f'})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>🛏</div>
                }
                <div style={{position:'absolute',top:8,right:8,background:roomDisplayStatus(room)==='Available'?'#1a7f4b':roomDisplayStatus(room)==='Maintenance'?'#9a3412':'#2563eb',color:'#fff',fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20}}>{roomDisplayStatus(room)}</div>
              </div>

              <div style={{padding:'12px 14px'}}>
                <div style={{fontSize:11,color:'#6b7280'}}>{room.room_number} · {room.type}</div>
                <div style={{fontWeight:700,fontSize:14,margin:'2px 0'}}>{room.name}</div>
                <div style={{fontSize:11,color:'#b45309',fontWeight:600,marginBottom:6}}>{formatRoomRating(room)}</div>
                <div style={{color:'#2d6a4f',fontWeight:700,fontSize:14,marginBottom:8}}>{fmt(room.price)}<span style={{fontSize:11,fontWeight:400,color:'#9ca3af'}}>/night</span></div>
                <div style={{fontSize:11,color:'#9ca3af',marginBottom:10}}>{room.beds} bed · {room.max_guests} guests</div>
                <div style={{display:'inline-flex',alignItems:'center',padding:'4px 10px',borderRadius:999,background:roomAvailabilityBadge(room).bg,color:roomAvailabilityBadge(room).fg,fontSize:11,fontWeight:600,marginBottom:10}}>
                  {roomAvailabilityBadge(room).label}
                </div>
                {can(user,'edit_room')&&(
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <button onClick={()=>openEdit(room)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12,color:'#374151'}}>✏ Edit</button>
                    {can(user,'delete_room')&&<button onClick={()=>remove(room.id)} style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12,color:'#ef4444'}}>🗑</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editing&&(
        <Modal title="Edit Room" onClose={()=>setEditing(null)}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Room Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inputStyle}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>{['Standard','Suite','Presidential','Family','Deluxe'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label style={labelStyle}>Price/Night (₱)</label><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>Max Guests</label><input type="number" value={form.max_guests} onChange={e=>setForm(f=>({...f,max_guests:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} style={{...inputStyle,resize:'vertical'}}/></div>
            {/* ── IMAGE URL ── */}
            <div>
  <label style={labelStyle}>Room Image</label>
  {form.image_url && <img src={form.image_url} alt="preview" style={{width:'100%',height:120,objectFit:'cover',borderRadius:8,marginBottom:8}}/>}
  <label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'2px dashed #d1fae5',borderRadius:8,padding:14,cursor:'pointer',background:'#f0fdf4',color:'#2d6a4f',fontSize:13,fontWeight:600}}>
    📁 Choose Image
    <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
      const file=e.target.files[0]; if(!file) return;
      try{const url=await api.uploadRoomImage(file);setForm(f=>({...f,image_url:url}));}
      catch(err){alert(err.message);}
    }}/>
  </label>
</div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>setEditing(null)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd&&(
        <Modal title="Add New Room" onClose={()=>{setShowAdd(false);setAddForm(emptyRoom);}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Room Number</label><input value={addForm.room_number} onChange={e=>setAddForm(f=>({...f,room_number:e.target.value}))} style={inputStyle} placeholder="e.g. 501"/></div>
              <div><label style={labelStyle}>Room Name</label><input value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} style={inputStyle} placeholder="e.g. Ocean View"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Type</label><select value={addForm.type} onChange={e=>setAddForm(f=>({...f,type:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>{['Standard','Suite','Presidential','Family','Deluxe'].map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label style={labelStyle}>Price/Night (₱)</label><input type="number" value={addForm.price} onChange={e=>setAddForm(f=>({...f,price:e.target.value}))} style={inputStyle} placeholder="0"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Beds</label><input type="number" value={addForm.beds} onChange={e=>setAddForm(f=>({...f,beds:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>Max Guests</label><input type="number" value={addForm.max_guests} onChange={e=>setAddForm(f=>({...f,max_guests:e.target.value}))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>Description</label><textarea value={addForm.description} onChange={e=>setAddForm(f=>({...f,description:e.target.value}))} rows={3} style={{...inputStyle,resize:'vertical'}} placeholder="Brief description..."/></div>
            {/* ── IMAGE URL ── */}
            <div>
  <label style={labelStyle}>Room Image</label>
  {addForm.image_url && <img src={addForm.image_url} alt="preview" style={{width:'100%',height:120,objectFit:'cover',borderRadius:8,marginBottom:8}}/>}
  <label style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'2px dashed #d1fae5',borderRadius:8,padding:14,cursor:'pointer',background:'#f0fdf4',color:'#2d6a4f',fontSize:13,fontWeight:600}}>
    📁 Choose Image
    <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
      const file=e.target.files[0]; if(!file) return;
      try{const url=await api.uploadRoomImage(file);setAddForm(f=>({...f,image_url:url}));}
      catch(err){alert(err.message);}
    }}/>
  </label>
</div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>{setShowAdd(false);setAddForm(emptyRoom);}} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveNew} disabled={saving||!addForm.room_number||!addForm.name||!addForm.price} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Adding…':'Add Room'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Reservations = ({ user }) => {
  const [reservations,setReservations]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [statusFilter,setStatusFilter]=useState('All Statuses'); const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null); const [newStatus,setNewStatus]=useState(''); const [saving,setSaving]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setReservations(await api.getReservations({status:statusFilter,search}));}catch(e){setError(e.message);}finally{setLoading(false);}}, [statusFilter,search]);
  useEffect(()=>{load();},[load]);
  const openEdit=(r)=>{setEditing(r);setNewStatus(r.status);};
  const saveStatus=async()=>{setSaving(true);try{const updated=await api.updateReservation(editing.id,{status:newStatus});setReservations(p=>p.map(r=>r.id===editing.id?{...r,...updated}:r));setEditing(null);}catch(e){alert(e.message);}finally{setSaving(false);}};
  const remove=async(id)=>{if(!confirm('Delete?'))return;try{await api.deleteReservation(id);setReservations(p=>p.filter(r=>r.id!==id));}catch(e){alert(e.message);}};
  return (
    <div>
      <Topbar title="Reservations" subtitle="View and manage all guest bookings." user={user}/>
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by Guest or Reservation No." style={{flex:1,...inputStyle}}/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{padding:'9px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
          {['All Statuses','Confirmed','Pending','Cancelled','Completed','Holding'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9fafb'}}>{['Reservation #','Guest','Room','Dates','Status','Payment','Amount','Actions'].map(h=><th key={h} style={{padding:'12px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
            <tbody>{reservations.map(r=>(
              <tr key={r.id} style={{borderTop:'1px solid #f3f4f6'}}>
                <td style={{padding:'12px 16px',fontWeight:500}}>{r.reservation_no}</td>
                <td style={{padding:'12px 16px'}}>{r.guest_name}</td>
                <td style={{padding:'12px 16px',color:'#6b7280'}}>{r.room_number} {r.room_name}</td>
                <td style={{padding:'12px 16px',color:'#6b7280',fontSize:12}}><div>In: {formatBookingDateTime(r.check_in)}</div><div>Out: {formatBookingDateTime(r.check_out)}</div></td>
                <td style={{padding:'12px 16px'}}><StatusBadge status={r.status}/></td>
                <td style={{padding:'12px 16px'}}><StatusBadge status={r.payment_status}/></td>
                <td style={{padding:'12px 16px',fontWeight:600}}>{fmt(r.total_amount)}</td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:8}}>
                    {can(user,'edit_reservation')&&<button onClick={()=>openEdit(r)} style={{background:'#f0fdf4',color:'#2d6a4f',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Edit</button>}
                    {can(user,'delete_reservation')&&<button onClick={()=>remove(r.id)} style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:'#ef4444'}}>🗑</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {editing&&(
        <Modal title={`Update — ${editing.reservation_no}`} onClose={()=>setEditing(null)}>
          <div style={{background:'#f9fafb',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:13}}>
            <div><strong>Guest:</strong> {editing.guest_name}</div>
            <div><strong>Room:</strong> {editing.room_name}</div>
            <div><strong>Amount:</strong> {fmt(editing.total_amount)}</div>
          </div>
          <label style={labelStyle}>Update Status</label>
<select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{...inputStyle,cursor:'pointer',marginBottom:16}}>
  {(user?.role === 'staff'
    ? ['Pending','Confirmed','Holding','Completed','Cancelled']
    : ['Pending','Confirmed','Holding','Completed','Cancelled']
  ).map(s=><option key={s}>{s}</option>)}
</select>
{user?.role === 'staff' && (
  <div style={{background:'#fef9c3',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#b87a00',marginBottom:16}}>
    💡 As staff, you can Confirm or Cancel reservations.
  </div>
)}
          <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
            <button onClick={()=>setEditing(null)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
            <button onClick={saveStatus} disabled={saving} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Update Status'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Customers = ({ user }) => {
  const [customers,setCustomers]=useState([]); const [feedback,setFeedback]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const[c,f]=await Promise.all([api.getCustomers(),api.getFeedback()]);setCustomers(c);setFeedback(f);}catch(e){setError(e.message);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();},[load]);
  const COLORS=['#e8a87c','#7ec8e3','#a8d8a8','#f7c59f','#b8a9c9','#ff9a9e','#a1c4fd','#ffecd2'];
  const ini=(n)=>(n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return (
    <div>
      <Topbar title="Customer Management" subtitle="View customer details and feedback." user={user}/>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>
          <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid #f3f4f6',fontWeight:600,fontSize:14}}>Registered Customers</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9fafb'}}>{['Customer','Contact','Bookings','Last Visit'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
              <tbody>{customers.map((c,i)=>(
                <tr key={c.id} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:COLORS[i%COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#1b3a2d'}}>{ini(c.full_name)}</div>
                      <div><div style={{fontWeight:600}}>{c.full_name}</div><div style={{fontSize:11,color:'#9ca3af'}}>{c.location}</div></div>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px'}}><div style={{fontSize:12,color:'#6b7280'}}>{c.email}</div><div style={{fontSize:12,color:'#6b7280'}}>{c.phone}</div></td>
                  <td style={{padding:'12px 16px',fontWeight:600,color:'#2d6a4f'}}>{c.total_bookings||0}</td>
                  <td style={{padding:'12px 16px',color:'#6b7280',fontSize:12}}>{c.last_visit?c.last_visit.split('T')[0]:'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',padding:16}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>Recent Feedback</div>
            {feedback.length===0&&<p style={{color:'#9ca3af',fontSize:13}}>No feedback yet.</p>}
            {feedback.map((f,i)=>(
              <div key={f.id} style={{borderBottom:i<feedback.length-1?'1px solid #f3f4f6':'none',paddingBottom:14,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:13}}>{f.full_name}</span>
                  <span style={{fontSize:11,color:'#9ca3af'}}>{f.created_at?.split('T')[0]}</span>
                </div>
                <Stars rating={f.rating}/>
                <p style={{fontSize:12,color:'#6b7280',margin:'6px 0 0',lineHeight:1.5}}>{f.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const stockColor=(s)=>s==='Out of Stock'?'#ef4444':s==='Low Stock'?'#f59e0b':'#2d6a4f';
const AddOns = ({ user }) => {
  const [addons,setAddons]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [filter,setFilter]=useState('All Status'); const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(null); const [form,setForm]=useState({}); const [saving,setSaving]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const emptyAddon={name:'',category:'Food & Dining',price:'',stock:'',total_stock:'',icon:'🎁'};
  const [addForm,setAddForm]=useState(emptyAddon);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setAddons(await api.getAddons({status:filter,search}));}catch(e){setError(e.message);}finally{setLoading(false);}}, [filter,search]);
  useEffect(()=>{load();},[load]);
  const openEdit=(a)=>{setEditing(a);setForm({name:a.name,price:a.price,stock:a.total_stock,category:a.category});};
  const save=async()=>{setSaving(true);try{const u=await api.updateAddon(editing.id,{name:form.name,price:Number(form.price),total_stock:Number(form.stock),category:form.category});setAddons(p=>p.map(a=>a.id===editing.id?{...a,...u}:a));setEditing(null);}catch(e){alert(e.message);}finally{setSaving(false);}};
  const remove=async(id)=>{if(!confirm('Delete?'))return;try{await api.deleteAddon(id);setAddons(p=>p.filter(a=>a.id!==id));}catch(e){alert(e.message);}};
  const saveNew=async()=>{setSaving(true);try{const c=await api.createAddon(addForm);setAddons(p=>[c,...p]);setShowAdd(false);setAddForm(emptyAddon);}catch(e){alert(e.message);}finally{setSaving(false);}};
  return (
    <div>
      <Topbar title="Add-Ons Management" subtitle="Manage inventory and pricing for extra services." user={user}
        action={can(user,'add_addon')&&<button onClick={()=>setShowAdd(true)} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,width:'100%'}}>＋ New Add-On</button>}
      />
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{flex:1,...inputStyle}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'9px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
          {['All Status','Available','Low Stock','Out of Stock'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
          {addons.map(addon=>{
            const pct=addon.total_stock>0?(addon.stock/addon.total_stock)*100:0;
            return (
              <div key={addon.id} style={{background:'#fff',borderRadius:12,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{addon.icon}</div>
                  <StatusBadge status={addon.status}/>
                </div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{addon.name}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginBottom:10}}>{addon.category}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#6b7280',marginBottom:3}}><span>Price</span><span>Stock</span></div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontWeight:700,fontSize:15,color:'#1b3a2d'}}>{fmt(addon.price)}</span>
                  <span style={{fontSize:12,color:'#6b7280'}}>{addon.stock}/{addon.total_stock}</span>
                </div>
                <div style={{background:'#f3f4f6',borderRadius:4,height:5,marginBottom:12,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:stockColor(addon.status),borderRadius:4}}/></div>
                {can(user,'edit_addon')&&(
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <button onClick={()=>openEdit(addon)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12,color:'#374151'}}>✏ Edit</button>
                    {can(user,'delete_addon')&&<button onClick={()=>remove(addon.id)} style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12,color:'#ef4444'}}>🗑</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showAdd&&(
        <Modal title="New Add-On" onClose={()=>{setShowAdd(false);setAddForm(emptyAddon);}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Item Name</label><input value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} style={inputStyle} placeholder="e.g. Room Flowers"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Price (₱)</label><input type="number" value={addForm.price} onChange={e=>setAddForm(f=>({...f,price:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>Icon (emoji)</label><input value={addForm.icon} onChange={e=>setAddForm(f=>({...f,icon:e.target.value}))} style={inputStyle} placeholder="🎁"/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Stock Available</label><input type="number" value={addForm.stock} onChange={e=>setAddForm(f=>({...f,stock:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>Total Stock</label><input type="number" value={addForm.total_stock} onChange={e=>setAddForm(f=>({...f,total_stock:e.target.value}))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>Category</label><select value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>{['Food & Dining','Transportation','Wellness','Events','Amenity','Experience'].map(c=><option key={c}>{c}</option>)}</select></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>{setShowAdd(false);setAddForm(emptyAddon);}} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveNew} disabled={saving||!addForm.name||!addForm.price} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Create Add-On'}</button>
            </div>
          </div>
        </Modal>
      )}
      {editing&&(
        <Modal title="Edit Add-On" onClose={()=>setEditing(null)}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Item Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inputStyle}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Price (₱)</label><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>Total Stock</label><input type="number" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>Category</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>{['Food & Dining','Transportation','Wellness','Events','Amenity','Experience'].map(c=><option key={c}>{c}</option>)}</select></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>setEditing(null)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Users = ({ user }) => {
  const [users,setUsers]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [showAdd,setShowAdd]=useState(false); const [editing,setEditing]=useState(null); const [saving,setSaving]=useState(false);
  const empty={full_name:'',email:'',password:'Admin123',role:'staff',phone:''};
  const [form,setForm]=useState(empty);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setUsers(await api.getUsers());}catch(e){setError(e.message);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();},[load]);
  const openEdit=(u)=>{setEditing(u);setForm({full_name:u.full_name,role:u.role,phone:u.phone||'',is_active:u.is_active});};
  const saveNew=async()=>{setSaving(true);try{const c=await api.createUser(form);setUsers(p=>[c,...p]);setShowAdd(false);setForm(empty);}catch(e){alert(e.message);}finally{setSaving(false);}};
  const saveEdit=async()=>{setSaving(true);try{const u=await api.updateUser(editing.id,form);setUsers(p=>p.map(x=>x.id===editing.id?{...x,...u}:x));setEditing(null);}catch(e){alert(e.message);}finally{setSaving(false);}};
const deactivate=async(id)=>{if(!confirm('Permanently delete this staff account? This cannot be undone.'))return;try{await api.deleteUser(id);setUsers(p=>p.filter(u=>u.id!==id));}catch(e){alert(e.message);}};  const RC={admin:'#7c3aed',manager:'#2563eb',staff:'#b87a00'};
  return (
    <div>
      <Topbar title="User Management" subtitle="Manage staff accounts and role assignments." user={user}
        action={<button onClick={()=>setShowAdd(true)} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,width:'100%'}}>+ Add Staff</button>}
      />
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
        {['admin','manager','staff'].map(role=>{
          const count=users.filter(u=>u.role===role&&u.is_active).length;
          return (
            <div key={role} style={{background:'#fff',borderRadius:12,padding:'16px 20px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:RC[role]+'20',display:'flex',alignItems:'center',justifyContent:'center',color:RC[role]}}>
                <AppIcon name={role==='admin' ? 'admin' : role==='manager' ? 'manager' : 'staff'} size={20} color={RC[role]} />
              </div>
              <div><div style={{fontSize:11,color:'#6b7280',textTransform:'capitalize',marginBottom:2}}>{role}s</div><div style={{fontSize:24,fontWeight:700,color:RC[role]}}>{count}</div></div>
            </div>
          );
        })}
      </div>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9fafb'}}>{['Staff Member','Email','Phone','Role','Status','Actions'].map(h=><th key={h} style={{padding:'12px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
            <tbody>{users.map(u=>(
              <tr key={u.id} style={{borderTop:'1px solid #f3f4f6',opacity:u.is_active?1:0.5}}>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:RC[u.role]+'30',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:RC[u.role]}}>{(u.full_name||'?').charAt(0).toUpperCase()}</div>
                    <span style={{fontWeight:600}}>{u.full_name}</span>
                  </div>
                </td>
                <td style={{padding:'12px 16px',color:'#6b7280'}}>{u.email}</td>
                <td style={{padding:'12px 16px',color:'#6b7280'}}>{u.phone||'—'}</td>
                <td style={{padding:'12px 16px'}}><StatusBadge status={u.role}/></td>
                <td style={{padding:'12px 16px'}}><StatusBadge status={u.is_active?'Active':'Inactive'}/></td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>openEdit(u)} style={{background:'#f0fdf4',color:'#2d6a4f',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Edit</button>
                    {u.is_active&&u.id!==user.id&&<button onClick={()=>deactivate(u.id)} style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:'#ef4444'}}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showAdd&&(
        <Modal title="Add New Staff Account" onClose={()=>{setShowAdd(false);setForm(empty);}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Full Name</label><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} style={inputStyle} placeholder="Juan Dela Cruz"/></div>
            <div><label style={labelStyle}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={inputStyle} placeholder="juan@verdanthaven.com"/></div>
            <div><label style={labelStyle}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inputStyle} placeholder="+63 9XX XXX XXXX"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}><option value="staff">Staff (Front Desk)</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
              <div><label style={labelStyle}>Default Password</label><PasswordField value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Enter temporary password"/></div>
            </div>
            <div style={{background:'#fef9c3',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#b87a00'}}>💡 Staff should change their password after first login.</div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>{setShowAdd(false);setForm(empty);}} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveNew} disabled={saving} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Creating…':'Create Account'}</button>
            </div>
          </div>
        </Modal>
      )}
      {editing&&(
        <Modal title={`Edit — ${editing.full_name}`} onClose={()=>setEditing(null)}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Full Name</label><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}><option value="staff">Staff (Front Desk)</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>setEditing(null)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Schedule = ({ user }) => {
  const [schedules,setSchedules]=useState([]); const [staffList,setStaffList]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [week,setWeek]=useState(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());return d.toISOString().split('T')[0];});
  const [showAdd,setShowAdd]=useState(false); const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({staff_id:'',shift_date:'',shift_type:'Morning',notes:''});
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const[s,st]=await Promise.all([api.getSchedules(week),api.getScheduleStaff()]);setSchedules(s);setStaffList(st);}catch(e){setError(e.message);}finally{setLoading(false);}}, [week]);
  useEffect(()=>{load();},[load]);
  const addShift=async()=>{setSaving(true);try{const c=await api.createSchedule(form);setSchedules(p=>[...p,c]);setShowAdd(false);setForm({staff_id:'',shift_date:'',shift_type:'Morning',notes:''});}catch(e){alert(e.message);}finally{setSaving(false);}};
  const removeShift=async(id)=>{try{await api.deleteSchedule(id);setSchedules(p=>p.filter(s=>s.id!==id));}catch(e){alert(e.message);}};
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(d.getDate()+i);return d.toISOString().split('T')[0];});
  const SHIFTS=['Morning','Afternoon','Night'];
  const TIMES={Morning:'6AM–2PM',Afternoon:'2PM–10PM',Night:'10PM–6AM'};
  return (
    <div>
      <Topbar title="Employee Schedule" subtitle="Assign and manage staff shifts for the week." user={user}
        action={can(user,'assign_schedule')&&<button onClick={()=>setShowAdd(true)} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,width:'100%'}}>＋ Assign Shift</button>}
      />
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button onClick={()=>{const d=new Date(week);d.setDate(d.getDate()-7);setWeek(d.toISOString().split('T')[0]);}} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13}}>← Prev</button>
        <div style={{fontWeight:600,fontSize:14}}>Week of {new Date(week).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}</div>
        <button onClick={()=>{const d=new Date(week);d.setDate(d.getDate()+7);setWeek(d.toISOString().split('T')[0]);}} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13}}>Next →</button>
      </div>
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {!loading&&!error&&(
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:900}}>
            <thead><tr style={{background:'#f9fafb'}}>
              <th style={{padding:'12px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12,width:110}}>Shift</th>
              {weekDays.map(d=><th key={d} style={{padding:'12px 8px',textAlign:'center',color:'#6b7280',fontWeight:600,fontSize:12}}>
                <div>{new Date(d).toLocaleDateString('en-PH',{weekday:'short'})}</div>
                <div style={{fontSize:11,fontWeight:400}}>{new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</div>
              </th>)}
            </tr></thead>
            <tbody>{SHIFTS.map(shift=>(
              <tr key={shift} style={{borderTop:'1px solid #f3f4f6'}}>
                <td style={{padding:'12px 16px'}}><StatusBadge status={shift}/><div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>{TIMES[shift]}</div></td>
                {weekDays.map(day=>{
                  const ds=schedules.filter(s=>s.shift_date===day&&s.shift_type===shift);
                  return (
                    <td key={day} style={{padding:8,verticalAlign:'top',borderLeft:'1px solid #f3f4f6'}}>
                      {ds.map(s=>(
                        <div key={s.id} style={{background:'#f0fdf4',borderRadius:6,padding:'6px 8px',marginBottom:4,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div><div style={{fontWeight:600,fontSize:12,color:'#1b3a2d'}}>{s.staff_name}</div><div style={{fontSize:10,color:'#6b7280',textTransform:'capitalize'}}>{s.staff_role}</div></div>
                          {can(user,'assign_schedule')&&<button onClick={()=>removeShift(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:14}}>×</button>}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showAdd&&(
        <Modal title="Assign Shift" onClose={()=>setShowAdd(false)}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Staff Member</label><select value={form.staff_id} onChange={e=>setForm(f=>({...f,staff_id:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}><option value="">Select staff...</option>{staffList.map(s=><option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}</select></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Date</label><input type="date" value={form.shift_date} onChange={e=>setForm(f=>({...f,shift_date:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>Shift</label><select value={form.shift_type} onChange={e=>setForm(f=>({...f,shift_type:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>{SHIFTS.map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label style={labelStyle}>Notes (optional)</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inputStyle} placeholder="Special instructions..."/></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>setShowAdd(false)} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={addShift} disabled={saving||!form.staff_id||!form.shift_date} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving?'Saving…':'Assign Shift'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Audit = ({ user }) => {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(null);
  const [date,setDate]=useState(()=>new Date().toISOString().split('T')[0]);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setData(await api.getDailyAudit(date));}catch(e){setError(e.message);}finally{setLoading(false);}}, [date]);
  useEffect(()=>{load();},[load]);
  return (
    <div>
      <Topbar title="Daily Audit" subtitle="Review daily operations, check-ins, and staff activity." user={user}
        action={<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13,outline:'none',width:'100%'}}/>}
      />
      {loading&&<Spinner/>} {error&&<ErrorMsg msg={error} onRetry={load}/>}
      {data&&!loading&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
            {[{label:'Check-ins Today',value:data.summary.total_check_ins,icon:'🏨',color:'#2d6a4f'},
              {label:'Check-outs Today',value:data.summary.total_check_outs,icon:'🚪',color:'#2563eb'},
              {label:'Revenue Collected',value:fmt(data.summary.total_collected),icon:'💰',color:'#c8973a'}].map(s=>(
              <div key={s.label} style={{background:'#fff',borderRadius:12,padding:'18px 20px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div><div style={{color:'#6b7280',fontSize:12,marginBottom:6}}>{s.label}</div><div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div></div>
                <div style={{fontSize:28}}>{s.icon}</div>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
            {[{title:'🏨 Check-ins',items:data.check_ins},{title:'🚪 Check-outs',items:data.check_outs}].map(({title,items})=>(
              <div key={title} style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>{title}</div>
                {items.length===0?<p style={{color:'#9ca3af',fontSize:13}}>None today.</p>:items.map(r=>(
                  <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                    <div><div style={{fontWeight:600,fontSize:13}}>{r.guest_name}</div><div style={{fontSize:11,color:'#6b7280'}}>{r.room_name} · {r.reservation_no}</div></div>
                    <StatusBadge status={r.status}/>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',marginBottom:20}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>👥 Staff Activity</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9fafb'}}>{['Staff','Role','Reservations Handled'].map(h=><th key={h} style={{padding:'8px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}</tr></thead>
              <tbody>{data.staff_activity.map(s=>(
                <tr key={s.full_name} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'10px 16px',fontWeight:600}}>{s.full_name}</td>
                  <td style={{padding:'10px 16px'}}><StatusBadge status={s.role}/></td>
                  <td style={{padding:'10px 16px',fontWeight:700,color:'#2d6a4f'}}>{s.reservations_handled}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>💳 Payment Breakdown</div>
            {data.payments.length===0?<p style={{color:'#9ca3af',fontSize:13}}>No payments today.</p>:data.payments.map(p=>(
              <div key={p.payment_method} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #f3f4f6'}}>
                <div><div style={{fontWeight:600}}>{p.payment_method||'Unknown'}</div><div style={{fontSize:12,color:'#6b7280'}}>{p.total_transactions} transaction{p.total_transactions>1?'s':''}</div></div>
                <div style={{fontWeight:700,fontSize:16,color:'#2d6a4f'}}>{fmt(p.total_collected)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Approvals = ({ user }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCustomers(await api.getPendingCustomers()); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id, status) => {
    try {
      await api.approveCustomer(id, status);
      setCustomers(p => p.filter(c => c.id !== id));
      alert(status === 'Approved' ? '✅ Account approved!' : '❌ Account rejected.');
    } catch(e) { alert(e.message); }
  };

  return (
    <div>
      <Topbar title="Account Approvals" subtitle="Review and approve customer registrations." user={user}/>
      {loading && <Spinner/>}
      {error && <ErrorMsg msg={error} onRetry={load}/>}
      {!loading && !error && customers.length === 0 && (
        <div style={{textAlign:'center',padding:60,color:'#9ca3af'}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:600}}>No pending approvals</div>
        </div>
      )}
      {!loading && !error && customers.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb'}}>
                {['Customer','Email','Phone','Sex','ID','Registered','Actions'].map(h =>
                  <th key={h} style={{padding:'12px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>{c.full_name}</td>
                  <td style={{padding:'12px 16px',color:'#6b7280'}}>{c.email}</td>
                  <td style={{padding:'12px 16px',color:'#6b7280'}}>{c.phone||'—'}</td>
                  <td style={{padding:'12px 16px',color:'#6b7280'}}>{c.sex||'—'}</td>
                  <td style={{padding:'12px 16px'}}>
                    {c.valid_id_url
                      ? <IdPreviewThumb src={c.valid_id_url} alt={`${c.full_name} valid ID`} />
                      : <label style={{display:'inline-flex',alignItems:'center',gap:8,color:'#2d6a4f',fontWeight:600,fontSize:12,cursor:'pointer'}}>
                          <span>{uploadingId === c.id ? 'Uploading...' : 'Upload ID'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{display:'none'}}
                            onChange={e => attachId(c.id, e.target.files?.[0])}
                          />
                        </label>
                    }
                  </td>
                  <td style={{padding:'12px 16px',color:'#6b7280',fontSize:12}}>
                    {c.created_at?.split('T')[0]||'—'}
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>approve(c.id,'Approved')}
                        style={{background:'#dcfce7',color:'#1a7f4b',border:'none',borderRadius:6,
                          padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>
                        ✅ Approve
                      </button>
                      <button onClick={()=>approve(c.id,'Rejected')}
                        style={{background:'#fee2e2',color:'#ef4444',border:'none',borderRadius:6,
                          padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>
                        ❌ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Housekeeping = ({ user }) => {
  const canManage = canManageHousekeeping(user);
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [form, setForm] = useState({ room_id: '', assigned_staff_id: '', status: 'Pending', notes: '', due_date: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskData, roomData, staffData] = await Promise.all([
        api.getHousekeepingTasks({ status: filter }),
        api.getRooms({}),
        canManage ? api.getHousekeepingStaff() : Promise.resolve([]),
      ]);
      setTasks(taskData);
      setRooms(roomData);
      setStaffList(staffData);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, canManage]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const resetForm = () => {
    setEditingTask(null);
    setForm({ room_id: '', assigned_staff_id: '', status: 'Pending', notes: '', due_date: '' });
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setForm({
      room_id: task.room_id || '',
      assigned_staff_id: task.assigned_staff_id || '',
      status: task.status || 'Pending',
      notes: task.notes || '',
      due_date: task.due_date || '',
    });
    setShowModal(true);
  };

  const saveTask = async () => {
    if (!form.room_id && !editingTask?.reservation_id) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!canManage) return;
      if (editingTask) {
        const updated = await api.updateHousekeepingTask(editingTask.id, payload);
        setTasks(prev => prev.map(task => task.id === editingTask.id ? { ...task, ...updated } : task));
      } else {
        const created = await api.createHousekeepingTask(payload);
        setTasks(prev => [created, ...prev]);
      }
      setShowModal(false);
      resetForm();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (task, status) => {
    setSaving(true);
    try {
      const updated = await api.updateHousekeepingTask(task.id, { status });
      setTasks(prev => prev.map(item => item.id === task.id ? { ...item, ...updated } : item));
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredTasks = tasks;
  const counts = {
    total: filteredTasks.length,
    pending: filteredTasks.filter(t => t.status === 'Pending').length,
    inProgress: filteredTasks.filter(t => t.status === 'In Progress').length,
    completed: filteredTasks.filter(t => t.status === 'Completed').length,
  };

  return (
    <div>
      <Topbar
        title="Housekeeping"
        subtitle="Track which cleaner is assigned to each room in real time."
        user={user}
        action={canManage ? <button onClick={openCreate} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,width:'100%'}}>+ Assign Room</button> : null}
      />
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
        <MetricCard label="Tasks" value={counts.total} icon="housekeeping" bg="#1b3a2d" accent="#1b3a2d" />
        <MetricCard label="Pending" value={counts.pending} icon="arrival" bg="#b87a00" accent="#92400e" />
        <MetricCard label="In Progress" value={counts.inProgress} icon="checkin" bg="#2563eb" accent="#1d4ed8" />
        <MetricCard label="Completed" value={counts.completed} icon="confirmed" bg="#1a7f4b" accent="#1a7f4b" />
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:'9px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
          {['All','Pending','In Progress','Completed','Blocked'].map(s => <option key={s}>{s}</option>)}
        </select>
        <div style={{fontSize:12,color:'#6b7280'}}>
          {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Live updates every 10 seconds'}
        </div>
      </div>
      {loading && <Spinner/>}
      {error && <ErrorMsg msg={error} onRetry={load}/>}
      {!loading && !error && filteredTasks.length === 0 && (
        <div style={{textAlign:'center',padding:60,color:'#9ca3af',background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <div style={{fontSize:18,fontWeight:600,marginBottom:6}}>No housekeeping tasks yet</div>
          <div style={{fontSize:13}}>Completed reservations will appear here automatically, and managers can assign rooms manually.</div>
        </div>
      )}
      {!loading && !error && filteredTasks.length > 0 && (
        <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb'}}>
                {['Room','Reservation','Cleaner','Status','Due','Notes','Actions'].map(h => <th key={h} style={{padding:'12px 16px',textAlign:'left',color:'#6b7280',fontWeight:600,fontSize:12}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id} style={{borderTop:'1px solid #f3f4f6'}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{fontWeight:700}}>{task.room_name || 'Room'}</div>
                    <div style={{fontSize:11,color:'#6b7280'}}>{task.room_number || '—'} · {task.room_type || '—'}</div>
                  </td>
                  <td style={{padding:'12px 16px',color:'#6b7280'}}>
                    <div style={{fontWeight:600,color:'#111827'}}>{task.reservation_no || 'Manual task'}</div>
                    <div style={{fontSize:11}}>{task.reservation_status || 'N/A'}</div>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    {task.assigned_staff_name
                      ? <div><div style={{fontWeight:600}}>{task.assigned_staff_name}</div><div style={{fontSize:11,color:'#6b7280',textTransform:'capitalize'}}>{task.assigned_staff_role}</div></div>
                      : <StatusBadge status="Pending" />
                    }
                  </td>
                  <td style={{padding:'12px 16px'}}><StatusBadge status={task.status} /></td>
                  <td style={{padding:'12px 16px',color:'#6b7280'}}>{formatDateOnly(task.due_date || task.check_out)}</td>
                  <td style={{padding:'12px 16px',color:'#6b7280',maxWidth:240}}>{task.notes || '—'}</td>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {canManage && <button onClick={() => openEdit(task)} style={{background:'#f0fdf4',color:'#2d6a4f',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Edit</button>}
                      {!canManage && task.assigned_staff_id === user?.id && task.status !== 'Completed' && (
                        <>
                          {task.status !== 'In Progress' && <button onClick={() => updateStatus(task, 'In Progress')} disabled={saving} style={{background:'#dbeafe',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Start</button>}
                          <button onClick={() => updateStatus(task, 'Completed')} disabled={saving} style={{background:'#dcfce7',color:'#1a7f4b',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Done</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && canManage && (
        <Modal title={editingTask ? 'Edit Housekeeping Task' : 'Assign Housekeeping Task'} onClose={() => { setShowModal(false); resetForm(); }}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={labelStyle}>Room</label><select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} style={{...inputStyle,cursor:'pointer'}}><option value="">Select room...</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.room_number} - {room.name}</option>)}</select></div>
            <div><label style={labelStyle}>Assigned Cleaner</label><select value={form.assigned_staff_id} onChange={e => setForm(f => ({ ...f, assigned_staff_id: e.target.value }))} style={{...inputStyle,cursor:'pointer'}}><option value="">Saina only</option>{staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.full_name} ({staff.role})</option>)}</select></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={labelStyle}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{...inputStyle,cursor:'pointer'}}>{['Pending','In Progress','Completed','Blocked'].map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={labelStyle}>Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{...inputStyle,resize:'vertical'}} placeholder="Cleaning instructions, special care, etc."/></div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{background:'none',border:'1px solid #e5e7eb',borderRadius:7,padding:'9px 20px',cursor:'pointer',fontSize:13}}>Cancel</button>
              <button onClick={saveTask} disabled={saving || !form.room_id} style={{background:'#1b3a2d',color:'#fff',border:'none',borderRadius:7,padding:'9px 22px',cursor:'pointer',fontSize:13,fontWeight:600}}>{saving ? 'Saving…' : (editingTask ? 'Save Changes' : 'Assign Task')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

function App() {
  const [user,setUser]=useState(null); const [active,setActive]=useState(null); const [checking,setChecking]=useState(true);
  useEffect(()=>{
    if(api.getToken()){api.getMe().then(u=>{if(['admin','manager','staff'].includes(u.role)){setUser(u);setActive(NAV_BY_ROLE[u.role][0]);}else{api.clearToken();}}).catch(()=>api.clearToken()).finally(()=>setChecking(false));}
    else{setChecking(false);}
  },[]);
  const handleLogin=(u)=>{setUser(u);setActive(NAV_BY_ROLE[u.role][0]);};
  const handleLogout=()=>{api.logout();setUser(null);setActive(null);};
const pages={dashboard:<DashboardHome user={user} setActive={setActive}/>,reports:<Dashboard user={user}/>,rooms:<Rooms user={user}/>,housekeeping:<Housekeeping user={user}/>,reservations:<Reservations user={user}/>,customers:<Customers user={user}/>,'add-ons':<AddOns user={user}/>,users:<Users user={user}/>,audit:<Audit user={user}/>,approvals:<Approvals user={user}/>};
  if(checking)return(<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1b3a2d'}}><div style={{color:'#fff',fontSize:18,fontFamily:"'Playfair Display',serif"}}>🌿 Loading…</div></div>);
  return(
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
      {!user?<Login onLogin={handleLogin}/>:(
        <div style={{display:'flex',fontFamily:"'DM Sans',sans-serif",background:'#f7f8f9',minHeight:'100vh'}}>
          <Sidebar active={active} setActive={setActive} user={user} onLogout={handleLogout}/>
          <main style={{marginLeft:210,flex:1,padding:'28px 32px',maxWidth:'calc(100vw - 210px)'}}>
            <div style={{maxWidth:1200}}>{active&&pages[active]}</div>
          </main>
        </div>
      )}
    </>
  );
}
export default App;

