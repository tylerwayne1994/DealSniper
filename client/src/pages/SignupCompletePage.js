// /signup-complete used to run its own copy of the browser-side account
// creation (supabase.auth.signUp after Stripe Checkout). That path could leave
// a paying Stripe subscriber with no Supabase login. Account creation is now
// server-side, so this route simply shares PaymentSuccessRedirect.
export { default } from './PaymentSuccessRedirect';
