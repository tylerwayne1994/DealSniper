# Add this endpoint to App.py

@app.get("/api/get-checkout-session")
async def get_checkout_session(session_id: str):
    """Retrieve Stripe checkout session data"""
    try:
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        session = stripe.checkout.Session.retrieve(session_id)
        return {
            "metadata": session.get("metadata", {}),
            "customer_email": session.get("customer_email")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
