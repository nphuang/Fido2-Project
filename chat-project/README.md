## Prerequisites

Create a file `/chat-backend/.env` with the following content:

```
PORT=4000
HTTPS_PORT=443
CORS_ORIGIN=https://localhost:5173
SSL_KEY_PATH=./xxx-key.pem
SSL_CERT_PATH=./xxx.pem
```

Since HTTPS is required, use `mkcert` to generate the two .pem files and place them in both `/chat-backend` and `/chat-frontend`.