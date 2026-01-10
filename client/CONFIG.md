# DealSniper - Configuration Files

## Deployment
- `vercel.json` - Vercel (frontend) deployment configuration
- `render.yaml` - Render (backend) deployment configuration
- `.env.production` - Production environment variables for frontend

## API Configuration
- `src/config/api.js` - Centralized API endpoint configuration

## Environment Variables

### Development (.env)
```env
REACT_APP_MAPBOX_TOKEN=your_mapbox_token
```

### Production (.env.production)
```env
REACT_APP_API_URL=https://dealsniper-backend.onrender.com
REACT_APP_MAPBOX_TOKEN=your_mapbox_token
```

## Usage in Components

Instead of hardcoding `http://localhost:8010`, import from `config/api.js`:

```javascript
import { API_ENDPOINTS } from '../config/api';

// Old way:
const response = await fetch('http://localhost:8010/api/tokens/check');

// New way:
const response = await fetch(API_ENDPOINTS.tokensCheck);
```

This automatically switches between development and production URLs based on the environment.
