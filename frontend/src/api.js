export async function request(url, options = {}) {
  const token = sessionStorage.getItem('nexo_session');
  const response = await fetch('/api' + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/auth/')) {
      sessionStorage.removeItem('nexo_session');
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(data.message || 'Não foi possível concluir o pedido.');
  }
  return data;
}
