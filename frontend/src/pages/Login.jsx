import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function LoginBackdrop() {
  const canvasRef = useRef(null);
  const pointer = useRef({ x: 0.55, y: 0.4, tx: 0.55, ty: 0.4 });
  const reducedMotion = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const nodes = Array.from({ length: 52 }, (_, i) => {
      const seed = i * 1.618;
      return {
        x: (Math.sin(seed * 3.1) * 0.5 + 0.5) * 0.92 + 0.04,
        y: (Math.cos(seed * 2.4) * 0.5 + 0.5) * 0.86 + 0.07,
        r: 1.6 + (i % 5) * 0.65,
        phase: seed,
        speed: 0.15 + (i % 7) * 0.04,
      };
    });

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e) {
      pointer.current.tx = e.clientX / w;
      pointer.current.ty = e.clientY / h;
    }

    function onLeave() {
      pointer.current.tx = 0.55;
      pointer.current.ty = 0.4;
    }

    function frame(t) {
      const time = t * 0.001;
      const p = pointer.current;
      p.x += (p.tx - p.x) * 0.06;
      p.y += (p.ty - p.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // Soft depth wash that tracks the pointer
      const gx = p.x * w;
      const gy = p.y * h;
      const wash = ctx.createRadialGradient(gx, gy, 40, gx, gy, Math.max(w, h) * 0.72);
      wash.addColorStop(0, 'rgba(44, 183, 223, 0.3)');
      wash.addColorStop(0.35, 'rgba(15, 159, 138, 0.14)');
      wash.addColorStop(1, 'rgba(38, 48, 119, 0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      const positions = nodes.map((n, i) => {
        const drift = reducedMotion.current ? 0 : Math.sin(time * n.speed + n.phase) * 0.012;
        const pullX = (p.x - 0.5) * 0.04 * ((i % 3) - 1);
        const pullY = (p.y - 0.5) * 0.035 * ((i % 4) - 1.5);
        return {
          x: (n.x + drift + pullX) * w,
          y: (n.y + Math.cos(time * n.speed * 0.8 + n.phase) * (reducedMotion.current ? 0 : 0.01) + pullY) * h,
          r: n.r,
        };
      });

      // Connection lattice
      ctx.lineWidth = 1.15;
      for (let i = 0; i < positions.length; i += 1) {
        for (let j = i + 1; j < positions.length; j += 1) {
          const a = positions[i];
          const b = positions[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 190) continue;
          const alpha = (1 - dist / 190) * 0.38;
          ctx.strokeStyle = `rgba(38, 48, 119, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const pt of positions) {
        const near = Math.hypot(pt.x - gx, pt.y - gy);
        const boost = Math.max(0, 1 - near / 300);
        ctx.beginPath();
        ctx.fillStyle = `rgba(44, 183, 223, ${0.42 + boost * 0.5})`;
        ctx.arc(pt.x, pt.y, pt.r + boost * 2.1, 0, Math.PI * 2);
        ctx.fill();
        if (boost > 0.15) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(15, 159, 138, ${boost * 0.28})`;
          ctx.arc(pt.x, pt.y, pt.r + 7 + boost * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cursor comet trail ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(44, 183, 223, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.arc(gx, gy, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(38, 48, 119, 0.22)';
      ctx.arc(gx, gy, 98, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="login-stage" aria-hidden="true">
      <div className="login-aurora login-aurora-a" />
      <div className="login-aurora login-aurora-b" />
      <div className="login-aurora login-aurora-c" />
      <div className="login-grid" />
      <canvas ref={canvasRef} className="login-network" />
      <div className="login-vignette" />
    </div>
  );
}

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    login: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login({ login: form.login, password: form.password });
      navigate(user?.role === 'superadmin' ? '/super-admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <LoginBackdrop />

      <div className="login-shell">
        <div className="login-hero">
          <img src="/practo-logo.svg" alt="Practo" className="login-logo" />
          <p className="login-kicker">Clinic outreach, orchestrated</p>
          <h1 className="login-title">Sales Automation</h1>
          <p className="login-lede">
            Sign in to run lead discovery, commercial proposals, and AI pilots across WhatsApp,
            Gmail, and calls.
          </p>
        </div>

        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-card-head">
            <h2>Welcome back</h2>
            <p>Use your user ID or email and password.</p>
          </div>

          <label className="field">
            User ID / Email
            <input
              required
              name="username"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username or email"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
