# DealSniper Deployment Guide

This guide covers deploying DealSniper to **Vercel** (frontend) and **Render** (backend).

---

## 🚀 Quick Deploy

### Step 1: Deploy Backend to Render

1. **Go to [Render Dashboard](https://dashboard.render.com/)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repo:** `tylerwayne1994/DealSniper`
4. **Configure:**
   - **Name:** `dealsniper-backend`
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn App:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Starter ($7/month) or Free

5. **Add Environment Variables** (from `backend/.env`):
   ```
   MISTRAL_API_KEY=<your_mistral_api_key>
   OPENAI_API_KEY=<your_openai_api_key>
   CLAUDE_API_KEY=<your_claude_api_key>
   ANTHROPIC_API_KEY=<your_anthropic_api_key>
   PERPLEXITY_API_KEY=<your_perplexity_api_key>
   GOOGLE_CLIENT_ID=<your_google_client_id>
   GOOGLE_CLIENT_SECRET=<your_google_client_secret>
   GOOGLE_REDIRECT_URI=https://dealsniper-backend.onrender.com/auth/google/callback
   SUPABASE_URL=<your_supabase_url>
   SUPABASE_SERVICE_KEY=<your_supabase_service_key>
   FRONTEND_URL=https://dealsniper.vercel.app
   STRIPE_SECRET_KEY=<your_stripe_secret_key>
   STRIPE_PUBLISHABLE_KEY=<your_stripe_publishable_key>
   STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
   PRICE_ID_BASE=<your_stripe_base_price_id>
   PRICE_ID_PRO=<your_stripe_pro_price_id>
   PYTHON_VERSION=3.11.0
   ```

6. **Click "Create Web Service"**
7. **Wait for deployment** (~5-10 minutes)
8. **Copy your backend URL:** `https://dealsniper-backend.onrender.com`

---

### Step 2: Deploy Frontend to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "Add New..." → "Project"**
3. **Import your GitHub repo:** `tylerwayne1994/DealSniper`
4. **Configure:**
   - **Framework Preset:** Create React App
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

5. **Add Environment Variables:**
   ```
   REACT_APP_API_URL=https://dealsniper-backend.onrender.com
   REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoidHlsZXJ3YXluZTEyIiwiYSI6ImNtanl5b3RkNTZwYnMzZ3B3eHN3eGJ4OHAifQ.Jz3DXX3FplxJPTqMQSRbCA
   ```

6. **Click "Deploy"**
7. **Wait for deployment** (~2-3 minutes)
8. **Your app will be live at:** `https://dealsniper.vercel.app` (or custom domain)

---

### Step 3: Update CORS & Redirect URLs

After both are deployed, update these configurations:

#### Backend CORS (if needed)
The backend already allows all origins in `cors_config.py`, but you can restrict it:
```python
origins = [
    "https://dealsniper.vercel.app",
    "http://localhost:3000",  # For local dev
]
```

#### Google OAuth Redirect
Update in Google Cloud Console:
- Authorized redirect URIs: `https://dealsniper-backend.onrender.com/auth/google/callback`

#### Stripe Webhook
Update in Stripe Dashboard:
- Webhook endpoint: `https://dealsniper-backend.onrender.com/api/stripe/webhook`

---

## 🔧 Configuration Files Created

✅ `client/vercel.json` - Vercel deployment config
✅ `render.yaml` - Render deployment config (optional, can use dashboard)
✅ `client/.env.production` - Production environment variables
✅ `DEPLOYMENT_GUIDE.md` - This guide

---

## 📝 Post-Deployment Checklist

- [ ] Backend deployed to Render and responding
- [ ] Frontend deployed to Vercel and loading
- [ ] API calls working (check browser console)
- [ ] MapBox map displaying correctly
- [ ] Supabase authentication working
- [ ] Stripe payments working
- [ ] File uploads working (OM parsing)
- [ ] AI features working (pitch deck, market research)
- [ ] Update Google OAuth redirect URI
- [ ] Update Stripe webhook endpoint
- [ ] Set up custom domain (optional)

---

## 🐛 Troubleshooting

### CORS Errors
- Check that `FRONTEND_URL` is set correctly in Render
- Verify `cors_config.py` includes your Vercel URL

### API Not Connecting
- Check `REACT_APP_API_URL` in Vercel environment variables
- Verify backend is running on Render (check logs)

### Environment Variables Not Working
- Vercel: Must start with `REACT_APP_`
- Render: Restart service after adding env vars

### Build Failures
- **Frontend:** Check Node.js version (should be 16+)
- **Backend:** Check Python version (should be 3.11+)
- Review build logs for missing dependencies

---

## 💰 Pricing

### Vercel (Frontend)
- **Hobby:** FREE (unlimited bandwidth, 100GB)
- **Pro:** $20/month (better performance, analytics)

### Render (Backend)
- **Free:** FREE (spins down after 15 min inactivity)
- **Starter:** $7/month (always on, 512MB RAM)
- **Standard:** $25/month (better performance, 2GB RAM)

**Recommendation:** Start with Vercel Hobby + Render Starter ($7/month total)

---

## 🚀 Next Steps

1. Deploy backend to Render first
2. Get backend URL
3. Update `REACT_APP_API_URL` in Vercel
4. Deploy frontend to Vercel
5. Test all features
6. Update OAuth/Webhook URLs
7. Go live! 🎉

---

**Need help?** Check the logs:
- Render: Dashboard → Your Service → Logs
- Vercel: Dashboard → Your Project → Deployments → [Latest] → View Function Logs
