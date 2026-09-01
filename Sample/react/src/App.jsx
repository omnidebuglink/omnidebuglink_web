import { useEffect, useRef, useState } from 'react';
import { OmniDebugLink } from '@omnidebuglink/web';

const WS_BASE = 'wss://api.omnidebuglink.dev/ws?token=';
// web-react 设备的独立 token(与网页 sample 分席,避免 4000 互踢)
const DEFAULT_TOKEN = 'odl-dev-7ed53c180bb20311dd641c26e447297e10c998fdfcefe8a90cd33efe37cdefef';

// Shadow DOM web component:内联样式,顺带当 screenshot shadow 展平(0.1.4)的验证目标
class ShadowCard extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <div style="border:1px dashed #2a2d3a;border-radius:4px;padding:10px">
        <button id="sb" style="background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:4px;font-size:13px;cursor:pointer">Shadow Button</button>
        <span style="color:#6b7280;font-size:12px;margin-left:10px">shadow DOM 内(ui_traverse 可见、screenshot 已展平)</span>
      </div>`;
    shadow.querySelector('#sb').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('shadow-click', { bubbles: true }));
    });
  }
}
customElements.define('shadow-card', ShadowCard);

const stamp = () => new Date().toLocaleTimeString();

export default function App() {
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [state, setState] = useState('stopped');
  const [actions, setActions] = useState(true);
  const [logs, setLogs] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ text: '', email: '', option: '' });
  const [range, setRange] = useState(50);
  const shadowRef = useRef(null);

  const pushLog = (msg) => setLogs((l) => [...l.slice(-99), `[${stamp()}] ${msg}`]);

  // 状态轮询展示
  useEffect(() => {
    const t = setInterval(() => setState(OmniDebugLink.state), 1000);
    return () => clearInterval(t);
  }, []);

  // shadow 自定义事件 + 卸载时断开
  useEffect(() => {
    const el = shadowRef.current;
    const onShadow = () => pushLog('Shadow button clicked');
    el?.addEventListener('shadow-click', onShadow);
    return () => {
      el?.removeEventListener('shadow-click', onShadow);
      OmniDebugLink.stop();
    };
  }, []);

  const connect = () => {
    OmniDebugLink.actionsEnabled = actions;
    OmniDebugLink.start(WS_BASE + token.trim());
    pushLog('连接请求已发送');
  };
  const disconnect = () => {
    OmniDebugLink.stop();
    pushLog('已断开');
  };
  const toggleActions = (v) => {
    setActions(v);
    OmniDebugLink.actionsEnabled = v;
    pushLog(`actionsEnabled = ${v}`);
  };

  const connected = state === 'connected';

  return (
    <>
      <h1>OmniDebugLink <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>— React Sample</span></h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px' }}>
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="dot" />{state}
        </span>
        {connected && (
          <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
            lib {OmniDebugLink.LIB_VERSION} · {token.slice(0, 12)}…
          </span>
        )}
      </div>

      <h2>连接</h2>
      <div className="card">
        <div className="row">
          <button data-testid="btn-connect" onClick={connect}>连接</button>
          <button className="danger" data-testid="btn-disconnect" onClick={disconnect}>断开</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" checked={actions} onChange={(e) => toggleActions(e.target.checked)} /> actionsEnabled
          </label>
        </div>
        <label style={{ marginTop: 8 }}>设备 token(web-react,与网页 sample 分席)</label>
        <input data-testid="input-token" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>

      <h2>事件日志</h2>
      <div className="card">
        <pre data-testid="react-log">{logs.join('\n')}</pre>
      </div>

      <h2>受控表单(input_text 目标)</h2>
      <div className="card">
        <div className="grid">
          <div>
            <label>文本(受控)</label>
            <input data-testid="react-text" placeholder="React onChange" value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div>
            <label>Email</label>
            <input data-testid="react-email" type="email" placeholder="test@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label>下拉</label>
            <select data-testid="react-select" value={form.option}
              onChange={(e) => setForm({ ...form, option: e.target.value })}>
              <option value="">请选择</option>
              <option value="a">选项 A</option>
              <option value="b">选项 B</option>
            </select>
          </div>
          <div>
            <label>滑块(受控,swipe 目标)</label>
            <input data-testid="react-range" type="range" min="0" max="100" value={range} style={{ width: '100%' }}
              onChange={(e) => setRange(Number(e.target.value))} />
            <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{range}</span>
          </div>
        </div>
      </div>

      <h2>按钮 & 动态列表(ui_click / find_objects 目标)</h2>
      <div className="card">
        <div className="row">
          <button data-testid="btn-primary" onClick={() => pushLog('Primary clicked')}>Primary</button>
          <button className="secondary" data-testid="btn-secondary" onClick={() => pushLog('Secondary clicked')}>Secondary</button>
          <button className="danger" data-testid="btn-danger" onClick={() => pushLog('Delete clicked')}>Delete</button>
          <button className="secondary" data-testid="btn-add" onClick={() => {
            setItems((arr) => [...arr, `Item #${arr.length + 1}`]);
            pushLog(`+ 列表项(共 ${items.length + 1})`);
          }}>+ 添加列表项</button>
          <button className="secondary" data-testid="btn-clear" onClick={() => { setItems([]); pushLog('列表已清空'); }}>清空</button>
        </div>
        <ul data-testid="react-list">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      </div>

      <h2>Shadow DOM</h2>
      <div className="card">
        <shadow-card ref={shadowRef} />
      </div>
    </>
  );
}
