/* Member accounts configuration.
   Fill both values from the Supabase dashboard: Project Settings > API.
   The anon key is safe to publish: row-level security (supabase/schema.sql) is what protects data.
   Leave them empty and the site runs without accounts: modules and self-checks still work,
   scores just aren't saved, and sign-up falls back to the Substack newsletter. */
export const SUPABASE_URL = "https://pjxckmxgpwyqfshsqvrq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGNrbXhncHd5cWZzaHNxdnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3MTc4MjAsImV4cCI6MjExMTI5MzgyMH0._ILVud2bhFVNY1wUGmn7-ZItIc5c3j09NsKJzMhBFTw";

/* Fallback newsletter while accounts are off. */
export const SUBSTACK_URL = "https://getrural56done.substack.com";

/* The Field Guide calendar: modules open on the first Tuesday of their month (Central time). */
export const MODULES = [
  { n: 1,  slug: "01-wire-to-your-porch",      title: "The Wire to Your Porch",                opens: "2027-01-05", decision: "Understanding your co-op or utility before anyone asks you to vote" },
  { n: 2,  slug: "02-who-pays-for-the-substation", title: "Who Pays for the Substation?",     opens: "2027-02-02", decision: "Commenting on a large-load tariff; co-op annual meetings" },
  { n: 3,  slug: "03-why-ai-eats-power",       title: "Why AI Eats Power",                     opens: "2027-03-02", decision: "Reading an energy claim critically" },
  { n: 4,  slug: "04-the-water-question",      title: "The Water Question",                    opens: "2027-04-06", decision: "Evaluating a water-use permit or claim" },
  { n: 5,  slug: "05-noise-light-and-land",    title: "Noise, Light, and Land",                opens: "2027-05-04", decision: "Writing or reviewing a zoning ordinance" },
  { n: 6,  slug: "06-the-rural-hospital-runs-on-compute", title: "The Rural Hospital Runs on Compute", opens: "2027-06-01", decision: "Choosing AI tools and the infrastructure behind them" },
  { n: 7,  slug: "07-sun-storage-and-flexible-load", title: "Sun, Storage, and Flexible Load", opens: "2027-07-06", decision: "Valuing batteries, solar, and curtailment during summer peak" },
  { n: 8,  slug: "08-the-jobs-question",       title: "The Jobs Question",                     opens: "2027-08-03", decision: "Judging job promises; building a training pipeline" },
  { n: 9,  slug: "09-ai-on-the-farm",          title: "AI on the Farm",                        opens: "2027-09-07", decision: "Choosing precision-ag tools; edge computing in the field" },
  { n: 10, slug: "10-making-the-deal",         title: "Making the Deal",                       opens: "2027-10-05", decision: "Negotiating a community benefit agreement" },
  { n: 11, slug: "11-small-is-possible",       title: "Small Is Possible",                     opens: "2027-11-02", decision: "Pooled regional compute for public services" },
  { n: 12, slug: "12-the-three-clocks",        title: "The Three Clocks",                      opens: "2027-12-07", decision: "Writing a 12-month local plan" }
];

/* Modules with a published page, whatever the calendar says. */
export const PUBLISHED = [1, 5];
