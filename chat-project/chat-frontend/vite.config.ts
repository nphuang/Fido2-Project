import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // server: {
  //   port: 5173, // 指定自訂的port
  // },
  server: {
    https: {
      key: './localhost-key.pem',
      cert: './localhost.pem',
    },
    host: 'localhost',
    port: 5173,
    hmr: {
      protocol: 'wss', // 使用 WebSocket 安全协议
      host: 'localhost',
    },
  },

})
