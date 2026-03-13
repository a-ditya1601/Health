# Environment Configuration

This project runs as four separate services:

1. `frontend` on `http://localhost:3000`
2. `backend` on `http://localhost:5000`
3. `ai-service` on `http://localhost:8000`
4. `blockchain` for contract compilation and deployment

## 1. Frontend

Create `frontend/.env.local` from `frontend/.env.local.example`.

Required values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Install and run:

```bash
cd frontend
npm install
npm run dev
```

## 2. Backend

Create `backend/.env` from `backend/.env.example`.

Local demo mode:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
BLOCKCHAIN_MODE=mock
AI_SERVICE_URL=http://localhost:8000/api/summarize
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
PINATA_JWT=
```

Polygon relayer mode:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
BLOCKCHAIN_MODE=contract
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your-key
HEALTH_RECORD_CONTRACT_ADDRESS=0xYourDeployedHealthRecordContract
RELAYER_PRIVATE_KEY=your-relayer-private-key
AI_SERVICE_URL=http://localhost:8000/api/summarize
IPFS_API_URL=https://api.pinata.cloud/pinning/pinFileToIPFS
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
PINATA_JWT=your-pinata-jwt
```

Install and run:

```bash
cd backend
npm install
npm run dev
```

## 3. AI Service

Create `ai-service/.env` from `ai-service/.env.example`.

Required values:

```env
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5000
```

Optional upstream LLM values:

```env
AI_SUMMARY_ENDPOINT=https://your-llm-endpoint
AI_SUMMARY_API_KEY=your-api-key
AI_SUMMARY_MODEL=medical-summary
```

Install and run:

```bash
cd ai-service
npm install
npm run dev
```

## 4. Blockchain

Create `blockchain/.env` from `blockchain/.env.example`.

Required values for Amoy deployment:

```env
PRIVATE_KEY=your-wallet-private-key
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/your-key
POLYGONSCAN_API_KEY=your-polygonscan-key
```

Install, compile, and deploy:

```bash
cd blockchain
npm install
npm run compile
npm run deploy:amoy
```

After deployment:

1. Copy the deployed contract address into `backend/.env` as `HEALTH_RECORD_CONTRACT_ADDRESS`.
2. Make sure the backend relayer wallet is authorized in the contract.
3. Set `BLOCKCHAIN_MODE=contract`.

## Request Flow Summary

1. Patient uploads a PDF from the frontend.
2. Backend encrypts the file and uploads it to IPFS.
3. Backend stores the IPFS hash on-chain through the relayer-enabled contract.
4. Backend sends extracted report text to the AI service.
5. AI service returns structured JSON with summary, conditions, medications, risk flags, and medical events.
6. Frontend dashboards load records, consent logs, access state, and summaries from the backend API.
