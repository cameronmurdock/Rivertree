import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const API_BASE = 'https://guestbook-worker.gen.gratis.workers.dev/'; // Adjust if needed

function ShiftChecklist() {
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(API_BASE + 'shifts')
      .then(res => res.json())
      .then(data => setShifts(data.shifts || []));
  }, []);

  useEffect(() => {
    if (!selectedShift) return;
    setLoading(true);
    fetch(API_BASE + `shift-tasks?shift=${selectedShift}`)
      .then(res => res.json())
      .then(data => {
        setTasks(data.tasks || []);
        setLoading(false);
      });
  }, [selectedShift]);

  const handleCheck = (id) => {
    setTasks(tasks => tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleComplete = async () => {
    setSaving(true);
    setStatus('');
    const updates = tasks.map(t => ({ taskId: t.id, completed: !!t.completed }));
    const resp = await fetch(API_BASE + 'shift-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
    const result = await resp.json();
    if (result.results && result.results.every(r => r.success)) {
      setStatus('All tasks saved!');
    } else {
      setStatus('Some tasks failed to save.');
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#181f2a', borderRadius: 16, padding: 32, color: '#fff', boxShadow: '0 4px 32px #0002' }}>
      <h2 style={{ fontWeight: 700, fontSize: 28, color: '#6ee7b7', marginBottom: 16 }}>Shift Checklist</h2>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 500, marginRight: 12 }}>Select Shift:</label>
        <select
          value={selectedShift}
          onChange={e => setSelectedShift(e.target.value)}
          style={{ padding: 10, borderRadius: 6, fontSize: 16 }}
        >
          <option value="">-- Choose a shift --</option>
          {shifts.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div style={{ color: '#6ee7b7' }}>Loading tasks...</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tasks.map(task => (
            <li key={task.id} style={{ display: 'flex', alignItems: 'center', background: '#232c3b', marginBottom: 12, borderRadius: 8, padding: 12 }}>
              <input
                type="checkbox"
                checked={!!task.completed}
                onChange={() => handleCheck(task.id)}
                style={{ width: 22, height: 22, marginRight: 18 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{task.name}</div>
                <div style={{ fontSize: 14, color: '#9ca3af' }}>{task.points ? `${task.points} pts` : ''} {task.person ? `• ${task.person}` : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={handleComplete}
        disabled={saving || !tasks.length}
        style={{ width: '100%', padding: '16px 0', marginTop: 24, background: '#34d399', color: '#181f2a', fontWeight: 700, fontSize: 18, border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving...' : 'Complete Shift'}
      </button>
      {status && <div style={{ marginTop: 18, fontWeight: 500, color: status.includes('All') ? '#6ee7b7' : '#f87171' }}>{status}</div>}
    </div>
  );
}

const domContainer = document.querySelector('#root');
const root = ReactDOM.createRoot(domContainer);
root.render(<ShiftChecklist />);
