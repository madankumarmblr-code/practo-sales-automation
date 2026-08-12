import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../utils/format';

const empty = {
  name: '',
  email: '',
  phone: '',
  company: '',
  title: '',
  tags: '',
  notes: '',
};

export default function Contacts() {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(search = q) {
    setLoading(true);
    try {
      setContacts(await api.getContacts(search));
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(c) {
    setEditing(c.id);
    setForm({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      title: c.title || '',
      tags: (c.tags || []).join(', '),
      notes: c.notes || '',
    });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (editing) {
        await api.updateContact(editing, payload);
        toast('Contact updated');
      } else {
        await api.createContact(payload);
        toast('Contact created');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this contact?')) return;
    try {
      await api.deleteContact(id);
      toast('Contact deleted');
      load();
    } catch (err) {
      toast(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Contacts</h1>
          <p>People and clinic stakeholders linked to your sales pipeline.</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add contact
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search name, email, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
          />
          <button type="button" className="btn btn-secondary" onClick={() => load(q)}>
            Search
          </button>
        </div>

        {loading ? (
          <div className="muted">Loading contacts…</div>
        ) : contacts.length === 0 ? (
          <div className="empty">No contacts found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email / Phone</th>
                  <th>Tags</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {c.title}
                      </div>
                    </td>
                    <td>{c.company}</td>
                    <td>
                      <div>{c.email}</div>
                      <div className="muted">{c.phone}</div>
                    </td>
                    <td>
                      {(c.tags || []).map((t) => (
                        <span key={t} className="badge badge-teal" style={{ marginRight: 4 }}>
                          {t}
                        </span>
                      ))}
                    </td>
                    <td>{formatDate(c.updated_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => remove(c.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>{editing ? 'Edit contact' : 'New contact'}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <form className="form-grid" onSubmit={save}>
              <div className="form-grid two">
                <label className="field">
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Title
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="field">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                Company
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </label>
              <label className="field">
                Tags (comma separated)
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </label>
              <label className="field">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Save contact
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
