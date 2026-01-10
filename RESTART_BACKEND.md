# Restart Backend to Enable Max AI

## The Issue:
Max AI shows: "Partner chat encountered an issue but your spreadsheet features are unaffected. Please configure ANTHROPIC_API_KEY or try again later."

## The Solution:
Your `.env` file already has the correct API keys! You just need to restart the backend server.

## Steps:

1. **Stop the current backend** (if running):
   - Press `Ctrl+C` in the terminal running `python App.py`

2. **Restart the backend**:
   ```bash
   cd C:\Users\hello\DealSniper\backend
   python App.py
   ```

3. **Verify the logs show**:
   ```
   ANTHROPIC_API_KEY exists: True
   ```

4. **Test Max AI**:
   - Upload a deal document
   - Max should automatically analyze it
   - Or type a question in the Max chat panel

## Your API Keys (Already Configured):
✅ ANTHROPIC_API_KEY=configured (in .env file)
✅ OPENAI_API_KEY=configured (in .env file)
✅ MISTRAL_API_KEY=configured (in .env file)
