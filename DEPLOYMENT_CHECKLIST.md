# 🚀 DealSniper Deployment Checklist

## ✅ Pre-Deployment Setup

### Files Created
- ✅ `client/vercel.json` - Vercel deployment config
- ✅ `render.yaml` - Render deployment config
- ✅ `client/.env.production` - Production environment variables
- ✅ `client/src/config/api.js` - Centralized API configuration
- ✅ `DEPLOYMENT_GUIDE.md` - Detailed deployment instructions

---

## 📋 Step-by-Step Deployment

### 1️⃣ Deploy Backend to Render (Do This First!)

1. Go to **[Render Dashboard](https://dashboard.render.com/)**
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repo: `tylerwayne1994/DealSniper`
4. Configure settings:
   - **Name:** `dealsniper-backend`
   - **Region:** Oregon (US West) or closest to you
   - **Branch:** `main`
   - **Root Directory:** Leave empty (or set to `backend`)
   - **Runtime:** Python 3
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && uvicorn App:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Choose **Starter ($7/month)** or Free

5. **Add Environment Variables** (copy from `backend/.env`):
   ```
   MISTRAL_API_KEY=<your_mistral_api_key>
   OPENAI_API_KEY=<your_openai_api_key>
   CLAUDE_API_KEY=<your_claude_api_key>
   ANTHROPIC_API_KEY=<your_anthropic_api_key>
   PERPLEXITY_API_KEY=<your_perplexity_api_key>
   SUPABASE_URL=<your_supabase_url>
   SUPABASE_SERVICE_KEY=<your_supabase_service_key>
   GOOGLE_CLIENT_ID=<your_google_client_id>
   GOOGLE_CLIENT_SECRET=<your_google_client_secret>
   GOOGLE_REDIRECT_URI=https://dealsniper-backend.onrender.com/auth/google/callback
   FRONTEND_URL=https://dealsniper.vercel.app
   STRIPE_SECRET_KEY=<your_stripe_secret_key>
   STRIPE_PUBLISHABLE_KEY=<your_stripe_publishable_key>
   STRIPE_WEBHOOK_SECRET=<your_stripe_webhook_secret>
   PRICE_ID_BASE=<your_stripe_base_price_id>
   PRICE_ID_PRO=<your_stripe_pro_price_id>
   PYTHON_VERSION=3.11.0
   ```

6. Click **"Create Web Service"**
7. Wait for deployment (~5-10 minutes)
8. **✅ IMPORTANT:** Copy your backend URL (e.g., `https://dealsniper-backend.onrender.com`)

---

### 2️⃣ Deploy Frontend to Vercel

1. Go to **[Vercel Dashboard](https://vercel.com/dashboard)**
2. Click **"Add New..."** → **"Project"**
3. Import GitHub repo: `tylerwayne1994/DealSniper`
4. Configure settings:
   - **Framework Preset:** Create React App
   - **Root Directory:** `client`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `build` (auto-detected)

5. **Add Environment Variables:**
   - Variable name: `REACT_APP_API_URL`
   - Value: `https://dealsniper-backend.onrender.com` (your Render URL)
   
   - Variable name: `REACT_APP_MAPBOX_TOKEN`
   - Value: `pk.eyJ1IjoidHlsZXJ3YXluZTEyIiwiYSI6ImNtanl5b3RkNTZwYnMzZ3B3eHN3eGJ4OHAifQ.Jz3DXX3FplxJPTqMQSRbCA`

6. Click **"Deploy"**
7. Wait for deployment (~2-3 minutes)
8. **Your app is live!** 🎉

---

### 3️⃣ Update External Services

#### Google OAuth
1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs:**
   - `https://dealsniper-backend.onrender.com/auth/google/callback`

#### Stripe Webhook
1. Go to **[Stripe Dashboard](https://dashboard.stripe.com/webhooks)**
2. Click **"Add endpoint"**
3. Endpoint URL: `https://dealsniper-backend.onrender.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `payment_intent.succeeded`
5. Copy the **Signing secret**
6. Update `STRIPE_WEBHOOK_SECRET` in Render environment variables

#### Supabase (Optional - if using RLS)
1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Navigate to **Authentication** → **URL Configuration**
3. Add site URL: `https://dealsniper.vercel.app`
4. Add redirect URLs: `https://dealsniper.vercel.app/*`

---

## 🧪 Testing Your Deployment

### Backend Health Check
```bash
curl https://dealsniper-backend.onrender.com/health
```
Should return: `{"status":"ok"}`

### Frontend Test
1. Open `https://dealsniper.vercel.app` (or your custom domain)
2. Check browser console for errors (F12)
3. Try uploading a deal document
4. Test authentication (sign up/login)
5. Test AI features (pitch deck, market research)

---

## 🐛 Common Issues & Fixes

### ❌ "Failed to fetch" errors
**Problem:** Frontend can't connect to backend

**Solutions:**
1. Check `REACT_APP_API_URL` in Vercel environment variables
2. Verify backend is running on Render (check logs)
3. Check CORS settings in `backend/cors_config.py`

**Fix CORS (if needed):**
```python
# backend/cors_config.py
origins = [
    "https://dealsniper.vercel.app",
    "http://localhost:3000",  # Keep for local dev
]
```

### ❌ Backend build fails
**Problem:** Missing dependencies or Python version

**Solutions:**
1. Check `requirements.txt` is in `backend/` folder
2. Verify Python version is 3.11+ (set `PYTHON_VERSION=3.11.0`)
3. Check Render logs for specific error

### ❌ Frontend build fails
**Problem:** Missing dependencies or build errors

**Solutions:**
1. Check Node.js version (should be 16+ or 18+)
2. Verify all dependencies in `package.json`
3. Check Vercel build logs for specific error

### ❌ Environment variables not working
**Problem:** Variables not being read

**Solutions:**
- **Frontend:** Must start with `REACT_APP_`
- **Backend:** Restart service after adding/changing env vars
- **Vercel:** Redeploy after adding variables

### ❌ Render free tier sleeping
**Problem:** Backend spins down after 15 min inactivity

**Solutions:**
1. Upgrade to Starter plan ($7/month) for always-on
2. Use a ping service (e.g., UptimeRobot) to keep it awake
3. Add warming endpoint: `https://dealsniper-backend.onrender.com/health`

---

## 💰 Cost Breakdown

### Monthly Costs

| Service | Plan | Cost | Features |
|---------|------|------|----------|
| **Vercel** | Hobby | **FREE** | Unlimited bandwidth, 100GB, SSL |
| **Render** | Free | **FREE** | Sleeps after 15min, 750hrs/month |
| **Render** | Starter | **$7** | Always on, 512MB RAM |
| **Supabase** | Free | **FREE** | 500MB database, 50k MAU |
| **MapBox** | Free | **FREE** | 50k map loads/month |

**Recommended Setup:** 
- Start: Vercel Free + Render Free = **$0/month**
- Production: Vercel Free + Render Starter = **$7/month**

---

## 🔒 Security Checklist

- [ ] All API keys stored in environment variables (not in code)
- [ ] `.env` files added to `.gitignore`
- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] CORS properly configured
- [ ] Supabase RLS policies enabled
- [ ] Stripe webhook signature verification enabled
- [ ] Rate limiting enabled (if needed)

---

## 📊 Monitoring

### Render Logs
- Dashboard → Your Service → **Logs**
- Monitor for errors, API calls, performance

### Vercel Analytics
- Dashboard → Your Project → **Analytics**
- Monitor traffic, performance, errors

### Uptime Monitoring (Free)
Use **[UptimeRobot](https://uptimerobot.com/)** to:
- Monitor backend uptime
- Keep Render free tier awake
- Get alerts for downtime

---

## 🎯 Next Steps After Deployment

1. **Custom Domain (Optional)**
   - Vercel: Add custom domain in project settings
   - Update `FRONTEND_URL` in Render

2. **SSL Certificate**
   - Automatic on Vercel
   - Automatic on Render

3. **Database Backups**
   - Supabase: Enable automatic backups in dashboard

4. **Performance Optimization**
   - Enable Vercel Edge Caching
   - Add CDN for static assets
   - Monitor API response times

5. **User Testing**
   - Test all features in production
   - Monitor error logs
   - Collect user feedback

---

## 🆘 Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Render Docs:** https://render.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **React Deployment:** https://create-react-app.dev/docs/deployment/

---

## ✅ Final Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set correctly
- [ ] CORS configured for production
- [ ] Google OAuth redirect updated
- [ ] Stripe webhook endpoint updated
- [ ] Supabase URLs updated (if using RLS)
- [ ] Health check endpoint responding
- [ ] Frontend loading without errors
- [ ] API calls working in production
- [ ] Authentication working
- [ ] File uploads working
- [ ] AI features working (pitch deck, market research)
- [ ] Stripe payments working
- [ ] MapBox map displaying

---

## 🚀 You're Live!

Your DealSniper app is now deployed and accessible worldwide! 

- **Frontend:** `https://dealsniper.vercel.app`
- **Backend:** `https://dealsniper-backend.onrender.com`

Share your app with users and start analyzing deals! 💼📈
