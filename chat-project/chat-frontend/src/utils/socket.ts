let socket: WebSocket | null = null;

export const connectWebSocket = (url: string, onMessage: (data: any) => void) => {
  socket = new WebSocket(url);
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    onMessage(message);
  };
};

export const sendWebSocketMessage = (message: any) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

export const closeWebSocket = () => {
  if (socket) {
    socket.close();
  }
};
