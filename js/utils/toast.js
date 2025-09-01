// toast/notification system
export function toast(msg, duration=2000){
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded shadow-lg opacity-0 transition-opacity duration-300';
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.style.opacity='1');
  setTimeout(()=>{ el.style.opacity='0'; el.remove(); }, duration);
}
